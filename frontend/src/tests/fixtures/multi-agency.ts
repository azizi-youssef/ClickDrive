import type { AgencyMemberRole } from '@clickdrive/shared/roles';
import type { ServerAuthContext } from '@/lib/auth/server';
import { createFakeSupabase, eqValue, type FakeCall, type FakeResult } from '@/tests/support/fake-supabase';

/**
 * Deux agences, trois acteurs (administrateur A, agent A, administrateur B), des véhicules aux états
 * variés et une demande de réservation de l'agence A. Les faux clients reproduisent :
 * - la RLS pour le client de session (un membre ne lit que les réservations de son agence) ;
 * - le service-role pour les lectures/écritures privilégiées (aucun filtre implicite : seuls les filtres
 *   écrits par le code limitent le résultat, comme en production).
 */

export const AGENCY_A = 'a1000000-0000-4000-8000-00000000000a';
export const AGENCY_B = 'b1000000-0000-4000-8000-00000000000b';

export const VEHICLE = {
  /** Véhicule demandé dans la réservation */
  requested: 'a2000000-0000-4000-8000-000000000001',
  /** Agence A, publié, disponible */
  available: 'a2000000-0000-4000-8000-000000000002',
  /** Agence A, non publié */
  unpublished: 'a2000000-0000-4000-8000-000000000003',
  /** Agence A, publié mais réservé sur les dates */
  booked: 'a2000000-0000-4000-8000-000000000004',
  /** Agence A, en maintenance */
  maintenance: 'a2000000-0000-4000-8000-000000000005',
  /** Agence B, publié, disponible */
  otherAgency: 'b2000000-0000-4000-8000-000000000001',
} as const;

export const PRIVATE_MARKERS = ['12345-A-50', 'A#101', 'carte-grise.pdf', '98765-B-48', 'B#777', 'assurance-b.pdf'];

type VehicleRow = Record<string, unknown> & { id: string; agency_id: string };

function vehicle(id: string, agencyId: string, overrides: Record<string, unknown> = {}): VehicleRow {
  return {
    id,
    agency_id: agencyId,
    slug: `vehicule-${id.slice(-4)}`,
    brand: agencyId === AGENCY_A ? 'Dacia' : 'Peugeot',
    model: agencyId === AGENCY_A ? 'Logan' : '208',
    year: 2025,
    category: 'Économique',
    transmission: 'MANUAL',
    fuel: 'DIESEL',
    seats: 5,
    daily_price: 300,
    status: 'AVAILABLE',
    published: true,
    archived_at: null,
    featured: false,
    license_plate: agencyId === AGENCY_A ? '12345-A-50' : '98765-B-48',
    unit_number: agencyId === AGENCY_A ? 'A#101' : 'B#777',
    documents: [{ url: agencyId === AGENCY_A ? 'carte-grise.pdf' : 'assurance-b.pdf' }],
    mileage: 42000,
    images: [{ url: `https://img.test/${id}.jpg`, is_primary: true, display_order: 0 }],
    ...overrides,
  };
}

export function vehicleRows(): Record<string, VehicleRow> {
  return {
    [VEHICLE.requested]: vehicle(VEHICLE.requested, AGENCY_A),
    [VEHICLE.available]: vehicle(VEHICLE.available, AGENCY_A),
    [VEHICLE.unpublished]: vehicle(VEHICLE.unpublished, AGENCY_A, { published: false }),
    [VEHICLE.booked]: vehicle(VEHICLE.booked, AGENCY_A),
    [VEHICLE.maintenance]: vehicle(VEHICLE.maintenance, AGENCY_A, { status: 'MAINTENANCE' }),
    [VEHICLE.otherAgency]: vehicle(VEHICLE.otherAgency, AGENCY_B),
  };
}

export const BOOKING_REF = 'CD-2026-100001';

export function bookingRow(status = 'PENDING') {
  return {
    id: 'a3000000-0000-4000-8000-000000000001',
    reference: BOOKING_REF,
    booking_ref: BOOKING_REF,
    agency_id: AGENCY_A,
    vehicle_id: VEHICLE.requested,
    status,
    start_date: '2027-03-01',
    end_date: '2027-03-05',
    total_price: 1200,
    commission_amount: 0,
  };
}

