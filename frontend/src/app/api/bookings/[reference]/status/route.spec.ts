import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { writesTo } from '@/tests/support/fake-supabase';
import {
  BOOKING_REF,
  VEHICLE,
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

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // Hors requête Next, after() n'a pas de contexte : les notifications différées sont ignorées
  after: () => undefined,
}));
vi.mock('@/lib/bookings/notifications', () => ({ notifyBookingStatusByReference: async () => undefined }));
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: async () => undefined }));
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

import { POST } from './route';

let scenario: ReturnType<typeof buildScenario>;

function setup(options: ScenarioOptions) {
  state.actor = options.actor;
  scenario = buildScenario(options);
  state.session = scenario.session.client;
  state.service = scenario.service.client;
  state.publicClient = scenario.publicClient.client;
}

function call(body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/bookings/${BOOKING_REF}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ reference: BOOKING_REF }) }
  );
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
});

describe('POST /api/bookings/[reference]/status — proposition d’alternative', () => {
  it('sans session : 401', async () => {
    setup({ actor: 'none' });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.available });
    expect(response.status).toBe(401);
  });

  it('agence B sur une réservation de A : 404 sans divulgation (RLS)', async () => {
    setup({ actor: 'adminB' });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.otherAgency });
    expect(response.status).toBe(404);
  });

  it('agence B avec une réservation visible : 403', async () => {
    setup({ actor: 'adminB', rlsLeaksBooking: true });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.otherAgency });
    expect(response.status).toBe(403);
    expect(writesTo(scenario.service.calls, 'bookings')).toHaveLength(0);
  });

  it('agence A qui propose un véhicule de B : 404, aucune donnée de B dans la réponse', async () => {
    setup({ actor: 'adminA' });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.otherAgency });
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(leaksPrivateVehicleData(body)).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/Peugeot/);
  });

  it('véhicule indisponible : 409', async () => {
    setup({ actor: 'adminA' });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.booked });
    expect(response.status).toBe(409);
  });

  it('véhicule non publié : refusé (400)', async () => {
    setup({ actor: 'adminA' });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.unpublished });
    expect(response.status).toBe(400);
  });

  it('succès : 200, alternative en projection publique (ni plaque, ni n° interne, ni documents)', async () => {
    setup({ actor: 'agentA' });
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.available });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.booking.alternative_vehicle.id).toBe(VEHICLE.available);
    expect(leaksPrivateVehicleData(body)).toEqual([]);
  });

  it('clé service-role absente : 503 avec message neutre', async () => {
    setup({ actor: 'adminA' });
    state.service = null;
    const response = await call({ action: 'propose_alternative', alternativeVehicleId: VEHICLE.available });
    expect(response.status).toBe(503);
    expect((await response.json()).error).not.toMatch(/SUPABASE|service_role|clé/i);
  });
});
