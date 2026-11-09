import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261109000100 : note des agences calculée à partir des avis réels,
 * informations pratiques des agences et assurance des véhicules.
 */

const ID = {
  agency: '10000000-0000-4000-8000-0000000002aa',
  other: '10000000-0000-4000-8000-0000000002bb',
  vehicle: '20000000-0000-4000-8000-0000000002aa',
  bookingA: '30000000-0000-4000-8000-0000000002a1',
  bookingB: '30000000-0000-4000-8000-0000000002a2',
} as const;

async function seed(db: PGlite) {
  const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                  VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
  await db.query(agency, [ID.agency, 'Agence Avis', 'agence-avis', 'avis@test.invalid']);
  await db.query(agency, [ID.other, 'Agence Sans Avis', 'agence-sans-avis', 'sans@test.invalid']);
  await db.query(
    `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
     VALUES ($1, $2, 'R-1', 'Renault', 'Clio', 'renault-clio-avis', 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`,
    [ID.vehicle, ID.agency]
  );
  const booking = `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
                     customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
                   VALUES ($1, $2, $2, $3, $4, 'Client', 'client@test.invalid', '0600000000', $5, $6, 3, 300, 900, 3000, 'COMPLETED')`;
  await db.query(booking, [ID.bookingA, 'CD-2026-200001', ID.vehicle, ID.agency, '2026-10-01', '2026-10-04']);
  await db.query(booking, [ID.bookingB, 'CD-2026-200002', ID.vehicle, ID.agency, '2026-10-10', '2026-10-13']);
}

const ratingOf = async (db: PGlite, id: string) =>
  (await db.query<{ rating: string; review_count: number }>(`SELECT rating, review_count FROM public.agencies WHERE id = $1`, [id])).rows[0];

const review = `INSERT INTO public.reviews (booking_id, vehicle_id, agency_id, author_name, rating, comment)
                VALUES ($1, $2, $3, 'Client vérifié', $4, 'Très bonne location, rien à redire.') RETURNING id`;

describe('Avis et conditions de location (20261109000100)', () => {
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

  it('une agence sans avis n’affiche plus de note par défaut (0 au lieu de 4,90)', async () => {
    expect(await ratingOf(db, ID.other)).toEqual({ rating: '0.00', review_count: 0 });
  });

  it('la note suit les avis réels : ajout, puis suppression', async () => {
    await db.query(review, [ID.bookingA, ID.vehicle, ID.agency, 5]);
    expect(await ratingOf(db, ID.agency)).toEqual({ rating: '5.00', review_count: 1 });
    const { rows } = await db.query<{ id: string }>(review, [ID.bookingB, ID.vehicle, ID.agency, 4]);
    expect(await ratingOf(db, ID.agency)).toEqual({ rating: '4.50', review_count: 2 });
    await db.query(`DELETE FROM public.reviews WHERE id = $1`, [rows[0].id]);
    expect(await ratingOf(db, ID.agency)).toEqual({ rating: '5.00', review_count: 1 });
  });

  it('infos pratiques et assurance : valeurs bornées par la base', async () => {
    await db.query(
      `UPDATE public.agencies SET opening_hours = 'Lun–Sam 8h–20h', languages = ARRAY['ar','fr','es'], delivery_fee_airport = 0, delivery_fee_port = 150 WHERE id = $1`,
      [ID.agency]
    );
    expect(await errorOf(db.query(`UPDATE public.agencies SET delivery_fee_port = -1 WHERE id = $1`, [ID.agency]))).toMatch(/check constraint/i);
    await db.query(`UPDATE public.vehicles SET insurance_coverage = 'COMPREHENSIVE', insurance_excess = 5000 WHERE id = $1`, [ID.vehicle]);
    expect(await errorOf(db.query(`UPDATE public.vehicles SET insurance_coverage = 'ALL' WHERE id = $1`, [ID.vehicle]))).toMatch(/check constraint/i);
  });
});