export type Actor = 'adminA' | 'agentA' | 'adminB' | 'none';

export const ACTORS: Record<Exclude<Actor, 'none'>, { userId: string; agencyId: string; memberRole: string }> = {
  adminA: { userId: 'a4000000-0000-4000-8000-0000000000a1', agencyId: AGENCY_A, memberRole: 'agency_admin' },
  agentA: { userId: 'a4000000-0000-4000-8000-0000000000a2', agencyId: AGENCY_A, memberRole: 'agency_agent' },
  adminB: { userId: 'b4000000-0000-4000-8000-0000000000b1', agencyId: AGENCY_B, memberRole: 'agency_admin' },
};

/** Matrice ACCESS_CONTROL.md pour les permissions utilisées ici */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  agency_admin: ['vehicles.read', 'vehicles.manage', 'bookings.read', 'bookings.manage', 'customers.read', 'reports.read', 'agencies.update'],
  agency_agent: ['vehicles.read', 'bookings.read', 'bookings.manage', 'customers.read'],
};

export function actorHasPermission(actor: Actor, permission: string, agencyId?: string): boolean {
  if (actor === 'none') return false;
  const { agencyId: own, memberRole } = ACTORS[actor];
  return Boolean(agencyId && agencyId === own && ROLE_PERMISSIONS[memberRole]?.includes(permission));
}

export function serverAuthFor(actor: Actor): ServerAuthContext | null {
  if (actor === 'none') return null;
  const { userId, agencyId, memberRole } = ACTORS[actor];
  return {
    userId,
    email: `${actor}@test.invalid`,
    displayName: actor,
    avatarUrl: null,
    role: 'CUSTOMER',
    agencyIds: [agencyId],
    memberships: [{ agencyId, role: memberRole as AgencyMemberRole }],
    agencyName: null,
    agencyLogoUrl: null,
  };
}

export type ScenarioOptions = {
  actor: Actor;
  bookingStatus?: string;
  /** Simule une RLS défaillante : la réservation est visible même d'une autre agence */
  rlsLeaksBooking?: boolean;
  /** Réponse de la fonction agency_decide_booking (par défaut : décision enregistrée) */
  decision?: FakeResult;
  /** Erreur de la fonction vehicle_availability (et du repli) : disponibilité inconnue */
  availabilityDown?: boolean;
  vehicleCountByAgency?: Record<string, number | null>;
  plans?: { id: string; slug: string; name: string; max_vehicles: number | null }[];
  subscriptionPlan?: { id: string; slug: string; name: string; max_vehicles: number | null } | null;
  subscriptionStatus?: string;
  customVehicleLimit?: number | null;
  capacityReadError?: boolean;
  vehicleInsertError?: { message: string; code?: string };
};

export const DEFAULT_PLANS = [
  { id: 'c1000000-0000-4000-8000-000000000001', slug: 'starter', name: 'Starter', max_vehicles: 15 },
  { id: 'c1000000-0000-4000-8000-000000000002', slug: 'pro', name: 'Pro', max_vehicles: 25 },
  { id: 'c1000000-0000-4000-8000-000000000003', slug: 'business', name: 'Flotte Business', max_vehicles: 35 },
  { id: 'c1000000-0000-4000-8000-000000000004', slug: 'unlimited', name: 'Concession Premium', max_vehicles: 45 },
];

