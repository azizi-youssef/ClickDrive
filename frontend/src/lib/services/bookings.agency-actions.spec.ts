import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eqValue, writesTo } from '@/tests/support/fake-supabase';
import {
  AGENCY_A,
  BOOKING_REF,
  VEHICLE,
  actorHasPermission,
  buildScenario,
  leaksPrivateVehicleData,
  type Actor,
  type ScenarioOptions,
} from '@/tests/fixtures/multi-agency';

const state = vi.hoisted(() => ({
  actor: 'adminA' as string,
  session: null as unknown,
  service: null as unknown,
  publicClient: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => state.session,
  createAdminClient: async () => state.service,
  createPublicClient: () => state.publicClient,
}));

vi.mock('@/lib/auth/server', async () => {
  const fixtures = await import('@/tests/fixtures/multi-agency');
  return {
    hasAccessPermission: async (permission: string, agencyId?: string) =>
      fixtures.actorHasPermission(state.actor as Actor, permission, agencyId),
    getServerAuth: async () => fixtures.serverAuthFor(state.actor as Actor),
  };
});

import { bookingsService } from './bookings.service';
import { PrivilegedAccessUnavailableError } from '@/lib/supabase/privileged';

let scenario: ReturnType<typeof buildScenario>;

function setup(options: ScenarioOptions) {
  state.actor = options.actor;
  scenario = buildScenario(options);
  state.session = scenario.session.client;
  state.service = scenario.service.client;
  state.publicClient = scenario.publicClient.client;
}

/** Décisions passées par la fonction SQL transactionnelle agency_decide_booking */
const decisions = () => scenario.service.calls.filter((call) => call.op === 'rpc' && call.table === 'agency_decide_booking');
const decisionArgs = (index = 0) => decisions()[index]?.payload as Record<string, unknown>;
/** Toute écriture de réservation : directe (interdite) ou par la fonction transactionnelle */
const bookingWrites = () => [...writesTo(scenario.service.calls, 'bookings'), ...decisions()];
const vehicleLookups = () => scenario.service.calls.filter((call) => call.table === 'vehicles' && call.op === 'select');

const ALTERNATIVE_KEYS = ['brand', 'category', 'daily_price', 'fuel', 'id', 'image', 'model', 'seats', 'slug', 'transmission', 'year'];

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
});

describe('Matrice de permissions des fixtures', () => {
  it('administrateur A et agent A gèrent les réservations de A, pas de B', () => {
    expect(actorHasPermission('adminA', 'bookings.manage', AGENCY_A)).toBe(true);
    expect(actorHasPermission('agentA', 'bookings.manage', AGENCY_A)).toBe(true);
    expect(actorHasPermission('agentA', 'vehicles.manage', AGENCY_A)).toBe(false);
    expect(actorHasPermission('adminB', 'bookings.manage', AGENCY_A)).toBe(false);
  });
});

