import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase } from './harness';

/**
 * Contraintes de la table bookings pour un refus (statut, motif, journal) écrit par le service_role,
 * sur toutes les migrations réelles. Depuis la phase 3, le service passe par agency_decide_booking()
 * (voir phase3-decisions.spec.ts) ; ce test garde la vérification des contraintes de la table.
 */

const ID = {
  agency: '11000000-0000-4000-8000-00000000000a',
  vehicle: '21000000-0000-4000-8000-00000000000a',
  actor: '01000000-0000-4000-8000-0000000000a1',
} as const;

let counter = 0;

async function createBooking(db: PGlite, status: string): Promise<string> {
  counter += 1;
  const id = `31000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  const ref = `CD-2026-2${String(counter).padStart(5, '0')}`;
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
     VALUES ($1, $2, $2, $3, $4, 'Client', 'client@test.invalid', '0600000000',
       ('2027-01-01'::date + ($5 * 10)), ('2027-01-04'::date + ($5 * 10)), 3, 300, 900, 3000, $6)`,
    [id, ref, ID.vehicle, ID.agency, counter, status]
  );
  return id;
}

/** Refus écrit directement par le service_role (contraintes de la table) */
async function reject(db: PGlite, bookingId: string, reason = 'Véhicule en maintenance') {
  return asRole(db, 'service_role', null, async (tx) => {
    const now = new Date().toISOString();
    const result = await tx.query<{ status: string; rejection_reason: string }>(
      `UPDATE public.bookings
          SET status = 'REJECTED', agency_status = 'REJECTED', commission_status = 'CANCELLED',
              rejection_reason = $2, updated_at = $3
        WHERE id = $1
        RETURNING status, rejection_reason`,
      [bookingId, reason, now]
    );
    await tx.query(
      `INSERT INTO public.booking_events (booking_id, actor_id, actor_role, event_type, metadata)
       VALUES ($1, $2, 'AGENCY_OWNER', 'AGENCY_REJECTED', $3)`,
      [bookingId, ID.actor, JSON.stringify({ reason })]
    );
    return result.rows[0];
  });
}

describe('Actions agence sur une demande de réservation', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'agent@test.invalid')`, [ID.actor]);
    await db.query(
      `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
       VALUES ($1, 'Agence', 'agence-actions', '0536000000', '0661000000', 'agence@test.invalid', 'Nador', 'ACTIVE')`,
      [ID.agency]
    );
    await db.query(
      `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
       VALUES ($1, $2, 'U-1', 'Dacia', 'Logan', 'dacia-logan-actions', 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`,
      [ID.vehicle, ID.agency]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  it.each(['REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED', 'PENDING'])(
    'refus depuis %s : statut REJECTED, motif enregistré, événement journalisé',
    async (status) => {
      const bookingId = await createBooking(db, status);
      const row = await reject(db, bookingId);
      expect(row).toEqual({ status: 'REJECTED', rejection_reason: 'Véhicule en maintenance' });
    }
  );
});
