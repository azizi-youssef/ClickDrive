import { createHash } from 'node:crypto';
import { canPerformAgencyBookingAction } from '@clickdrive/shared/booking-state-machine';
import { AlternativeVehicleSummary, Booking, BookingStatus, BookingEvent, BookingEventType } from '@/types';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireServiceRoleClient } from '@/lib/supabase/privileged';
import { hasAccessPermission } from '@/lib/auth/server';
import { bookingRequestSchema, BookingRequestInput } from '@/lib/validations/booking';
import { calculateRentalDays, calculateRentalPrice } from '@/lib/utils/pricing';
import { generateBookingReference, isValidBookingReference } from '@/lib/utils/reference';
import { commissionService } from './commission.service';
import { vehiclesService } from './vehicles.service';
import { isUuid, type AvailabilityStatus } from '@/lib/availability/status';
import { PRIVATE_VEHICLE_FIELDS } from '@/lib/vehicles/public';

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

/**
 * Colonnes du véhicule lues avec un client de session (droits par colonne, migration 20261115000100) :
 * aucune colonne privée (plaque, n° d'unité, documents) ; colonnes présentes dans tous les environnements.
 * Vérifiées par src/tests/db/phase2-privileges.spec.ts.
 */
const SESSION_VEHICLE_COLUMNS =
  'id, agency_id, slug, brand, model, year, category, transmission, fuel, seats, doors, air_conditioning, ' +
  'daily_price, weekly_price, monthly_price, deposit, min_rental_days, status, published, featured, archived_at, created_at, updated_at';

/**
 * Réservation renvoyée hors du serveur : le véhicule joint ne porte jamais ses champs internes
 * (même liste que toPublicVehicle), y compris quand il a été lu avec la clé service-role.
 */
function withoutPrivateVehicleFields<T>(booking: T): T {
  const record = booking as unknown as { vehicle?: unknown } | null;
  const vehicle = record?.vehicle;
  if (!vehicle || typeof vehicle !== 'object') return booking;
  const copy = { ...(vehicle as Record<string, unknown>) };
  for (const field of PRIVATE_VEHICLE_FIELDS) delete copy[field];
  return { ...(record as object), vehicle: copy } as unknown as T;
}

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

/** Résultat d'une décision agence ; les drapeaux déterminent le code HTTP de la route */
export type AgencyDecisionResult = {
  success: boolean;
  booking?: Booking;
  error?: string;
  notFound?: boolean;
  forbidden?: boolean;
  availabilityConflict?: boolean;
  transitionConflict?: boolean;
  serviceUnavailable?: boolean;
};

/**
 * Colonnes lues pour un véhicule alternatif : de quoi vérifier l'éligibilité et présenter le véhicule.
 * Jamais : plaque, numéro d'unité interne, documents, kilométrage, données de l'agence.
 */
const ALTERNATIVE_VEHICLE_COLUMNS =
  'id, slug, brand, model, year, category, transmission, fuel, seats, daily_price, status, published, archived_at, ' +
  'images:vehicle_images(url, is_primary, display_order)';

/** Statuts de flotte compatibles avec une location future (identiques à vehicle_availability()) */
const RENTABLE_FLEET_STATUSES = new Set(['AVAILABLE', 'RENTED']);

type AlternativeVehicleRow = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  transmission: string;
  fuel: string;
  seats: number | null;
  daily_price: number | string;
  status: string;
  published: boolean;
  archived_at: string | null;
  images: { url: string; is_primary: boolean | null; display_order: number | null }[] | null;
};