describe('proposeAlternative — isolation multi-agences', () => {
  it.each(['adminA', 'agentA'] as const)('%s propose un véhicule publié et disponible de son agence : projection publique seulement', async (actor) => {
    setup({ actor });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.available, undefined, 'actor-id');

    expect(result.success).toBe(true);
    expect(Object.keys(result.booking?.alternative_vehicle ?? {}).sort()).toEqual(ALTERNATIVE_KEYS);
    expect(leaksPrivateVehicleData(result)).toEqual([]);

    // Lecture bornée à l'agence de la réservation, colonnes explicites
    const [lookup] = vehicleLookups();
    expect(eqValue(lookup, 'agency_id')).toBe(AGENCY_A);
    expect(lookup.columns).not.toMatch(/\*|license_plate|unit_number|documents|mileage/);

    // Transition gardée dans une transaction SQL : même agence, même statut que celui lu
    expect(decisionArgs()).toMatchObject({
      p_action: 'propose_alternative',
      p_agency_id: AGENCY_A,
      p_expected_status: 'PENDING',
      p_alternative_vehicle_id: VEHICLE.available,
    });
    expect(writesTo(scenario.service.calls, 'bookings')).toHaveLength(0);
  });

  it('A ne peut pas proposer un véhicule de B, même en connaissant son identifiant : aucune donnée divulguée', async () => {
    setup({ actor: 'adminA' });
    const fromOtherAgency = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.otherAgency);
    const unknown = await bookingsService.proposeAlternative(BOOKING_REF, 'a2000000-0000-4000-8000-0000000000ff');

    expect(fromOtherAgency).toMatchObject({ success: false, notFound: true });
    // Même réponse qu'un identifiant inexistant : on n'apprend pas que le véhicule existe ailleurs
    expect(fromOtherAgency.error).toBe(unknown.error);
    expect(JSON.stringify(fromOtherAgency)).not.toMatch(/Peugeot|208/);
    expect(leaksPrivateVehicleData(fromOtherAgency)).toEqual([]);
    expect(bookingWrites()).toHaveLength(0);
  });

  it('B ne voit pas la réservation de A (RLS) : introuvable, aucun accès privilégié', async () => {
    setup({ actor: 'adminB' });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.otherAgency);
    expect(result).toMatchObject({ success: false, notFound: true });
    expect(scenario.service.calls).toHaveLength(0);
  });

  it('défense en profondeur : même si la RLS laissait voir la réservation, B est refusé avant toute lecture privilégiée', async () => {
    setup({ actor: 'adminB', rlsLeaksBooking: true });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.otherAgency);
    expect(result).toMatchObject({ success: false, forbidden: true });
    expect(scenario.service.calls).toHaveLength(0);
  });

  it.each([
    ['non publié', VEHICLE.unpublished],
    ['en maintenance', VEHICLE.maintenance],
  ])('véhicule %s : refusé', async (_label, vehicleId) => {
    setup({ actor: 'adminA' });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, vehicleId);
    expect(result.success).toBe(false);
    expect(bookingWrites()).toHaveLength(0);
    expect(leaksPrivateVehicleData(result)).toEqual([]);
  });

  it('véhicule réservé sur les dates de la demande : conflit de disponibilité', async () => {
    setup({ actor: 'adminA' });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.booked);
    expect(result).toMatchObject({ success: false, availabilityConflict: true });
    expect(bookingWrites()).toHaveLength(0);
  });

  it('disponibilité invérifiable : refus (fail-closed)', async () => {
    setup({ actor: 'adminA', availabilityDown: true });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.available);
    expect(result).toMatchObject({ success: false, serviceUnavailable: true });
    expect(bookingWrites()).toHaveLength(0);
  });

  it('le véhicule déjà demandé n’est pas une alternative', async () => {
    setup({ actor: 'adminA' });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.requested);
    expect(result.success).toBe(false);
    expect(bookingWrites()).toHaveLength(0);
  });

  it('identifiant non UUID : refusé sans requête', async () => {
    setup({ actor: 'adminA' });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, "x' OR 1=1");
    expect(result).toMatchObject({ success: false, notFound: true });
    expect(scenario.session.calls).toHaveLength(0);
    expect(scenario.service.calls).toHaveLength(0);
  });

  it('demande traitée entre-temps (aucune ligne modifiée) : conflit, jamais un faux succès', async () => {
    setup({ actor: 'adminA', decision: { data: { ok: false, code: 'transition_conflict' } } });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.available);
    expect(result).toMatchObject({ success: false, transitionConflict: true });
    expect(writesTo(scenario.service.calls, 'booking_events')).toHaveLength(0);
  });

  it('erreur base à l’écriture : échec avec message neutre (aucun détail technique)', async () => {
    setup({ actor: 'adminA', decision: { error: { message: 'relation "bookings" violates policy xyz', code: '42501' } } });
    const result = await bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.available);
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/relation|policy|42501/);
  });

  it('clé service-role absente : erreur explicite, aucun repli vers le client de session', async () => {
    setup({ actor: 'adminA' });
    state.service = null;
    await expect(bookingsService.proposeAlternative(BOOKING_REF, VEHICLE.available)).rejects.toBeInstanceOf(
      PrivilegedAccessUnavailableError
    );
    expect(writesTo(scenario.session.calls, 'bookings')).toHaveLength(0);
  });
});

