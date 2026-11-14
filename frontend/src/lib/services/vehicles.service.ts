import { Vehicle, SearchFilters } from '@/types';
import { createAdminClient, createPublicClient } from '@/lib/supabase/server';
import { requireServiceRoleClient } from '@/lib/supabase/privileged';
import { findSameModelAlternatives } from '@/lib/availability/engine';
import {
  AvailabilityValidationError,
  BLOCKING_BOOKING_STATUSES,
  evaluateAvailability,
  isUuid,
  type AvailabilityStatus,
} from '@/lib/availability/status';
import { formatLocalDate } from '@/lib/utils/date-only';

const EXPIRY_INTERVAL_MS = 10 * 60_000;
let lastExpiryAt = 0;

/** Vrai au plus une fois toutes les 10 minutes (par instance serveur) */
export function shouldExpireCompletedBookings(now = Date.now()): boolean {
  if (now - lastExpiryAt < EXPIRY_INTERVAL_MS) return false;
  lastExpiryAt = now;
  return true;
}


function requireSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith('http')) {
    throw new Error(
      'Supabase non configuré. Définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
}

/**
 * Lectures du catalogue public : service-role explicite, sans repli vers un client utilisateur.
 * Justification : vehicle_images et vehicle_features ont la RLS activée sans aucune politique de lecture
 * (vérifié par src/tests/db/public-read-anon.spec.ts) ; un client anon renverrait un catalogue sans photos
 * ni équipements. Frontière : chaque requête filtre published = true (et l'agence active pour la liste) ;
 * toute sortie vers le navigateur passe par toPublicVehicle() (ni plaque, ni n° d'unité, ni documents).
 * Le client reste sans cookies, donc utilisable dans unstable_cache.
 */
async function requireCatalogClient() {
  requireSupabase();
  return requireServiceRoleClient('vehicles.public_catalog');
}

/** Client service-role facultatif, sans repli : null si la clé n'est pas configurée (développement) */
async function optionalServiceRoleClient() {
  try {
    return await createAdminClient();
  } catch (error) {
    console.error('[VehiclesService] Client service-role indisponible :', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Normalise les résultats Supabase vers le type Vehicle attendu */
function normalizeVehicle(row: any): Vehicle {
  const rawImages = Array.isArray(row.images) ? row.images : [];
  const images = rawImages
    .map((img: any) => (typeof img === 'string' ? img : img?.url))
    .filter((url: any): url is string => typeof url === 'string' && url.length > 0);

  const rawFeatures =
    Array.isArray(row.vehicle_features) && row.vehicle_features.length > 0
      ? row.vehicle_features.map((f: any) => (typeof f === 'string' ? f : f?.name))
      : Array.isArray(row.features) && row.features.length > 0
      ? row.features.map((f: any) => (typeof f === 'string' ? f : f?.name))
      : [];

  return {
    ...row,
    images,
    features: rawFeatures.filter(Boolean),
  };
}

export class VehiclesService {
  async getVehicles(filters?: SearchFilters): Promise<Vehicle[]> {
    const supabase = await requireCatalogClient();

    let query = supabase
      .from('vehicles')
      .select('*, agency:agencies!inner(*), images:vehicle_images(url, is_primary), vehicle_features(name)')
      .eq('published', true)
      .is('archived_at', null)
      .eq('agency.status', 'ACTIVE')
      .is('agency.archived_at', null);

    if (filters?.agencyId) {
      query = query.eq('agency_id', filters.agencyId);
    }
    if (filters?.category && filters.category !== 'Tous les types') {
      query = query.ilike('category', filters.category);
    }
    if (filters?.brand) {
      query = query.ilike('brand', filters.brand);
    }
    if (filters?.transmission) {
      query = query.eq('transmission', filters.transmission);
    }
    if (filters?.fuel) {
      query = query.eq('fuel', filters.fuel);
    }
    if (filters?.minPrice) {
      query = query.gte('daily_price', filters.minPrice);
    }
    if (filters?.maxPrice) {
      query = query.lte('daily_price', filters.maxPrice);
    }

    if (filters?.sortBy === 'price_asc') {
      query = query.order('daily_price', { ascending: true });
    } else if (filters?.sortBy === 'price_desc') {
      query = query.order('daily_price', { ascending: false });
    } else {
      query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) {
      console.error('[VehiclesService] getVehicles error:', error.message);
      throw new Error('Impossible de charger les véhicules.');
    }

    const mapped: Vehicle[] = (data ?? []).map(normalizeVehicle);

    // Date-specific availability is computed in PostgreSQL to share one source of truth.
    if (filters?.startDate && filters?.endDate) {
      // Nettoyage des locations terminées (statuts véhicules) : une écriture en base, donc au plus
      // une fois toutes les 10 minutes par instance ; la tâche planifiée le fait aussi toutes les 15 min.
      // Facultatif pour cette lecture : la disponibilité ignore déjà les réservations passées.
      // Écriture de maintenance sans donnée utilisateur (EXECUTE retiré à anon et authenticated)
      if (shouldExpireCompletedBookings()) {
        const { error: expireError } = await supabase.rpc('expire_completed_bookings');
        if (expireError) {
          console.warn('[VehiclesService] Booking expiry skipped:', expireError.message);
        }
      }

      const availability: { vehicle_id: string; available: boolean }[] = [];
      for (let offset = 0; offset < mapped.length; offset += 500) {
        const { data, error: availabilityError } = await supabase.rpc(
          'vehicle_availability',
          {
            p_vehicle_ids: mapped.slice(offset, offset + 500).map((vehicle) => vehicle.id),
            p_start_date: filters.startDate,
            p_end_date: filters.endDate,
          }
        );
        if (availabilityError) {
          console.error('[VehiclesService] Availability lookup failed:', availabilityError.message);
          throw new Error('Impossible de vérifier la disponibilité des véhicules.');
        }
        availability.push(...(data ?? []));
      }
      const availableIds = new Set(
        availability.filter((item) => item.available).map((item) => item.vehicle_id)
      );
      return mapped.filter((vehicle) => availableIds.has(vehicle.id));
    }

    return mapped;
  }

  /** Véhicule publié, ou null (l'appelant vérifie aussi l'agence : voir isPubliclyVisible) */
  async getVehicleBySlug(slug: string): Promise<Vehicle | null> {
    const supabase = await requireCatalogClient();

    const { data, error } = await supabase
      .from('vehicles')
      .select('*, agency:agencies(*), images:vehicle_images(url, is_primary), vehicle_features(name)')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();

    if (error) {
      console.error('[VehiclesService] getVehicleBySlug error:', error.message);
      throw new Error('Impossible de charger le véhicule.');
    }
    return data ? normalizeVehicle(data) : null;
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    // Un identifiant non UUID ne peut correspondre à aucun véhicule (évite une erreur SQL de conversion)
    if (!isUuid(id)) return null;
    // Véhicule publié, ou null (l'appelant vérifie aussi l'agence)
    const supabase = await requireCatalogClient();

    const { data, error } = await supabase
      .from('vehicles')
      .select('*, agency:agencies(*), images:vehicle_images(url, is_primary), vehicle_features(name)')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();

    if (error) {
      console.error('[VehiclesService] getVehicleById error:', error.message);
      throw new Error('Impossible de charger le véhicule.');
    }
    return data ? normalizeVehicle(data) : null;
  }

  async getAlternatives(
    vehicle: Vehicle,
    startDate?: string,
    endDate?: string
  ): Promise<Vehicle[]> {
    requireSupabase();
    const allVehicles = await this.getVehicles(
      startDate && endDate ? { startDate, endDate } : undefined
    );

    return findSameModelAlternatives({
      currentVehicle: vehicle,
      allVehicles,
      allBookings: [],
      startDate,
      endDate,
    });
  }

  /**
   * Disponibilité d'un véhicule sur une période, en trois états (voir lib/availability/status.ts).
   * Ne renvoie jamais AVAILABLE sans vérification réussie : toute erreur donne UNKNOWN.
   * Un identifiant invalide lève AvailabilityValidationError (réponse 400).
   */
  async getAvailabilityStatus(vehicleId: string, startDate: string, endDate: string): Promise<AvailabilityStatus> {
    if (!isUuid(vehicleId)) throw new AvailabilityValidationError();
    requireSupabase();

    // 1. Fonction SQL canonique (SECURITY DEFINER, accordée à anon : ne renvoie qu'un booléen par véhicule)
    try {
      const publicClient = createPublicClient();
      if (!publicClient) return 'UNKNOWN';
      const { data, error } = await publicClient.rpc('vehicle_availability', {
        p_vehicle_ids: [vehicleId],
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (!error && Array.isArray(data)) {
        const row = (data as { vehicle_id: string; available: boolean }[]).find((item) => item.vehicle_id === vehicleId);
        // La fonction renvoie une ligne par véhicule demandé ; absence de ligne = réponse inattendue
        if (row) return row.available ? 'AVAILABLE' : 'UNAVAILABLE';
        console.warn('[VehiclesService] vehicle_availability: no row returned for the requested vehicle');
      } else if (error) {
        console.warn('[VehiclesService] vehicle_availability RPC failed, using equivalent table checks:', error.message);
      }
    } catch (rpcError) {
      console.warn('[VehiclesService] vehicle_availability RPC threw, using equivalent table checks:', rpcError);
    }

    // 2. Vérification équivalente sur les tables : lit des réservations et blocages privés, donc service-role
    //    uniquement (aucun repli vers un client utilisateur). Sans clé ou en cas d'erreur : UNKNOWN (fail-closed).
    const supabase = await optionalServiceRoleClient();
    if (!supabase) return 'UNKNOWN';
    try {
      const [vehicleRes, bookingsRes, blocksRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, status, published, archived_at, agency:agencies(status, archived_at)')
          .eq('id', vehicleId)
          .maybeSingle(),
        supabase
          .from('bookings')
          .select('start_date, end_date, status')
          .eq('vehicle_id', vehicleId)
          .in('status', [...BLOCKING_BOOKING_STATUSES])
          .lte('start_date', endDate)
          .gte('end_date', startDate),
        supabase
          .from('vehicle_unavailability')
          .select('start_date, end_date')
          .eq('vehicle_id', vehicleId)
          .lte('start_date', endDate)
          .gte('end_date', startDate),
      ]);
      if (vehicleRes.error || bookingsRes.error || blocksRes.error) {
        console.error('[VehiclesService] Availability table checks failed:', vehicleRes.error?.message ?? bookingsRes.error?.message ?? blocksRes.error?.message);
        return 'UNKNOWN';
      }
      const vehicleRow = vehicleRes.data as
        | { status: string; published: boolean; archived_at: string | null; agency: unknown }
        | null;
      const agencyRaw = vehicleRow ? (Array.isArray(vehicleRow.agency) ? vehicleRow.agency[0] : vehicleRow.agency) : null;
      return evaluateAvailability(
        {
          vehicle: vehicleRow ? { status: vehicleRow.status, published: vehicleRow.published, archived_at: vehicleRow.archived_at } : null,
          agency: (agencyRaw as { status: string; archived_at: string | null } | null) ?? null,
          bookings: (bookingsRes.data ?? []) as { start_date: string; end_date: string; status: string }[],
          unavailability: (blocksRes.data ?? []) as { start_date: string; end_date: string }[],
        },
        { startDate, endDate },
        formatLocalDate(new Date())
      );
    } catch (fallbackError) {
      console.error('[VehiclesService] Availability table checks threw:', fallbackError);
      return 'UNKNOWN';
    }
  }

  // Les écritures de flotte passent exclusivement par /api/agencies/[id]/vehicles (validation Zod,
  // permission vehicles.manage, contrôle de capacité) : aucune méthode d'écriture générique ici.
}

export const vehiclesService = new VehiclesService();
