import { Booking, BookingStatus, VehicleStatus } from '@/types';
import { createAdminClient } from '@/lib/supabase/server';
import { getMeetingPoint } from '@/lib/constants/meetingPoints';
import { whatsappService } from './whatsapp.service';

/**
 * ========================================================================
 * Service Delivery & Remise de Véhicule — ClickDrive
 * Gère l'organisation des rendez-vous de livraison (Aéroport, Port, Agence),
 * l'enregistrement digital de l'état des lieux (checklists, kilométrage, carburant)
 * et la validation sécurisée du départ et de la restitution.
 * ========================================================================
 */

export interface MeetingScheduleInput {
  bookingId: string;
  agencyId: string;
  meetingPointId: string;
  customAddress?: string;
  scheduledAt: string; // ISO ou format lisible (ex: "2026-10-20 14:30")
  flightNumber?: string;
  flightArrivalTime?: string;
  agentName?: string;
  agentPhone?: string;
  instructions?: string;
  sendWhatsAppNotification?: boolean;
}

export interface DeliveryScheduleResult {
  success: boolean;
  bookingId?: string;
  meetingPointName?: string;
  scheduledAt?: string;
  whatsappMessageId?: string;
  error?: string;
}

export interface HandoverChecklist {
  spareTire: boolean;
  jack: boolean;
  registrationDoc: boolean;
  insuranceDoc: boolean;
  safetyKit: boolean;
}

export interface HandoverInspectionInput {
  bookingId: string;
  agencyId: string;
  type: 'PICKUP' | 'RETURN';
  actorId?: string;
  actorRole?: 'AGENCY_OWNER' | 'AGENCY_MANAGER' | 'AGENCY_STAFF';
  mileage: number;
  fuelLevel: 'EMPTY' | '1/4' | '1/2' | '3/4' | 'FULL';
  cleanliness: 'CLEAN' | 'NORMAL' | 'DIRTY';
  checklist: HandoverChecklist;
  damagesDescription?: string;
  photos?: string[];
  notes?: string;
  // Spécifique restitution (RETURN)
  depositReturned?: boolean;
  depositDeduction?: number;
  deductionReason?: string;
  sendWhatsAppNotification?: boolean;
}

export interface HandoverValidationResult {
  success: boolean;
  bookingId?: string;
  type?: 'PICKUP' | 'RETURN';
  bookingStatus?: BookingStatus;
  vehicleStatus?: VehicleStatus;
  mileage?: number;
  distanceDrivenKm?: number;
  whatsappSent?: boolean;
  whatsappMessageId?: string;
  error?: string;
}

export class DeliveryService {
  /**
   * 1. Organiser le rendez-vous de remise du véhicule (Meeting Scheduling)
   * Enregistre le point de rencontre, les détails du vol, l'agent affecté et notifie le client via WhatsApp.
   */
  public async scheduleMeeting(input: MeetingScheduleInput): Promise<DeliveryScheduleResult> {
    const supabase = await createAdminClient();
    if (!supabase) {
      return { success: false, error: 'Service de base de données indisponible.' };
    }

    try {
      // Vérifier la réservation
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, reference, customer_name, customer_phone, agency_id, status, start_date, end_date')
        .eq('id', input.bookingId)
        .eq('agency_id', input.agencyId)
        .maybeSingle();

      if (bErr || !booking) {
        return { success: false, error: 'Réservation introuvable pour cette agence.' };
      }

      // Identifier le point de rendez-vous
      const meetingPoint = getMeetingPoint(input.meetingPointId);
      const meetingName = meetingPoint?.name || input.customAddress || 'Point de rendez-vous convenu';
      const instructions = input.instructions || meetingPoint?.instructions || '';

      const nowIso = new Date().toISOString();

      // Mettre à jour la réservation
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          pickup_location: meetingName,
          delivery_type: meetingPoint?.type || 'AGENCY_PICKUP',
          flight_number: input.flightNumber || null,
          flight_arrival_time: input.flightArrivalTime || null,
          agency_notes: input.agentName
            ? `Agent assigné: ${input.agentName} (${input.agentPhone || ''}). ${input.instructions || ''}`.trim()
            : input.instructions || null,
          updated_at: nowIso,
        })
        .eq('id', input.bookingId);

      if (updErr) {
        return { success: false, error: `Erreur enregistrement rendez-vous: ${updErr.message}` };
      }

      // Enregistrer l'événement d'audit dans la timeline
      await supabase.from('booking_events').insert({
        booking_id: input.bookingId,
        actor_role: 'AGENCY_MANAGER',
        event_type: 'DELIVERY_SCHEDULED',
        metadata: {
          meetingPointId: input.meetingPointId,
          meetingName,
          scheduledAt: input.scheduledAt,
          flightNumber: input.flightNumber,
          flightArrivalTime: input.flightArrivalTime,
          agentName: input.agentName,
          agentPhone: input.agentPhone,
        },
      });

