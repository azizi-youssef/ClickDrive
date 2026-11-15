import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261122000100 : agency_record_handover() — remise (départ) et restitution (retour) en une
 * seule transaction : statut de la réservation, statut et compteur du véhicule, état des lieux
 * (booking_events) et journal (audit_logs) écrits ensemble ou pas du tout ; garde sur l'agence, sur le
 * statut lu et sur la machine à états ; service-role uniquement.
 */

const ID = {
  agencyA: '91000000-0000-4000-8000-00000000000a',
  agencyB: '91000000-0000-4000-8000-00000000000b',
  vehicleA: '92000000-0000-4000-8000-00000000000a',
  actor: '01000000-0000-4000-8000-0000000009a1',
  ghost: '01000000-0000-4000-8000-0000000009ff',
} as const;

let counter = 0;

async function createBooking(db: PGlite, status: string): Promise<string> {
  counter += 1;
  const id = `93000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  const ref = `CD-2027-9${String(counter).padStart(5, '0')}`;
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
     VALUES ($1, $2, $2, $3, $4, 'Client', 'client@test.invalid', '0612345678',
       CURRENT_DATE + $5::int, CURRENT_DATE + $5::int + 3, 3, 300, 900, 3000, $6)`,
    [id, ref, ID.vehicleA, ID.agencyA, 30 + counter * 10, status]
  );
  return id;
}

type Outcome = { ok: boolean; code?: string; status?: string; vehicle_status?: string };

type HandoverCall = {
  bookingId: string;
  action: 'pickup' | 'return';
  expectedStatus: string;
  vehicleStatus: string;
  agencyId?: string;
  actorId?: string;
  mileage?: number;
};

const HANDOVER_SQL = `SELECT public.agency_record_handover($1, $2, $3, $4, $5, 'AGENCY_MANAGER', $6, $7, $8::jsonb, $9::jsonb) AS result`;

function handoverParams(call: HandoverCall) {
  return [
    call.bookingId,
    call.agencyId ?? ID.agencyA,
    call.action,
    call.expectedStatus,
    call.actorId ?? ID.actor,
    call.mileage ?? 42000,
    call.vehicleStatus,
    JSON.stringify({ mileage: call.mileage ?? 42000, fuelLevel: 'FULL' }),
    JSON.stringify({ vehicleId: ID.vehicleA }),
  ];
}

/** Appel dont l'effet est conservé (superutilisateur : la fonction est SECURITY DEFINER) */
async function recordAndKeep(db: PGlite, call: HandoverCall): Promise<Outcome> {
  const { rows } = await db.query<{ result: Outcome }>(HANDOVER_SQL, handoverParams(call));
  return rows[0].result;
}

async function state(db: PGlite, bookingId: string) {
  const booking = await db.query<{ status: string; completed_at: string | null }>(
    `SELECT status, completed_at FROM public.bookings WHERE id = $1`,
    [bookingId]
  );
  const vehicle = await db.query<{ status: string; mileage: number }>(
    `SELECT status, mileage FROM public.vehicles WHERE id = $1`,
    [ID.vehicleA]
  );
  const events = await db.query<{ event_type: string; actor_id: string | null; metadata: Record<string, unknown> }>(
    `SELECT event_type, actor_id, metadata FROM public.booking_events WHERE booking_id = $1 ORDER BY created_at`,
    [bookingId]
  );
  const audits = await db.query<{ action: string; user_id: string | null; agency_id: string | null; entity_id: string }>(
    `SELECT action, user_id, agency_id, entity_id FROM public.audit_logs WHERE entity_id = $1 ORDER BY created_at`,
    [bookingId]
  );
  return {
    status: booking.rows[0].status,
    completedAt: booking.rows[0].completed_at,
    vehicle: vehicle.rows[0],
    events: events.rows,
    audits: audits.rows,
  };
}

async function resetVehicle(db: PGlite) {
  await db.query(`UPDATE public.vehicles SET status = 'AVAILABLE', mileage = 40000 WHERE id = $1`, [ID.vehicleA]);
}

