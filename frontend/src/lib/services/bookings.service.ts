import { createHash } from 'node:crypto';
import { canPerformAgencyBookingAction } from '@clickdrive/shared/booking-state-machine';
import { Booking, BookingStatus, BookingEvent, BookingEventType } from '@/types';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { bookingRequestSchema, BookingRequestInput } from '@/lib/validations/booking';
import { calculateRentalDays, calculateRentalPrice } from '@/lib/utils/pricing';
import { generateBookingReference, isValidBookingReference } from '@/lib/utils/reference';
import { commissionService } from './commission.service';
import { vehiclesService } from './vehicles.service';
import type { AvailabilityStatus } from '@/lib/availability/status';

/* -------------------------------------------------------------------------- */
/* Colonnes sélectionnées                                                     */
/* -------------------------------------------------------------------------- */

const BOOKING_READ_COLUMNS = [
  'id',
  'booking_ref',
  'reference',
  'vehicle_id',
  'agency_id',
  'customer_id',
  'start_date',
  'end_date',
  'rental_period',
  'pickup_time',
  'dropoff_time',
  'total_days',
  'daily_price',
  'total_price',
  'commission_rate',
  'commission_amount',
  'agency_amount',
  'deposit_amount',
  'status',
  'created_at',
  'updated_at',
  'agency_status',
  'commission_status',
  'requested_at',
  'reviewed_at',
  'confirmed_at',
  'completed_at',
  'cancelled_at',
  'pdf_url',
  'delivery_type',
  'child_seat',
  'additional_driver',
].join(', ');

const BOOKING_CUSTOMER_COLUMNS = [
  'first_name',
  'last_name',
  'customer_name',
  'customer_email',
  'customer_phone',
  'cin',
  'customer_country',
  'birth_date',
  'license_number',
  'license_expiry',
  'customer_notes',
  'flight_number',
  'flight_arrival_time',
  'pickup_location',
  'dropoff_location',
  'notes',
].join(', ');

/* -------------------------------------------------------------------------- */
/* Types internes                                                              */
/* -------------------------------------------------------------------------- */

type BookingRequestResult = {
  success: boolean;
  booking?: Booking;
  error?: string;
  idempotentReplay?: boolean;
  idempotencyConflict?: boolean;
  availabilityConflict?: boolean;
  serviceUnavailable?: boolean;
};

