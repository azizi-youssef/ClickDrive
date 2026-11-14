import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261115000100 (phase 2) :
 * - colonnes privées des véhicules (plaque, n° d'unité, documents) illisibles pour anon et authenticated ;
 * - aucune écriture directe sur la flotte par PostgREST (tout passe par l'API serveur) ;
 * - photos et équipements lisibles exactement quand le véhicule l'est ;
 * - plus aucune politique RLS n'accorde de droit au rôle historique ADMIN.
 */

const ID = {
  agencyA: '61000000-0000-4000-8000-00000000000a',
  agencyB: '61000000-0000-4000-8000-00000000000b',
  published: '62000000-0000-4000-8000-00000000000a',
  unpublished: '62000000-0000-4000-8000-00000000000b',
  vehicleB: '62000000-0000-4000-8000-00000000000c',
  adminA: '01000000-0000-4000-8000-0000000006a1',
  adminB: '01000000-0000-4000-8000-0000000006b1',
  customer: '01000000-0000-4000-8000-0000000006c1',
  legacyAdmin: '01000000-0000-4000-8000-0000000006d1',
  superAdmin: '01000000-0000-4000-8000-0000000006e1',
  revokedA: '01000000-0000-4000-8000-0000000006f1',
} as const;

/** Colonnes que l'application lit avec un client de session (bookings.service, routes RLS) */
const SESSION_VEHICLE_COLUMNS =
  'id, agency_id, slug, brand, model, year, category, transmission, fuel, seats, doors, air_conditioning, ' +
  'daily_price, weekly_price, monthly_price, deposit, min_rental_days, status, published, featured, archived_at, created_at, updated_at';

describe('Phase 2 — privilèges des véhicules et politiques plateforme', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    for (const [id, email] of [
      [ID.adminA, 'p2.admin.a@test.invalid'],
      [ID.adminB, 'p2.admin.b@test.invalid'],
      [ID.customer, 'p2.customer@test.invalid'],
      [ID.legacyAdmin, 'p2.legacy@test.invalid'],
      [ID.superAdmin, 'p2.super@test.invalid'],
      [ID.revokedA, 'p2.revoked@test.invalid'],
    ]) {
      await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, email]);
    }
    await db.query(`UPDATE public.profiles SET role = 'ADMIN' WHERE id = $1`, [ID.legacyAdmin]);
    await db.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.superAdmin]);

    const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                    VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
    await db.query(agency, [ID.agencyA, 'Agence A', 'p2-agence-a', 'p2a@test.invalid']);
    await db.query(agency, [ID.agencyB, 'Agence B', 'p2-agence-b', 'p2b@test.invalid']);
    const member = `INSERT INTO public.agency_members (agency_id, user_id, role, status, revoked_at)
                    VALUES ($1, $2, 'agency_admin', $3, CASE WHEN $3 = 'REVOKED' THEN now() END)`;
    await db.query(member, [ID.agencyA, ID.adminA, 'ACTIVE']);
    await db.query(member, [ID.agencyB, ID.adminB, 'ACTIVE']);
    await db.query(member, [ID.agencyA, ID.revokedA, 'REVOKED']);

    const vehicle = `INSERT INTO public.vehicles (id, agency_id, unit_number, license_plate, brand, model, slug, year, category, transmission, fuel, daily_price, published)
                     VALUES ($1, $2, $3, $4, 'Dacia', 'Logan', $5, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, $6)`;
    await db.query(vehicle, [ID.published, ID.agencyA, 'A#101', '12345-A-50', 'p2-published', true]);
    await db.query(vehicle, [ID.unpublished, ID.agencyA, 'A#102', '12346-A-50', 'p2-unpublished', false]);
    await db.query(vehicle, [ID.vehicleB, ID.agencyB, 'B#201', '98765-B-48', 'p2-vehicle-b', true]);
    for (const vehicleId of [ID.published, ID.unpublished]) {
      await db.query(`INSERT INTO public.vehicle_images (vehicle_id, url, is_primary) VALUES ($1, 'https://img.test/a.jpg', true)`, [vehicleId]);
      await db.query(`INSERT INTO public.vehicle_features (vehicle_id, name) VALUES ($1, 'Climatisation')`, [vehicleId]);
    }
    await db.query(
      `INSERT INTO public.agency_subscriptions (agency_id, plan_id, status)
       SELECT $1, id, 'ACTIVE' FROM public.subscription_plans WHERE slug = 'starter'`,
      [ID.agencyA]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  describe('Colonnes privées des véhicules', () => {
    it.each([
      ['anon', null],
      ['client connecté', ID.customer],
      ['membre d’une autre agence', ID.adminB],
      ['membre de l’agence', ID.adminA],
    ] as const)('%s : plaque, n° d’unité et documents illisibles par PostgREST', async (_label, userId) => {
      const role = userId ? 'authenticated' : 'anon';
      for (const column of ['license_plate', 'unit_number', 'documents', '*']) {
        const error = await errorOf(asRole(db, role, userId, (tx) => tx.query(`SELECT ${column} FROM public.vehicles`)));
        expect(error, `SELECT ${column}`).toMatch(/permission denied/i);
      }
    });

    it('les colonnes lues par l’application avec une session restent lisibles (RLS inchangée)', async () => {
      const anon = await asRole(db, 'anon', null, async (tx) =>
        (await tx.query<{ id: string }>(`SELECT ${SESSION_VEHICLE_COLUMNS} FROM public.vehicles ORDER BY id`)).rows.map((r) => r.id)
      );
      expect(anon).toEqual([ID.published, ID.vehicleB]);
      const member = await asRole(db, 'authenticated', ID.adminA, async (tx) =>
        (await tx.query<{ id: string }>(`SELECT ${SESSION_VEHICLE_COLUMNS} FROM public.vehicles WHERE agency_id = $1 ORDER BY id`, [ID.agencyA])).rows.map((r) => r.id)
      );
      expect(member).toEqual([ID.published, ID.unpublished]);
    });

    it('la clé service-role lit toujours les colonnes privées (routes serveur après contrôle d’accès)', async () => {
      const rows = await asRole(db, 'service_role', null, async (tx) =>
        (await tx.query<{ license_plate: string }>(`SELECT license_plate FROM public.vehicles WHERE id = $1`, [ID.published])).rows
      );
      expect(rows).toEqual([{ license_plate: '12345-A-50' }]);
    });

    it('aucune écriture directe sur la flotte, même pour un membre vehicles.manage', async () => {
      for (const statement of [
        [`UPDATE public.vehicles SET featured = true WHERE id = $1`, [ID.published]],
        [`UPDATE public.vehicles SET daily_price = 1 WHERE id = $1`, [ID.published]],
        [`DELETE FROM public.vehicles WHERE id = $1`, [ID.published]],
        [
          `INSERT INTO public.vehicles (agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price)
           VALUES ($1, 'X', 'Dacia', 'Logan', 'p2-direct', 2025, 'Économique', 'MANUAL', 'DIESEL', 300)`,
          [ID.agencyA],
        ],
      ] as const) {
        const error = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) => tx.query(statement[0], [...statement[1]])));
        expect(error, statement[0]).toMatch(/permission denied/i);
      }
    });
  });

  describe('Photos et équipements', () => {
    const visible = (table: 'vehicle_images' | 'vehicle_features', role: 'anon' | 'authenticated', userId: string | null) =>
      asRole(db, role, userId, async (tx) =>
        (await tx.query<{ vehicle_id: string }>(`SELECT vehicle_id FROM public.${table} ORDER BY vehicle_id`)).rows.map((r) => r.vehicle_id)
      );

    it.each(['vehicle_images', 'vehicle_features'] as const)('%s : anon voit ceux des véhicules publiés seulement', async (table) => {
      expect(await visible(table, 'anon', null)).toEqual([ID.published]);
    });

    it.each(['vehicle_images', 'vehicle_features'] as const)('%s : le membre de l’agence voit aussi ceux des véhicules non publiés', async (table) => {
      expect(await visible(table, 'authenticated', ID.adminA)).toEqual([ID.published, ID.unpublished]);
    });

    it.each(['vehicle_images', 'vehicle_features'] as const)('%s : une autre agence ne voit pas ceux des véhicules non publiés de A', async (table) => {
      expect(await visible(table, 'authenticated', ID.adminB)).toEqual([ID.published]);
    });

    it('aucune écriture directe sur les photos', async () => {
      const error = await errorOf(
        asRole(db, 'authenticated', ID.adminA, (tx) =>
          tx.query(`INSERT INTO public.vehicle_images (vehicle_id, url) VALUES ($1, 'https://evil.test/x.jpg')`, [ID.published])
        )
      );
      expect(error).toMatch(/permission denied|row-level security/i);
    });
  });

  describe('Rôle historique ADMIN', () => {
    it('aucune politique RLS ne cite encore le rôle ADMIN', async () => {
      const { rows } = await db.query<{ tablename: string; policyname: string }>(
        `SELECT tablename, policyname FROM pg_policies
          WHERE schemaname = 'public'
            AND (coalesce(qual, '') ~ '''ADMIN''' OR coalesce(with_check, '') ~ '''ADMIN''')
          ORDER BY tablename, policyname`
      );
      expect(rows).toEqual([]);
    });

    it('ADMIN ne gère ni les formules ni les abonnements', async () => {
      const plan = await asRole(db, 'authenticated', ID.legacyAdmin, async (tx) =>
        (await tx.query(`UPDATE public.subscription_plans SET price_monthly = 1 WHERE slug = 'starter' RETURNING id`)).rows
      );
      expect(plan).toEqual([]);
      const subscriptions = await asRole(db, 'authenticated', ID.legacyAdmin, async (tx) =>
        (await tx.query(`SELECT id FROM public.agency_subscriptions`)).rows
      );
      expect(subscriptions).toEqual([]);
      const insert = await errorOf(
        asRole(db, 'authenticated', ID.legacyAdmin, (tx) =>
          tx.query(
            `INSERT INTO public.agency_subscriptions (agency_id, plan_id) SELECT $1, id FROM public.subscription_plans WHERE slug = 'unlimited'`,
            [ID.agencyB]
          )
        )
      );
      expect(insert).toMatch(/row-level security|permission denied/i);
    });

    it('SUPER_ADMIN garde la gestion des formules et des abonnements', async () => {
      const plan = await asRole(db, 'authenticated', ID.superAdmin, async (tx) =>
        (await tx.query(`UPDATE public.subscription_plans SET badge = badge WHERE slug = 'starter' RETURNING id`)).rows
      );
      expect(plan).toHaveLength(1);
      const subscriptions = await asRole(db, 'authenticated', ID.superAdmin, async (tx) =>
        (await tx.query(`SELECT agency_id FROM public.agency_subscriptions`)).rows
      );
      expect(subscriptions).toEqual([{ agency_id: ID.agencyA }]);
    });

    it('un membre actif lit l’abonnement de son agence ; un membre révoqué ou une autre agence, non', async () => {
      const read = (userId: string) =>
        asRole(db, 'authenticated', userId, async (tx) => (await tx.query(`SELECT agency_id FROM public.agency_subscriptions`)).rows);
      expect(await read(ID.adminA)).toEqual([{ agency_id: ID.agencyA }]);
      expect(await read(ID.revokedA)).toEqual([]);
      expect(await read(ID.adminB)).toEqual([]);
    });
  });
});
