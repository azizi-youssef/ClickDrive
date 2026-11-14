import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * API agence du suivi GPS : authentification, appartenance, permission, isolation entre agences, échec fermé.
 * La base est remplacée par un double : ces tests prouvent la logique des routes (garde, validation, appels
 * de fonctions). L'isolation réelle des données est prouvée par src/tests/db/gps-tracking.spec.ts.
 */

const A = '10000000-0000-4000-8000-00000000000a';
const B = '10000000-0000-4000-8000-00000000000b';
const VEHICLE = '20000000-0000-4000-8000-0000000000a1';
const OTHER_ID = '40000000-0000-4000-8000-0000000000f1';

type Auth = {
  userId: string;
  role: string;
  agencyIds: string[];
  memberships: { agencyId: string; role: string }[];
};

const mocks = vi.hoisted(() => ({
  clientMode: 'ok' as 'ok' | 'null' | 'throw',
  auth: null as null | { userId: string; role: string; agencyIds: string[]; memberships: unknown[]; email: string; displayName: string; avatarUrl: null; agencyName: null; agencyLogoUrl: null },
  permissions: new Set<string>(),
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcResults: {} as Record<string, unknown>,
  rpcErrors: {} as Record<string, { code: string; message: string }>,
  rows: {} as Record<string, Record<string, unknown>[]>,
  permissionCheckError: false,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: async () => null,
  checkRateLimit: () => ({ ok: true }),
  clientIpFromRequest: () => '203.0.113.9',
}));

vi.mock('@/lib/auth/server', () => ({
  getServerAuth: async () => mocks.auth,
}));

vi.mock('@/lib/supabase/server', () => {
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args });
      if (fn === 'has_tracking_permission') {
        if (mocks.permissionCheckError) return { data: null, error: { code: 'XX000', message: 'boom' } };
        return { data: mocks.permissions.has(`${args.p_agency_id}:${args.p_permission}`), error: null };
      }
      if (mocks.rpcErrors[fn]) return { data: null, error: mocks.rpcErrors[fn] };
      return { data: fn in mocks.rpcResults ? mocks.rpcResults[fn] : null, error: null };
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          const match = (mocks.rows[table] ?? []).find((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
          return { data: match ?? null, error: null };
        },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: (mocks.rows[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)), error: null }),
      };
      return builder;
    },
  };
  return {
    createClient: async () => {
      if (mocks.clientMode === 'throw') throw new Error('Supabase non configuré en production');
      return mocks.clientMode === 'null' ? null : db;
    },
    createAdminClient: async () => db,
  };
});

import * as vehiclesList from './vehicles/route';
import * as vehicleDetail from './vehicles/[id]/route';
import * as vehicleLocation from './vehicles/[id]/location/route';
import * as vehicleHistory from './vehicles/[id]/history/route';
import * as vehicleTrips from './vehicles/[id]/trips/route';
import * as trips from './trips/route';
import * as tripRoute from './trips/[id]/route/route';
import * as alerts from './alerts/route';
import * as alertItem from './alerts/[id]/route';
import * as trackers from './trackers/route';
import * as trackerItem from './trackers/[id]/route';
import * as geofences from './geofences/route';
import * as geofenceItem from './geofences/[id]/route';
import * as settings from './settings/route';
import * as supportGrants from './support-grants/route';
import * as supportGrantItem from './support-grants/[id]/route';
import * as webhookRoute from '../../webhooks/tracking/[provider]/route';

const BASE = 'https://clickdrive.ma/api/agency/tracking';
const RANGE = 'from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const idContext = { params: Promise.resolve({ id: VEHICLE }) };

