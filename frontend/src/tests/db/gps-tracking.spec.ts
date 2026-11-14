import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { ACCESS_PERMISSIONS, AGENCY_ROLE_TRACKING_PERMISSIONS, TRACKING_PERMISSIONS } from '@clickdrive/shared/roles';
import { asRole, createTestDatabase, errorOf, type DbRole } from './harness';

/**
 * Suivi GPS (migrations 20261119000100 et 20261119000200), sur la vraie base PGlite : permissions, RLS,
 * ingestion idempotente, trajets, alertes, zones, audit, support plateforme, purge.
 *
 * Limite assumée : PGlite n'est pas Supabase. Ces tests prouvent le comportement des migrations du dépôt ;
 * le filtrage Realtime réel (WebSocket, JWT) et PostgREST ne sont pas exercés ici (voir docs/gps-tracking.md).
 */

const ID = {
  adminA: '00000000-0000-4000-8000-0000000000a2',
  managerA: '00000000-0000-4000-8000-0000000000a6',
  agentA: '00000000-0000-4000-8000-0000000000a3',
  viewerA: '00000000-0000-4000-8000-0000000000a4',
  adminB: '00000000-0000-4000-8000-0000000000b2',
  customer: '00000000-0000-4000-8000-0000000000c1',
  superAdmin: '00000000-0000-4000-8000-0000000000f1',
  agencyA: '10000000-0000-4000-8000-00000000000a',
  agencyB: '10000000-0000-4000-8000-00000000000b',
  vehicleA1: '20000000-0000-4000-8000-0000000000a1',
  vehicleA2: '20000000-0000-4000-8000-0000000000a2',
  vehicleB1: '20000000-0000-4000-8000-0000000000b1',
  bookingA1: '30000000-0000-4000-8000-0000000000a1',
} as const;

const PROVIDER = 'testprov';
const LAT0 = 35.1688;
const LON0 = -2.9335;
/** 1° de latitude ≈ 111,195 km */
const KM_PER_DEG = 111.195;

