import { canPerformHandover, targetStatusForHandover, type HandoverAction } from '@clickdrive/shared/booking-state-machine';
import { normalizeBookingStatus } from '@clickdrive/shared/booking-status';
import { Booking, BookingStatus, VehicleStatus } from '@/types';
import { isUuid } from '@/lib/availability/status';
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

/** Réservation lue pour un état des lieux (colonnes explicites) */
type HandoverBookingRow = {
  id: string;
  reference: string | null;
  booking_ref: string | null;
  vehicle_id: string | null;
  agency_id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_price: number | string | null;
  deposit_amount: number | string | null;
  start_date: string;
  end_date: string;
  vehicle:
    | { id: string; brand: string; model: string; year: number; status: string; mileage: number | null }
    | { id: string; brand: string; model: string; year: number; status: string; mileage: number | null }[]
    | null;
};

/** Statuts pour lesquels un rendez-vous de remise peut être organisé */
const SCHEDULABLE_STATUSES = new Set(['APPROVED', 'READY_FOR_PICKUP']);

export interface HandoverValidationResult {
  success: boolean;
  /** Réservation introuvable pour cette agence (404) */
  notFound?: boolean;
  /** Transition refusée par la machine à états ou modifiée entre-temps (409) */
  transitionConflict?: boolean;
  /** Données d'état des lieux incohérentes (422) */
  invalidInput?: boolean;
  /** Base indisponible (503) */
  serviceUnavailable?: boolean;
  /** Écritures secondaires en échec après une transition enregistrée */
  warnings?: string[];
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