/** Projection publique renvoyée au navigateur (liste blanche de champs) */
function toAlternativeVehicleSummary(row: AlternativeVehicleRow): AlternativeVehicleSummary {
  const images = [...(row.images ?? [])].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    category: row.category,
    transmission: row.transmission,
    fuel: row.fuel,
    seats: row.seats,
    daily_price: Number(row.daily_price),
    image: images[0]?.url ?? null,
  };
}

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
        // Service-role (données client) : véhicule complet pour le PDF (motos), champs privés retirés ensuite.
        // Session : colonnes explicites, les colonnes privées n'étant pas accordées aux rôles utilisateur.
        `${BOOKING_READ_COLUMNS}${includeCustomerData ? `, ${BOOKING_CUSTOMER_COLUMNS}` : ''}, vehicle:vehicles(${includeCustomerData ? '*' : SESSION_VEHICLE_COLUMNS}), agency:agencies(*)`
      )
      .or(`reference.eq.${cleanRef},booking_ref.eq.${cleanRef}`)
      .maybeSingle();

    if (error) {
      console.error('[BookingsService] Booking lookup failed:', error.message);
      throw new Error('Impossible de charger la réservation.');
    }
    return data ? withoutPrivateVehicleFields(data as unknown as Booking) : null;
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
        `${BOOKING_READ_COLUMNS}${includeCustomerData ? `, ${BOOKING_CUSTOMER_COLUMNS}` : ''}, vehicle:vehicles(${includeCustomerData ? '*' : SESSION_VEHICLE_COLUMNS}), agency:agencies(*), events:booking_events(id, booking_id, actor_role, event_type, created_at)`
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
    return ((data ?? []) as unknown as Booking[]).map(withoutPrivateVehicleFields);
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
      booking: withoutPrivateVehicleFields(bookingWithoutIdempotencyFields(record)),
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
          // Statut de la machine à états partagée (PENDING n'est plus écrit : statut historique)
          status: 'REQUESTED',
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
          error: 'Votre demande n’a pas pu être enregistrée. Réessayez dans un instant.',
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
        return { success: true, booking: withoutPrivateVehicleFields(createdBooking) };
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
   * Frontière d'autorisation des décisions agence, revérifiée dans le service même si la route l'a déjà fait :
   * permission `bookings.manage` sur l'agence de la réservation, dérivée de la session serveur.
   * Toute impossibilité de vérifier vaut refus (fail-closed).
   */
  private async canManageBooking(agencyId: string | null | undefined): Promise<boolean> {
    if (!agencyId) return false;
    try {
      return await hasAccessPermission('bookings.manage', agencyId);
    } catch (error) {
      console.error('[BookingsService] Permission check failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Exécute une décision agence dans une transaction SQL (agency_decide_booking) : verrou de la réservation,
   * garde sur le statut lu, nouveau statut de la machine à états et journal booking_events ensemble.
   * L'appelant a déjà vérifié la permission et la transition autorisée.
   */
  private async runAgencyDecision(
    booking: Booking,
    action: 'approve' | 'reject' | 'propose_alternative',
    actorId: string | undefined,
    details: { notes?: string; reason?: string; alternativeVehicleId?: string } = {}
  ): Promise<AgencyDecisionResult> {
    // Service-role requis : les rôles utilisateur n'ont aucun droit d'écriture sur bookings (RLS + privilèges)
    const supabase = await requireServiceRoleClient(`bookings.${action}`);
    const { data, error } = await supabase.rpc('agency_decide_booking', {
      p_booking_id: booking.id,
      p_agency_id: booking.agency_id,
      p_action: action,
      p_expected_status: booking.status,
      p_actor_id: actorId ?? null,
      p_actor_role: 'AGENCY_OWNER',
      p_notes: details.notes ?? null,
      p_reason: details.reason ?? null,
      p_alternative_vehicle_id: details.alternativeVehicleId ?? null,
    });

    if (error) {
      console.error(`[BookingsService] agency_decide_booking(${action}) failed:`, error.code, error.message);
      if (error.code === '23P01') {
        return {
          success: false,
          error: 'Ce véhicule vient d’être réservé pour une période qui chevauche ces dates. Choisissez une autre période ou un autre véhicule.',
          availabilityConflict: true,
        };
      }
      return { success: false, error: 'La décision n’a pas pu être enregistrée. Réessayez dans un instant.' };
    }

    const outcome = (data ?? {}) as { ok?: boolean; code?: string; status?: string };
    if (!outcome.ok) {
      if (outcome.code === 'not_found') return { success: false, error: 'Réservation introuvable', notFound: true };
      if (outcome.code === 'alternative_ineligible') {
        return { success: false, error: 'Ce véhicule n’est pas proposable : il doit être publié et louable.' };
      }
      return {
        success: false,
        error: 'Cette demande a déjà été traitée. Actualisez la liste des réservations.',
        transitionConflict: true,
      };
    }

    // Réservation à jour, relue avec la session de l'agence (colonnes explicites, sans donnée privée)
    const refreshed = booking.reference ? await this.getBookingByReference(booking.reference).catch(() => null) : null;
    return {
      success: true,
      booking: refreshed ?? { ...booking, status: (outcome.status ?? booking.status) as BookingStatus },
    };
  }

  /**
   * Validation de la demande par l'agence (APPROBATION) → APPROVED.
   * Le statut de flotte du véhicule n'est pas modifié : il passe en RENTED à la remise des clés.
   */
  async approveBooking(
    bookingIdOrRef: string,
    agencyNotes?: string,
    actorId?: string
  ): Promise<AgencyDecisionResult> {
    requireSupabase();
    const booking = await this.resolveBooking(bookingIdOrRef);
    if (!booking) return { success: false, error: 'Réservation introuvable', notFound: true };
    if (!(await this.canManageBooking(booking.agency_id))) {
      return { success: false, error: 'Accès refusé', forbidden: true };
    }
    if (!canPerformAgencyBookingAction(booking.status, 'approve')) {
      return { success: false, error: 'Cette demande ne peut plus être approuvée dans son état actuel.', transitionConflict: true };
    }
    return this.runAgencyDecision(booking, 'approve', actorId, { notes: agencyNotes });
  }

  /**
   * Refus de la demande par l'agence (REJET) → REJECTED
   */
  async rejectBooking(
    bookingIdOrRef: string,
    reason?: string,
    actorId?: string
  ): Promise<AgencyDecisionResult> {
    requireSupabase();
    const booking = await this.resolveBooking(bookingIdOrRef);
    if (!booking) return { success: false, error: 'Réservation introuvable', notFound: true };
    if (!(await this.canManageBooking(booking.agency_id))) {
      return { success: false, error: 'Accès refusé', forbidden: true };
    }
    if (!canPerformAgencyBookingAction(booking.status, 'reject')) {
      return { success: false, error: 'Cette demande ne peut plus être refusée dans son état actuel.', transitionConflict: true };
    }
    return this.runAgencyDecision(booking, 'reject', actorId, { reason });
  }

  /**
   * Proposition d'un véhicule alternatif par l'agence → ALTERNATIVE_PROPOSED.
   * Isolation multi-agences : le véhicule proposé doit appartenir à l'agence de la réservation, être publié,
   * louable et disponible sur les dates demandées. Seule une projection publique est renvoyée.
   * Un véhicule d'une autre agence reçoit la même réponse qu'un identifiant inexistant (aucune divulgation).
   * Machine à états : une fois l'alternative proposée, la demande ne peut plus qu'être refusée.
   */
  async proposeAlternative(
    bookingIdOrRef: string,
    alternativeVehicleId: string,
    notes?: string,
    actorId?: string
  ): Promise<AgencyDecisionResult> {
    requireSupabase();
    if (!isUuid(alternativeVehicleId)) {
      return { success: false, error: 'Véhicule alternatif introuvable pour cette agence.', notFound: true };
    }

    const booking = await this.resolveBooking(bookingIdOrRef);
    if (!booking) return { success: false, error: 'Réservation introuvable', notFound: true };
    if (!(await this.canManageBooking(booking.agency_id))) {
      return { success: false, error: 'Accès refusé', forbidden: true };
    }

    if (!canPerformAgencyBookingAction(booking.status, 'propose_alternative')) {
      return { success: false, error: 'Impossible de proposer une alternative pour cette demande.', transitionConflict: true };
    }
    if (alternativeVehicleId === booking.vehicle_id) {
      return { success: false, error: 'Choisissez un autre véhicule que celui demandé.' };
    }

    const supabase = await requireServiceRoleClient('bookings.propose_alternative');

    // Lecture bornée à l'agence de la réservation, colonnes explicites (ni plaque, ni n° interne, ni documents)
    const { data: altRow, error: altError } = await supabase
      .from('vehicles')
      .select(ALTERNATIVE_VEHICLE_COLUMNS)
      .eq('id', alternativeVehicleId)
      .eq('agency_id', booking.agency_id)
      .maybeSingle();

    if (altError) {
      console.error('[BookingsService] Alternative vehicle lookup failed:', altError.message);
      return { success: false, error: 'Le véhicule alternatif ne peut pas être vérifié pour le moment.', serviceUnavailable: true };
    }
    const alternative = altRow as unknown as AlternativeVehicleRow | null;
    if (!alternative) {
      return { success: false, error: 'Véhicule alternatif introuvable pour cette agence.', notFound: true };
    }
    if (!alternative.published || alternative.archived_at || !RENTABLE_FLEET_STATUSES.has(String(alternative.status))) {
      return { success: false, error: 'Ce véhicule n’est pas proposable : il doit être publié et louable.' };
    }

    // Disponibilité sur les dates du client : seul AVAILABLE est accepté (UNKNOWN = refus, fail-closed)
    const availability = await vehiclesService.getAvailabilityStatus(alternative.id, booking.start_date, booking.end_date);
    if (availability === 'UNKNOWN') {
      return { success: false, error: 'La disponibilité de ce véhicule ne peut pas être vérifiée pour le moment.', serviceUnavailable: true };
    }
    if (availability === 'UNAVAILABLE') {
      return { success: false, error: 'Ce véhicule n’est pas disponible sur les dates de la demande.', availabilityConflict: true };
    }

    const result = await this.runAgencyDecision(booking, 'propose_alternative', actorId, {
      notes,
      alternativeVehicleId: alternative.id,
    });
    if (!result.success || !result.booking) return result;
    return {
      ...result,
      booking: { ...result.booking, alternative_vehicle: toAlternativeVehicleSummary(alternative) },
    };
  }

  /**
   * Journalise un événement dans booking_events (service-role : aucun rôle utilisateur ne peut y écrire).
   * Un échec est journalisé côté serveur et signalé par `persisted: false`, jamais masqué.
   */
  async logEvent(
    bookingId: string,
    eventType: BookingEventType | string,
    actorRole: 'CUSTOMER' | 'AGENCY_OWNER' | 'AGENCY_MANAGER' | 'AGENCY_STAFF' | 'SUPER_ADMIN' | 'SYSTEM' = 'SYSTEM',
    actorId?: string,
    metadata?: Record<string, unknown>
  ): Promise<BookingEvent & { persisted: boolean }> {
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
      const supabase = await requireServiceRoleClient('booking_events.insert');
      const { data, error } = await supabase
        .from('booking_events')
        .insert({
          booking_id: bookingId,
          actor_id: actorId || null,
          actor_role: actorRole,
          event_type: eventType,
          metadata: metadata || {},
        })
        .select('id, created_at')
        .single();
      if (error || !data) {
        console.error('[BookingsService] booking_event not persisted:', eventType, error?.message ?? 'aucune ligne');
        return { ...event, persisted: false };
      }
      const row = data as { id: string; created_at: string };
      return { ...event, id: row.id, created_at: row.created_at, persisted: true };
    } catch (err) {
      console.error('[BookingsService] booking_event not persisted:', eventType, err instanceof Error ? err.message : err);
      return { ...event, persisted: false };
    }
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

    if (!isUuid(idOrRef)) return null;
    // Colonnes explicites : la session n'a ni SELECT * sur bookings ni les colonnes privées des véhicules
    const { data, error } = await supabase
      .from('bookings')
      .select(`${BOOKING_READ_COLUMNS}, vehicle:vehicles(${SESSION_VEHICLE_COLUMNS}), agency:agencies(*)`)
      .eq('id', idOrRef)
      .maybeSingle();
    if (error) {
      console.error('[BookingsService] Booking lookup by id failed:', error.message);
      return null;
    }

    return (data as unknown as Booking) ?? null;
  }
}

export const bookingsService = new BookingsService();
