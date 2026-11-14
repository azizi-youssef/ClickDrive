import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261114000100 : la capacité de la formule est appliquée par la base, pour tous les rôles,
 * (les insertions directes par PostgREST sont en plus interdites depuis la migration 20261115000100).
 * Limite : PGlite n'a qu'une connexion ; la concurrence réelle (deux transactions) est couverte par le
 * verrou consultatif dont on vérifie la prise, et reste à rejouer sur staging.
 */

const ID = {
  agencyFree: '41000000-0000-4000-8000-00000000000a',
  agencyPro: '41000000-0000-4000-8000-00000000000b',
  agencyTarget: '41000000-0000-4000-8000-00000000000c',
  managerFree: '01000000-0000-4000-8000-0000000000f1',
} as const;

let counter = 0;

async function insertVehicles(tx: PGlite | Transaction, agencyId: string, count: number) {
  const values: string[] = [];
  const params: unknown[] = [agencyId];
  for (let i = 0; i < count; i += 1) {
    counter += 1;
    params.push(`cap-${counter}`);
    values.push(`($1, 'U-${counter}', 'Dacia', 'Logan', $${params.length}, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`);
  }
  await tx.query(
    `INSERT INTO public.vehicles (agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
     VALUES ${values.join(', ')}`,
    params
  );
}

async function fleetSize(db: PGlite, agencyId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vehicles WHERE agency_id = $1`, [agencyId]);
  return rows[0].n;
}

describe('Capacité de flotte appliquée en base (enforce_vehicle_capacity)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                    VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
    await db.query(agency, [ID.agencyFree, 'Sans abonnement', 'cap-free', 'free@test.invalid']);
    await db.query(agency, [ID.agencyPro, 'Formule Pro', 'cap-pro', 'pro@test.invalid']);
    await db.query(agency, [ID.agencyTarget, 'Cible', 'cap-target', 'target@test.invalid']);
    await db.query(
      `INSERT INTO public.agency_subscriptions (agency_id, plan_id, status)
       SELECT $1, id, 'ACTIVE' FROM public.subscription_plans WHERE slug = 'pro'`,
      [ID.agencyPro]
    );
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'manager.free@test.invalid')`, [ID.managerFree]);
    await db.query(
      `INSERT INTO public.agency_members (agency_id, user_id, role, status) VALUES ($1, $2, 'agency_manager', 'ACTIVE')`,
      [ID.agencyFree, ID.managerFree]
    );

    // Agence sans abonnement : 14 véhicules (palier starter, limite 15)
    await insertVehicles(db, ID.agencyFree, 14);
    // Agence cible du déplacement : pleine (15/15)
    await insertVehicles(db, ID.agencyTarget, 15);
  });

  afterAll(async () => {
    await db?.close();
  });

  it('les formules de référence sont présentes (starter 15, pro 25)', async () => {
    const { rows } = await db.query<{ slug: string; max_vehicles: number }>(
      `SELECT slug, max_vehicles FROM public.subscription_plans WHERE slug IN ('starter', 'pro') ORDER BY slug`
    );
    expect(rows).toEqual([
      { slug: 'pro', max_vehicles: 25 },
      { slug: 'starter', max_vehicles: 15 },
    ]);
  });

  it('un ajout en lot qui franchit la limite est refusé en entier', async () => {
    const error = await errorOf(insertVehicles(db, ID.agencyFree, 2));
    expect(error).toContain('VEHICLE_CAPACITY_REACHED');
    expect(await fleetSize(db, ID.agencyFree)).toBe(14);
  });

  it('jusqu’à la limite : accepté ; au-delà : refusé', async () => {
    await insertVehicles(db, ID.agencyFree, 1);
    expect(await fleetSize(db, ID.agencyFree)).toBe(15);
    expect(await errorOf(insertVehicles(db, ID.agencyFree, 1))).toContain('VEHICLE_CAPACITY_REACHED');
    expect(await fleetSize(db, ID.agencyFree)).toBe(15);
  });

  it('insertion directe par PostgREST d’un membre vehicles.manage : impossible (privilège retiré en phase 2)', async () => {
    const error = await errorOf(
      asRole(db, 'authenticated', ID.managerFree, (tx) => insertVehicles(tx, ID.agencyFree, 1))
    );
    expect(error).toMatch(/permission denied/i);
  });

  it('la clé service-role ne contourne pas non plus la limite', async () => {
    const error = await errorOf(asRole(db, 'service_role', null, (tx) => insertVehicles(tx, ID.agencyFree, 1)));
    expect(error).toContain('VEHICLE_CAPACITY_REACHED');
  });

  it('formule de l’abonnement : une agence « pro » dépasse 15 véhicules', async () => {
    await insertVehicles(db, ID.agencyPro, 16);
    expect(await fleetSize(db, ID.agencyPro)).toBe(16);
  });

  it('déplacer un véhicule vers une agence pleine est refusé', async () => {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM public.vehicles WHERE agency_id = $1 LIMIT 1`, [ID.agencyPro]);
    const error = await errorOf(
      db.query(`UPDATE public.vehicles SET agency_id = $1 WHERE id = $2`, [ID.agencyTarget, rows[0].id])
    );
    expect(error).toContain('VEHICLE_CAPACITY_REACHED');
  });

  it('aucune formule active pour le palier : refus (fail-closed)', async () => {
    const error = await errorOf(
      db.transaction(async (tx) => {
        await tx.query(`UPDATE public.subscription_plans SET is_active = false WHERE slug = 'starter'`);
        await tx.query(`DELETE FROM public.vehicles WHERE agency_id = $1`, [ID.agencyTarget]);
        try {
          await insertVehicles(tx, ID.agencyTarget, 1);
        } finally {
          await tx.rollback();
        }
      })
    );
    expect(error).toContain('VEHICLE_CAPACITY_UNVERIFIABLE');
  });

  it('chaque ajout prend le verrou consultatif de l’agence (sérialisation des ajouts concurrents)', async () => {
    const locks = await db.transaction(async (tx) => {
      await insertVehicles(tx, ID.agencyPro, 1);
      const { rows } = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
      );
      await tx.rollback();
      return rows[0].n;
    }).catch(() => -1);
    expect(locks).toBeGreaterThan(0);
  });
});