      // Notification WhatsApp automatique
      let whatsappMessageId: string | undefined;
      if (input.sendWhatsAppNotification !== false && booking.customer_phone) {
        const waRes = await whatsappService.sendDeliveryMeetingInvite(booking as Booking, {
          meetingPoint: meetingName,
          scheduledAt: input.scheduledAt,
          flightNumber: input.flightNumber,
          agentName: input.agentName,
          agentPhone: input.agentPhone,
          instructions,
        });
        if (waRes.success) {
          whatsappMessageId = waRes.messageId;
        }
      }

      return {
        success: true,
        bookingId: input.bookingId,
        meetingPointName: meetingName,
        scheduledAt: input.scheduledAt,
        whatsappMessageId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue lors de la planification du rendez-vous';
      return { success: false, error: msg };
    }
  }

  /**
   * 2. Enregistrer l'état des lieux et valider la remise du véhicule (Handover Execution)
   * Gère à la fois le DÉPART (PICKUP) et le RETOUR (RETURN).
   */
  public async validateHandover(input: HandoverInspectionInput): Promise<HandoverValidationResult> {
    if (input.mileage < 0) {
      return { success: false, error: 'Le kilométrage doit être positif.' };
    }

    const supabase = await createAdminClient();
    if (!supabase) {
      return { success: false, error: 'Service de base de données indisponible.' };
    }

    try {
      // 1. Récupérer la réservation et le véhicule associé
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select(`
          id, reference, booking_ref, vehicle_id, agency_id, status,
          customer_name, customer_phone, total_price, deposit_amount,
          start_date, end_date,
          vehicle:vehicles (
            id, brand, model, year, status, mileage
          )
        `)
        .eq('id', input.bookingId)
        .eq('agency_id', input.agencyId)
        .maybeSingle();

      if (bErr || !booking) {
        return { success: false, error: 'Réservation introuvable pour cette agence.' };
      }

      const vehicle = Array.isArray(booking.vehicle) ? booking.vehicle[0] : booking.vehicle;
      const nowIso = new Date().toISOString();
      const isPickup = input.type === 'PICKUP';

      let nextBookingStatus: BookingStatus;
      let nextVehicleStatus: VehicleStatus;
      let distanceDrivenKm: number | undefined;

      // ----------------------------------------------------------------------
      // SCÉNARIO A : REMISE INITIALE DU VÉHICULE (DÉPART / PICKUP)
      // ----------------------------------------------------------------------
      if (isPickup) {
        nextBookingStatus = 'ACTIVE';
        nextVehicleStatus = 'RENTED';

        // Mise à jour de la réservation
        const { error: bkUpdErr } = await supabase
          .from('bookings')
          .update({
            status: nextBookingStatus,
            reviewed_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', input.bookingId);

        if (bkUpdErr) {
          return { success: false, error: `Erreur mise à jour statut réservation: ${bkUpdErr.message}` };
        }

        // Mise à jour du statut et du compteur du véhicule
        if (booking.vehicle_id) {
          await supabase
            .from('vehicles')
            .update({
              status: nextVehicleStatus,
              mileage: input.mileage,
              updated_at: nowIso,
            })
            .eq('id', booking.vehicle_id);
        }

        // Enregistrement de l'état des lieux dans la timeline
        await supabase.from('booking_events').insert({
          booking_id: input.bookingId,
          actor_id: input.actorId || null,
          actor_role: input.actorRole || 'AGENCY_MANAGER',
          event_type: 'HANDOVER_PICKUP_COMPLETED',
          metadata: {
            mileage: input.mileage,
            fuelLevel: input.fuelLevel,
            cleanliness: input.cleanliness,
            checklist: input.checklist,
            damagesDescription: input.damagesDescription || null,
            photosCount: input.photos?.length || 0,
            notes: input.notes || null,
            recordedAt: nowIso,
          },
        });

        // Audit log officiel
        await supabase.from('audit_logs').insert({
          action: 'VEHICLE_HANDOVER_PICKUP',
          entity_type: 'booking',
          entity_id: input.bookingId,
          agency_id: input.agencyId,
          metadata: {
            vehicleId: booking.vehicle_id,
            mileage: input.mileage,
            fuelLevel: input.fuelLevel,
          },
        });
      }
      // ----------------------------------------------------------------------
      // SCÉNARIO B : RESTITUTION DU VÉHICULE (RETOUR / RETURN)
      // ----------------------------------------------------------------------
      else {
        nextBookingStatus = 'COMPLETED';
        // Si dégâts déclarés lors du retour, le véhicule est envoyé en maintenance pour inspection
        nextVehicleStatus = input.damagesDescription ? 'MAINTENANCE' : 'AVAILABLE';

        // Calculer la distance parcourue si le kilométrage de départ était enregistré
        if (vehicle?.mileage && input.mileage >= vehicle.mileage) {
          distanceDrivenKm = input.mileage - vehicle.mileage;
        }

        // Mise à jour de la réservation en statut terminé
        const { error: bkUpdErr } = await supabase
          .from('bookings')
          .update({
            status: nextBookingStatus,
            completed_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', input.bookingId);

        if (bkUpdErr) {
          return { success: false, error: `Erreur finalisation restitution: ${bkUpdErr.message}` };
        }

        // Libération du véhicule et mise à jour de son compteur
        if (booking.vehicle_id) {
          await supabase
            .from('vehicles')
            .update({
              status: nextVehicleStatus,
              mileage: input.mileage,
              updated_at: nowIso,
            })
            .eq('id', booking.vehicle_id);
        }

        // Enregistrement de l'état des lieux de retour
        await supabase.from('booking_events').insert({
          booking_id: input.bookingId,
          actor_id: input.actorId || null,
          actor_role: input.actorRole || 'AGENCY_MANAGER',
          event_type: 'HANDOVER_RETURN_COMPLETED',
          metadata: {
            mileage: input.mileage,
            distanceDrivenKm: distanceDrivenKm || null,
            fuelLevel: input.fuelLevel,
            cleanliness: input.cleanliness,
            checklist: input.checklist,
            damagesDescription: input.damagesDescription || null,
            depositReturned: input.depositReturned !== false,
            depositDeduction: input.depositDeduction || 0,
            deductionReason: input.deductionReason || null,
            recordedAt: nowIso,
          },
        });

        // Audit log officiel
        await supabase.from('audit_logs').insert({
          action: 'VEHICLE_HANDOVER_RETURN',
          entity_type: 'booking',
          entity_id: input.bookingId,
          agency_id: input.agencyId,
          metadata: {
            vehicleId: booking.vehicle_id,
            mileage: input.mileage,
            depositReturned: input.depositReturned !== false,
            depositDeduction: input.depositDeduction || 0,
          },
        });
      }

      // Notification WhatsApp de synthèse au client
      let whatsappSent = false;
      let whatsappMessageId: string | undefined;

      if (input.sendWhatsAppNotification !== false && booking.customer_phone) {
        const depositText = !isPickup
          ? input.depositReturned !== false
            ? 'Restituée intégralement'
            : `Retenue: ${input.depositDeduction || 0} MAD (${input.deductionReason || 'Dégâts'})`
          : undefined;

        const waRes = await whatsappService.sendHandoverSummary(booking as unknown as Booking, {
          type: input.type,
          mileage: input.mileage,
          fuelLevel: input.fuelLevel,
          cleanliness: input.cleanliness,
          damages: input.damagesDescription,
          depositStatus: depositText,
        });

        whatsappSent = waRes.success;
        whatsappMessageId = waRes.messageId;
      }

      return {
        success: true,
        bookingId: input.bookingId,
        type: input.type,
        bookingStatus: nextBookingStatus,
        vehicleStatus: nextVehicleStatus,
        mileage: input.mileage,
        distanceDrivenKm,
        whatsappSent,
        whatsappMessageId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la validation de la remise';
      return { success: false, error: msg };
    }
  }

  /**
   * 3. Récupère l'historique complet des états des lieux d'une réservation
   */
  public async getHandoverHistory(bookingId: string) {
    const supabase = await createAdminClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from('booking_events')
      .select('*')
      .eq('booking_id', bookingId)
      .in('event_type', ['DELIVERY_SCHEDULED', 'HANDOVER_PICKUP_COMPLETED', 'HANDOVER_RETURN_COMPLETED'])
      .order('created_at', { ascending: true });

    return data || [];
  }

  /**
   * 4. Liste les départs et retours prévus pour une agence
   */
  public async listUpcomingDeliveries(agencyId: string, targetDate?: string) {
    const supabase = await createAdminClient();
    if (!supabase) return { departures: [], returns: [] };

    const date = targetDate || new Date().toISOString().slice(0, 10);

    const [depRes, retRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, vehicle:vehicles(brand, model, license_plate)')
        .eq('agency_id', agencyId)
        .eq('start_date', date)
        .in('status', ['CONFIRMED', 'PENDING']),
      supabase
        .from('bookings')
        .select('*, vehicle:vehicles(brand, model, license_plate)')
        .eq('agency_id', agencyId)
        .eq('end_date', date)
        .eq('status', 'ACTIVE'),
    ]);

    return {
      departures: depRes.data || [],
      returns: retRes.data || [],
    };
  }
}

export const deliveryService = new DeliveryService();