/** Construit les trois faux clients (session RLS, service-role, public) d'un scénario */
export function buildScenario(options: ScenarioOptions) {
  const vehicles = vehicleRows();
  const booking = bookingRow(options.bookingStatus);
  const actor = options.actor;
  const actorAgency = actor === 'none' ? null : ACTORS[actor].agencyId;

  const session = createFakeSupabase((call) => {
    if (call.table === 'bookings' && call.op === 'select') {
      const visible = options.rlsLeaksBooking || actorAgency === booking.agency_id;
      return { data: visible ? booking : null };
    }
    if (call.table === 'vehicles' && call.op === 'select') {
      // RLS : publié d'une agence active, ou membre de l'agence avec vehicles.read
      const row = vehicles[String(eqValue(call, 'id'))];
      const visible = row && (row.published === true || row.agency_id === actorAgency);
      return { data: visible ? { id: row.id, agency_id: row.agency_id } : null };
    }
    return undefined;
  });

  const service = createFakeSupabase((call: FakeCall) => {
    if (call.table === 'vehicles' && call.op === 'select') {
      if (call.options && (call.options as { head?: boolean }).head) {
        if (options.capacityReadError) return { error: { message: 'timeout' } };
        const agencyId = String(eqValue(call, 'agency_id'));
        return { count: options.vehicleCountByAgency?.[agencyId] ?? 3 };
      }
      const row = vehicles[String(eqValue(call, 'id'))];
      if (!row) return { data: null };
      const agencyFilter = eqValue(call, 'agency_id');
      if (agencyFilter !== undefined && agencyFilter !== row.agency_id) return { data: null };
      return { data: { ...row } };
    }
    if (call.table === 'vehicles' && call.op === 'insert') {
      if (options.vehicleInsertError) return { error: options.vehicleInsertError };
      return { data: { id: 'a2000000-0000-4000-8000-00000000new1', ...(call.payload as object) } };
    }
    if (call.table === 'vehicles' && call.op === 'update') {
      const row = vehicles[String(eqValue(call, 'id'))];
      const agencyFilter = eqValue(call, 'agency_id');
      if (!row || (agencyFilter !== undefined && agencyFilter !== row.agency_id)) {
        return call.mode === 'single' ? { error: { message: 'no rows', code: 'PGRST116' } } : { data: null };
      }
      return { data: { ...row, ...(call.payload as object) } };
    }
    if (call.op === 'rpc' && call.table === 'agency_decide_booking') {
      const action = (call.payload as { p_action: string }).p_action;
      const status = { approve: 'APPROVED', reject: 'REJECTED', propose_alternative: 'ALTERNATIVE_PROPOSED' }[action];
      return options.decision ?? { data: { ok: true, status } };
    }
    if (call.table === 'bookings' && call.op === 'select') {
      // Repli de disponibilité et recherche d'autres réservations bloquantes
      if (options.availabilityDown) return { error: { message: 'db down' } };
      return { data: [] };
    }
    if (call.table === 'vehicle_unavailability') {
      return options.availabilityDown ? { error: { message: 'db down' } } : { data: [] };
    }
    if (call.table === 'booking_events' && call.op === 'insert') {
      return { data: { id: 'evt-1', created_at: '2026-11-14T00:00:00.000Z' } };
    }
    if (call.table === 'agency_subscriptions') {
      if (options.capacityReadError) return { error: { message: 'timeout' } };
      return {
        data: options.subscriptionPlan
          ? { status: options.subscriptionStatus ?? 'ACTIVE', custom_vehicle_limit: options.customVehicleLimit ?? null, plan: options.subscriptionPlan }
          : null,
      };
    }
    if (call.table === 'subscription_plans') {
      if (options.capacityReadError) return { error: { message: 'timeout' } };
      return { data: options.plans ?? DEFAULT_PLANS };
    }
    return undefined;
  });

  const publicClient = createFakeSupabase((call) => {
    if (call.op === 'rpc' && call.table === 'vehicle_availability') {
      if (options.availabilityDown) return { error: { message: 'rpc down' } };
      const ids = (call.payload as { p_vehicle_ids: string[] }).p_vehicle_ids;
      return { data: ids.map((id) => ({ vehicle_id: id, available: id !== VEHICLE.booked })) };
    }
    return undefined;
  });

  return { session, service, publicClient, vehicles, booking };
}

/** Le texte contient-il une donnée privée de véhicule (plaque, n° interne, document) ? */
export function leaksPrivateVehicleData(value: unknown): string[] {
  const text = JSON.stringify(value);
  return PRIVATE_MARKERS.filter((marker) => text.includes(marker));
}