describe('approve / reject — autorisation et transitions gardées', () => {
  it('B ne peut ni approuver ni refuser une demande de A (même si la RLS laissait la voir)', async () => {
    setup({ actor: 'adminB', rlsLeaksBooking: true });
    expect(await bookingsService.approveBooking(BOOKING_REF)).toMatchObject({ success: false, forbidden: true });
    expect(await bookingsService.rejectBooking(BOOKING_REF, 'motif')).toMatchObject({ success: false, forbidden: true });
    expect(scenario.service.calls).toHaveLength(0);
  });

  it('refus concurrent d’une approbation : la garde de statut empêche d’écraser la décision', async () => {
    setup({ actor: 'adminA', decision: { data: { ok: false, code: 'transition_conflict', status: 'APPROVED' } } });
    const result = await bookingsService.rejectBooking(BOOKING_REF, 'motif');
    expect(result).toMatchObject({ success: false, transitionConflict: true });
    expect(decisionArgs()).toMatchObject({ p_action: 'reject', p_expected_status: 'PENDING', p_agency_id: AGENCY_A });
    // Aucune remise en disponibilité du véhicule après un refus non enregistré
    expect(writesTo(scenario.service.calls, 'vehicles')).toHaveLength(0);
  });

  it('approbation par l’administrateur A : transition gardée et événement journalisé', async () => {
    setup({ actor: 'adminA' });
    const result = await bookingsService.approveBooking(BOOKING_REF, 'ok', 'actor-id');
    expect(result.success).toBe(true);
    expect(decisionArgs()).toMatchObject({ p_action: 'approve', p_expected_status: 'PENDING', p_agency_id: AGENCY_A });
    // Statut, journal et commission écrits ensemble par la fonction SQL ; le véhicule n'est pas touché
    // (il passe en RENTED à la remise des clés)
    expect(writesTo(scenario.service.calls, 'bookings')).toHaveLength(0);
    expect(writesTo(scenario.service.calls, 'vehicles')).toHaveLength(0);
    expect(writesTo(scenario.service.calls, 'booking_events')).toHaveLength(0);
  });

  it('chevauchement détecté par la contrainte d’exclusion (23P01) : conflit de disponibilité', async () => {
    setup({ actor: 'adminA', decision: { error: { message: 'conflicting key value violates exclusion constraint', code: '23P01' } } });
    expect(await bookingsService.approveBooking(BOOKING_REF)).toMatchObject({ success: false, availabilityConflict: true });
  });

  it('erreur base à l’approbation : message neutre', async () => {
    setup({ actor: 'adminA', decision: { error: { message: 'deadlock detected on bookings_pkey', code: '40P01' } } });
    const result = await bookingsService.approveBooking(BOOKING_REF);
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/deadlock|bookings_pkey/);
  });
});

describe('logEvent — échec d’écriture signalé', () => {
  it('une insertion refusée renvoie persisted: false (jamais un faux identifiant présenté comme enregistré)', async () => {
    setup({ actor: 'adminA' });
    const failing = buildScenario({ actor: 'adminA' });
    state.service = {
      ...failing.service.client,
      from: (table: string) =>
        table === 'booking_events'
          ? { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'denied' } }) }) }) }
          : failing.service.client.from(table),
    };
    const event = await bookingsService.logEvent('a3000000-0000-4000-8000-000000000001', 'AGENCY_ACCEPTED');
    expect(event.persisted).toBe(false);
  });
});