describe('agency_record_handover — remise et restitution atomiques (migration 20261122000100)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'handover.actor@test.invalid')`, [ID.actor]);
    const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                    VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
    await db.query(agency, [ID.agencyA, 'Agence remise A', 'ho-a', 'hoa@test.invalid']);
    await db.query(agency, [ID.agencyB, 'Agence remise B', 'ho-b', 'hob@test.invalid']);
    await db.query(
      `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
       VALUES ($1, $2, 'HO-1', 'Dacia', 'Logan', 'ho-vehicle', 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`,
      [ID.vehicleA, ID.agencyA]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  it('remise : réservation ACTIVE, véhicule RENTED et compteur, état des lieux et journal ensemble', async () => {
    await resetVehicle(db);
    const bookingId = await createBooking(db, 'APPROVED');
    expect(await recordAndKeep(db, { bookingId, action: 'pickup', expectedStatus: 'APPROVED', vehicleStatus: 'RENTED' })).toEqual({
      ok: true,
      status: 'ACTIVE',
      vehicle_status: 'RENTED',
    });

    const after = await state(db, bookingId);
    expect(after.status).toBe('ACTIVE');
    expect(after.vehicle).toEqual({ status: 'RENTED', mileage: 42000 });
    expect(after.events).toEqual([
      { event_type: 'HANDOVER_PICKUP_COMPLETED', actor_id: ID.actor, metadata: { mileage: 42000, fuelLevel: 'FULL' } },
    ]);
    expect(after.audits).toEqual([
      { action: 'VEHICLE_HANDOVER_PICKUP', user_id: ID.actor, agency_id: ID.agencyA, entity_id: bookingId },
    ]);
  });

  it('restitution avec dégâts : COMPLETED, date de fin, véhicule en MAINTENANCE', async () => {
    await resetVehicle(db);
    const bookingId = await createBooking(db, 'ACTIVE');
    const outcome = await recordAndKeep(db, {
      bookingId,
      action: 'return',
      expectedStatus: 'ACTIVE',
      vehicleStatus: 'MAINTENANCE',
      mileage: 42650,
    });
    expect(outcome).toMatchObject({ ok: true, status: 'COMPLETED' });

    const after = await state(db, bookingId);
    expect(after.status).toBe('COMPLETED');
    expect(after.completedAt).not.toBeNull();
    expect(after.vehicle).toEqual({ status: 'MAINTENANCE', mileage: 42650 });
    expect(after.events.map((event) => event.event_type)).toEqual(['HANDOVER_RETURN_COMPLETED']);
    expect(after.audits.map((audit) => audit.action)).toEqual(['VEHICLE_HANDOVER_RETURN']);
  });

  it('une écriture en échec annule tout : ni statut de réservation, ni véhicule, ni journal', async () => {
    await resetVehicle(db);
    const bookingId = await createBooking(db, 'ACTIVE');
    // Acteur inconnu : la clé étrangère de booking_events échoue APRÈS les mises à jour de la réservation et du véhicule
    const error = await errorOf(
      recordAndKeep(db, { bookingId, action: 'return', expectedStatus: 'ACTIVE', vehicleStatus: 'MAINTENANCE', actorId: ID.ghost })
    );
    expect(error).toMatch(/foreign key/i);

    const after = await state(db, bookingId);
    expect(after.status).toBe('ACTIVE');
    expect(after.completedAt).toBeNull();
    expect(after.vehicle).toEqual({ status: 'AVAILABLE', mileage: 40000 });
    expect(after.events).toEqual([]);
    expect(after.audits).toEqual([]);
  });

  it('statut changé entre la lecture et la transaction : conflit, rien n’est écrit', async () => {
    await resetVehicle(db);
    const bookingId = await createBooking(db, 'ACTIVE');
    expect(await recordAndKeep(db, { bookingId, action: 'pickup', expectedStatus: 'APPROVED', vehicleStatus: 'RENTED' })).toEqual({
      ok: false,
      code: 'transition_conflict',
      status: 'ACTIVE',
    });
    const after = await state(db, bookingId);
    expect(after.status).toBe('ACTIVE');
    expect(after.vehicle.status).toBe('AVAILABLE');
    expect(after.events).toEqual([]);
  });

  it.each([
    ['pickup', 'REQUESTED', 'RENTED'],
    ['pickup', 'COMPLETED', 'RENTED'],
    ['return', 'APPROVED', 'AVAILABLE'],
    ['return', 'CANCELLED', 'AVAILABLE'],
  ] as const)('machine à états : %s depuis %s refusé', async (action, status, vehicleStatus) => {
    const bookingId = await createBooking(db, status);
    expect(await recordAndKeep(db, { bookingId, action, expectedStatus: status, vehicleStatus })).toMatchObject({
      ok: false,
      code: 'transition_conflict',
    });
    expect((await state(db, bookingId)).status).toBe(status);
  });

  it('réservation d’une autre agence : introuvable, rien n’est écrit', async () => {
    const bookingId = await createBooking(db, 'APPROVED');
    expect(
      await recordAndKeep(db, { bookingId, action: 'pickup', expectedStatus: 'APPROVED', vehicleStatus: 'RENTED', agencyId: ID.agencyB })
    ).toEqual({ ok: false, code: 'not_found' });
    expect((await state(db, bookingId)).status).toBe('APPROVED');
  });

  it.each([
    ['pickup', 'AVAILABLE'],
    ['return', 'RENTED'],
    ['return', 'BLOCKED'],
  ] as const)('statut de véhicule incohérent (%s → %s) : refusé', async (action, vehicleStatus) => {
    const bookingId = await createBooking(db, action === 'pickup' ? 'APPROVED' : 'ACTIVE');
    const error = await errorOf(
      recordAndKeep(db, { bookingId, action, expectedStatus: action === 'pickup' ? 'APPROVED' : 'ACTIVE', vehicleStatus })
    );
    expect(error).toContain('AGENCY_HANDOVER_INVALID_VEHICLE_STATUS');
  });

  it('service_role peut l’appeler ; anon et authenticated non', async () => {
    const bookingId = await createBooking(db, 'APPROVED');
    const params = handoverParams({ bookingId, action: 'pickup', expectedStatus: 'APPROVED', vehicleStatus: 'RENTED' });
    const asService = await asRole(db, 'service_role', null, async (tx) => {
      const { rows } = await tx.query<{ result: Outcome }>(HANDOVER_SQL, params);
      return rows[0].result;
    });
    expect(asService).toMatchObject({ ok: true, status: 'ACTIVE' });
    for (const role of ['anon', 'authenticated'] as const) {
      const error = await asRole(db, role, ID.actor, (tx) => errorOf(tx.query(HANDOVER_SQL, params)));
      expect(error).toContain('permission denied');
    }
  });
});
