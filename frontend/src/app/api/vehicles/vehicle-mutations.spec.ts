import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eqValue, writesTo } from '@/tests/support/fake-supabase';
import {
  AGENCY_A,
  AGENCY_B,
  VEHICLE,
  buildScenario,
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

import { POST as legacyCreate } from './route';
import { DELETE as legacyDelete, PATCH as legacyPatch } from './[ref]/route';
import { POST as agencyCreate } from '../agencies/[id]/vehicles/route';
import { PATCH as agencyPatch } from '../agencies/[id]/vehicles/[vehicleId]/route';

let scenario: ReturnType<typeof buildScenario>;

function setup(options: ScenarioOptions) {
  state.actor = options.actor;
  scenario = buildScenario(options);
  state.session = scenario.session.client;
  state.service = scenario.service.client;
  state.publicClient = scenario.publicClient.client;
}

function json(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const patchLegacy = (vehicleId: string, body: unknown) =>
  legacyPatch(json(`/api/vehicles/${vehicleId}`, 'PATCH', body), { params: Promise.resolve({ ref: vehicleId }) });
const createLegacy = (body: unknown) => legacyCreate(json('/api/vehicles', 'POST', body));

const vehicleWrites = () => writesTo(scenario.service.calls, 'vehicles');
const vehicleUpdates = () => vehicleWrites().filter((call) => call.op === 'update');
const vehicleInserts = () => vehicleWrites().filter((call) => call.op === 'insert');

const VALID_VEHICLE = {
  brand: 'Dacia',
  model: 'Logan',
  year: 2025,
  category: 'Économique',
  transmission: 'MANUAL',
  fuel: 'DIESEL',
  daily_price: 300,
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
});

describe('PATCH /api/vehicles/[ref] (historique, délègue à la route agence)', () => {
  it('sans session : 401, aucune requête', async () => {
    setup({ actor: 'none' });
    const response = await patchLegacy(VEHICLE.available, { daily_price: 350 });
    expect(response.status).toBe(401);
    expect(scenario.session.calls).toHaveLength(0);
    expect(scenario.service.calls).toHaveLength(0);
  });

  it('mise à jour autorisée : 200, bornée à l’agence propriétaire lue en base, route signalée obsolète', async () => {
    setup({ actor: 'adminA' });
    const response = await patchLegacy(VEHICLE.available, { daily_price: 350 });
    expect(response.status).toBe(200);
    expect(response.headers.get('Deprecation')).toBe('true');
    const [update] = vehicleUpdates();
    expect(eqValue(update, 'agency_id')).toBe(AGENCY_A);
    expect(update.payload).not.toHaveProperty('agency_id');
    expect(update.payload).toMatchObject({ daily_price: 350 });
  });

  it.each([
    [{ agency_id: AGENCY_B }, 400],
    [{ featured: true }, 403],
    [{ id: VEHICLE.otherAgency }, 400],
    [{ unknown_column: 1 }, 400],
  ])('champ protégé ou inconnu %j : %i, aucune écriture', async (body, status) => {
    setup({ actor: 'adminA' });
    const response = await patchLegacy(VEHICLE.available, body);
    expect(response.status).toBe(status);
    expect(vehicleWrites()).toHaveLength(0);
  });

  it('charge invalide (Zod) : refusée, aucune écriture', async () => {
    setup({ actor: 'adminA' });
    const response = await patchLegacy(VEHICLE.available, { daily_price: -5 });
    expect(response.status).toBe(422);
    expect(vehicleWrites()).toHaveLength(0);
  });

  it.each([{ status: 'MAINTENANCE' }, { published: false }])(
    'agent A (sans vehicles.manage) ne modifie pas %j : 403',
    async (body) => {
      setup({ actor: 'agentA' });
      const response = await patchLegacy(VEHICLE.available, body);
      expect(response.status).toBe(403);
      expect(vehicleWrites()).toHaveLength(0);
    }
  );

  it('administrateur A (vehicles.manage) modifie statut et publication : 200', async () => {
    setup({ actor: 'adminA' });
    const response = await patchLegacy(VEHICLE.available, { status: 'MAINTENANCE', published: false });
    expect(response.status).toBe(200);
    expect(vehicleUpdates()[0].payload).toMatchObject({ status: 'MAINTENANCE', published: false });
  });

  it('agence B : 403 sur un véhicule publié de A, 404 sur un véhicule non publié de A', async () => {
    setup({ actor: 'adminB' });
    expect((await patchLegacy(VEHICLE.available, { daily_price: 1 })).status).toBe(403);
    expect((await patchLegacy(VEHICLE.unpublished, { daily_price: 1 })).status).toBe(404);
    expect(vehicleWrites()).toHaveLength(0);
  });

  it('DELETE par l’agence B : refusé, aucune écriture', async () => {
    setup({ actor: 'adminB' });
    const response = await legacyDelete(json(`/api/vehicles/${VEHICLE.available}`, 'DELETE'), {
      params: Promise.resolve({ ref: VEHICLE.available }),
    });
    expect(response.status).toBe(403);
    expect(vehicleWrites()).toHaveLength(0);
  });
});

describe('POST /api/vehicles (historique, délègue à la route agence)', () => {
  it('sans session : 401', async () => {
    setup({ actor: 'none' });
    expect((await createLegacy(VALID_VEHICLE)).status).toBe(401);
    expect(vehicleInserts()).toHaveLength(0);
  });

  it('agence déduite de la session : 201, rattaché à l’agence A', async () => {
    setup({ actor: 'adminA' });
    const response = await createLegacy(VALID_VEHICLE);
    expect(response.status).toBe(201);
    expect(response.headers.get('Deprecation')).toBe('true');
    expect(vehicleInserts()[0].payload).toMatchObject({ agency_id: AGENCY_A, brand: 'Dacia' });
  });

  it('agency_id d’une autre agence : 403, aucune insertion', async () => {
    setup({ actor: 'adminA' });
    expect((await createLegacy({ ...VALID_VEHICLE, agency_id: AGENCY_B })).status).toBe(403);
    expect(vehicleInserts()).toHaveLength(0);
  });

  it.each([
    [{ featured: true }, 403],
    [{ slug: 'force-slug' }, 400],
    [{ rating: 5 }, 403],
    [{ hacked: true }, 400],
  ])('champ protégé ou inconnu %j : %i', async (extra, status) => {
    setup({ actor: 'adminA' });
    expect((await createLegacy({ ...VALID_VEHICLE, ...extra })).status).toBe(status);
    expect(vehicleInserts()).toHaveLength(0);
  });

  it('charge invalide (Zod) : refusée', async () => {
    setup({ actor: 'adminA' });
    const { brand: _brand, ...withoutBrand } = VALID_VEHICLE;
    void _brand;
    expect((await createLegacy(withoutBrand)).status).toBe(422);
    expect(vehicleInserts()).toHaveLength(0);
  });

  it('agent A (sans vehicles.manage) : 403', async () => {
    setup({ actor: 'agentA' });
    expect((await createLegacy(VALID_VEHICLE)).status).toBe(403);
    expect(vehicleInserts()).toHaveLength(0);
  });
});

describe('Capacité de la formule (routes historique et canonique)', () => {
  it('flotte pleine (15/15, palier starter) : 409, aucune insertion', async () => {
    setup({ actor: 'adminA', vehicleCountByAgency: { [AGENCY_A]: 15 } });
    const response = await createLegacy(VALID_VEHICLE);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CAPACITY_LIMIT_REACHED');
    expect(vehicleInserts()).toHaveLength(0);
  });

  it('formule de l’abonnement prioritaire : « pro » accepte un 16e véhicule', async () => {
    setup({
      actor: 'adminA',
      vehicleCountByAgency: { [AGENCY_A]: 15 },
      subscriptionPlan: { id: 'c1000000-0000-4000-8000-000000000002', slug: 'pro', name: 'Pro', max_vehicles: 25 },
    });
    expect((await createLegacy(VALID_VEHICLE)).status).toBe(201);
  });

  it('quota invérifiable (erreur base) : 503, aucune insertion (fail-closed)', async () => {
    setup({ actor: 'adminA', capacityReadError: true });
    const response = await createLegacy(VALID_VEHICLE);
    expect(response.status).toBe(503);
    expect(vehicleInserts()).toHaveLength(0);
  });

  it('aucune formule en base : 503 (jamais la grille codée en dur)', async () => {
    setup({ actor: 'adminA', plans: [] });
    expect((await createLegacy(VALID_VEHICLE)).status).toBe(503);
    expect(vehicleInserts()).toHaveLength(0);
  });

  it('clé service-role absente : 503', async () => {
    setup({ actor: 'adminA' });
    state.service = null;
    expect((await createLegacy(VALID_VEHICLE)).status).toBe(503);
  });

  it('ajouts simultanés : le trigger SQL refuse le dépassement, l’API répond 409 (pas 500)', async () => {
    setup({
      actor: 'adminA',
      vehicleCountByAgency: { [AGENCY_A]: 14 },
      vehicleInsertError: { message: 'VEHICLE_CAPACITY_REACHED', code: 'P0001' },
    });
    const response = await createLegacy(VALID_VEHICLE);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe('CAPACITY_LIMIT_REACHED');
    expect(body.error).not.toContain('P0001');
  });

  it('route canonique : agency_id du corps différent de l’URL refusé', async () => {
    setup({ actor: 'adminA' });
    const response = await agencyCreate(json(`/api/agencies/${AGENCY_A}/vehicles`, 'POST', { ...VALID_VEHICLE, agency_id: AGENCY_B }), {
      params: Promise.resolve({ id: AGENCY_A }),
    });
    expect(response.status).toBe(400);
    expect(vehicleInserts()).toHaveLength(0);
  });
});

describe('Route canonique PATCH — formulaire de l’espace agence', () => {
  /** Ligne telle que l'espace agence la reçoit de GET /api/agencies/[id]/vehicles (photos en URL) */
  const formRow = () => {
    const row = scenario.vehicles[VEHICLE.available] as unknown as Record<string, unknown> & { images: { url: string }[] };
    return { ...row, images: row.images.map((image) => image.url), features: [] as string[] };
  };

  const patchAgency = (body: unknown) =>
    agencyPatch(json(`/api/agencies/${AGENCY_A}/vehicles/${VEHICLE.available}`, 'PATCH', body), {
      params: Promise.resolve({ id: AGENCY_A, vehicleId: VEHICLE.available }),
    });

  it('ligne complète renvoyée par le formulaire (champs protégés inchangés, horodatage ancien) : acceptée', async () => {
    setup({ actor: 'adminA' });
    const row = formRow();
    const response = await patchAgency({ ...row, updated_at: '2020-01-01T00:00:00.000Z', daily_price: 320 });
    expect(response.status).toBe(200);
    const [update] = vehicleUpdates();
    expect(update.payload).toMatchObject({ daily_price: 320 });
    expect(update.payload).not.toHaveProperty('agency_id');
    expect(update.payload).not.toHaveProperty('featured');
  });

  it.each([
    [{ agency_id: AGENCY_B }, 400],
    [{ featured: true }, 403],
  ])('tentative de modification %j : %i', async (change, status) => {
    setup({ actor: 'adminA' });
    const row = formRow();
    expect((await patchAgency({ ...row, ...change })).status).toBe(status);
    expect(vehicleUpdates()).toHaveLength(0);
  });
});