async function seed(db: PGlite) {
  const users: [string, string][] = [
    [ID.adminA, 'admin.a@test.invalid'],
    [ID.managerA, 'manager.a@test.invalid'],
    [ID.agentA, 'agent.a@test.invalid'],
    [ID.viewerA, 'viewer.a@test.invalid'],
    [ID.adminB, 'admin.b@test.invalid'],
    [ID.customer, 'customer@test.invalid'],
    [ID.superAdmin, 'super@test.invalid'],
  ];
  for (const [id, email] of users) await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, email]);
  await db.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.superAdmin]);

  const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                  VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
  await db.query(agency, [ID.agencyA, 'Agence A', 'agence-a-gps', 'a-gps@test.invalid']);
  await db.query(agency, [ID.agencyB, 'Agence B', 'agence-b-gps', 'b-gps@test.invalid']);

  const member = `INSERT INTO public.agency_members (agency_id, user_id, role, status) VALUES ($1, $2, $3, 'ACTIVE')`;
  await db.query(member, [ID.agencyA, ID.adminA, 'agency_admin']);
  await db.query(member, [ID.agencyA, ID.managerA, 'agency_manager']);
  await db.query(member, [ID.agencyA, ID.agentA, 'agency_agent']);
  await db.query(member, [ID.agencyA, ID.viewerA, 'viewer']);
  await db.query(member, [ID.agencyB, ID.adminB, 'agency_admin']);

  const vehicle = `INSERT INTO public.vehicles (id, agency_id, unit_number, license_plate, brand, model, slug, year, category, transmission, fuel, daily_price, published)
                   VALUES ($1, $2, $3, $4, 'Dacia', 'Logan', $5, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`;
  await db.query(vehicle, [ID.vehicleA1, ID.agencyA, 'A-1', '11111-A-50', 'dacia-logan-gps-a1']);
  await db.query(vehicle, [ID.vehicleA2, ID.agencyA, 'A-2', '22222-A-50', 'dacia-logan-gps-a2']);
  await db.query(vehicle, [ID.vehicleB1, ID.agencyB, 'B-1', '33333-B-50', 'dacia-logan-gps-b1']);

  // Location en cours (retrait effectué) sur le véhicule A1 : sert à l'association réservation
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
     VALUES ($1, 'CD-2026-900001', 'CD-2026-900001', $2, $3, 'Locataire Privé', 'locataire@test.invalid', '0600000000',
       current_date - 1, current_date + 2, 4, 300, 1200, 3000, 'ACTIVE')`,
    [ID.bookingA1, ID.vehicleA1, ID.agencyA]
  );
}

type Row = Record<string, unknown>;

/** Change d'identité au sein d'une même transaction de test (comme le font deux requêtes PostgREST successives) */
async function as(tx: Transaction, role: DbRole, userId: string | null) {
  await tx.exec('RESET ROLE');
  await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role, ...(userId ? { sub: userId } : {}) })]);
  await tx.exec(`SET LOCAL ROLE ${role}`);
}

/** Tente une requête qui doit échouer sans abandonner la transaction de test (point de sauvegarde) */
async function attempt(tx: Transaction, sql: string, params: unknown[] = []): Promise<string | null> {
  await tx.exec('SAVEPOINT attempt');
  try {
    await tx.query(sql, params);
    await tx.exec('RELEASE SAVEPOINT attempt');
    return null;
  } catch (error) {
    await tx.exec('ROLLBACK TO SAVEPOINT attempt');
    return error instanceof Error ? error.message : String(error);
  }
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type EventInput = {
  at: string;
  lat?: number | null;
  lon?: number | null;
  speed?: number | null;
  ignition?: boolean | null;
  event_id?: string;
  accuracy?: number;
  tamper?: boolean;
  power_disconnected?: boolean;
  [key: string]: unknown;
};

async function ingest(tx: Transaction, device: string, event: EventInput) {
  const { at, lat, lon, speed, ignition, accuracy, ...rest } = event;
  const payload: Record<string, unknown> = { recorded_at: at, ...rest };
  if (lat !== undefined) payload.latitude = lat;
  if (lon !== undefined) payload.longitude = lon;
  if (speed !== undefined) payload.speed_kmh = speed;
  if (ignition !== undefined) payload.ignition = ignition;
  if (accuracy !== undefined) payload.accuracy_m = accuracy;
  const { rows } = await tx.query<{ r: Row }>(`SELECT public.tracking_ingest_event($1, $2, $3::jsonb) AS r`, [PROVIDER, device, JSON.stringify(payload)]);
  return rows[0]!.r;
}

describe('Suivi GPS — base de données', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;
    await seed(db);
  });

  afterAll(async () => {
    await db?.close();
  });

  afterEach(async () => {
    await db.exec(`
      DELETE FROM public.vehicle_trips;
      DELETE FROM public.tracking_alerts;
      DELETE FROM public.vehicle_trackers;
      DELETE FROM public.vehicle_geofences;
      DELETE FROM public.tracking_settings;
      DELETE FROM public.tracking_support_grants;
    `);
  });

  async function tracker(vehicleId: string | null, device: string, agencyId: string = ID.agencyA, status = 'ACTIVE') {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO public.vehicle_trackers (agency_id, vehicle_id, provider, external_device_id, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [agencyId, vehicleId, PROVIDER, device, status]
    );
    return rows[0]!.id;
  }

  // ------------------------------------------------------------------------
  describe('Permissions et rôles', () => {
    const can = (userId: string, agencyId: string, permission: string) =>
      asRole(db, 'authenticated', userId, async (tx) =>
        (await tx.query<{ ok: boolean }>(`SELECT public.has_tracking_permission($1, $2) AS ok`, [agencyId, permission])).rows[0]!.ok
      );

    it('agency_admin : les quatre permissions sur sa propre agence', async () => {
      for (const permission of ['tracking.read', 'tracking.manage', 'tracking.alerts.manage', 'tracking.settings.manage']) {
        expect(await can(ID.adminA, ID.agencyA, permission), permission).toBe(true);
      }
    });

    it('agency_manager : lecture, gestion et alertes, mais pas les paramètres', async () => {
      expect(await can(ID.managerA, ID.agencyA, 'tracking.read')).toBe(true);
      expect(await can(ID.managerA, ID.agencyA, 'tracking.manage')).toBe(true);
      expect(await can(ID.managerA, ID.agencyA, 'tracking.alerts.manage')).toBe(true);
      expect(await can(ID.managerA, ID.agencyA, 'tracking.settings.manage')).toBe(false);
    });

    it('agency_agent, viewer et client : aucun accès GPS', async () => {
      for (const user of [ID.agentA, ID.viewerA, ID.customer]) {
        for (const permission of ['tracking.read', 'tracking.manage', 'tracking.alerts.manage', 'tracking.settings.manage']) {
          expect(await can(user, ID.agencyA, permission), `${user} ${permission}`).toBe(false);
        }
      }
    });

    it('jamais d’accès à une autre agence', async () => {
      expect(await can(ID.adminA, ID.agencyB, 'tracking.read')).toBe(false);
      expect(await can(ID.adminB, ID.agencyA, 'tracking.read')).toBe(false);
    });

    it('un Super Admin n’a aucun accès implicite au suivi (mais garde ses droits ailleurs)', async () => {
      expect(await can(ID.superAdmin, ID.agencyA, 'tracking.read')).toBe(false);
      expect(await can(ID.superAdmin, ID.agencyA, 'tracking.manage')).toBe(false);
      const others = await asRole(db, 'authenticated', ID.superAdmin, async (tx) =>
        (await tx.query<{ ok: boolean }>(`SELECT public.has_agency_permission($1, 'vehicles.manage') AS ok`, [ID.agencyA])).rows[0]!.ok
      );
      expect(others).toBe(true);
      const tracking = await asRole(db, 'authenticated', ID.superAdmin, async (tx) =>
        (await tx.query<{ ok: boolean }>(`SELECT public.has_agency_permission($1, 'tracking.read') AS ok`, [ID.agencyA])).rows[0]!.ok
      );
      expect(tracking).toBe(false);
    });

    it('la matrice TypeScript (interface) est identique à la matrice de la base', async () => {
      const { rows } = await db.query<{ role_key: string; permission_key: string }>(
        `SELECT role_key, permission_key FROM public.role_permissions WHERE permission_key LIKE 'tracking.%' AND role_key <> 'super_admin'`
      );
      const fromDb: Record<string, string[]> = { agency_admin: [], agency_manager: [], agency_agent: [], viewer: [] };
      for (const row of rows) fromDb[row.role_key]!.push(row.permission_key);
      for (const role of Object.keys(fromDb)) {
        expect([...fromDb[role]!].sort(), role).toEqual([...AGENCY_ROLE_TRACKING_PERMISSIONS[role as keyof typeof AGENCY_ROLE_TRACKING_PERMISSIONS]].sort());
      }
      for (const permission of TRACKING_PERMISSIONS) expect(ACCESS_PERMISSIONS).toContain(permission);
    });

    it('la matrice de rôles en base ne donne tracking.* à aucun autre rôle', async () => {
      const { rows } = await db.query<{ role_key: string; permission_key: string }>(
        `SELECT role_key, permission_key FROM public.role_permissions WHERE permission_key LIKE 'tracking.%' ORDER BY 1, 2`
      );
      expect(rows.map((r) => `${r.role_key}:${r.permission_key}`)).toEqual([
        'agency_admin:tracking.alerts.manage',
        'agency_admin:tracking.manage',
        'agency_admin:tracking.read',
        'agency_admin:tracking.settings.manage',
        'agency_manager:tracking.alerts.manage',
        'agency_manager:tracking.manage',
        'agency_manager:tracking.read',
      ]);
    });
  });

  // ------------------------------------------------------------------------
  describe('RLS : isolation par agence', () => {
    it('chaque agence ne voit que ses boîtiers et ses positions ; client, agent et anon ne voient rien', async () => {
      const trackerA = await tracker(ID.vehicleA1, 'rls-a');
      const trackerB = await tracker(ID.vehicleB1, 'rls-b', ID.agencyB);
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'rls-a', { at: minutesAgo(5), lat: LAT0, lon: LON0, speed: 0 });
        await ingest(tx, 'rls-b', { at: minutesAgo(5), lat: LAT0 + 0.1, lon: LON0, speed: 0 });
        // Les données doivent survivre à la transaction de lecture : on les relit dans la même
        await as(tx, 'authenticated', ID.adminA);
        const trackersA = (await tx.query<{ id: string }>(`SELECT id FROM public.vehicle_trackers`)).rows.map((r) => r.id);
        expect(trackersA).toEqual([trackerA]);
        const latestA = (await tx.query<{ agency_id: string }>(`SELECT agency_id FROM public.vehicle_tracking_latest`)).rows;
        expect(latestA.map((r) => r.agency_id)).toEqual([ID.agencyA]);
        const locA = (await tx.query<{ agency_id: string }>(`SELECT DISTINCT agency_id FROM public.vehicle_locations`)).rows;
        expect(locA.map((r) => r.agency_id)).toEqual([ID.agencyA]);

        await as(tx, 'authenticated', ID.adminB);
        expect((await tx.query<{ id: string }>(`SELECT id FROM public.vehicle_trackers`)).rows.map((r) => r.id)).toEqual([trackerB]);
        expect((await tx.query(`SELECT 1 FROM public.vehicle_tracking_latest WHERE vehicle_id = $1`, [ID.vehicleA1])).rows).toEqual([]);

        for (const user of [ID.customer, ID.agentA, ID.viewerA, ID.superAdmin]) {
          await as(tx, 'authenticated', user);
          for (const table of ['vehicle_trackers', 'vehicle_locations', 'vehicle_tracking_latest', 'vehicle_trips', 'tracking_alerts', 'vehicle_geofences', 'tracking_settings', 'tracking_audit_log']) {
            const { rows } = await tx.query(`SELECT 1 FROM public.${table}`);
            expect(rows, `${user} / ${table}`).toEqual([]);
          }
        }
      });
    });

    it('anon : aucun privilège sur les tables ni sur les fonctions', async () => {
      for (const table of ['vehicle_trackers', 'vehicle_locations', 'vehicle_tracking_latest', 'tracking_alerts', 'tracking_audit_log']) {
        const message = await errorOf(asRole(db, 'anon', null, (tx) => tx.query(`SELECT * FROM public.${table}`)));
        expect(message, table).toMatch(/permission denied/i);
      }
      const fn = await errorOf(asRole(db, 'anon', null, (tx) => tx.query(`SELECT public.tracking_fleet_overview($1)`, [ID.agencyA])));
      expect(fn).toMatch(/permission denied/i);
    });

    it('aucune écriture directe pour authenticated (positions, boîtiers, alertes, audit)', async () => {
      const writes = [
        `INSERT INTO public.vehicle_locations (agency_id, vehicle_id, tracker_id, recorded_at, latitude, longitude, dedupe_key) VALUES ('${ID.agencyA}', '${ID.vehicleA1}', gen_random_uuid(), now(), 35, -3, 'x')`,
        `INSERT INTO public.vehicle_trackers (agency_id, provider, external_device_id) VALUES ('${ID.agencyA}', 'p', 'x')`,
        `UPDATE public.tracking_alerts SET status = 'ACKNOWLEDGED'`,
        `DELETE FROM public.tracking_audit_log`,
        `UPDATE public.tracking_settings SET retention_days = 7`,
      ];
      for (const sql of writes) {
        const message = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) => tx.query(sql)));
        expect(message, sql).toMatch(/permission denied/i);
      }
    });

    it('les fonctions de lecture refusent un utilisateur sans permission ou d’une autre agence (42501)', async () => {
      for (const user of [ID.agentA, ID.viewerA, ID.customer, ID.adminB, ID.superAdmin]) {
        const message = await errorOf(asRole(db, 'authenticated', user, (tx) => tx.query(`SELECT public.tracking_fleet_overview($1)`, [ID.agencyA])));
        expect(message, user).toMatch(/permission denied/i);
      }
      const noSession = await errorOf(asRole(db, 'authenticated', null, (tx) => tx.query(`SELECT public.tracking_fleet_overview($1)`, [ID.agencyA])));
      expect(noSession).toMatch(/permission denied/i);
    });

    it('les fonctions d’ingestion et de maintenance sont réservées au service_role', async () => {
      for (const sql of [
        `SELECT public.tracking_ingest_event('p', 'd', '{}'::jsonb)`,
        `SELECT public.tracking_run_maintenance()`,
        `SELECT public.tracking_purge_expired(100)`,
        `SELECT public.tracking_record_ingest_failure('p', 'r')`,
      ]) {
        for (const role of ['anon', 'authenticated'] as const) {
          const message = await errorOf(asRole(db, role, ID.adminA, (tx) => tx.query(sql)));
          expect(message, `${role} ${sql}`).toMatch(/permission denied/i);
        }
      }
    });

    it('les tables de suivi sont diffusées par Realtime (RLS appliquée) : latest et alertes uniquement', async () => {
      const { rows } = await db.query<{ tablename: string }>(
        `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN
         ('vehicle_tracking_latest', 'tracking_alerts', 'vehicle_locations', 'vehicle_trips', 'vehicle_trackers') ORDER BY 1`
      );
      expect(rows.map((r) => r.tablename)).toEqual(['tracking_alerts', 'vehicle_tracking_latest']);
    });
  });

  // ------------------------------------------------------------------------
  describe('Boîtiers : enregistrement, affectation, audit', () => {
    const register = (tx: Transaction, device: string, vehicleId: string | null = null, agencyId: string = ID.agencyA) =>
      tx.query<{ id: string }>(`SELECT public.register_vehicle_tracker($1, $2, $3, 'Boîtier test', $4) AS id`, [agencyId, PROVIDER, device, vehicleId]);

    it('un gestionnaire enregistre et affecte un boîtier ; l’historique d’affectation et l’audit sont écrits', async () => {
      await asRole(db, 'authenticated', ID.managerA, async (tx) => {
        const created = (await register(tx, 'reg-1', ID.vehicleA1)).rows[0]!.id;
        const assignments = (await tx.query(`SELECT vehicle_id, unassigned_at FROM public.vehicle_tracker_assignments WHERE tracker_id = $1`, [created])).rows as Row[];
        expect(assignments).toHaveLength(1);
        expect(assignments[0]!.vehicle_id).toBe(ID.vehicleA1);

        await tx.query(`SELECT public.assign_vehicle_tracker($1, $2, 'Boîtier déplacé')`, [created, ID.vehicleA2]);
        // (les deux affectations partagent l'horodatage de la transaction de test : on les distingue par véhicule)
        const history = (await tx.query(`SELECT vehicle_id, unassigned_at, reason FROM public.vehicle_tracker_assignments WHERE tracker_id = $1`, [created])).rows as Row[];
        expect(history).toHaveLength(2);
        expect(history.find((h) => h.vehicle_id === ID.vehicleA1)!.unassigned_at).not.toBeNull();
        const current = history.find((h) => h.vehicle_id === ID.vehicleA2)!;
        expect(current.unassigned_at).toBeNull();
        expect(current.reason).toBe('Boîtier déplacé');

        await tx.query(`SELECT public.disconnect_vehicle_tracker($1, 'Fin de contrat')`, [created]);
        const row = (await tx.query(`SELECT status, vehicle_id FROM public.vehicle_trackers WHERE id = $1`, [created])).rows[0] as Row;
        expect(row).toMatchObject({ status: 'DISCONNECTED', vehicle_id: null });

        const audit = (await tx.query<{ action: string }>(`SELECT action FROM public.tracking_audit_log WHERE entity_id = $1 ORDER BY id`, [created])).rows.map((r) => r.action);
        expect(audit).toEqual(['tracker.registered', 'tracker.reassigned', 'tracker.disconnected']);
      });
    });

    it('agent, viewer, client et administrateur d’une autre agence ne peuvent pas enregistrer de boîtier', async () => {
      for (const user of [ID.agentA, ID.viewerA, ID.customer, ID.adminB]) {
        const message = await errorOf(asRole(db, 'authenticated', user, (tx) => register(tx, 'reg-denied', ID.vehicleA1)));
        expect(message, user).toMatch(/permission denied/i);
      }
    });

    it('un véhicule d’une autre agence ne peut pas recevoir de boîtier', async () => {
      const message = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) => register(tx, 'reg-cross', ID.vehicleB1)));
      expect(message).toMatch(/vehicle not found/i);
    });

    it('un autre agence ne peut ni modifier, ni réaffecter, ni déconnecter un boîtier (introuvable)', async () => {
      const id = await tracker(ID.vehicleA1, 'cross-tracker');
      for (const sql of [
        `SELECT public.assign_vehicle_tracker('${id}', '${ID.vehicleB1}')`,
        `SELECT public.disconnect_vehicle_tracker('${id}')`,
        `SELECT public.update_vehicle_tracker('${id}', '{"label":"piraté"}'::jsonb)`,
      ]) {
        const message = await errorOf(asRole(db, 'authenticated', ID.adminB, (tx) => tx.query(sql)));
        expect(message, sql).toMatch(/not found/i);
      }
      expect(((await db.query(`SELECT vehicle_id, label FROM public.vehicle_trackers WHERE id = $1`, [id])).rows[0] as Row)).toMatchObject({ vehicle_id: ID.vehicleA1, label: null });
    });

    it('un véhicule n’a qu’un seul boîtier actif, un identifiant d’appareil n’est enregistré qu’une fois', async () => {
      await tracker(ID.vehicleA1, 'dup-vehicle-1');
      const secondOnVehicle = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) => register(tx, 'dup-vehicle-2', ID.vehicleA1)));
      expect(secondOnVehicle).toMatch(/uq_vehicle_trackers_vehicle/);
      const sameDeviceOtherAgency = await errorOf(asRole(db, 'authenticated', ID.adminB, (tx) => register(tx, 'dup-vehicle-1', null, ID.agencyB)));
      expect(sameDeviceOtherAgency).toMatch(/uq_vehicle_trackers_device_active/);
    });

    it('un boîtier déconnecté libère son identifiant fournisseur', async () => {
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        const first = (await register(tx, 'reusable', ID.vehicleA1)).rows[0]!.id;
        await tx.query(`SELECT public.disconnect_vehicle_tracker($1)`, [first]);
        await as(tx, 'authenticated', ID.adminB);
        const reused = (await register(tx, 'reusable', null, ID.agencyB)).rows[0]!.id;
        expect(reused).toBeTruthy();
      });
    });

    it('mise en pause : un boîtier désactivé ne produit plus de positions', async () => {
      const id = await tracker(ID.vehicleA1, 'paused', ID.agencyA, 'PENDING');
      await asRole(db, 'authenticated', ID.adminA, (tx) => tx.query(`SELECT public.update_vehicle_tracker($1, '{"enabled": false}'::jsonb)`, [id]));
      // le changement a été annulé avec la transaction : on le pose directement pour tester l'ingestion
      await db.query(`UPDATE public.vehicle_trackers SET status = 'DISABLED' WHERE id = $1`, [id]);
      const result = await asRole(db, 'service_role', null, (tx) => ingest(tx, 'paused', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0 }));
      expect(result.status).toBe('disabled');
    });
  });

  // ------------------------------------------------------------------------
  describe('Ingestion', () => {
    it('événement valide : position créée, dernière position mise à jour, boîtier actif, réservation associée', async () => {
      const id = await tracker(ID.vehicleA1, 'ing-valid', ID.agencyA, 'PENDING');
      await asRole(db, 'service_role', null, async (tx) => {
        const result = await ingest(tx, 'ing-valid', { at: minutesAgo(2), lat: LAT0, lon: LON0, speed: 0, ignition: true, event_id: 'evt-1' });
        expect(result).toMatchObject({ status: 'accepted', quality: 'OK', late: false });

        const locations = (await tx.query(`SELECT latitude, longitude, quality, booking_id, agency_id, vehicle_id FROM public.vehicle_locations`)).rows as Row[];
        expect(locations).toHaveLength(1);
        expect(locations[0]).toMatchObject({ latitude: LAT0, longitude: LON0, quality: 'OK', booking_id: ID.bookingA1, agency_id: ID.agencyA, vehicle_id: ID.vehicleA1 });

        const latest = (await tx.query(`SELECT movement_state, booking_id FROM public.vehicle_tracking_latest WHERE vehicle_id = $1`, [ID.vehicleA1])).rows[0] as Row;
        expect(latest).toMatchObject({ movement_state: 'STATIONARY', booking_id: ID.bookingA1 });

        const device = (await tx.query(`SELECT status, last_seen_at, last_position_at, capabilities FROM public.vehicle_trackers WHERE id = $1`, [id])).rows[0] as Row;
        expect(device.status).toBe('ACTIVE');
        expect(device.last_seen_at).not.toBeNull();
        expect(device.capabilities).toMatchObject({ ignition: true });
      });
    });

    it('le suivi continue hors réservation : même flux sur un véhicule sans location, sans booking associé', async () => {
      await tracker(ID.vehicleA2, 'ing-no-booking');
      await asRole(db, 'service_role', null, async (tx) => {
        expect((await ingest(tx, 'ing-no-booking', { at: minutesAgo(2), lat: LAT0, lon: LON0, speed: 0 })).status).toBe('accepted');
        const row = (await tx.query(`SELECT booking_id FROM public.vehicle_tracking_latest WHERE vehicle_id = $1`, [ID.vehicleA2])).rows[0] as Row;
        expect(row.booking_id).toBeNull();
      });
    });

    it('le suivi ignore le statut de la réservation : une location terminée ou annulée ne coupe pas la collecte', async () => {
      await tracker(ID.vehicleA1, 'ing-status');
      await db.query(`UPDATE public.bookings SET status = 'CANCELLED' WHERE id = $1`, [ID.bookingA1]);
      try {
        await asRole(db, 'service_role', null, async (tx) => {
          expect((await ingest(tx, 'ing-status', { at: minutesAgo(2), lat: LAT0, lon: LON0, speed: 0 })).status).toBe('accepted');
          const row = (await tx.query(`SELECT booking_id FROM public.vehicle_locations`)).rows[0] as Row;
          expect(row.booking_id).toBeNull();
        });
      } finally {
        await db.query(`UPDATE public.bookings SET status = 'ACTIVE' WHERE id = $1`, [ID.bookingA1]);
      }
    });

    it('appareil inconnu : rejeté sans effet ; agency_id / vehicle_id fournis par le payload sont ignorés', async () => {
      await tracker(ID.vehicleA1, 'ing-known');
      await asRole(db, 'service_role', null, async (tx) => {
        expect((await ingest(tx, 'ing-ghost', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0 })).status).toBe('unknown_device');
        // Charge utile hostile : tente de cibler l'agence et le véhicule B
        const hostile = await ingest(tx, 'ing-known', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0, agency_id: ID.agencyB, vehicle_id: ID.vehicleB1 });
        expect(hostile.status).toBe('accepted');
        const rows = (await tx.query(`SELECT agency_id, vehicle_id FROM public.vehicle_locations`)).rows as Row[];
        expect(rows).toEqual([{ agency_id: ID.agencyA, vehicle_id: ID.vehicleA1 }]);
        expect((await tx.query(`SELECT 1 FROM public.vehicle_tracking_latest WHERE agency_id = $1`, [ID.agencyB])).rows).toEqual([]);
      });
    });

    it('coordonnées invalides : hors bornes, (0, 0), valeurs partielles, NaN', async () => {
      await tracker(ID.vehicleA1, 'ing-coords');
      await asRole(db, 'service_role', null, async (tx) => {
        const at = minutesAgo(2);
        for (const [lat, lon] of [[91, 0.5], [10, 181], [0, 0], [35, null], [null, -3], ['NaN', -3], [-95.5, 20]] as const) {
          const result = await ingest(tx, 'ing-coords', { at, lat: lat as number | null, lon: lon as number | null, speed: 10 });
          expect(result, `${lat},${lon}`).toMatchObject({ status: 'rejected', reason: 'invalid_coordinates' });
        }
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_locations`)).rows[0]).toEqual({ n: 0 });
      });
    });

    it('horodatages invalides : futur, trop ancien, absent, illisible', async () => {
      await tracker(ID.vehicleA1, 'ing-time');
      await asRole(db, 'service_role', null, async (tx) => {
        expect((await ingest(tx, 'ing-time', { at: new Date(Date.now() + 10 * 60_000).toISOString(), lat: LAT0, lon: LON0 })).reason).toBe('future_timestamp');
        expect((await ingest(tx, 'ing-time', { at: new Date(Date.now() - 100 * 3_600_000).toISOString(), lat: LAT0, lon: LON0 })).reason).toBe('timestamp_too_old');
        const missing = (await tx.query<{ r: Row }>(`SELECT public.tracking_ingest_event($1, 'ing-time', '{"latitude": 35.1, "longitude": -2.9}'::jsonb) AS r`, [PROVIDER])).rows[0]!.r;
        expect(missing.reason).toBe('missing_timestamp');
        expect((await ingest(tx, 'ing-time', { at: 'pas-une-date', lat: LAT0, lon: LON0 })).reason).toBe('malformed_event');
        expect((await ingest(tx, 'ing-time', { at: minutesAgo(1) })).reason).toBe('empty_event');
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_locations`)).rows[0]).toEqual({ n: 0 });
      });
    });

    it('doublon : la même observation n’est traitée qu’une fois (identifiant fournisseur ou empreinte)', async () => {
      await tracker(ID.vehicleA1, 'ing-dup');
      await asRole(db, 'service_role', null, async (tx) => {
        const at = minutesAgo(3);
        expect((await ingest(tx, 'ing-dup', { at, lat: LAT0, lon: LON0, speed: 0, event_id: 'same' })).status).toBe('accepted');
        expect((await ingest(tx, 'ing-dup', { at, lat: LAT0, lon: LON0, speed: 0, event_id: 'same' })).status).toBe('duplicate');
        const at2 = minutesAgo(2);
        expect((await ingest(tx, 'ing-dup', { at: at2, lat: LAT0, lon: LON0, speed: 0 })).status).toBe('accepted');
        expect((await ingest(tx, 'ing-dup', { at: at2, lat: LAT0, lon: LON0, speed: 0 })).status).toBe('duplicate');
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_locations`)).rows[0]).toEqual({ n: 2 });
      });
    });

    it('événement hors séquence : conservé en historique (LATE) sans écraser la position la plus récente', async () => {
      await tracker(ID.vehicleA1, 'ing-order');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'ing-order', { at: minutesAgo(2), lat: LAT0 + 0.01, lon: LON0, speed: 0 });
        const late = await ingest(tx, 'ing-order', { at: minutesAgo(10), lat: LAT0 + 0.5, lon: LON0 + 0.5, speed: 0 });
        expect(late).toMatchObject({ status: 'accepted', quality: 'LATE', late: true });
        const latest = (await tx.query(`SELECT latitude FROM public.vehicle_tracking_latest WHERE vehicle_id = $1`, [ID.vehicleA1])).rows[0] as Row;
        expect(latest.latitude).toBeCloseTo(LAT0 + 0.01, 6);
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_locations WHERE quality = 'LATE'`)).rows[0]).toEqual({ n: 1 });
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_trips`)).rows[0]).toEqual({ n: 0 });
      });
    });

    it('la table des dernières positions refuse elle-même une mise à jour plus ancienne (défense en profondeur)', async () => {
      await tracker(ID.vehicleA1, 'ing-guard');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'ing-guard', { at: minutesAgo(2), lat: LAT0, lon: LON0, speed: 0 });
        await tx.query(
          `INSERT INTO public.vehicle_tracking_latest AS l (vehicle_id, agency_id, tracker_id, latitude, longitude, recorded_at)
           SELECT vehicle_id, agency_id, tracker_id, 1, 1, recorded_at - interval '1 hour' FROM public.vehicle_tracking_latest
           ON CONFLICT (vehicle_id) DO UPDATE SET latitude = EXCLUDED.latitude, recorded_at = EXCLUDED.recorded_at
           WHERE l.recorded_at < EXCLUDED.recorded_at`
        );
        const latest = (await tx.query(`SELECT latitude FROM public.vehicle_tracking_latest`)).rows[0] as Row;
        expect(latest.latitude).toBeCloseTo(LAT0, 6);
      });
    });

    it('boîtier non affecté : communication notée, aucune position conservée', async () => {
      const id = await tracker(null, 'ing-unassigned', ID.agencyA, 'PENDING');
      await asRole(db, 'service_role', null, async (tx) => {
        expect((await ingest(tx, 'ing-unassigned', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0 })).status).toBe('unassigned');
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_locations`)).rows[0]).toEqual({ n: 0 });
        const row = (await tx.query(`SELECT status, last_seen_at FROM public.vehicle_trackers WHERE id = $1`, [id])).rows[0] as Row;
        expect(row.status).toBe('ACTIVE');
        expect(row.last_seen_at).not.toBeNull();
      });
    });

    it('valeurs optionnelles aberrantes (vitesse, cap) ignorées sans rejeter la position', async () => {
      await tracker(ID.vehicleA1, 'ing-optional');
      await asRole(db, 'service_role', null, async (tx) => {
        const result = await ingest(tx, 'ing-optional', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 9999, heading_deg: -20 });
        expect(result.status).toBe('accepted');
        const row = (await tx.query(`SELECT speed_kmh, heading_deg FROM public.vehicle_locations`)).rows[0] as Row;
        expect(row).toEqual({ speed_kmh: null, heading_deg: null });
      });
    });

    it('l’identifiant fournisseur trop long ou une charge illisible est rejeté', async () => {
      await tracker(ID.vehicleA1, 'ing-garbage');
      await asRole(db, 'service_role', null, async (tx) => {
        expect((await ingest(tx, 'ing-garbage', { at: minutesAgo(1), lat: LAT0, lon: LON0, event_id: 'x'.repeat(201) })).reason).toBe('invalid_event_id');
        const notAnObject = (await tx.query<{ r: Row }>(`SELECT public.tracking_ingest_event($1, 'ing-garbage', '[1,2]'::jsonb) AS r`, [PROVIDER])).rows[0]!.r;
        expect(notAnObject.reason).toBe('malformed_event');
      });
    });
  });

  // ------------------------------------------------------------------------
  describe('Détection de trajets', () => {
    /** Déplacement vers le nord : un point toutes les 10 s, `stepDeg` degrés de latitude à chaque pas */
    async function drive(tx: Transaction, device: string, opts: { from: number; points: number; stepDeg: number; start: number; speed: number; startLat?: number }) {
      const results: Row[] = [];
      for (let i = 0; i < opts.points; i += 1) {
        const at = new Date(Date.now() - (opts.from - i * 10) * 1000).toISOString();
        results.push(await ingest(tx, device, { at, lat: (opts.startLat ?? LAT0) + (opts.start + i) * opts.stepDeg, lon: LON0, speed: opts.speed }));
      }
      return results;
    }

    it('un trajet se crée au premier mouvement, cumule la distance et se clôture à l’arrêt prolongé', async () => {
      await tracker(ID.vehicleA2, 'trip-basic');
      await asRole(db, 'service_role', null, async (tx) => {
        // 2 points à l'arrêt, 12 points en mouvement (0,001° ≈ 111 m par pas de 10 s), puis 40 points à l'arrêt (> 5 min)
        await ingest(tx, 'trip-basic', { at: new Date(Date.now() - 900_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await ingest(tx, 'trip-basic', { at: new Date(Date.now() - 890_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-basic', { from: 880, points: 12, stepDeg: 0.001, start: 1, speed: 40 });
        const during = (await tx.query(`SELECT status, distance_km, max_speed_kmh FROM public.vehicle_trips`)).rows as Row[];
        expect(during).toHaveLength(1);
        expect(during[0]!.status).toBe('IN_PROGRESS');

        const lastLat = LAT0 + 12 * 0.001;
        for (let i = 0; i < 40; i += 1) {
          await ingest(tx, 'trip-basic', { at: new Date(Date.now() - (700 - i * 10) * 1000).toISOString(), lat: lastLat, lon: LON0, speed: 0 });
        }
        const trips = (await tx.query(`SELECT status, distance_km, duration_seconds, max_speed_kmh, closed_reason, start_latitude, end_latitude, point_count FROM public.vehicle_trips`)).rows as Row[];
        expect(trips).toHaveLength(1);
        const trip = trips[0]!;
        expect(trip).toMatchObject({ status: 'COMPLETED', closed_reason: 'IDLE', max_speed_kmh: 40 });
        // Distance attendue ≈ 12 × 0,001° × 111,195 km/° = 1,334 km (le dernier segment part du point à l'arrêt)
        expect(trip.distance_km as number).toBeGreaterThan(1.25);
        expect(trip.distance_km as number).toBeLessThan(1.42);
        expect(trip.start_latitude as number).toBeCloseTo(LAT0, 5);
        expect(trip.end_latitude as number).toBeCloseTo(lastLat, 4);
        expect(trip.duration_seconds as number).toBeGreaterThan(100);
        expect(trip.duration_seconds as number).toBeLessThan(160);
      });
    });

    it('le trajet est associé à la réservation en cours (contexte), sans condition de suivi', async () => {
      await tracker(ID.vehicleA1, 'trip-booking');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-booking', { at: new Date(Date.now() - 300_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-booking', { from: 290, points: 8, stepDeg: 0.001, start: 1, speed: 45 });
        const trip = (await tx.query(`SELECT booking_id FROM public.vehicle_trips`)).rows[0] as Row;
        expect(trip.booking_id).toBe(ID.bookingA1);
      });
    });

    it('un contact coupé clôture immédiatement le trajet à la position d’arrivée', async () => {
      await tracker(ID.vehicleA2, 'trip-ign');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-ign', { at: new Date(Date.now() - 300_000).toISOString(), lat: LAT0, lon: LON0, speed: 0, ignition: true });
        await drive(tx, 'trip-ign', { from: 290, points: 10, stepDeg: 0.001, start: 1, speed: 40 });
        const arrival = LAT0 + 10 * 0.001 + 0.0002;
        await ingest(tx, 'trip-ign', { at: new Date(Date.now() - 190_000).toISOString(), lat: arrival, lon: LON0, speed: 0, ignition: false });
        const trip = (await tx.query(`SELECT status, closed_reason, end_latitude FROM public.vehicle_trips`)).rows[0] as Row;
        expect(trip).toMatchObject({ status: 'COMPLETED', closed_reason: 'IGNITION_OFF' });
        expect(trip.end_latitude as number).toBeCloseTo(arrival, 6);
      });
    });

    it('un saut de position incohérent n’ajoute aucune distance et ne devient pas la position courante', async () => {
      await tracker(ID.vehicleA2, 'trip-jump');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-jump', { at: new Date(Date.now() - 300_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-jump', { from: 290, points: 6, stepDeg: 0.001, start: 1, speed: 40 });
        // 40 km en 10 s : impossible
        const jump = await ingest(tx, 'trip-jump', { at: new Date(Date.now() - 230_000).toISOString(), lat: LAT0 + 0.4, lon: LON0, speed: 40 });
        expect(jump).toMatchObject({ status: 'accepted', quality: 'JUMP' });
        await drive(tx, 'trip-jump', { from: 220, points: 4, stepDeg: 0.001, start: 7, speed: 40 });
        const trip = (await tx.query(`SELECT distance_km FROM public.vehicle_trips`)).rows[0] as Row;
        // ≈ 10 segments de 111 m ; un saut compté ajouterait ≈ 44 km
        expect(trip.distance_km as number).toBeLessThan(1.5);
        expect(trip.distance_km as number).toBeGreaterThan(1.0);
        const latest = (await tx.query(`SELECT latitude FROM public.vehicle_tracking_latest`)).rows[0] as Row;
        expect(latest.latitude as number).toBeLessThan(LAT0 + 0.02);
      });
    });

    it('après trois sauts consécutifs, la nouvelle position devient la référence (véhicule réellement déplacé)', async () => {
      await tracker(ID.vehicleA2, 'trip-relocate');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-relocate', { at: new Date(Date.now() - 300_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        const qualities: unknown[] = [];
        for (let i = 0; i < 4; i += 1) {
          const r = await ingest(tx, 'trip-relocate', { at: new Date(Date.now() - (290 - i * 10) * 1000).toISOString(), lat: LAT0 + 1 + i * 0.00001, lon: LON0, speed: 0 });
          qualities.push(r.quality);
        }
        expect(qualities).toEqual(['JUMP', 'JUMP', 'OK', 'OK']);
        const latest = (await tx.query(`SELECT latitude FROM public.vehicle_tracking_latest`)).rows[0] as Row;
        expect(latest.latitude as number).toBeGreaterThan(LAT0 + 0.9);
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_trips`)).rows[0]).toEqual({ n: 0 });
      });
    });

    it('positions imprécises (précision > 100 m ou < 3 satellites) : historisées mais jamais utilisées', async () => {
      await tracker(ID.vehicleA2, 'trip-lowacc');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-lowacc', { at: new Date(Date.now() - 100_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        const r = await ingest(tx, 'trip-lowacc', { at: new Date(Date.now() - 90_000).toISOString(), lat: LAT0 + 0.003, lon: LON0, speed: 60, accuracy: 350 });
        expect(r.quality).toBe('LOW_ACCURACY');
        const sats = await ingest(tx, 'trip-lowacc', { at: new Date(Date.now() - 80_000).toISOString(), lat: LAT0 + 0.003, lon: LON0, speed: 60, satellites: 1 });
        expect(sats.quality).toBe('LOW_ACCURACY');
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_trips`)).rows[0]).toEqual({ n: 0 });
        const latest = (await tx.query(`SELECT latitude FROM public.vehicle_tracking_latest`)).rows[0] as Row;
        expect(latest.latitude as number).toBeCloseTo(LAT0, 6);
      });
    });

    it('le bruit GPS à l’arrêt ne crée ni trajet ni distance', async () => {
      await tracker(ID.vehicleA2, 'trip-noise');
      await asRole(db, 'service_role', null, async (tx) => {
        for (let i = 0; i < 20; i += 1) {
          await ingest(tx, 'trip-noise', { at: new Date(Date.now() - (300 - i * 10) * 1000).toISOString(), lat: LAT0 + (i % 2) * 0.00004, lon: LON0 + (i % 3) * 0.00003, speed: 0 });
        }
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_trips`)).rows[0]).toEqual({ n: 0 });
      });
    });

    it('un micro-trajet (< 100 m) est écarté à la clôture', async () => {
      await tracker(ID.vehicleA2, 'trip-tiny');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-tiny', { at: new Date(Date.now() - 900_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-tiny', { from: 890, points: 2, stepDeg: 0.0002, start: 1, speed: 8 });
        // ≈ 44 m parcourus, puis plus de 5 min à l'arrêt : le trajet se clôture et est écarté
        for (let i = 0; i < 40; i += 1) {
          await ingest(tx, 'trip-tiny', { at: new Date(Date.now() - (860 - i * 10) * 1000).toISOString(), lat: LAT0 + 0.0004, lon: LON0, speed: 0 });
        }
        expect((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_trips`)).rows[0]).toEqual({ n: 0 });
      });
    });

    it('une interruption d’émission supérieure à 15 min clôture le trajet (DEVICE_GAP) puis en démarre un autre', async () => {
      await tracker(ID.vehicleA2, 'trip-gap');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-gap', { at: new Date(Date.now() - 3_000_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-gap', { from: 2990, points: 10, stepDeg: 0.001, start: 1, speed: 40 });
        // 30 minutes de silence puis reprise du mouvement
        await drive(tx, 'trip-gap', { from: 600, points: 10, stepDeg: 0.001, start: 11, speed: 40 });
        const trips = (await tx.query(`SELECT status, closed_reason FROM public.vehicle_trips ORDER BY started_at`)).rows as Row[];
        expect(trips).toHaveLength(2);
        expect(trips[0]).toMatchObject({ status: 'COMPLETED', closed_reason: 'DEVICE_GAP' });
        expect(trips[1]!.status).toBe('IN_PROGRESS');
      });
    });

    it('la maintenance clôture les trajets abandonnés (boîtier silencieux)', async () => {
      await tracker(ID.vehicleA2, 'trip-stale');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-stale', { at: new Date(Date.now() - 3_600_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-stale', { from: 3590, points: 10, stepDeg: 0.001, start: 1, speed: 40 });
        const result = (await tx.query<{ r: Row }>(`SELECT public.tracking_run_maintenance() AS r`)).rows[0]!.r;
        expect(result.stale_trips_closed).toBe(1);
        expect((await tx.query(`SELECT status, closed_reason FROM public.vehicle_trips`)).rows[0]).toEqual({ status: 'COMPLETED', closed_reason: 'STALE' });
      });
    });

    it('un seul trajet en cours par véhicule (contrainte)', async () => {
      await tracker(ID.vehicleA2, 'trip-unique');
      const message = await errorOf(
        db.exec(`
          INSERT INTO public.vehicle_trips (agency_id, vehicle_id, started_at, start_latitude, start_longitude, last_position_at)
          VALUES ('${ID.agencyA}', '${ID.vehicleA2}', now(), 35, -3, now()), ('${ID.agencyA}', '${ID.vehicleA2}', now(), 35, -3, now());
        `)
      );
      expect(message).toMatch(/uq_vehicle_trips_open/);
    });

    it('route d’un trajet : rééchantillonnée, bornée, réservée à l’agence', async () => {
      await tracker(ID.vehicleA2, 'trip-route');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'trip-route', { at: new Date(Date.now() - 900_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await drive(tx, 'trip-route', { from: 890, points: 60, stepDeg: 0.0005, start: 1, speed: 40 });
        const tripId = ((await tx.query(`SELECT id FROM public.vehicle_trips`)).rows[0] as Row).id as string;

        await as(tx, 'authenticated', ID.adminA);
        const route = (await tx.query<{ r: Row }>(`SELECT public.tracking_trip_route($1, $2, 20) AS r`, [ID.agencyA, tripId])).rows[0]!.r;
        const points = route.points as { latitude: number }[];
        expect(route.total_points).toBeGreaterThan(50);
        expect(points.length).toBeLessThanOrEqual(35);
        expect(points.length).toBeGreaterThan(10);
        // premier et dernier points conservés
        expect(points[0]!.latitude).toBeCloseTo(LAT0, 5);

        await as(tx, 'authenticated', ID.adminB);
        const message = await attempt(tx, `SELECT public.tracking_trip_route($1, $2)`, [ID.agencyB, tripId]);
        expect(message).toMatch(/trip not found/);
      });
    });
  });

  // ------------------------------------------------------------------------
  describe('Zones géographiques et alertes', () => {
    async function geofence(vehicleIds: string[], overrides: Record<string, unknown> = {}) {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO public.vehicle_geofences (agency_id, name, center_latitude, center_longitude, radius_m, enabled, alert_on_enter, alert_on_exit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [ID.agencyA, (overrides.name as string) ?? 'Aéroport Nador', LAT0, LON0, (overrides.radius_m as number) ?? 500, overrides.enabled ?? true, overrides.alert_on_enter ?? true, overrides.alert_on_exit ?? true]
      );
      for (const vehicleId of vehicleIds) {
        await db.query(`INSERT INTO public.vehicle_geofence_assignments (geofence_id, vehicle_id, agency_id) VALUES ($1, $2, $3)`, [rows[0]!.id, vehicleId, ID.agencyA]);
      }
      return rows[0]!.id;
    }

    const alertsOf = async (tx: Transaction, type?: string) =>
      (await tx.query(`SELECT type, severity, status, ongoing, resolved_at, geofence_id, description FROM public.tracking_alerts ${type ? `WHERE type = '${type}'` : ''} ORDER BY occurred_at, id`)).rows as Row[];

    it('entrée et sortie : une alerte par franchissement, aucune au premier fix, aucun doublon', async () => {
      await tracker(ID.vehicleA2, 'gf-basic');
      const gf = await geofence([ID.vehicleA2]);
      await asRole(db, 'service_role', null, async (tx) => {
        // Premier fix dans la zone : l'état est enregistré sans alerte
        await ingest(tx, 'gf-basic', { at: minutesAgo(30), lat: LAT0, lon: LON0, speed: 0 });
        expect(await alertsOf(tx)).toHaveLength(0);
        // Rester dans la zone : rien
        await ingest(tx, 'gf-basic', { at: minutesAgo(29), lat: LAT0 + 0.001, lon: LON0, speed: 0 });
        expect(await alertsOf(tx)).toHaveLength(0);
        // Sortie (≈ 1,1 km au nord) puis nouvelle position hors zone : une seule alerte de sortie
        await ingest(tx, 'gf-basic', { at: minutesAgo(28), lat: LAT0 + 0.01, lon: LON0, speed: 0 });
        await ingest(tx, 'gf-basic', { at: minutesAgo(27), lat: LAT0 + 0.011, lon: LON0, speed: 0 });
        let alerts = await alertsOf(tx);
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toMatchObject({ type: 'GEOFENCE_EXIT', severity: 'INFO', status: 'OPEN', geofence_id: gf });
        expect(alerts[0]!.description).toContain('Aéroport Nador');
        // Retour dans la zone : alerte d'entrée
        await ingest(tx, 'gf-basic', { at: minutesAgo(26), lat: LAT0, lon: LON0, speed: 0 });
        alerts = await alertsOf(tx);
        expect(alerts.map((a) => a.type)).toEqual(['GEOFENCE_EXIT', 'GEOFENCE_ENTER']);
        // Rejouer la livraison ne duplique rien
        await ingest(tx, 'gf-basic', { at: minutesAgo(26), lat: LAT0, lon: LON0, speed: 0 });
        expect(await alertsOf(tx)).toHaveLength(2);
      });
    });

    it('marge de sortie : une oscillation sur le bord de la zone ne déclenche pas d’alertes en rafale', async () => {
      await tracker(ID.vehicleA2, 'gf-edge');
      await geofence([ID.vehicleA2], { radius_m: 500 });
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'gf-edge', { at: minutesAgo(30), lat: LAT0, lon: LON0, speed: 0 });
        // 500 m ≈ 0,0045° : on oscille entre ≈ 489 m (0,0044°) et ≈ 515 m (0,00463°), dans la marge de sortie de 25 m
        for (let i = 0; i < 6; i += 1) {
          await ingest(tx, 'gf-edge', { at: minutesAgo(29 - i), lat: LAT0 + (i % 2 === 0 ? 0.00463 : 0.0044), lon: LON0, speed: 0 });
        }
        expect(await alertsOf(tx)).toHaveLength(0);
        // Une vraie sortie (≈ 600 m) déclenche bien l'alerte
        await ingest(tx, 'gf-edge', { at: minutesAgo(20), lat: LAT0 + 0.0054, lon: LON0, speed: 0 });
        expect((await alertsOf(tx)).map((a) => a.type)).toEqual(['GEOFENCE_EXIT']);
      });
    });

    it('zone désactivée ou sans alerte d’entrée / sortie : aucune alerte correspondante', async () => {
      await tracker(ID.vehicleA2, 'gf-flags');
      await geofence([ID.vehicleA2], { name: 'Sortie seule', alert_on_enter: false });
      await geofence([ID.vehicleA2], { name: 'Désactivée', enabled: false });
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'gf-flags', { at: minutesAgo(30), lat: LAT0, lon: LON0, speed: 0 });
        await ingest(tx, 'gf-flags', { at: minutesAgo(29), lat: LAT0 + 0.02, lon: LON0, speed: 0 });
        await ingest(tx, 'gf-flags', { at: minutesAgo(28), lat: LAT0, lon: LON0, speed: 0 });
        const alerts = await alertsOf(tx);
        expect(alerts.map((a) => a.type)).toEqual(['GEOFENCE_EXIT']);
        expect(alerts[0]!.description).toContain('Sortie seule');
      });
    });

    it('seuls les véhicules affectés à la zone déclenchent ses alertes', async () => {
      await tracker(ID.vehicleA1, 'gf-assigned');
      await tracker(ID.vehicleA2, 'gf-unassigned');
      await geofence([ID.vehicleA1]);
      await asRole(db, 'service_role', null, async (tx) => {
        for (const device of ['gf-assigned', 'gf-unassigned']) {
          await ingest(tx, device, { at: minutesAgo(30), lat: LAT0, lon: LON0, speed: 0 });
          await ingest(tx, device, { at: minutesAgo(29), lat: LAT0 + 0.02, lon: LON0, speed: 0 });
        }
        const rows = (await tx.query(`SELECT vehicle_id FROM public.tracking_alerts`)).rows as Row[];
        expect(rows).toEqual([{ vehicle_id: ID.vehicleA1 }]);
      });
    });

    it('vitesse excessive : une seule alerte ouverte pendant le dépassement, résolue au retour sous la limite, nouvelle alerte au dépassement suivant', async () => {
      await tracker(ID.vehicleA2, 'speed');
      await db.query(`INSERT INTO public.tracking_settings (agency_id, speed_alerts_enabled, speed_limit_kmh) VALUES ($1, true, 90)`, [ID.agencyA]);
      await asRole(db, 'service_role', null, async (tx) => {
        const lat = (i: number) => LAT0 + i * 0.001;
        await ingest(tx, 'speed', { at: minutesAgo(30), lat: lat(0), lon: LON0, speed: 60 });
        await ingest(tx, 'speed', { at: minutesAgo(29.5), lat: lat(1), lon: LON0, speed: 95 });
        await ingest(tx, 'speed', { at: minutesAgo(29), lat: lat(2), lon: LON0, speed: 110 });
        await ingest(tx, 'speed', { at: minutesAgo(28.5), lat: lat(3), lon: LON0, speed: 100 });
        let alerts = await alertsOf(tx, 'SPEED_LIMIT');
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toMatchObject({ ongoing: true, resolved_at: null });
        const meta = (await tx.query(`SELECT metadata FROM public.tracking_alerts WHERE type = 'SPEED_LIMIT'`)).rows[0] as Row;
        expect(meta.metadata).toMatchObject({ peak_speed_kmh: 110, limit_kmh: 90 });

        await ingest(tx, 'speed', { at: minutesAgo(28), lat: lat(4), lon: LON0, speed: 70 });
        alerts = await alertsOf(tx, 'SPEED_LIMIT');
        expect(alerts[0]!.resolved_at).not.toBeNull();

        await ingest(tx, 'speed', { at: minutesAgo(27.5), lat: lat(5), lon: LON0, speed: 120 });
        expect(await alertsOf(tx, 'SPEED_LIMIT')).toHaveLength(2);
      });
    });

    it('limite de vitesse désactivée : aucune alerte, même au-delà de la limite configurée', async () => {
      await tracker(ID.vehicleA2, 'speed-off');
      await db.query(`INSERT INTO public.tracking_settings (agency_id, speed_alerts_enabled, speed_limit_kmh) VALUES ($1, false, 90)`, [ID.agencyA]);
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'speed-off', { at: minutesAgo(10), lat: LAT0, lon: LON0, speed: 150 });
        expect(await alertsOf(tx)).toHaveLength(0);
      });
    });

    it('mouvement inattendu : départ hors réservation pendant les heures calmes uniquement, et seulement si activé', async () => {
      await tracker(ID.vehicleA2, 'unexpected');
      // Heures calmes couvrant toute la journée : on teste la logique sans dépendre de l'heure d'exécution
      await db.query(
        `INSERT INTO public.tracking_settings (agency_id, unexpected_movement_enabled, quiet_hours_start, quiet_hours_end) VALUES ($1, true, '00:00', '23:59:59')`,
        [ID.agencyA]
      );
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'unexpected', { at: new Date(Date.now() - 300_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        for (let i = 0; i < 3; i += 1) {
          await ingest(tx, 'unexpected', { at: new Date(Date.now() - (290 - i * 10) * 1000).toISOString(), lat: LAT0 + (i + 1) * 0.001, lon: LON0, speed: 40 });
        }
        const alerts = await alertsOf(tx, 'UNEXPECTED_MOVEMENT');
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toMatchObject({ severity: 'WARNING', ongoing: false });
      });
      // Avec réservation active (véhicule A1) : jamais d'alerte
      await tracker(ID.vehicleA1, 'unexpected-booked');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'unexpected-booked', { at: new Date(Date.now() - 300_000).toISOString(), lat: LAT0, lon: LON0, speed: 0 });
        await ingest(tx, 'unexpected-booked', { at: new Date(Date.now() - 290_000).toISOString(), lat: LAT0 + 0.001, lon: LON0, speed: 40 });
        const rows = (await tx.query(`SELECT 1 FROM public.tracking_alerts WHERE vehicle_id = $1`, [ID.vehicleA1])).rows;
        expect(rows).toHaveLength(0);
      });
    });

    it('hors ligne : alerte unique par boîtier silencieux (sans doublon), sévérité critique pendant une location, résolue au retour du signal', async () => {
      const a2 = await tracker(ID.vehicleA2, 'offline-a2');
      const a1 = await tracker(ID.vehicleA1, 'offline-a1');
      await db.query(`UPDATE public.vehicle_trackers SET last_seen_at = now() - interval '40 minutes' WHERE id IN ($1, $2)`, [a2, a1]);
      await asRole(db, 'service_role', null, async (tx) => {
        const first = (await tx.query<{ r: Row }>(`SELECT public.tracking_run_maintenance() AS r`)).rows[0]!.r;
        expect(first.offline_alerts_created).toBe(2);
        const second = (await tx.query<{ r: Row }>(`SELECT public.tracking_run_maintenance() AS r`)).rows[0]!.r;
        expect(second.offline_alerts_created).toBe(0);
        const rows = (await tx.query(`SELECT vehicle_id, severity FROM public.tracking_alerts WHERE type = 'DEVICE_OFFLINE' ORDER BY severity`)).rows as Row[];
        expect(rows).toEqual([
          { vehicle_id: ID.vehicleA1, severity: 'CRITICAL' },
          { vehicle_id: ID.vehicleA2, severity: 'WARNING' },
        ]);
        // Le boîtier reprend contact : alerte résolue
        await ingest(tx, 'offline-a2', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0 });
        const resolved = (await tx.query(`SELECT resolved_at FROM public.tracking_alerts WHERE vehicle_id = $1`, [ID.vehicleA2])).rows[0] as Row;
        expect(resolved.resolved_at).not.toBeNull();
        // Une nouvelle coupure après résolution crée une nouvelle alerte
        await tx.query(`UPDATE public.vehicle_trackers SET last_seen_at = now() - interval '40 minutes' WHERE id = $1`, [a2]);
        const third = (await tx.query<{ r: Row }>(`SELECT public.tracking_run_maintenance() AS r`)).rows[0]!.r;
        expect(third.offline_alerts_created).toBe(1);
      });
    });

    it('le seuil hors ligne est celui de l’agence ; un boîtier en attente n’est jamais « hors ligne »', async () => {
      await tracker(ID.vehicleA2, 'offline-threshold');
      await tracker(ID.vehicleA1, 'offline-pending', ID.agencyA, 'PENDING');
      await db.query(`UPDATE public.vehicle_trackers SET last_seen_at = now() - interval '40 minutes' WHERE external_device_id = 'offline-threshold'`);
      await db.query(`INSERT INTO public.tracking_settings (agency_id, offline_after_minutes) VALUES ($1, 120)`, [ID.agencyA]);
      const r = await asRole(db, 'service_role', null, async (tx) => (await tx.query<{ r: Row }>(`SELECT public.tracking_run_maintenance() AS r`)).rows[0]!.r);
      expect(r.offline_alerts_created).toBe(0);
    });

    it('signaux matériels (sabotage, débranchement) : alertes critiques uniquement si le boîtier les fournit, résolues à la fin du signal', async () => {
      await tracker(ID.vehicleA2, 'hw');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'hw', { at: minutesAgo(10), lat: LAT0, lon: LON0, speed: 0 });
        expect(await alertsOf(tx)).toHaveLength(0);
        await ingest(tx, 'hw', { at: minutesAgo(9), lat: LAT0, lon: LON0, speed: 0, tamper: true, power_disconnected: true });
        await ingest(tx, 'hw', { at: minutesAgo(8), lat: LAT0, lon: LON0, speed: 0, tamper: true, power_disconnected: true });
        let alerts = await alertsOf(tx);
        expect(alerts.map((a) => `${a.type}:${a.severity}`).sort()).toEqual(['TRACKER_DISCONNECTED:CRITICAL', 'TRACKER_TAMPER:CRITICAL']);
        await ingest(tx, 'hw', { at: minutesAgo(7), lat: LAT0, lon: LON0, speed: 0, tamper: false, power_disconnected: false });
        alerts = await alertsOf(tx);
        expect(alerts.every((a) => a.resolved_at !== null)).toBe(true);
        // Événement sans position : accepté s'il porte un signal matériel
        const statusOnly = await ingest(tx, 'hw', { at: minutesAgo(6), tamper: true });
        expect(statusOnly.status).toBe('accepted');
      });
    });

    it('accusé de réception : permission, idempotence, horodatage et audit', async () => {
      await tracker(ID.vehicleA2, 'ack');
      await db.query(`INSERT INTO public.tracking_settings (agency_id, speed_alerts_enabled, speed_limit_kmh) VALUES ($1, true, 50)`, [ID.agencyA]);
      const alertId = await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'ack', { at: minutesAgo(2), lat: LAT0, lon: LON0, speed: 120 });
        return ((await tx.query(`SELECT id FROM public.tracking_alerts`)).rows[0] as Row).id as string;
      });
      // La transaction ci-dessus est annulée : on recrée l'alerte de façon durable
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO public.tracking_alerts (agency_id, vehicle_id, type, severity, title, description, dedupe_key, occurred_at)
         VALUES ($1, $2, 'SPEED_LIMIT', 'WARNING', 'Vitesse excessive', 'Test', 'ack-test', now()) RETURNING id`,
        [ID.agencyA, ID.vehicleA2]
      );
      void alertId;
      const id = rows[0]!.id;

      for (const user of [ID.agentA, ID.viewerA, ID.customer, ID.adminB]) {
        expect(await errorOf(asRole(db, 'authenticated', user, (tx) => tx.query(`SELECT public.acknowledge_tracking_alert($1)`, [id])))).toMatch(/permission denied|not found/);
      }
      await asRole(db, 'authenticated', ID.managerA, async (tx) => {
        const first = (await tx.query<{ r: Row }>(`SELECT public.acknowledge_tracking_alert($1) AS r`, [id])).rows[0]!.r;
        expect(first).toMatchObject({ changed: true, status: 'ACKNOWLEDGED' });
        const again = (await tx.query<{ r: Row }>(`SELECT public.acknowledge_tracking_alert($1) AS r`, [id])).rows[0]!.r;
        expect(again).toMatchObject({ changed: false, status: 'ACKNOWLEDGED' });
        const row = (await tx.query(`SELECT status, acknowledged_at, acknowledged_by FROM public.tracking_alerts WHERE id = $1`, [id])).rows[0] as Row;
        expect(row.acknowledged_at).not.toBeNull();
        expect(row.acknowledged_by).toBe(ID.managerA);
        const audit = (await tx.query(`SELECT count(*)::int AS n FROM public.tracking_audit_log WHERE entity_id = $1 AND action = 'alert.acknowledged'`, [id])).rows[0] as Row;
        expect(audit.n).toBe(1);
      });
    });

    it('zones : création et affectation par la fonction, isolation entre agences, limite de véhicules étrangers', async () => {
      await asRole(db, 'authenticated', ID.managerA, async (tx) => {
        const id = (await tx.query<{ id: string }>(
          `SELECT public.save_vehicle_geofence($1, NULL, 'Agence centrale', $2, $3, 300, true, true, true, ARRAY[$4, $5]::uuid[]) AS id`,
          [ID.agencyA, LAT0, LON0, ID.vehicleA1, ID.vehicleA2]
        )).rows[0]!.id;
        const assigned = (await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_geofence_assignments WHERE geofence_id = $1`, [id])).rows[0] as Row;
        expect(assigned.n).toBe(2);
        // Mise à jour : retire un véhicule
        await tx.query(`SELECT public.save_vehicle_geofence($1, $2, 'Agence centrale', $3, $4, 300, true, true, true, ARRAY[$5]::uuid[])`, [ID.agencyA, id, LAT0, LON0, ID.vehicleA1]);
        expect(((await tx.query(`SELECT count(*)::int AS n FROM public.vehicle_geofence_assignments WHERE geofence_id = $1`, [id])).rows[0] as Row).n).toBe(1);

        // Véhicule d'une autre agence : refusé
        expect(await attempt(tx, `SELECT public.save_vehicle_geofence($1, NULL, 'Piège', $2, $3, 300, true, true, true, ARRAY[$4]::uuid[])`, [ID.agencyA, LAT0, LON0, ID.vehicleB1])).toMatch(/vehicle not found/);
      });
      await asRole(db, 'authenticated', ID.agentA, async (tx) => {
        expect(await attempt(tx, `SELECT public.save_vehicle_geofence($1, NULL, 'Interdit', $2, $3, 300, true, true, true, '{}'::uuid[])`, [ID.agencyA, LAT0, LON0])).toMatch(/permission denied/);
      });
      await asRole(db, 'authenticated', ID.adminB, async (tx) => {
        expect(await attempt(tx, `SELECT public.save_vehicle_geofence($1, NULL, 'Cross', $2, $3, 300, true, true, true, '{}'::uuid[])`, [ID.agencyA, LAT0, LON0])).toMatch(/permission denied/);
      });
    });

    it('zones : bornes du rayon et nom unique par agence imposés par la base', async () => {
      await geofence([], { name: 'Unique' });
      const dup = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) =>
        tx.query(`SELECT public.save_vehicle_geofence($1, NULL, ' unique ', $2, $3, 300, true, true, true, '{}'::uuid[])`, [ID.agencyA, LAT0, LON0])));
      expect(dup).toMatch(/uq_vehicle_geofences_name/);
      for (const radius of [10, 100001]) {
        const message = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) =>
          tx.query(`SELECT public.save_vehicle_geofence($1, NULL, 'Rayon', $2, $3, $4, true, true, true, '{}'::uuid[])`, [ID.agencyA, LAT0, LON0, radius])));
        expect(message, String(radius)).toMatch(/check constraint/i);
      }
    });

    it('modifier la géométrie d’une zone réinitialise l’état (pas de fausse alerte au prochain fix)', async () => {
      await tracker(ID.vehicleA2, 'gf-reset');
      const gf = await geofence([ID.vehicleA2]);
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'gf-reset', { at: minutesAgo(30), lat: LAT0, lon: LON0, speed: 0 });
      });
      await db.query(`UPDATE public.vehicle_geofence_assignments SET inside = true WHERE geofence_id = $1`, [gf]);
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        await tx.query(`SELECT public.save_vehicle_geofence($1, $2, 'Aéroport Nador', $3, $4, 100, true, true, true, ARRAY[$5]::uuid[])`, [ID.agencyA, gf, LAT0 + 0.05, LON0, ID.vehicleA2]);
        const state = (await tx.query(`SELECT inside FROM public.vehicle_geofence_assignments WHERE geofence_id = $1`, [gf])).rows[0] as Row;
        expect(state.inside).toBeNull();
      });
    });
  });

  // ------------------------------------------------------------------------
  describe('Lectures de l’agence (RPC)', () => {
    it('aperçu de flotte : compteurs, états, recherche, isolation et absence de données de locataire', async () => {
      await tracker(ID.vehicleA1, 'ov-1');
      await tracker(ID.vehicleA2, 'ov-2');
      await asRole(db, 'service_role', null, async (tx) => {
        // A1 : en mouvement ; A2 : à l'arrêt
        await ingest(tx, 'ov-1', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 45 });
        await ingest(tx, 'ov-2', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0 });
        await as(tx, 'authenticated', ID.adminA);
        const overview = (await tx.query<{ r: Row }>(`SELECT public.tracking_fleet_overview($1) AS r`, [ID.agencyA])).rows[0]!.r;
        expect(overview.summary).toMatchObject({ total_vehicles: 2, tracked: 2, online: 2, moving: 1, stationary: 1, offline: 0, untracked: 0 });
        const vehicles = overview.vehicles as Row[];
        expect(vehicles.map((v) => v.state)).toEqual(['MOVING', 'STATIONARY']);
        expect((vehicles[0] as Row).booking_reference).toBe('CD-2026-900001');
        expect(JSON.stringify(overview)).not.toMatch(/Locataire Privé|locataire@test|0600000000/);

        const search = (await tx.query<{ r: Row }>(`SELECT public.tracking_fleet_overview($1, '22222') AS r`, [ID.agencyA])).rows[0]!.r;
        expect((search.vehicles as Row[]).map((v) => v.unit_number)).toEqual(['A-2']);
        const filtered = (await tx.query<{ r: Row }>(`SELECT public.tracking_fleet_overview($1, NULL, 'moving') AS r`, [ID.agencyA])).rows[0]!.r;
        expect((filtered.vehicles as Row[]).map((v) => v.unit_number)).toEqual(['A-1']);

        await as(tx, 'authenticated', ID.adminB);
        const other = (await tx.query<{ r: Row }>(`SELECT public.tracking_fleet_overview($1) AS r`, [ID.agencyB])).rows[0]!.r;
        expect(other.summary).toMatchObject({ total_vehicles: 1, tracked: 0, untracked: 1 });
        expect(JSON.stringify(other)).not.toContain(LAT0.toString());
      });
    });

    it('états : hors ligne si silence prolongé, en attente avant la première position, hors suivi sans boîtier', async () => {
      await tracker(ID.vehicleA1, 'st-offline');
      await tracker(ID.vehicleA2, 'st-pending', ID.agencyA, 'PENDING');
      await db.query(`UPDATE public.vehicle_trackers SET last_seen_at = now() - interval '2 hours' WHERE external_device_id = 'st-offline'`);
      const states = await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        const r = (await tx.query<{ r: Row }>(`SELECT public.tracking_fleet_overview($1) AS r`, [ID.agencyA])).rows[0]!.r;
        return Object.fromEntries((r.vehicles as Row[]).map((v) => [v.unit_number as string, v.state]));
      });
      expect(states).toEqual({ 'A-1': 'OFFLINE', 'A-2': 'AWAITING' });
    });

    it('détail véhicule : 404 pour un véhicule d’une autre agence, 42501 sans permission', async () => {
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        expect(await attempt(tx, `SELECT public.tracking_vehicle_detail($1, $2)`, [ID.agencyA, ID.vehicleB1])).toMatch(/vehicle not found/);
        const detail = (await tx.query<{ r: Row }>(`SELECT public.tracking_vehicle_detail($1, $2) AS r`, [ID.agencyA, ID.vehicleA1])).rows[0]!.r;
        expect(detail.state).toBe('UNTRACKED');
        expect((detail.booking as Row).reference).toBe('CD-2026-900001');
        expect(JSON.stringify(detail)).not.toMatch(/Locataire Privé|locataire@test/);
      });
      expect(await errorOf(asRole(db, 'authenticated', ID.agentA, (tx) => tx.query(`SELECT public.tracking_vehicle_detail($1, $2)`, [ID.agencyA, ID.vehicleA1])))).toMatch(/permission denied/);
    });

    it('historique : pagination par curseur sans doublon ni trou, positions suspectes exclues, plage et accès contrôlés', async () => {
      await tracker(ID.vehicleA2, 'hist');
      await asRole(db, 'service_role', null, async (tx) => {
        for (let i = 0; i < 12; i += 1) {
          await ingest(tx, 'hist', { at: new Date(Date.now() - (600 - i * 10) * 1000).toISOString(), lat: LAT0 + i * 0.0001, lon: LON0, speed: 0 });
        }
        // Un saut (JUMP) ne doit pas apparaître par défaut
        await ingest(tx, 'hist', { at: new Date(Date.now() - 400_000).toISOString(), lat: LAT0 + 2, lon: LON0, speed: 0 });

        await as(tx, 'authenticated', ID.adminA);
        const from = new Date(Date.now() - 3_600_000).toISOString();
        const to = new Date(Date.now() + 60_000).toISOString();
        const page = async (cursor?: { recorded_at: string; id: number }, includeSuspect = false) =>
          (await tx.query<{ r: { points: { id: number; recorded_at: string; quality: string }[]; next_cursor: { recorded_at: string; id: number } | null } }>(
            `SELECT public.tracking_vehicle_history($1, $2, $3, $4, 5, $5, $6, $7) AS r`,
            [ID.agencyA, ID.vehicleA2, from, to, cursor?.recorded_at ?? null, cursor?.id ?? null, includeSuspect]
          )).rows[0]!.r;

        const seen: number[] = [];
        let cursor: { recorded_at: string; id: number } | undefined;
        let pages = 0;
        do {
          const result = await page(cursor);
          seen.push(...result.points.map((p) => p.id));
          cursor = result.next_cursor ?? undefined;
          pages += 1;
        } while (cursor && pages < 10);
        expect(pages).toBe(3);
        expect(seen).toHaveLength(12);
        expect(new Set(seen).size).toBe(12);

        const all = (await tx.query<{ r: { points: { quality: string }[] } }>(
          `SELECT public.tracking_vehicle_history($1, $2, $3, $4, 50, NULL, NULL, true) AS r`,
          [ID.agencyA, ID.vehicleA2, from, to]
        )).rows[0]!.r;
        expect(all.points).toHaveLength(13);
        expect(all.points.some((p) => p.quality === 'JUMP')).toBe(true);

        expect(await attempt(tx, `SELECT public.tracking_vehicle_history($1, $2, now() - interval '40 days', now())`, [ID.agencyA, ID.vehicleA2])).toMatch(/31 days/);
        expect(await attempt(tx, `SELECT public.tracking_vehicle_history($1, $2, now() - interval '1 day', now(), 10, now(), NULL)`, [ID.agencyA, ID.vehicleA2])).toMatch(/invalid cursor/);
        expect(await attempt(tx, `SELECT public.tracking_vehicle_history($1, $2, now() - interval '1 day', now())`, [ID.agencyA, ID.vehicleB1])).toMatch(/vehicle not found/);
        await as(tx, 'authenticated', ID.agentA);
        expect(await attempt(tx, `SELECT public.tracking_vehicle_history($1, $2, now() - interval '1 day', now())`, [ID.agencyA, ID.vehicleA2])).toMatch(/permission denied/);
        await as(tx, 'authenticated', ID.adminB);
        expect(await attempt(tx, `SELECT public.tracking_vehicle_history($1, $2, now() - interval '1 day', now())`, [ID.agencyA, ID.vehicleA2])).toMatch(/permission denied/);
      });
    });

    it('pages de trajets et d’alertes : plage bornée à 93 jours, pagination bornée', async () => {
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        const bad = await attempt(tx, `SELECT public.tracking_trips_page($1, NULL, now() - interval '200 days', now())`, [ID.agencyA]);
        expect(bad).toMatch(/invalid date range/);
        const page = (await tx.query<{ r: Row }>(`SELECT public.tracking_trips_page($1, NULL, now() - interval '7 days', now(), 100000, -5) AS r`, [ID.agencyA])).rows[0]!.r;
        expect(page).toMatchObject({ total: 0, limit: 100, offset: 0 });
        const alerts = (await tx.query<{ r: Row }>(`SELECT public.tracking_alerts_page($1, NULL, NULL, NULL, NULL, 100000, 0) AS r`, [ID.agencyA])).rows[0]!.r;
        expect(alerts).toMatchObject({ limit: 100 });
      });
    });

    it('liste des boîtiers avec historique d’affectation, sans boîtiers déconnectés par défaut', async () => {
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        const a = (await tx.query<{ id: string }>(`SELECT public.register_vehicle_tracker($1, $2, 'list-1', 'Boîtier 1', $3) AS id`, [ID.agencyA, PROVIDER, ID.vehicleA1])).rows[0]!.id;
        await tx.query(`SELECT public.register_vehicle_tracker($1, $2, 'list-2', 'Boîtier 2', NULL)`, [ID.agencyA, PROVIDER]);
        await tx.query(`SELECT public.assign_vehicle_tracker($1, $2, 'Test')`, [a, ID.vehicleA2]);
        const list = (await tx.query<{ r: Row }>(`SELECT public.tracking_trackers_list($1) AS r`, [ID.agencyA])).rows[0]!.r;
        const trackers = list.trackers as Row[];
        expect(trackers).toHaveLength(2);
        const withHistory = trackers.find((t) => t.external_device_id === 'list-1') as Row;
        expect((withHistory.history as Row[]).length).toBe(2);
        expect((withHistory.vehicle as Row).unit_number).toBe('A-2');
        await tx.query(`SELECT public.disconnect_vehicle_tracker($1)`, [a]);
        expect(((await tx.query<{ r: Row }>(`SELECT public.tracking_trackers_list($1) AS r`, [ID.agencyA])).rows[0]!.r.trackers as Row[])).toHaveLength(1);
        expect(((await tx.query<{ r: Row }>(`SELECT public.tracking_trackers_list($1, true) AS r`, [ID.agencyA])).rows[0]!.r.trackers as Row[])).toHaveLength(2);
      });
    });
  });

  // ------------------------------------------------------------------------
  describe('Paramètres, conformité, support plateforme, audit, rétention', () => {
    it('paramètres : défauts cohérents avec la table, modification réservée à tracking.settings.manage, bornes imposées', async () => {
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        const defaults = (await tx.query<{ r: Row }>(`SELECT public.tracking_get_settings($1) AS r`, [ID.agencyA])).rows[0]!.r;
        expect(defaults).toMatchObject({ retention_days: 90, offline_after_minutes: 15, configured: false });
        const updated = (await tx.query<{ r: Row }>(
          `SELECT public.update_tracking_settings($1, '{"retention_days": 30, "speed_alerts_enabled": true, "speed_limit_kmh": 80, "legal_basis": "LEGITIMATE_INTEREST", "cndp_reference": "Dossier 123", "customers_informed": true}'::jsonb) AS r`,
          [ID.agencyA]
        )).rows[0]!.r;
        expect(updated).toMatchObject({ retention_days: 30, speed_limit_kmh: 80, legal_basis: 'LEGITIMATE_INTEREST', configured: true });
        expect(updated.customers_informed_at).not.toBeNull();
        expect(await attempt(tx, `SELECT public.update_tracking_settings($1, '{"retention_days": 1}'::jsonb)`, [ID.agencyA])).toMatch(/check constraint/i);
        expect(await attempt(tx, `SELECT public.update_tracking_settings($1, '{"speed_limit_kmh": null}'::jsonb)`, [ID.agencyA])).toMatch(/tracking_settings_speed_limit_required/);
        expect(await attempt(tx, `SELECT public.update_tracking_settings($1, '{"agency_id": "x"}'::jsonb)`, [ID.agencyA])).toMatch(/unknown setting/);
      });
      for (const user of [ID.managerA, ID.agentA, ID.viewerA, ID.customer, ID.adminB]) {
        expect(await errorOf(asRole(db, 'authenticated', user, (tx) => tx.query(`SELECT public.update_tracking_settings($1, '{"retention_days": 30}'::jsonb)`, [ID.agencyA]))), user).toMatch(/permission denied/);
      }
    });

    it('les valeurs par défaut renvoyées sans ligne en base sont celles de la table', async () => {
      await db.query(`INSERT INTO public.tracking_settings (agency_id) VALUES ($1)`, [ID.agencyB]);
      const { rows } = await db.query<{ defaults: Row; actual: Row }>(
        `SELECT public.tracking_default_settings(agency_id) AS defaults, to_jsonb(s) AS actual FROM public.tracking_settings s WHERE agency_id = $1`,
        [ID.agencyB]
      );
      for (const key of ['retention_days', 'trip_retention_days', 'offline_after_minutes', 'moving_speed_kmh', 'trip_end_idle_minutes', 'speed_alerts_enabled', 'unexpected_movement_enabled', 'quiet_hours_start', 'quiet_hours_end']) {
        expect(rows[0]!.defaults[key], key).toEqual(rows[0]!.actual[key]);
      }
    });

    it('support plateforme : accès explicite, motivé, borné, lecture seule, visible et révocable par l’agence', async () => {
      // Sans autorisation : aucun accès
      expect(await errorOf(asRole(db, 'authenticated', ID.superAdmin, (tx) => tx.query(`SELECT public.tracking_fleet_overview($1)`, [ID.agencyA])))).toMatch(/permission denied/);

      await asRole(db, 'authenticated', ID.superAdmin, async (tx) => {
        // Motif et durée obligatoires
        expect(await attempt(tx, `SELECT public.grant_tracking_support_access($1, 'court', 30)`, [ID.agencyA])).toMatch(/reason/);
        expect(await attempt(tx, `SELECT public.grant_tracking_support_access($1, 'Ticket support #4512 : localisation', 600)`, [ID.agencyA])).toMatch(/duration/);
        const grantId = (await tx.query<{ id: string }>(`SELECT public.grant_tracking_support_access($1, 'Ticket support #4512 : localisation', 30) AS id`, [ID.agencyA])).rows[0]!.id;

        // Lecture autorisée sur cette agence uniquement
        const ok = (await tx.query<{ r: Row }>(`SELECT public.tracking_fleet_overview($1) AS r`, [ID.agencyA])).rows[0]!.r;
        expect(ok.summary).toBeDefined();
        expect(await attempt(tx, `SELECT public.tracking_fleet_overview($1)`, [ID.agencyB])).toMatch(/permission denied/);
        // Lecture seule : aucune gestion
        expect(await attempt(tx, `SELECT public.register_vehicle_tracker($1, $2, 'support-x', NULL, NULL)`, [ID.agencyA, PROVIDER])).toMatch(/permission denied/);
        expect(await attempt(tx, `SELECT public.update_tracking_settings($1, '{"retention_days": 30}'::jsonb)`, [ID.agencyA])).toMatch(/permission denied/);
        // Une consultation sensible est journalisée comme accès de support
        await tx.query(`SELECT public.tracking_record_access($1, 'support.read', 'fleet', NULL, '{}'::jsonb)`, [ID.agencyA]);

        // L'administrateur de l'agence voit l'accès et peut y mettre fin
        await as(tx, 'authenticated', ID.adminA);
        const visible = (await tx.query(`SELECT id, reason FROM public.tracking_support_grants`)).rows as Row[];
        expect(visible.map((r) => r.id)).toEqual([grantId]);
        const audit = (await tx.query(`SELECT actor_kind, action FROM public.tracking_audit_log WHERE agency_id = $1 ORDER BY id`, [ID.agencyA])).rows as Row[];
        expect(audit).toEqual([
          { actor_kind: 'platform_support', action: 'support.access_granted' },
          { actor_kind: 'platform_support', action: 'support.read' },
        ]);
        await tx.query(`SELECT public.revoke_tracking_support_access($1)`, [grantId]);
        await as(tx, 'authenticated', ID.superAdmin);
        expect(await attempt(tx, `SELECT public.tracking_fleet_overview($1)`, [ID.agencyA])).toMatch(/permission denied/);
      });
    });

    it('support plateforme : seul un Super Admin peut demander un accès ; expiration respectée', async () => {
      for (const user of [ID.adminA, ID.managerA, ID.customer]) {
        expect(await errorOf(asRole(db, 'authenticated', user, (tx) => tx.query(`SELECT public.grant_tracking_support_access($1, 'Demande non autorisée de test', 30)`, [ID.agencyA]))), user).toMatch(/permission denied/);
      }
      // Autorisation expirée : accès refusé
      await db.query(
        `INSERT INTO public.tracking_support_grants (agency_id, granted_to, reason, starts_at, expires_at)
         VALUES ($1, $2, 'Autorisation expirée pour test', now() - interval '3 hours', now() - interval '2 hours' - interval '1 minute')`,
        [ID.agencyA, ID.superAdmin]
      );
      expect(await errorOf(asRole(db, 'authenticated', ID.superAdmin, (tx) => tx.query(`SELECT public.tracking_fleet_overview($1)`, [ID.agencyA])))).toMatch(/permission denied/);
    });

    it('accès sensibles : journalisation réservée aux lecteurs autorisés, actions bornées', async () => {
      await asRole(db, 'authenticated', ID.adminA, async (tx) => {
        await tx.query(`SELECT public.tracking_record_access($1, 'history.read', 'vehicle', $2, '{"range_days": 3}'::jsonb)`, [ID.agencyA, ID.vehicleA1]);
        expect(await attempt(tx, `SELECT public.tracking_record_access($1, 'settings.hack', 'vehicle', NULL)`, [ID.agencyA])).toMatch(/unsupported/);
      });
      expect(await errorOf(asRole(db, 'authenticated', ID.agentA, (tx) => tx.query(`SELECT public.tracking_record_access($1, 'history.read', 'vehicle', NULL)`, [ID.agencyA])))).toMatch(/permission denied/);
    });

    it('le journal d’audit est immuable (UPDATE, DELETE et TRUNCATE ordinaire refusés, même pour le propriétaire)', async () => {
      await asRole(db, 'authenticated', ID.adminA, (tx) => tx.query(`SELECT public.tracking_record_access($1, 'history.read', 'vehicle', NULL)`, [ID.agencyA]));
      // Hors transaction annulée : on écrit une ligne durable pour tester l'immuabilité
      await db.query(`INSERT INTO public.tracking_audit_log (agency_id, action, entity_type) VALUES ($1, 'test.immutable', 'test')`, [ID.agencyA]);
      expect(await errorOf(db.query(`UPDATE public.tracking_audit_log SET action = 'x' WHERE action = 'test.immutable'`))).toMatch(/append-only/);
      expect(await errorOf(db.query(`DELETE FROM public.tracking_audit_log WHERE action = 'test.immutable'`))).toMatch(/append-only/);
    });

    it('purge : positions et trajets expirés supprimés selon la rétention de chaque agence, pas les récents ni les autres agences', async () => {
      await tracker(ID.vehicleA1, 'purge-a');
      await tracker(ID.vehicleB1, 'purge-b', ID.agencyB);
      await db.query(`INSERT INTO public.tracking_settings (agency_id, retention_days) VALUES ($1, 7)`, [ID.agencyA]);
      const insert = (agency: string, vehicle: string, tracker_: string, days: number, key: string) =>
        db.query(
          `INSERT INTO public.vehicle_locations (agency_id, vehicle_id, tracker_id, recorded_at, latitude, longitude, dedupe_key)
           VALUES ($1, $2, $3, now() - make_interval(days => $4), 35.1, -2.9, $5)`,
          [agency, vehicle, tracker_, days, key]
        );
      const trackerA = ((await db.query(`SELECT id FROM public.vehicle_trackers WHERE external_device_id = 'purge-a'`)).rows[0] as Row).id as string;
      const trackerB = ((await db.query(`SELECT id FROM public.vehicle_trackers WHERE external_device_id = 'purge-b'`)).rows[0] as Row).id as string;
      await insert(ID.agencyA, ID.vehicleA1, trackerA, 30, 'a-old');
      await insert(ID.agencyA, ID.vehicleA1, trackerA, 2, 'a-new');
      await insert(ID.agencyB, ID.vehicleB1, trackerB, 30, 'b-30d'); // défaut 90 jours : conservé
      await insert(ID.agencyB, ID.vehicleB1, trackerB, 120, 'b-120d');
      await db.query(`INSERT INTO public.tracking_ingest_failures (provider, reason, created_at) VALUES ('p', 'old', now() - interval '40 days'), ('p', 'new', now())`);
      const result = await asRole(db, 'service_role', null, async (tx) => {
        const r = (await tx.query<{ r: Row }>(`SELECT public.tracking_purge_expired(1000) AS r`)).rows[0]!.r;
        const left = (await tx.query<{ dedupe_key: string }>(`SELECT dedupe_key FROM public.vehicle_locations ORDER BY dedupe_key`)).rows.map((x) => x.dedupe_key);
        return { r, left };
      });
      expect(result.left).toEqual(['a-new', 'b-30d']);
      expect(result.r).toMatchObject({ locations_deleted: 2, ingest_failures_deleted: 1 });
      await db.exec(`DELETE FROM public.vehicle_locations`);
    });

    it('purge : le journal d’audit de plus de 2 ans est supprimé par la seule fonction de purge', async () => {
      await db.exec(`SELECT set_config('tracking.audit_purge', 'on', false)`);
      await db.query(`INSERT INTO public.tracking_audit_log (agency_id, action, entity_type, created_at) VALUES ($1, 'test.ancient', 'test', now() - interval '800 days')`, [ID.agencyA]);
      await db.exec(`SELECT set_config('tracking.audit_purge', 'off', false)`);
      const outcome = await asRole(db, 'service_role', null, async (tx) => {
        const r = (await tx.query<{ r: Row }>(`SELECT public.tracking_purge_expired(1000) AS r`)).rows[0]!.r;
        const left = (await tx.query(`SELECT 1 FROM public.tracking_audit_log WHERE action = 'test.ancient'`)).rows.length;
        return { deleted: r.audit_rows_deleted, left };
      });
      expect(outcome).toEqual({ deleted: 1, left: 0 });
    });

    it('suppression physique d’un véhicule : le boîtier est détaché (pas supprimé) et l’historique suit le véhicule', async () => {
      const spare = '20000000-0000-4000-8000-0000000000a9';
      await db.query(
        `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price)
         VALUES ($1, $2, 'A-9', 'Fiat', 'Panda', 'fiat-panda-gps-a9', 2024, 'Citadine', 'MANUAL', 'GASOLINE', 250)`,
        [spare, ID.agencyA]
      );
      const id = await tracker(spare, 'delete-vehicle');
      await asRole(db, 'service_role', null, async (tx) => {
        await ingest(tx, 'delete-vehicle', { at: minutesAgo(1), lat: LAT0, lon: LON0, speed: 0 });
      });
      await db.query(`DELETE FROM public.vehicles WHERE id = $1`, [spare]);
      const row = (await db.query(`SELECT vehicle_id, agency_id FROM public.vehicle_trackers WHERE id = $1`, [id])).rows[0] as Row;
      expect(row).toEqual({ vehicle_id: null, agency_id: ID.agencyA });
    });

    it('cohérence tenant : un boîtier ne peut pas pointer vers un véhicule d’une autre agence (clé composite)', async () => {
      const message = await errorOf(
        db.query(`INSERT INTO public.vehicle_trackers (agency_id, vehicle_id, provider, external_device_id) VALUES ($1, $2, $3, 'tenant-mix')`, [ID.agencyA, ID.vehicleB1, PROVIDER])
      );
      expect(message).toMatch(/vehicle_trackers_vehicle_agency_fk|foreign key/i);
    });
  });
});