function req(method: string, path: string, body?: unknown, extraQuery = '') {
  const url = `${BASE}${path}${extraQuery ? (path.includes('?') ? '&' : '?') + extraQuery : ''}`;
  return new NextRequest(url, { method, headers: body === undefined ? {} : JSON_HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
}

type Endpoint = {
  name: string;
  permission: string;
  call: (query?: string) => Promise<Response>;
};

const endpoints: Endpoint[] = [
  { name: 'GET vehicles', permission: 'tracking.read', call: (q) => vehiclesList.GET(req('GET', '/vehicles', undefined, q)) },
  { name: 'GET vehicles/[id]', permission: 'tracking.read', call: (q) => vehicleDetail.GET(req('GET', `/vehicles/${VEHICLE}`, undefined, q), idContext) },
  { name: 'GET vehicles/[id]/location', permission: 'tracking.read', call: (q) => vehicleLocation.GET(req('GET', `/vehicles/${VEHICLE}/location`, undefined, q), idContext) },
  { name: 'GET vehicles/[id]/history', permission: 'tracking.read', call: (q) => vehicleHistory.GET(req('GET', `/vehicles/${VEHICLE}/history?${RANGE}`, undefined, q), idContext) },
  { name: 'GET vehicles/[id]/trips', permission: 'tracking.read', call: (q) => vehicleTrips.GET(req('GET', `/vehicles/${VEHICLE}/trips?${RANGE}`, undefined, q), idContext) },
  { name: 'GET trips', permission: 'tracking.read', call: (q) => trips.GET(req('GET', `/trips?${RANGE}`, undefined, q)) },
  { name: 'GET trips/[id]/route', permission: 'tracking.read', call: (q) => tripRoute.GET(req('GET', `/trips/${VEHICLE}/route`, undefined, q), idContext) },
  { name: 'GET alerts', permission: 'tracking.read', call: (q) => alerts.GET(req('GET', '/alerts', undefined, q)) },
  { name: 'PATCH alerts/[id]', permission: 'tracking.alerts.manage', call: (q) => alertItem.PATCH(req('PATCH', `/alerts/${VEHICLE}`, { action: 'acknowledge' }, q), idContext) },
  { name: 'GET trackers', permission: 'tracking.read', call: (q) => trackers.GET(req('GET', '/trackers', undefined, q)) },
  { name: 'POST trackers', permission: 'tracking.manage', call: (q) => trackers.POST(req('POST', '/trackers', { provider: 'klickdrive-gateway', external_device_id: 'DEV-1' }, q)) },
  { name: 'PATCH trackers/[id]', permission: 'tracking.manage', call: (q) => trackerItem.PATCH(req('PATCH', `/trackers/${VEHICLE}`, { label: 'Nouveau' }, q), idContext) },
  { name: 'GET geofences', permission: 'tracking.read', call: (q) => geofences.GET(req('GET', '/geofences', undefined, q)) },
  { name: 'POST geofences', permission: 'tracking.manage', call: (q) => geofences.POST(req('POST', '/geofences', { name: 'Zone', center_latitude: 35.1, center_longitude: -2.9, radius_m: 300 }, q)) },
  { name: 'PATCH geofences/[id]', permission: 'tracking.manage', call: (q) => geofenceItem.PATCH(req('PATCH', `/geofences/${VEHICLE}`, { name: 'Zone', center_latitude: 35.1, center_longitude: -2.9, radius_m: 300 }, q), idContext) },
  { name: 'DELETE geofences/[id]', permission: 'tracking.manage', call: (q) => geofenceItem.DELETE(req('DELETE', `/geofences/${VEHICLE}`, undefined, q), idContext) },
  { name: 'GET settings', permission: 'tracking.read', call: (q) => settings.GET(req('GET', '/settings', undefined, q)) },
  { name: 'PATCH settings', permission: 'tracking.settings.manage', call: (q) => settings.PATCH(req('PATCH', '/settings', { retention_days: 30 }, q)) },
  { name: 'GET support-grants', permission: 'tracking.settings.manage', call: (q) => supportGrants.GET(req('GET', '/support-grants', undefined, q)) },
  { name: 'DELETE support-grants/[id]', permission: 'tracking.settings.manage', call: (q) => supportGrantItem.DELETE(req('DELETE', `/support-grants/${VEHICLE}`, undefined, q), idContext) },
];

function memberOfA(role = 'AGENCY_OWNER'): NonNullable<typeof mocks.auth> {
  return { userId: 'user-a', role, agencyIds: [A], memberships: [{ agencyId: A, role: 'agency_admin' }], email: 'a@test.invalid', displayName: 'A', avatarUrl: null, agencyName: null, agencyLogoUrl: null };
}

const grantAll = (agency: string) => ['read', 'manage', 'alerts.manage', 'settings.manage'].forEach((p) => mocks.permissions.add(`${agency}:tracking.${p}`));
const permissionChecks = () => mocks.rpcCalls.filter((c) => c.fn === 'has_tracking_permission');
const dataCalls = () => mocks.rpcCalls.filter((c) => c.fn !== 'has_tracking_permission');

beforeEach(() => {
  mocks.clientMode = 'ok';
  mocks.auth = null;
  mocks.permissions = new Set();
  mocks.rpcCalls = [];
  mocks.rpcResults = {};
  mocks.rpcErrors = {};
  mocks.rows = {};
  mocks.permissionCheckError = false;
});

describe.each(endpoints)('$name — garde d’accès', (endpoint) => {
  it('configuration Supabase absente ou en échec : 503 (échec fermé), aucune donnée', async () => {
    mocks.auth = memberOfA();
    grantAll(A);
    mocks.clientMode = 'null';
    expect((await endpoint.call()).status).toBe(503);
    mocks.clientMode = 'throw';
    expect((await endpoint.call()).status).toBe(503);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('non authentifié : 401', async () => {
    expect((await endpoint.call()).status).toBe(401);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('client (aucune agence) : 403, sans aucune lecture', async () => {
    mocks.auth = { ...memberOfA('CUSTOMER'), agencyIds: [], memberships: [] };
    expect((await endpoint.call()).status).toBe(403);
    expect(dataCalls()).toHaveLength(0);
  });

  it('membre sans la permission requise (agent, lecteur…) : 403, aucune lecture ni écriture', async () => {
    mocks.auth = memberOfA('AGENCY_STAFF');
    const response = await endpoint.call();
    expect(response.status).toBe(403);
    expect(permissionChecks()).toEqual([{ fn: 'has_tracking_permission', args: { p_agency_id: A, p_permission: endpoint.permission } }]);
    expect(dataCalls()).toHaveLength(0);
    expect(await response.json()).toMatchObject({ success: false, code: 'FORBIDDEN' });
  });

  it('une autre agence demandée par agency_id : 403 sans même interroger la base pour cette agence', async () => {
    mocks.auth = memberOfA();
    grantAll(A);
    grantAll(B);
    const response = await endpoint.call(`agency_id=${B}`);
    expect(response.status).toBe(403);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('agency_id invalide : 400', async () => {
    mocks.auth = memberOfA();
    grantAll(A);
    expect((await endpoint.call('agency_id=pas-un-uuid')).status).toBe(400);
  });

  it('permission vérifiée sur l’agence du membre (jamais celle d’un paramètre de requête) ; échec de la vérification : 503', async () => {
    mocks.auth = memberOfA();
    grantAll(A);
    mocks.permissionCheckError = true;
    expect((await endpoint.call()).status).toBe(503);
    expect(dataCalls()).toHaveLength(0);
  });

  it('Super Admin sans autorisation de support : refusé par la base (403) ; sans agency_id : 400', async () => {
    mocks.auth = { ...memberOfA('SUPER_ADMIN'), agencyIds: [], memberships: [] };
    expect((await endpoint.call()).status).toBe(400);
    expect((await endpoint.call(`agency_id=${A}`)).status).toBe(403);
    expect(permissionChecks()).toHaveLength(1);
    expect(dataCalls()).toHaveLength(0);
  });
});

describe('accès autorisé', () => {
  beforeEach(() => {
    mocks.auth = memberOfA();
    grantAll(A);
  });

  it('flotte : l’agence vient de l’appartenance, les paramètres sont validés et la réponse n’est jamais mise en cache', async () => {
    mocks.rpcResults.tracking_fleet_overview = {
      summary: { total_vehicles: 0, tracked: 0, online: 0, moving: 0, stationary: 0, offline: 0, awaiting: 0, disabled: 0, untracked: 0, open_alerts: 0 },
      total: 0, limit: 200, offset: 0, generated_at: '2026-11-14T10:00:00Z', vehicles: [],
    };
    const response = await vehiclesList.GET(req('GET', '/vehicles', undefined, 'state=moving&q=logan'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(dataCalls()[0]).toEqual({
      fn: 'tracking_fleet_overview',
      args: { p_agency_id: A, p_search: 'logan', p_state: 'MOVING', p_limit: 200, p_offset: 0 },
    });
    expect((await vehiclesList.GET(req('GET', '/vehicles', undefined, 'limit=9999'))).status).toBe(422);
  });

  it('une réponse de base de données incohérente n’atteint pas le navigateur (500 neutre)', async () => {
    mocks.rpcResults.tracking_fleet_overview = { summary: 'oups' };
    const response = await vehiclesList.GET(req('GET', '/vehicles'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/oups|summary/);
  });

  it('historique : période de 31 jours maximum, consultation journalisée seulement après succès', async () => {
    const tooLong = 'from=2026-09-01T00:00:00Z&to=2026-11-01T00:00:00Z';
    const refused = await vehicleHistory.GET(req('GET', `/vehicles/${VEHICLE}/history?${tooLong}`), idContext);
    expect(refused.status).toBe(422);
    expect(dataCalls()).toHaveLength(0);

    mocks.rpcResults.tracking_vehicle_history = { points: [], limit: 500, next_cursor: { recorded_at: '2026-11-01T10:00:00.123Z', id: 9 } };
    const ok = await vehicleHistory.GET(req('GET', `/vehicles/${VEHICLE}/history?${RANGE}`), idContext);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(typeof body.meta.next_cursor).toBe('string');
    expect(dataCalls().map((c) => c.fn)).toEqual(['tracking_vehicle_history', 'tracking_record_access']);
    expect(dataCalls()[1]!.args).toMatchObject({ p_agency_id: A, p_action: 'history.read', p_entity_id: VEHICLE });
  });

  it('historique d’un véhicule d’une autre agence : 404 et aucune trace de lecture', async () => {
    mocks.rpcErrors.tracking_vehicle_history = { code: 'P0002', message: 'vehicle not found' };
    const response = await vehicleHistory.GET(req('GET', `/vehicles/${VEHICLE}/history?${RANGE}`), idContext);
    expect(response.status).toBe(404);
    expect(dataCalls().map((c) => c.fn)).toEqual(['tracking_vehicle_history']);
  });

  it('un identifiant de ressource invalide : 404 sans appel à la base', async () => {
    const response = await vehicleDetail.GET(req('GET', '/vehicles/pas-un-uuid'), { params: Promise.resolve({ id: 'pas-un-uuid' }) });
    expect(response.status).toBe(404);
    expect(dataCalls()).toHaveLength(0);
  });

  it('boîtier d’une autre agence : 404 et aucune opération n’est exécutée (modification, affectation, déconnexion)', async () => {
    mocks.rows.vehicle_trackers = [{ id: VEHICLE, agency_id: B }];
    for (const body of [{ label: 'Piraté' }, { vehicle_id: null }, { disconnect: true }]) {
      const response = await trackerItem.PATCH(req('PATCH', `/trackers/${VEHICLE}`, body), idContext);
      expect(response.status, JSON.stringify(body)).toBe(404);
    }
    expect(dataCalls()).toHaveLength(0);
  });

  it('boîtier de l’agence : chaque opération appelle la bonne fonction atomique', async () => {
    mocks.rows.vehicle_trackers = [{ id: VEHICLE, agency_id: A }];
    await trackerItem.PATCH(req('PATCH', `/trackers/${VEHICLE}`, { label: 'Logan 12', enabled: false }), idContext);
    await trackerItem.PATCH(req('PATCH', `/trackers/${VEHICLE}`, { vehicle_id: OTHER_ID, reason: 'Déplacé' }), idContext);
    await trackerItem.PATCH(req('PATCH', `/trackers/${VEHICLE}`, { disconnect: true }), idContext);
    expect(dataCalls().map((c) => c.fn)).toEqual(['update_vehicle_tracker', 'assign_vehicle_tracker', 'disconnect_vehicle_tracker']);
    expect(dataCalls()[0]!.args).toEqual({ p_tracker_id: VEHICLE, p_changes: { label: 'Logan 12', enabled: false } });
  });

  it('corps strict : agency_id ou statut fournis par le navigateur sont refusés (422), plusieurs opérations aussi', async () => {
    mocks.rows.vehicle_trackers = [{ id: VEHICLE, agency_id: A }];
    const withAgency = await trackers.POST(req('POST', '/trackers', { provider: 'klickdrive-gateway', external_device_id: 'DEV-1', agency_id: B }));
    expect(withAgency.status).toBe(422);
    const mixed = await trackerItem.PATCH(req('PATCH', `/trackers/${VEHICLE}`, { label: 'x', disconnect: true }), idContext);
    expect(mixed.status).toBe(422);
    expect(dataCalls()).toHaveLength(0);
  });

  it('enregistrer un boîtier : fournisseur non intégré refusé (aucune connectivité simulée), fournisseur intégré accepté', async () => {
    const pending = await trackers.POST(req('POST', '/trackers', { provider: 'traccar', external_device_id: 'DEV-1' }));
    expect(pending.status).toBe(422);
    expect(await pending.json()).toMatchObject({ code: 'PROVIDER_PENDING' });
    expect(dataCalls()).toHaveLength(0);

    mocks.rpcResults.register_vehicle_tracker = VEHICLE;
    const ok = await trackers.POST(req('POST', '/trackers', { provider: 'klickdrive-gateway', external_device_id: 'DEV-1', vehicle_id: OTHER_ID }));
    expect(ok.status).toBe(201);
    expect(dataCalls()[0]).toMatchObject({ fn: 'register_vehicle_tracker', args: { p_agency_id: A, p_provider: 'klickdrive-gateway', p_vehicle_id: OTHER_ID } });
  });

  it('conflits (boîtier ou véhicule déjà équipé) : 409 avec un message identique que le boîtier soit chez nous ou ailleurs', async () => {
    mocks.rpcErrors.register_vehicle_tracker = { code: '23505', message: 'duplicate key value violates unique constraint "uq_vehicle_trackers_device_active"' };
    const response = await trackers.POST(req('POST', '/trackers', { provider: 'klickdrive-gateway', external_device_id: 'DEV-1' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DEVICE_ALREADY_REGISTERED', error: 'Ce boîtier est déjà enregistré.' });
  });

  it('zone et alerte d’une autre agence : 404, aucune suppression ni accusé de réception', async () => {
    mocks.rows.vehicle_geofences = [{ id: VEHICLE, agency_id: B }];
    mocks.rows.tracking_alerts = [{ id: VEHICLE, agency_id: B }];
    expect((await geofenceItem.DELETE(req('DELETE', `/geofences/${VEHICLE}`), idContext)).status).toBe(404);
    const zone = { name: 'Zone', center_latitude: 35.1, center_longitude: -2.9, radius_m: 300 };
    expect((await geofenceItem.PATCH(req('PATCH', `/geofences/${VEHICLE}`, zone), idContext)).status).toBe(404);
    expect((await alertItem.PATCH(req('PATCH', `/alerts/${VEHICLE}`, { action: 'acknowledge' }), idContext)).status).toBe(404);
    expect(dataCalls()).toHaveLength(0);
  });

  it('accusé de réception d’une alerte de l’agence', async () => {
    mocks.rows.tracking_alerts = [{ id: VEHICLE, agency_id: A }];
    mocks.rpcResults.acknowledge_tracking_alert = { changed: true, status: 'ACKNOWLEDGED', acknowledged_at: '2026-11-14T10:00:00Z' };
    const response = await alertItem.PATCH(req('PATCH', `/alerts/${VEHICLE}`, { action: 'acknowledge' }), idContext);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ changed: true, status: 'ACKNOWLEDGED' });
  });

  it('création de zone : valide → 201 ; rayon hors bornes → 422 ; limite atteinte → 409', async () => {
    mocks.rpcResults.save_vehicle_geofence = VEHICLE;
    const zone = { name: 'Zone', center_latitude: 35.1, center_longitude: -2.9, radius_m: 300, vehicle_ids: [OTHER_ID] };
    expect((await geofences.POST(req('POST', '/geofences', zone))).status).toBe(201);
    expect(dataCalls()[0]!.args).toMatchObject({ p_agency_id: A, p_geofence_id: null, p_vehicle_ids: [OTHER_ID] });
    expect((await geofences.POST(req('POST', '/geofences', { ...zone, radius_m: 5 }))).status).toBe(422);
    mocks.rpcErrors.save_vehicle_geofence = { code: '54000', message: 'geofence limit reached' };
    expect((await geofences.POST(req('POST', '/geofences', zone))).status).toBe(409);
  });

  it('un corps non JSON ou de mauvais type : 400 / 415 ; corps trop volumineux : 413', async () => {
    const notJson = new NextRequest(`${BASE}/geofences`, { method: 'POST', headers: JSON_HEADERS, body: '{oups' });
    expect((await geofences.POST(notJson)).status).toBe(400);
    const wrongType = new NextRequest(`${BASE}/geofences`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    expect((await geofences.POST(wrongType)).status).toBe(415);
    const huge = new NextRequest(`${BASE}/geofences`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'x'.repeat(70_000) }) });
    expect((await geofences.POST(huge)).status).toBe(413);
  });

  it('paramètres : un gestionnaire (sans tracking.settings.manage) ne peut pas modifier la conservation', async () => {
    mocks.permissions = new Set([`${A}:tracking.read`, `${A}:tracking.manage`, `${A}:tracking.alerts.manage`]);
    expect((await settings.GET(req('GET', '/settings'))).status).toBe(200);
    const response = await settings.PATCH(req('PATCH', '/settings', { retention_days: 30 }));
    expect(response.status).toBe(403);
    expect(dataCalls().map((c) => c.fn)).toEqual(['tracking_get_settings']);
  });

  it('paramètres : un administrateur modifie ; valeurs hors bornes refusées avant la base', async () => {
    mocks.rpcResults.update_tracking_settings = { retention_days: 30, configured: true };
    expect((await settings.PATCH(req('PATCH', '/settings', { retention_days: 30 }))).status).toBe(200);
    expect((await settings.PATCH(req('PATCH', '/settings', { retention_days: 3 }))).status).toBe(422);
    expect((await settings.PATCH(req('PATCH', '/settings', { agency_id: B }))).status).toBe(422);
    expect(dataCalls().filter((c) => c.fn === 'update_tracking_settings')).toHaveLength(1);
  });
});

describe('support plateforme (Super Admin avec autorisation explicite)', () => {
  it('lecture seule : autorisée si la base l’accorde, journalisée AVANT d’être servie ; gestion refusée', async () => {
    mocks.auth = { ...memberOfA('SUPER_ADMIN'), agencyIds: [], memberships: [] };
    mocks.permissions = new Set([`${A}:tracking.read`]); // ce que renvoie has_tracking_permission avec une autorisation active
    mocks.rpcResults.tracking_fleet_overview = {
      summary: { total_vehicles: 0, tracked: 0, online: 0, moving: 0, stationary: 0, offline: 0, awaiting: 0, disabled: 0, untracked: 0, open_alerts: 0 },
      total: 0, limit: 200, offset: 0, generated_at: '2026-11-14T10:00:00Z', vehicles: [],
    };
    const read = await vehiclesList.GET(req('GET', '/vehicles', undefined, `agency_id=${A}`));
    expect(read.status).toBe(200);
    expect(dataCalls().map((c) => c.fn)).toEqual(['tracking_record_access', 'tracking_fleet_overview']);
    expect(dataCalls()[0]!.args).toMatchObject({ p_agency_id: A, p_action: 'support.read' });

    const write = await trackers.POST(req('POST', '/trackers', { provider: 'klickdrive-gateway', external_device_id: 'DEV-1' }, `agency_id=${A}`));
    expect(write.status).toBe(403);
  });

  it('si la trace d’audit échoue, la donnée n’est pas servie', async () => {
    mocks.auth = { ...memberOfA('SUPER_ADMIN'), agencyIds: [], memberships: [] };
    mocks.permissions = new Set([`${A}:tracking.read`]);
    mocks.rpcErrors.tracking_record_access = { code: 'XX000', message: 'audit indisponible' };
    const response = await vehiclesList.GET(req('GET', '/vehicles', undefined, `agency_id=${A}`));
    expect(response.status).toBe(500);
    expect(dataCalls().map((c) => c.fn)).toEqual(['tracking_record_access']);
  });
});

describe('webhook : méthodes', () => {
  it('GET refusé (405) : aucune vérification d’URL de type « challenge »', async () => {
    const response = await webhookRoute.GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

export type { Auth };
