import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261124000100 : customer_cancel_booking_request() — le client retire sa demande depuis le
 * lien de suivi tant que l'agence ne l'a pas acceptée ; statut, commission et journal changent ensemble.
 */

const ID = {
  agency: '81000000-0000-4000-8000-00000000000a',
  vehicle: '82000000-0000-4000-8000-00000000000a',
  actor: '01000000-0000-4000-8000-0000000008a1',
} as const;

let counter = 0;

async function createBooking(db: PGlite, status: string): Promise<{ id: string; reference: string }> {
  counter += 1;
  const id = `83000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  const reference = `CD-2027-8${String(counter).padStart(5, '0')}`;
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
     VALUES ($1, $2, $2, $3, $4, 'Client', 'client@test.invalid', '0600000000',
       ('2027-03-01'::date + $5::int), ('2027-03-04'::date + $5::int), 3, 300, 900, 3000, $6)`,
    [id, reference, ID.vehicle, ID.agency, counter * 10, status]
  );
  return { id, reference };
}

type Result = { ok: boolean; code?: string; status?: string; previous_status?: string };

/** Annulation conservée (appel du serveur avec la clé de service) */
async function cancel(db: PGlite, reference: string, reason: string | null = null): Promise<Result> {
  const { rows } = await db.query<{ result: Result }>(`SELECT public.customer_cancel_booking_request($1, $2) AS result`, [reference, reason]);
  return rows[0].result;
}

async function state(db: PGlite, bookingId: string) {
  const { rows } = await db.query<{ status: string; commission_status: string | null; events: { type: string; role: string; metadata: Record<string, unknown> }[] }>(
    `SELECT b.status, b.commission_status,
            coalesce(json_agg(json_build_object('type', e.event_type, 'role', e.actor_role, 'metadata', e.metadata))
                     FILTER (WHERE e.id IS NOT NULL), '[]') AS events
       FROM public.bookings b
       LEFT JOIN public.booking_events e ON e.booking_id = b.id
      WHERE b.id = $1
      GROUP BY b.status, b.commission_status`,
    [bookingId]
  );
  return rows[0];
}

describe('customer_cancel_booking_request', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'cancel.actor@test.invalid')`, [ID.actor]);
    await db.query(
      `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
       VALUES ($1, 'Agence annulation', 'cancel-a', '0536000000', '0661000000', 'cancel@test.invalid', 'Nador', 'ACTIVE')`,
      [ID.agency]
    );
    await db.query(
      `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
       VALUES ($1, $2, 'C-1', 'Dacia', 'Logan', 'cancel-v', 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`,
      [ID.vehicle, ID.agency]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  it.each(['PENDING', 'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED'])(
    'demande %s : annulée, commission annulée, événement client journalisé',
    async (status) => {
      const booking = await createBooking(db, status);
      expect(await cancel(db, booking.reference, 'plans_changed')).toEqual({ ok: true, status: 'CANCELLED', previous_status: status });
      const after = await state(db, booking.id);
      expect(after.status).toBe('CANCELLED');
      expect(after.commission_status).toBe('CANCELLED');
      expect(after.events).toEqual([
        { type: 'CUSTOMER_CANCELLED', role: 'CUSTOMER', metadata: { previous_status: status, reason: 'plans_changed', channel: 'tracking_link' } },
      ]);
    }
  );

  it.each(['APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'])(
    'réservation %s : refus, rien n’est écrit',
    async (status) => {
      const booking = await createBooking(db, status);
      expect(await cancel(db, booking.reference)).toEqual({ ok: false, code: 'not_cancellable', status });
      expect(await state(db, booking.id)).toMatchObject({ status, events: [] });
    }
  );

  it('l’agence a accepté avant : l’annulation arrive trop tard', async () => {
    const booking = await createBooking(db, 'REQUESTED');
    await db.query(`SELECT public.agency_decide_booking($1, $2, 'approve', 'REQUESTED', $3)`, [booking.id, ID.agency, ID.actor]);
    expect(await cancel(db, booking.reference)).toMatchObject({ ok: false, code: 'not_cancellable', status: 'APPROVED' });
  });

  it('référence en minuscules ou entourée d’espaces : retrouvée ; inconnue ou vide : introuvable', async () => {
    const booking = await createBooking(db, 'PENDING');
    expect(await cancel(db, `  ${booking.reference.toLowerCase()} `)).toMatchObject({ ok: true });
    expect(await cancel(db, 'CD-2027-999999')).toEqual({ ok: false, code: 'not_found' });
    expect(await cancel(db, '   ')).toEqual({ ok: false, code: 'not_found' });
  });

  it('motif hors liste : refusé sans rien écrire', async () => {
    const booking = await createBooking(db, 'PENDING');
    const error = await errorOf(cancel(db, booking.reference, 'texte libre'));
    expect(error).toMatch(/CUSTOMER_CANCEL_INVALID_REASON/);
    expect(await state(db, booking.id)).toMatchObject({ status: 'PENDING', events: [] });
  });

  it('réservée au serveur : EXECUTE refusé à anon et authenticated', async () => {
    const booking = await createBooking(db, 'PENDING');
    for (const [role, userId] of [['anon', null], ['authenticated', ID.actor]] as const) {
      const error = await errorOf(
        asRole(db, role, userId, (tx) => tx.query(`SELECT public.customer_cancel_booking_request($1)`, [booking.reference]))
      );
      expect(error).toMatch(/permission denied/i);
    }
    const allowed = await asRole(db, 'service_role', null, (tx) =>
      tx.query<{ result: Result }>(`SELECT public.customer_cancel_booking_request($1) AS result`, [booking.reference])
    );
    expect(allowed.rows[0].result).toMatchObject({ ok: true });
  });
});
