import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261118000100 : paliers de remise longue durée des agences (colonne agencies.duration_discounts).
 * La base borne les valeurs ; l'ordre et la progression des paliers sont vérifiés par l'API.
 */

const AGENCY = '10000000-0000-4000-8000-0000000003aa';

describe('Remises longue durée des agences (20261118000100)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;
    await db.query(
      `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
       VALUES ($1, 'Agence Remises', 'agence-remises', '0536000000', '0661000000', 'remises@test.invalid', 'Nador', 'ACTIVE')`,
      [AGENCY]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  const setTiers = (value: unknown) =>
    db.query(`UPDATE public.agencies SET duration_discounts = $1::jsonb WHERE id = $2`, [JSON.stringify(value), AGENCY]);

  it('par défaut : aucune remise (tableau vide)', async () => {
    const { rows } = await db.query<{ duration_discounts: unknown }>(`SELECT duration_discounts FROM public.agencies WHERE id = $1`, [AGENCY]);
    expect(rows[0]!.duration_discounts).toEqual([]);
  });

  it('paliers valides enregistrés', async () => {
    await setTiers([
      { min_days: 3, percent: 5 },
      { min_days: 7, percent: 10 },
      { min_days: 15, percent: 15 },
      { min_days: 30, percent: 20 },
    ]);
    const { rows } = await db.query<{ n: number }>(`SELECT jsonb_array_length(duration_discounts) AS n FROM public.agencies WHERE id = $1`, [AGENCY]);
    expect(rows[0]!.n).toBe(4);
  });

  it.each([
    ['5 paliers', Array.from({ length: 5 }, (_, i) => ({ min_days: 2 + i, percent: 1 + i }))],
    ['remise excessive', [{ min_days: 7, percent: 60 }]],
    ['durée de 1 jour', [{ min_days: 1, percent: 5 }]],
    ['valeur décimale', [{ min_days: 7, percent: 7.5 }]],
    ['champ manquant', [{ min_days: 7 }]],
    ['texte au lieu d’un nombre', [{ min_days: '7', percent: 10 }]],
    ['objet au lieu d’un tableau', { min_days: 7, percent: 10 }],
  ])('refusé par la base : %s', async (_label, value) => {
    expect(await errorOf(setTiers(value))).toMatch(/check constraint/i);
  });
});