type AdminSupabaseClient = NonNullable<Awaited<ReturnType<typeof createAdminClient>>>;
type IdempotentBookingRecord = Booking & {
  idempotency_key: string;
  idempotency_fingerprint: string;
};

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function requireSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith('http')) {
    throw new Error(
      'Supabase non configuré. Définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
}

function bookingWithoutIdempotencyFields(data: IdempotentBookingRecord): Booking {
  const {
    idempotency_key: idempotencyKey,
    idempotency_fingerprint: idempotencyFingerprint,
    ...booking
  } = data;
  if (!idempotencyKey || !idempotencyFingerprint) {
    throw new Error('Les données d\'idempotence de la réservation sont incomplètes.');
  }
  return booking;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export class BookingsService {
  /**
   * Disponibilité d'un véhicule pour une plage de dates (AVAILABLE / UNAVAILABLE / UNKNOWN).
   * UNKNOWN n'est jamais traité comme une disponibilité.
   */
  async getAvailabilityStatus(
    vehicleId: string,
    startDate: string,
    endDate: string
  ): Promise<AvailabilityStatus> {
    requireSupabase();
    return vehiclesService.getAvailabilityStatus(vehicleId, startDate, endDate);
  }

  /**
   * Récupère une réservation par sa référence unique (ex: CD-2026-001842)
   */
  async getBookingByReference(
    reference: string,
    includeCustomerData = false
  ): Promise<Booking | null> {
    requireSupabase();
    const cleanRef = reference.trim();
    // Format strict avant interpolation dans le filtre PostgREST `.or(...)` (anti-injection).
    if (!isValidBookingReference(cleanRef)) return null;

    const supabase = includeCustomerData
      ? await createAdminClient()
      : await createClient();

    if (includeCustomerData && !supabase) {
      throw new Error('Lecture sécurisée des données client indisponible.');
    }
    if (!supabase) throw new Error('Client Supabase indisponible.');

    const { data, error } = await supabase
      .from('bookings')
      .select(
        `${BOOKING_READ_COLUMNS}${includeCustomerData ? `, ${BOOKING_CUSTOMER_COLUMNS}` : ''}, vehicle:vehicles(*), agency:agencies(*)`
      )
      .or(`reference.eq.${cleanRef},booking_ref.eq.${cleanRef}`)
      .maybeSingle();

    if (error) {
      console.error('[BookingsService] Booking lookup failed:', error.message);
      throw new Error('Impossible de charger la réservation.');
    }
    return (data as unknown as Booking) ?? null;
  }

  /**
   * Récupère les réservations (avec filtre optionnel d'agence ou de client)
   */
  async getBookings(
    filters?: {
      agencyId?: string;
      customerId?: string;
      customerEmail?: string;
      status?: BookingStatus;
    },
    includeCustomerData = false
  ): Promise<Booking[]> {
    requireSupabase();
    const supabase = includeCustomerData
      ? await createAdminClient()
      : await createClient();

    if (includeCustomerData && !supabase) {
      throw new Error('Lecture sécurisée des données client indisponible.');
    }
    if (!supabase) throw new Error('Client Supabase indisponible.');

    let query = supabase
      .from('bookings')
      .select(
        `${BOOKING_READ_COLUMNS}${includeCustomerData ? `, ${BOOKING_CUSTOMER_COLUMNS}` : ''}, vehicle:vehicles(*), agency:agencies(*), events:booking_events(id, booking_id, actor_role, event_type, created_at)`
      );

    if (filters?.agencyId) {
      query = query.eq('agency_id', filters.agencyId);
    }
    if (filters?.customerId && filters?.customerEmail) {
      query = query.or(`customer_id.eq.${filters.customerId},customer_email.eq.${filters.customerEmail}`);
    } else if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    } else if (filters?.customerEmail) {
      query = query.eq('customer_email', filters.customerEmail);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('[BookingsService] Booking list failed:', error.message);
      throw new Error('Impossible de charger les réservations.');
    }
    return (data ?? []) as unknown as Booking[];
  }

  /**
   * Création d'une nouvelle demande de réservation par un client.
   * RÈGLES CRITIQUES :
   * 1. La demande n'est PAS une réservation instantanée.
   * 2. Le prix et la commission sont STRICTEMENT calculés côté serveur.
   * 3. Le taux de commission actuel de la plateforme est sauvegardé dans la réservation.
   * 4. La commission initiale est à statut 'PENDING'.
   * 5. Un événement 'REQUEST_CREATED' est journalisé dans booking_events.
   */
  async createBookingRequest(
    rawInput: BookingRequestInput,
    customerId?: string,
    idempotencyKey?: string
  ): Promise<BookingRequestResult> {
    requireSupabase();

    const validation = bookingRequestSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(', '),
      };
    }

    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return {
        success: false,
        error: 'Une clé Idempotency-Key UUID valide est requise.',
      };
    }

    const input = validation.data;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ customerId: customerId ?? null, input }))
      .digest('hex');

    return this.createValidatedBookingRequest(input, customerId, idempotencyKey, fingerprint);
  }

  private async findIdempotentBooking(
    supabase: AdminSupabaseClient,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<BookingRequestResult | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, vehicle:vehicles(*), agency:agencies(*)')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) {
      console.error('[BookingsService] Idempotency lookup failed:', error);
      return {
        success: false,
        error: 'Impossible de vérifier si cette demande a déjà été enregistrée.',
        serviceUnavailable: true,
      };
    }
    if (!data) return null;

    const record = data as unknown as IdempotentBookingRecord;
    if (record.idempotency_fingerprint !== fingerprint) {
      return {
        success: false,
        error: 'Cette clé Idempotency-Key a déjà été utilisée avec une autre demande.',
        idempotencyConflict: true,
      };
    }

    return {
      success: true,
      booking: bookingWithoutIdempotencyFields(record),
      idempotentReplay: true,
    };
  }

  private async createValidatedBookingRequest(
    input: BookingRequestInput,
    customerId: string | undefined,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<BookingRequestResult> {
    const supabase = await createAdminClient();
    if (!supabase) {
      return {
        success: false,
        error: 'Le service sécurisé de réservation est indisponible. Vérifiez SUPABASE_SERVICE_ROLE_KEY.',
        serviceUnavailable: true,
      };
    }

    // 1. Vérification idempotence
    const existing = await this.findIdempotentBooking(supabase, idempotencyKey, fingerprint);
    if (existing) return existing;

    // 2. Récupération du véhicule et validation de l'agence depuis la source serveur.
    const vehicle = await vehiclesService.getVehicleById(input.vehicleId);
    if (!vehicle || !vehicle.published || vehicle.agency_id !== input.agencyId) {
      return {
        success: false,
        error: 'Le véhicule demandé est introuvable ou indisponible.',
      };
    }

    // 3. Vérification réelle (fail-closed) ; l'approbation est ensuite arbitrée par la contrainte SQL
    //    no_overlapping_confirmed_bookings. Une disponibilité non vérifiable bloque la demande.
    const availability = await this.getAvailabilityStatus(input.vehicleId, input.startDate, input.endDate);
    if (availability === 'UNKNOWN') {
      return {
        success: false,
        error: 'La disponibilité de ce véhicule ne peut pas être vérifiée pour le moment. Votre demande n\'a pas été envoyée : réessayez dans quelques instants.',
        serviceUnavailable: true,
      };
    }
    if (availability === 'UNAVAILABLE') {
      return {
        success: false,
        error: 'Ce véhicule n\'est plus disponible pour les dates sélectionnées. Veuillez choisir d\'autres dates ou explorer les véhicules équivalents.',
        availabilityConflict: true,
      };
    }

    // 4. Calcul financier certifié côté serveur
    const totalDays = calculateRentalDays(input.startDate, input.endDate);
    const platformCommissionRate = await commissionService.getCommissionRate();
    // Tarif semaine ou mois de l'agence appliqué dès 7 ou 30 jours (même calcul que l'estimation affichée)
    const pricing = calculateRentalPrice(vehicle, totalDays, platformCommissionRate);

    // 5. Génération de la référence unique (CD-2026-XXXXXX)
    const reference = generateBookingReference();
    const fullName = `${input.firstName} ${input.lastName}`.trim();
    const nowIso = new Date().toISOString();

    try {
      const insertBooking = (withLocale: boolean) =>
        supabase
          .from('bookings')
          .insert({
          // Colonne de la migration 20261111000100 : écrite seulement pour une langue autre que le français
          ...(withLocale && input.locale && input.locale !== 'fr' ? { customer_locale: input.locale } : {}),
          reference,
          booking_ref: reference,
          idempotency_key: idempotencyKey,
          idempotency_fingerprint: fingerprint,
          vehicle_id: input.vehicleId,
          agency_id: input.agencyId,
          customer_id: customerId || null,
          first_name: input.firstName,
          last_name: input.lastName,
          customer_name: fullName,
          cin: input.cin || null,
          customer_email: input.email || `${input.phone.replace(/[^0-9]/g, '')}@clickdrive.ma`,
          customer_phone: input.phone,
          customer_country: input.country,
          birth_date: input.birthDate,
          license_number: input.licenseNumber || null,
          // Colonne de la migration 20261110000100 : envoyée seulement si le client l'a renseignée
          ...(input.ferryDetails ? { ferry_details: input.ferryDetails } : {}),
          license_expiry: input.licenseExpiry || null,
          start_date: input.startDate,
          end_date: input.endDate,
          pickup_time: input.pickupTime,
          dropoff_time: input.dropoffTime,
          pickup_location: input.pickupLocation,
          dropoff_location: input.dropoffLocation,
          total_days: totalDays,
          delivery_type: input.deliveryType,
          flight_number: input.flightNumber || null,
          flight_arrival_time: input.flightArrivalTime || null,
          child_seat: input.childSeat,
          additional_driver: input.additionalDriver,
          customer_notes: input.customerNotes || null,
          daily_price: pricing.daily_price,
          total_price: pricing.total,
          commission_rate: pricing.commission_rate,
          deposit_amount: vehicle.deposit || 3000,
          status: 'PENDING',
          commission_status: 'PENDING',
          requested_at: nowIso,
        })
          .select('*, vehicle:vehicles(*), agency:agencies(*)')
          .single();

      let { data, error } = await insertBooking(true);
      // Migration de la langue pas encore appliquée : la demande passe quand même (e-mails en français)
      if (error && /customer_locale/.test(`${error.message} ${error.details ?? ''}`)) {
        console.warn('[BookingsService] Colonne customer_locale absente : demande enregistrée sans la langue.');
        ({ data, error } = await insertBooking(false));
      }

      if (error) {
        if (error.code === '23505') {
          const duplicate = await this.findIdempotentBooking(supabase, idempotencyKey, fingerprint);
          if (duplicate) return duplicate;
        }
        console.error('[BookingsService] Supabase insert error:', error);
        return {
          success: false,
          error: `Erreur base de données : ${error.message}`,
          serviceUnavailable: true,
        };
      }

      if (data) {
        const createdBooking = bookingWithoutIdempotencyFields(
          data as unknown as IdempotentBookingRecord
        );
        await this.logEvent(createdBooking.id, 'REQUEST_CREATED', 'CUSTOMER', customerId, {
          reference,
          vehicle: `${vehicle.brand} ${vehicle.model}`,
          total: pricing.total,
        });
        return { success: true, booking: createdBooking };
      }
    } catch (err) {
      console.error('[BookingsService] Supabase insert failed:', err);
      return {
        success: false,
        error: 'Échec de l\'enregistrement de la réservation en base de données.',
        serviceUnavailable: true,
      };
    }

    return {
      success: false,
      error: 'Base de données non disponible.',
      serviceUnavailable: true,
    };
  }

  /**
   * Validation de la demande par l'agence (APPROBATION)
   */
  async approveBooking(
    bookingIdOrRef: string,
    agencyNotes?: string,
    actorId?: string
  ): Promise<{
    success: boolean;
    booking?: Booking;
    error?: string;
    availabilityConflict?: boolean;
    transitionConflict?: boolean;
  }> {
    requireSupabase();
    const booking = await this.resolveBooking(bookingIdOrRef);
    if (!booking) return { success: false, error: 'Réservation introuvable' };

    if (!canPerformAgencyBookingAction(booking.status, 'approve')) {
      return { success: false, error: 'Cette demande ne peut plus être approuvée dans son état actuel.' };
    }

    const supabase = (await createAdminClient()) ?? (await createClient());
    if (!supabase) return { success: false, error: 'Base de données non disponible.' };

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'CONFIRMED',
        agency_status: 'ACCEPTED',
        commission_status: 'CONFIRMED',
        agency_notes: agencyNotes || null,
        confirmed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', booking.id)
      .eq('status', booking.status)
      .select('*, vehicle:vehicles(*), agency:agencies(*)')
      .single();

    if (error) {
      console.error('[BookingsService] Supabase approve error:', error);
      if (error.code === '23P01') {
        return {
          success: false,
          error: 'Ce véhicule vient d’être réservé pour une période qui chevauche ces dates. Choisissez une autre période ou un autre véhicule.',
          availabilityConflict: true,
        };
      }
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Cette demande a déjà été traitée. Actualisez la liste des réservations.',
          transitionConflict: true,
        };
      }
      return { success: false, error: error.message };
    }

    // Mettre à jour le véhicule en RENTED pour refléter son statut réservé
    if (booking.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'RENTED', updated_at: nowIso })
        .eq('id', booking.vehicle_id);
    }

    await this.logEvent(booking.id, 'AGENCY_ACCEPTED', 'AGENCY_OWNER', actorId, { agencyNotes });
    await this.logEvent(booking.id, 'COMMISSION_CONFIRMED', 'SYSTEM', undefined, {
      commission_amount: (data as any).commission_amount ?? booking.commission_amount,
    });
    return { success: true, booking: data as unknown as Booking };
  }

  /**
   * Refus de la demande par l'agence (REJET)
   */
  async rejectBooking(
    bookingIdOrRef: string,
    reason?: string,
    actorId?: string
  ): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    requireSupabase();
    const booking = await this.resolveBooking(bookingIdOrRef);
    if (!booking) return { success: false, error: 'Réservation introuvable' };

    if (!canPerformAgencyBookingAction(booking.status, 'reject')) {
      return { success: false, error: 'Cette demande ne peut plus être refusée dans son état actuel.' };
    }

    const supabase = (await createAdminClient()) ?? (await createClient());
    if (!supabase) return { success: false, error: 'Base de données non disponible.' };

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'REJECTED',
        agency_status: 'REJECTED',
        commission_status: 'CANCELLED',
        rejection_reason: reason || 'Non disponible',
        updated_at: nowIso,
      })
      .eq('id', booking.id)
      .select('*, vehicle:vehicles(*), agency:agencies(*)')
      .single();

    if (error) {
      console.error('[BookingsService] Supabase reject error:', error);
      return { success: false, error: error.message };
    }

    // Si aucune autre réservation active/confirmée n'existe sur le véhicule, le remettre en AVAILABLE
    if (booking.vehicle_id) {
      const { data: otherBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('vehicle_id', booking.vehicle_id)
        .neq('id', booking.id)
        .in('status', ['APPROVED', 'CONFIRMED', 'ACTIVE', 'READY_FOR_PICKUP']);

      if (!otherBookings || otherBookings.length === 0) {
        await supabase
          .from('vehicles')
          .update({ status: 'AVAILABLE', updated_at: nowIso })
          .eq('id', booking.vehicle_id);
      }
    }

    await this.logEvent(booking.id, 'AGENCY_REJECTED', 'AGENCY_OWNER', actorId, { reason });
    return { success: true, booking: data as unknown as Booking };
  }

  /**
   * Proposition d'un véhicule alternatif par l'agence
   */
  async proposeAlternative(
    bookingIdOrRef: string,
    alternativeVehicleId: string,
    notes?: string,
    actorId?: string
  ): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    requireSupabase();
    const booking = await this.resolveBooking(bookingIdOrRef);
    if (!booking) return { success: false, error: 'Réservation introuvable' };

    if (!canPerformAgencyBookingAction(booking.status, 'propose_alternative')) {
      return { success: false, error: 'Impossible de proposer une alternative pour cette demande.' };
    }

    const altVehicle = await vehiclesService.getVehicleById(alternativeVehicleId);
    if (!altVehicle) return { success: false, error: 'Véhicule alternatif introuvable' };

    const supabase = (await createAdminClient()) ?? (await createClient());
    if (!supabase) return { success: false, error: 'Base de données non disponible.' };

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('bookings')
      .update({
        agency_status: 'ALTERNATIVE_PROPOSED',
        agency_notes: notes || `Véhicule alternatif proposé : ${altVehicle.brand} ${altVehicle.model}`,
        updated_at: nowIso,
      })
      .eq('id', booking.id);

    if (error) {
      console.error('[BookingsService] Supabase alternative error:', error);
      return { success: false, error: error.message };
    }

    await this.logEvent(booking.id, 'ALTERNATIVE_PROPOSED', 'AGENCY_OWNER', actorId, {
      alternativeVehicleId,
      alternativeVehicleName: `${altVehicle.brand} ${altVehicle.model}`,
      notes,
    });
    return {
      success: true,
      booking: {
        ...booking,
        agency_status: 'ALTERNATIVE_PROPOSED',
        alternative_vehicle: altVehicle,
      },
    };
  }

  /**
   * Journalise un événement dans booking_events
   */
  async logEvent(
    bookingId: string,
    eventType: BookingEventType | string,
    actorRole: 'CUSTOMER' | 'AGENCY_OWNER' | 'AGENCY_MANAGER' | 'AGENCY_STAFF' | 'SUPER_ADMIN' | 'SYSTEM' = 'SYSTEM',
    actorId?: string,
    metadata?: Record<string, any>
  ): Promise<BookingEvent> {
    const event: BookingEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      booking_id: bookingId,
      actor_id: actorId,
      actor_role: actorRole,
      event_type: eventType,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = (await createAdminClient()) ?? (await createClient());
      if (supabase) {
        await supabase.from('booking_events').insert({
          booking_id: bookingId,
          actor_id: actorId || null,
          actor_role: actorRole,
          event_type: eventType,
          metadata: metadata || {},
        });
      }
    } catch (err) {
      console.warn('[BookingsService] Could not persist booking_event:', err);
    }

    return event;
  }

  /**
   * Récupère tous les événements d'une réservation (Timeline)
   */
  async getBookingEvents(
    bookingId: string,
    includeMetadata = false
  ): Promise<BookingEvent[]> {
    requireSupabase();
    const supabase = includeMetadata
      ? await createAdminClient()
      : await createClient();

    if (includeMetadata && !supabase) {
      throw new Error('Lecture sécurisée de l\'historique indisponible.');
    }
    if (!supabase) throw new Error('Client Supabase indisponible.');

    const { data, error } = await supabase
      .from('booking_events')
      .select(
        includeMetadata
          ? 'id, booking_id, actor_id, actor_role, event_type, metadata, created_at'
          : 'id, booking_id, actor_role, event_type, created_at'
      )
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[BookingsService] Event lookup failed:', error.message);
      throw new Error('Impossible de charger l\'historique de réservation.');
    }
    return (data ?? []) as unknown as BookingEvent[];
  }

  private async resolveBooking(idOrRef: string): Promise<Booking | null> {
    const byRef = await this.getBookingByReference(idOrRef);
    if (byRef) return byRef;

    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from('bookings')
      .select('*, vehicle:vehicles(*), agency:agencies(*)')
      .eq('id', idOrRef)
      .maybeSingle();

    return (data as unknown as Booking) ?? null;
  }
}

export const bookingsService = new BookingsService();
