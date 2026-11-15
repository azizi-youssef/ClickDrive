import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261120000100 : paliers de remise distincts pour les motos (agencies.motorcycle_duration_discounts).
 * Les voitures gardent agencies.duration_discounts ; aucun prix ne change au déploiement.
 */

const FILE = '20261120000100_motorcycle_duration_discounts.sql';
const MIGRATION = readFileSync(path.join(MIGRATIONS_DIR, FILE), 'utf8');

const A = '10000000-0000-4000-8000-0000000004a1';
const B = '10000000-0000-4000-8000-0000000004b2';
const C = '10000000-0000-4000-8000-0000000004c3';

const insertAgency = (db: PGlite, id: string, slug: string, tiers?: unknown) =>
  db.query(
    `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status${tiers === undefined ? '' : ', duration_discounts'})
     VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE'${tiers === undefined ? '' : ', $5::jsonb'})`,
    tiers === undefined ? [id, slug, slug, `${slug}@test.invalid`] : [id, slug, slug, `${slug}@test.invalid`, JSON.stringify(tiers)]
  );

describe('Remises des motos distinctes de celles des voitures (20261120000100)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;
    await insertAgency(db, A, 'agence-motos-a');
  });

  afterAll(async () => {
    await db?.close();
  });

  const setMoto = (id: string, value: unknown) =>
    db.query(`UPDATE public.agencies SET motorcycle_duration_discounts = $1::jsonb WHERE id = $2`, [JSON.stringify(value), id]);
  const read = async (id: string) =>
    (
      await db.query<{ cars: unknown; motos: unknown }>(
        `SELECT duration_discounts AS cars, motorcycle_duration_discounts AS motos FROM public.agencies WHERE id = $1`,
        [id]
      )
    ).rows[0]!;

  it('une nouvelle agence : aucune remise, ni voitures ni motos', async () => {
    expect(await read(A)).toEqual({ cars: [], motos: [] });
  });

  it('les deux listes sont indépendantes : modifier l’une ne change pas l’autre', async () => {
    await db.query(`UPDATE public.agencies SET duration_discounts = $1::jsonb WHERE id = $2`, [JSON.stringify([{ min_days: 7, percent: 10 }]), A]);
    await setMoto(A, [{ min_days: 3, percent: 15 }]);
    expect(await read(A)).toEqual({ cars: [{ min_days: 7, percent: 10 }], motos: [{ min_days: 3, percent: 15 }] });

    await setMoto(A, []);
    expect(await read(A)).toEqual({ cars: [{ min_days: 7, percent: 10 }], motos: [] });
  });

  it.each([
    ['5 paliers', Array.from({ length: 5 }, (_, i) => ({ min_days: 2 + i, percent: 1 + i }))],
    ['remise excessive', [{ min_days: 7, percent: 60 }]],
    ['durée de 1 jour', [{ min_days: 1, percent: 5 }]],
    ['valeur décimale', [{ min_days: 7, percent: 7.5 }]],
    ['champ manquant', [{ min_days: 7 }]],
    ['texte au lieu d’un nombre', [{ min_days: '7', percent: 10 }]],
    ['objet au lieu d’un tableau', { min_days: 7, percent: 10 }],
  ])('refusé par la base pour les motos : %s', async (_label, value) => {
    expect(await errorOf(setMoto(A, value))).toMatch(/check constraint/i);
  });

  it('quatre paliers valides acceptés pour les motos', async () => {
    await setMoto(A, [
      { min_days: 3, percent: 5 },
      { min_days: 7, percent: 10 },
      { min_days: 15, percent: 15 },
      { min_days: 30, percent: 20 },
    ]);
    const { rows } = await db.query<{ n: number }>(`SELECT jsonb_array_length(motorcycle_duration_discounts) AS n FROM public.agencies WHERE id = $1`, [A]);
    expect(rows[0]!.n).toBe(4);
  });

  describe('déploiement sur une base existante : aucun prix ne change', () => {
    it('à la création de la colonne, les paliers actuels des agences sont repris pour les motos (elles en bénéficiaient déjà)', async () => {
      // État d'avant la migration : agences avec des paliers pour « toute la flotte », pas de colonne des motos
      await insertAgency(db, B, 'agence-motos-b', [{ min_days: 7, percent: 12 }]);
      await insertAgency(db, C, 'agence-motos-c');
      await db.exec(`
        ALTER TABLE public.agencies DROP CONSTRAINT agencies_motorcycle_duration_discounts_check;
        ALTER TABLE public.agencies DROP COLUMN motorcycle_duration_discounts;
      `);

      await db.exec(MIGRATION);

      expect(await read(B)).toEqual({ cars: [{ min_days: 7, percent: 12 }], motos: [{ min_days: 7, percent: 12 }] });
      // Une agence sans remise reste sans remise ; une autre garde ses paliers dans les deux listes
      expect(await read(C)).toEqual({ cars: [], motos: [] });
      expect(await read(A)).toEqual({ cars: [{ min_days: 7, percent: 10 }], motos: [{ min_days: 7, percent: 10 }] });
    });

    it('rejouer la migration ne touche jamais aux réglages ensuite saisis par les agences', async () => {
      await setMoto(B, [{ min_days: 3, percent: 5 }]);
      await db.exec(MIGRATION);
      expect(await read(B)).toEqual({ cars: [{ min_days: 7, percent: 12 }], motos: [{ min_days: 3, percent: 5 }] });
      await setMoto(B, []);
      await db.exec(MIGRATION);
      expect((await read(B)).motos).toEqual([]);
    });
  });
});

describe('Migration 20261120000100 : prérequis', () => {
  it('sans la migration 20261118000100 : échec immédiat et message clair, aucune colonne créée', async () => {
    const empty = await PGlite.create();
    try {
      const error = await errorOf(empty.exec(MIGRATION));
      expect(error).toContain('Migration 20261120000100');
      expect(error).toContain('duration_discounts');
      await empty.exec('ROLLBACK').catch(() => undefined);
      const { rows } = await empty.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM information_schema.columns WHERE column_name = 'motorcycle_duration_discounts'`
      );
      expect(rows[0]!.n).toBe(0);
    } finally {
      await empty.close();
    }
  });
});