      if (bErr) {
        console.error('[DeliveryService] Booking lookup failed:', bErr.message);
        return { success: false, error: 'La réservation ne peut pas être vérifiée pour le moment.' };
      }
      if (!booking) {
        return { success: false, error: 'Réservation introuvable pour cette agence.' };
      }
      if (!SCHEDULABLE_STATUSES.has(normalizeBookingStatus(String(booking.status)))) {
        return { success: false, error: 'Un rendez-vous ne peut être organisé que pour une réservation validée par l’agence.' };
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
        .eq('id', input.bookingId)
        .eq('agency_id', input.agencyId);

      if (updErr) {
        console.error('[DeliveryService] Meeting not saved:', updErr.message);
        return { success: false, error: 'Le rendez-vous n’a pas pu être enregistré. Réessayez dans un instant.' };
      }

      // Enregistrer l'événement d'audit dans la timeline
      const { error: meetingEventError } = await supabase.from('booking_events').insert({
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
      if (meetingEventError) console.error('[DeliveryService] Meeting event not recorded:', meetingEventError.message);

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
      console.error('[DeliveryService] Meeting scheduling failed:', err instanceof Error ? err.message : err);
      return { success: false, error: 'Le rendez-vous n’a pas pu être enregistré. Réessayez dans un instant.' };
    }
  }

  /**
   * 2. Enregistrer l'état des lieux et valider la remise du véhicule (Handover Execution)
   * Gère à la fois le DÉPART (PICKUP) et le RETOUR (RETURN).
   *
   * Règles :
   * - transition validée par la machine à états partagée : remise depuis APPROVED / READY_FOR_PICKUP
   *   (CONFIRMED historique inclus), restitution depuis ACTIVE seulement ;
   * - écriture gardée par l'agence et par le statut lu : une remise concurrente ou une décision prise
   *   entre-temps donne un conflit, jamais une double transition ;
   * - chaque écriture est vérifiée ; une écriture secondaire en échec (véhicule, journal) est signalée
   *   dans `warnings`, jamais masquée ; aucun détail technique n'est renvoyé.
   * La permission (bookings.manage sur l'agence) est vérifiée par la route appelante.
   */
  public async validateHandover(input: HandoverInspectionInput): Promise<HandoverValidationResult> {
    if (!Number.isFinite(input.mileage) || input.mileage < 0) {
      return { success: false, error: 'Le kilométrage doit être positif.', invalidInput: true };
    }
    if (input.depositDeduction !== undefined && (!Number.isFinite(input.depositDeduction) || input.depositDeduction < 0)) {
      return { success: false, error: 'La retenue sur caution doit être positive.', invalidInput: true };
    }
    if (!isUuid(input.bookingId) || !isUuid(input.agencyId)) {
      return { success: false, error: 'Réservation introuvable pour cette agence.', notFound: true };
    }

    const supabase = await createAdminClient();
    if (!supabase) {
      return { success: false, error: 'Service de base de données indisponible.', serviceUnavailable: true };
    }

    const action: HandoverAction = input.type === 'PICKUP' ? 'pickup' : 'return';
    const isPickup = action === 'pickup';

    try {
      // 1. Réservation de l'agence et véhicule associé (colonnes explicites)
      const { data: bookingRow, error: bErr } = await supabase
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

      if (bErr) {
        console.error('[DeliveryService] Booking lookup failed:', bErr.message);
        return { success: false, error: 'La réservation ne peut pas être vérifiée pour le moment.', serviceUnavailable: true };
      }
      if (!bookingRow) {
        return { success: false, error: 'Réservation introuvable pour cette agence.', notFound: true };
      }

      const booking = bookingRow as unknown as HandoverBookingRow;
      const vehicle = Array.isArray(booking.vehicle) ? booking.vehicle[0] ?? null : booking.vehicle;

      // 2. Machine à états : aucune remise d'une demande non validée, refusée, annulée ou terminée
      if (!canPerformHandover(booking.status, action)) {
        return {
          success: false,
          error: isPickup
            ? 'La remise du véhicule n’est possible que pour une réservation validée par l’agence et pas encore commencée.'
            : 'La restitution n’est possible que pour une location en cours.',
          transitionConflict: true,
        };
      }

      let distanceDrivenKm: number | undefined;
      if (!isPickup) {
        const startMileage = typeof vehicle?.mileage === 'number' ? vehicle.mileage : null;
        if (startMileage !== null && input.mileage < startMileage) {
          return {
            success: false,
            error: `Le kilométrage de retour (${input.mileage} km) ne peut pas être inférieur au kilométrage de départ (${startMileage} km).`,
            invalidInput: true,
          };
        }
        if (startMileage !== null) distanceDrivenKm = input.mileage - startMileage;

        const deposit = Number(booking.deposit_amount ?? 0);
        if ((input.depositDeduction ?? 0) > deposit) {
          return { success: false, error: 'La retenue ne peut pas dépasser le montant de la caution.', invalidInput: true };
        }
      }

      const nextBookingStatus = targetStatusForHandover(action) as BookingStatus;
      // Si dégâts déclarés au retour, le véhicule passe en maintenance pour inspection
      const nextVehicleStatus: VehicleStatus = isPickup ? 'RENTED' : input.damagesDescription ? 'MAINTENANCE' : 'AVAILABLE';
      const nowIso = new Date().toISOString();
      const warnings: string[] = [];

      // 3. Transition gardée (agence + statut lu) : une seule remise / restitution possible
      const { data: transitioned, error: bkUpdErr } = await supabase
        .from('bookings')
        .update(
          isPickup
            ? { status: nextBookingStatus, reviewed_at: nowIso, updated_at: nowIso }
            : { status: nextBookingStatus, completed_at: nowIso, updated_at: nowIso }
        )
        .eq('id', booking.id)
        .eq('agency_id', input.agencyId)
        .eq('status', booking.status)
        .select('id')
        .maybeSingle();

      if (bkUpdErr) {
        console.error('[DeliveryService] Booking transition failed:', bkUpdErr.code, bkUpdErr.message);
        if (bkUpdErr.code === '23P01') {
          return {
            success: false,
            error: 'Une autre location confirmée occupe déjà ce véhicule sur ces dates.',
            transitionConflict: true,
          };
        }
        return { success: false, error: 'L’état des lieux n’a pas pu être enregistré. Réessayez dans un instant.' };
      }
      if (!transitioned) {
        return {
          success: false,
          error: 'Cette réservation a été modifiée entre-temps. Actualisez la page avant de recommencer.',
          transitionConflict: true,
        };
      }

      // 4. Statut et compteur du véhicule (bornés à l'agence)
      if (booking.vehicle_id) {
        const { error: vehicleError } = await supabase
          .from('vehicles')
          .update({ status: nextVehicleStatus, mileage: input.mileage, updated_at: nowIso })
          .eq('id', booking.vehicle_id)
          .eq('agency_id', input.agencyId);
        if (vehicleError) {
          console.error('[DeliveryService] Vehicle not updated after handover:', vehicleError.message);
          warnings.push('vehicle_not_updated');
        }
      }

      // 5. État des lieux dans la timeline et journal d'audit
      const { error: eventError } = await supabase.from('booking_events').insert({
        booking_id: booking.id,
        actor_id: input.actorId || null,
        actor_role: input.actorRole || 'AGENCY_MANAGER',
        event_type: isPickup ? 'HANDOVER_PICKUP_COMPLETED' : 'HANDOVER_RETURN_COMPLETED',
        metadata: isPickup
          ? {
              mileage: input.mileage,
              fuelLevel: input.fuelLevel,
              cleanliness: input.cleanliness,
              checklist: input.checklist,
              damagesDescription: input.damagesDescription || null,
              photosCount: input.photos?.length || 0,
              notes: input.notes || null,
              recordedAt: nowIso,
            }
          : {
              mileage: input.mileage,
              distanceDrivenKm: distanceDrivenKm ?? null,
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
      if (eventError) {
        console.error('[DeliveryService] Handover event not recorded:', eventError.message);
        warnings.push('event_not_recorded');
      }

      const { error: auditError } = await supabase.from('audit_logs').insert({
        action: isPickup ? 'VEHICLE_HANDOVER_PICKUP' : 'VEHICLE_HANDOVER_RETURN',
        entity_type: 'booking',
        entity_id: booking.id,
        agency_id: input.agencyId,
        metadata: isPickup
          ? { vehicleId: booking.vehicle_id, mileage: input.mileage, fuelLevel: input.fuelLevel }
          : {
              vehicleId: booking.vehicle_id,
              mileage: input.mileage,
              depositReturned: input.depositReturned !== false,
              depositDeduction: input.depositDeduction || 0,
            },
      });
      if (auditError) {
        console.error('[DeliveryService] Handover audit log not recorded:', auditError.message);
        warnings.push('audit_not_recorded');
      }

      // 6. Notification WhatsApp de synthèse au client (seulement après une transition enregistrée)
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
        bookingId: booking.id,
        type: input.type,
        bookingStatus: nextBookingStatus,
        vehicleStatus: nextVehicleStatus,
        mileage: input.mileage,
        distanceDrivenKm,
        whatsappSent,
        whatsappMessageId,
        warnings,
      };
    } catch (err: unknown) {
      console.error('[DeliveryService] Handover failed:', err instanceof Error ? err.message : err);
      return { success: false, error: 'L’état des lieux n’a pas pu être enregistré. Réessayez dans un instant.' };
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
        .in('status', ['APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP']),
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
