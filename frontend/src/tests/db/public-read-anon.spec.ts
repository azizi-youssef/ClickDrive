import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase } from './harness';

/**
 * Lectures publiques sans clé service-role (client anon sans session) : agences du cache public, formules,
 * avis et disponibilité. Ces tests vérifient sur les vraies migrations ce que la RLS du rôle anon permet,
 * Depuis la migration 20261115000100, photos et équipements sont lisibles par anon pour les véhicules publiés.
 */

const ID = {
  agencyActive: '51000000-0000-4000-8000-00000000000a',
  agencySuspended: '51000000-0000-4000-8000-00000000000b',
  published: '52000000-0000-4000-8000-00000000000a',
  unpublished: '52000000-0000-4000-8000-00000000000b',
  suspendedVehicle: '52000000-0000-4000-8000-00000000000c',
  booked: '52000000-0000-4000-8000-00000000000d',
  booking: '53000000-0000-4000-8000-00000000000a',
} as const;

describe('Lectures publiques avec le rôle anon (sans clé service-role)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                    VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', $5)`;
    await db.query(agency, [ID.agencyActive, 'Agence active', 'pub-active', 'active@test.invalid', 'ACTIVE']);
    await db.query(agency, [ID.agencySuspended, 'Agence suspendue', 'pub-suspended', 'suspended@test.invalid', 'SUSPENDED']);

    const vehicle = `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
                     VALUES ($1, $2, $3, 'Dacia', 'Logan', $4, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, $5)`;
    await db.query(vehicle, [ID.published, ID.agencyActive, 'P-1', 'pub-published', true]);
    await db.query(vehicle, [ID.unpublished, ID.agencyActive, 'P-2', 'pub-unpublished', false]);
    await db.query(vehicle, [ID.suspendedVehicle, ID.agencySuspended, 'S-1', 'pub-suspended-vehicle', true]);
    await db.query(vehicle, [ID.booked, ID.agencyActive, 'P-3', 'pub-booked', true]);
    await db.query(`INSERT INTO public.vehicle_images (vehicle_id, url, is_primary, display_order) VALUES ($1, 'https://img.test/1.jpg', true, 0)`, [ID.published]);
    await db.query(`INSERT INTO public.vehicle_features (vehicle_id, name) VALUES ($1, 'Climatisation')`, [ID.published]);
    const { rows: stored } = await db.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM public.vehicle_images WHERE vehicle_id = $1)::int + (SELECT count(*) FROM public.vehicle_features WHERE vehicle_id = $1)::int AS n`,
      [ID.published]
    );
    if (stored[0].n !== 2) throw new Error('Photos et équipements de test non enregistrés');

    await db.query(
      `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
         customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
       VALUES ($1, 'CD-2027-500001', 'CD-2027-500001', $2, $3, 'Client', 'client@test.invalid', '0600000000',
         '2027-06-10', '2027-06-14', 4, 300, 1200, 3000, 'CONFIRMED')`,
      [ID.booking, ID.booked, ID.agencyActive]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  it('catalogue : véhicules publiés d’agences actives lisibles avec leur agence, leurs photos et leurs équipements', async () => {
    const rows = await asRole(db, 'anon', null, async (tx) =>
      (
        await tx.query<{ id: string; agency_name: string; images: number; features: number }>(
          `SELECT v.id, a.name AS agency_name,
                  (SELECT count(*)::int FROM public.vehicle_images i WHERE i.vehicle_id = v.id) AS images,
                  (SELECT count(*)::int FROM public.vehicle_features f WHERE f.vehicle_id = v.id) AS features
             FROM public.vehicles v
             JOIN public.agencies a ON a.id = v.agency_id
            WHERE v.published = true AND a.status = 'ACTIVE' AND a.archived_at IS NULL
            ORDER BY v.id`
        )
      ).rows
    );
    expect(rows).toEqual([
      // Politiques « Images / Features of readable vehicles » (migration 20261115000100)
      { id: ID.published, agency_name: 'Agence active', images: 1, features: 1 },
      { id: ID.booked, agency_name: 'Agence active', images: 0, features: 0 },
    ]);
  });

  it('sans filtre applicatif, la RLS masque les véhicules non publiés et ceux d’une agence suspendue', async () => {
    const ids = await asRole(db, 'anon', null, async (tx) =>
      (await tx.query<{ id: string }>(`SELECT id FROM public.vehicles ORDER BY id`)).rows.map((row) => row.id)
    );
    expect(ids).toEqual([ID.published, ID.booked]);
    expect(ids).not.toContain(ID.unpublished);
    expect(ids).not.toContain(ID.suspendedVehicle);
  });

  it('agences : seules les agences actives sont lisibles', async () => {
    const ids = await asRole(db, 'anon', null, async (tx) =>
      // SELECT * comme agenciesService.getActiveAgenciesWithoutSession : aucune colonne réservée ne doit faire échouer la lecture
      (await tx.query<{ id: string }>(`SELECT * FROM public.agencies WHERE id = ANY($1::uuid[])`, [[ID.agencyActive, ID.agencySuspended]])).rows.map((row) => row.id)
    );
    expect(ids).toEqual([ID.agencyActive]);
  });

  it('disponibilité : vehicle_availability() exacte pour anon (réservations privées prises en compte)', async () => {
    const rows = await asRole(db, 'anon', null, async (tx) =>
      (
        await tx.query<{ vehicle_id: string; available: boolean }>(
          `SELECT vehicle_id, available FROM public.vehicle_availability($1::uuid[], '2027-06-12', '2027-06-13') ORDER BY vehicle_id`,
          [[ID.published, ID.booked]]
        )
      ).rows
    );
    expect(rows).toEqual([
      { vehicle_id: ID.published, available: true },
      { vehicle_id: ID.booked, available: false },
    ]);
  });

  it('anon ne lit aucune réservation (le repli de disponibilité exige la clé service-role)', async () => {
    const error = await asRole(db, 'anon', null, async (tx) =>
      tx.query(`SELECT id FROM public.bookings`).then(() => null, (e: Error) => e.message)
    );
    expect(error).toMatch(/permission denied/i);
  });

  it('formules actives et avis lisibles par anon', async () => {
    const { plans, reviewsReadable } = await asRole(db, 'anon', null, async (tx) => ({
      plans: (await tx.query<{ slug: string }>(`SELECT slug FROM public.subscription_plans ORDER BY sort_order`)).rows.map((r) => r.slug),
      reviewsReadable: await tx.query(`SELECT id, rating, comment, author_name, created_at FROM public.reviews LIMIT 1`).then(() => true),
    }));
    expect(plans).toEqual(['starter', 'pro', 'business', 'unlimited']);
    expect(reviewsReadable).toBe(true);
  });
});
