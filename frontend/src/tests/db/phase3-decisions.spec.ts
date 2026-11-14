import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261116000100 (phase 3) :
 * - agency_decide_booking() : décision agence atomique (statut de la machine à états + journal), garde de
 *   concurrence, aucune modification du statut de flotte à l'approbation ;
 * - admin_decide_plan_change() : une seule décision par demande, formule appliquée et demande close ensemble ;
 * - capacité : véhicules archivés exclus, custom_vehicle_limit, abonnement annulé = palier déduit.
 */

const ID = {
  agencyA: '71000000-0000-4000-8000-00000000000a',
  agencyB: '71000000-0000-4000-8000-00000000000b',
  agencyCap: '71000000-0000-4000-8000-00000000000c',
  vehicleA: '72000000-0000-4000-8000-00000000000a',
  vehicleA2: '72000000-0000-4000-8000-00000000000b',
  vehicleB: '72000000-0000-4000-8000-00000000000c',
  actor: '01000000-0000-4000-8000-0000000007a1',
  admin: '01000000-0000-4000-8000-0000000007e1',
} as const;

let counter = 0;

async function createBooking(db: PGlite, status: string, vehicleId: string = ID.vehicleA, offsetDays?: number): Promise<string> {
  counter += 1;
  const id = `73000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  const ref = `CD-2027-7${String(counter).padStart(5, '0')}`;
  const offset = offsetDays ?? counter * 10;
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
     VALUES ($1, $2, $2, $3, $4, 'Client', 'client@test.invalid', '0600000000',
       ('2027-01-01'::date + $5::int), ('2027-01-04'::date + $5::int), 3, 300, 900, 3000, $6)`,
    [id, ref, vehicleId, vehicleId === ID.vehicleB ? ID.agencyB : ID.agencyA, offset, status]
  );
  return id;
}

type Decision = { ok: boolean; code?: string; status?: string };

async function decide(
  db: PGlite,
  bookingId: string,
  action: string,
  expectedStatus: string,
  extra: { agencyId?: string; alternativeVehicleId?: string; reason?: string } = {}
): Promise<Decision> {
  return asRole(db, 'service_role', null, async (tx) => {
    const { rows } = await tx.query<{ result: Decision }>(
      `SELECT public.agency_decide_booking($1, $2, $3, $4, $5, 'AGENCY_OWNER', NULL, $6, $7) AS result`,
      [bookingId, extra.agencyId ?? ID.agencyA, action, expectedStatus, ID.actor, extra.reason ?? null, extra.alternativeVehicleId ?? null]
    );
    return rows[0].result;
  });
}

/** Décision dont l'effet est conservé (decide() passe par asRole, dont la transaction est toujours annulée) */
async function decideAndKeep(db: PGlite, bookingId: string, action: string, expectedStatus: string, extra: { alternativeVehicleId?: string } = {}) {
  const { rows } = await db.query<{ result: Decision }>(
    `SELECT public.agency_decide_booking($1, $2, $3, $4, $5, 'AGENCY_OWNER', NULL, NULL, $6) AS result`,
    [bookingId, ID.agencyA, action, expectedStatus, ID.actor, extra.alternativeVehicleId ?? null]
  );
  return rows[0].result;
}

async function bookingState(db: PGlite, bookingId: string) {
  const { rows } = await db.query<{ status: string; events: string[] }>(
    `SELECT b.status,
            coalesce(array_agg(e.event_type ORDER BY e.event_type) FILTER (WHERE e.id IS NOT NULL), '{}') AS events
       FROM public.bookings b
       LEFT JOIN public.booking_events e ON e.booking_id = b.id
      WHERE b.id = $1
      GROUP BY b.status`,
    [bookingId]
  );
  return rows[0];
}

async function vehicleStatus(db: PGlite, vehicleId: string) {
  const { rows } = await db.query<{ status: string }>(`SELECT status FROM public.vehicles WHERE id = $1`, [vehicleId]);
  return rows[0].status;
}

describe('Phase 3 — décisions transactionnelles et règles de capacité', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'p3.actor@test.invalid'), ($2, 'p3.admin@test.invalid')`, [ID.actor, ID.admin]);
    await db.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.admin]);
    const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                    VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
    await db.query(agency, [ID.agencyA, 'Agence A', 'p3-a', 'p3a@test.invalid']);
    await db.query(agency, [ID.agencyB, 'Agence B', 'p3-b', 'p3b@test.invalid']);
    await db.query(agency, [ID.agencyCap, 'Agence capacité', 'p3-cap', 'p3cap@test.invalid']);
    const vehicle = `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
                     VALUES ($1, $2, $3, 'Dacia', 'Logan', $4, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, $5)`;
    await db.query(vehicle, [ID.vehicleA, ID.agencyA, 'A-1', 'p3-va', true]);
    await db.query(vehicle, [ID.vehicleA2, ID.agencyA, 'A-2', 'p3-va2', true]);
    await db.query(vehicle, [ID.vehicleB, ID.agencyB, 'B-1', 'p3-vb', true]);
  });

  afterAll(async () => {
    await db?.close();
  });

  describe('agency_decide_booking', () => {
    it('approbation : APPROVED, événements journalisés ensemble, statut de flotte inchangé', async () => {
      const bookingId = await createBooking(db, 'PENDING');
      expect(await decideAndKeep(db, bookingId, 'approve', 'PENDING')).toEqual({ ok: true, status: 'APPROVED' });
      expect(await bookingState(db, bookingId)).toEqual({ status: 'APPROVED', events: ['AGENCY_ACCEPTED', 'COMMISSION_CONFIRMED'] });
      expect(await vehicleStatus(db, ID.vehicleA)).toBe('AVAILABLE');
    });

    it('statut lu périmé (décision concurrente) : conflit, rien n’est écrit', async () => {
      const bookingId = await createBooking(db, 'REQUESTED');
      expect(await decideAndKeep(db, bookingId, 'reject', 'PENDING')).toMatchObject({ ok: false, code: 'transition_conflict' });
      expect(await bookingState(db, bookingId)).toEqual({ status: 'REQUESTED', events: [] });
    });

    it('réservation d’une autre agence : introuvable', async () => {
      const bookingId = await createBooking(db, 'REQUESTED');
      expect(await decide(db, bookingId, 'approve', 'REQUESTED', { agencyId: ID.agencyB })).toMatchObject({ ok: false, code: 'not_found' });
    });

    it('refus : REJECTED et événement', async () => {
      const bookingId = await createBooking(db, 'REQUESTED');
      expect(await decideAndKeep(db, bookingId, 'reject', 'REQUESTED')).toEqual({ ok: true, status: 'REJECTED' });
      expect(await bookingState(db, bookingId)).toEqual({ status: 'REJECTED', events: ['AGENCY_REJECTED'] });
    });

    it('alternative : ALTERNATIVE_PROPOSED ; un véhicule d’une autre agence est refusé', async () => {
      const bookingId = await createBooking(db, 'REQUESTED');
      expect(await decideAndKeep(db, bookingId, 'propose_alternative', 'REQUESTED', { alternativeVehicleId: ID.vehicleB })).toMatchObject({
        ok: false,
        code: 'alternative_ineligible',
      });
      expect(await decideAndKeep(db, bookingId, 'propose_alternative', 'REQUESTED', { alternativeVehicleId: ID.vehicleA2 })).toEqual({
        ok: true,
        status: 'ALTERNATIVE_PROPOSED',
      });
      expect(await bookingState(db, bookingId)).toEqual({ status: 'ALTERNATIVE_PROPOSED', events: ['ALTERNATIVE_PROPOSED'] });
    });

    it('chevauchement : la contrainte d’exclusion annule toute la décision (aucun événement orphelin)', async () => {
      const first = await createBooking(db, 'REQUESTED', ID.vehicleA, 500);
      const second = await createBooking(db, 'REQUESTED', ID.vehicleA, 501);
      await decideAndKeep(db, first, 'approve', 'REQUESTED');
      const error = await errorOf(decideAndKeep(db, second, 'approve', 'REQUESTED'));
      expect(error).toMatch(/no_overlapping_confirmed_bookings|exclusion/i);
      expect(await bookingState(db, second)).toEqual({ status: 'REQUESTED', events: [] });
    });

    it('réservée au serveur : EXECUTE refusé à anon et authenticated', async () => {
      const bookingId = await createBooking(db, 'REQUESTED');
      for (const [role, userId] of [['anon', null], ['authenticated', ID.actor]] as const) {
        const error = await errorOf(
          asRole(db, role, userId, (tx) =>
            tx.query(`SELECT public.agency_decide_booking($1, $2, 'approve', 'REQUESTED', $3)`, [bookingId, ID.agencyA, ID.actor])
          )
        );
        expect(error).toMatch(/permission denied/i);
      }
    });
  });

  describe('admin_decide_plan_change', () => {
    async function createRequest(agencyId: string, slug: string): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO public.subscription_change_requests (agency_id, requested_plan_id, amount_due)
         SELECT $1, id, price_monthly FROM public.subscription_plans WHERE slug = $2
         RETURNING id`,
        [agencyId, slug]
      );
      return rows[0].id;
    }
    const decidePlan = async (requestId: string, decision: string) =>
      (
        await db.query<{ result: Decision }>(`SELECT public.admin_decide_plan_change($1, $2, $3, 'VIR-123', NULL) AS result`, [
          requestId,
          decision,
          ID.admin,
        ])
      ).rows[0].result;

    it('validation : formule appliquée et demande close ensemble ; une seconde décision est refusée', async () => {
      const requestId = await createRequest(ID.agencyB, 'pro');
      expect(await decidePlan(requestId, 'APPROVED')).toEqual({ ok: true, status: 'APPROVED' });
      const { rows } = await db.query<{ slug: string; status: string }>(
        `SELECT p.slug, s.status FROM public.agency_subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.agency_id = $1`,
        [ID.agencyB]
      );
      expect(rows).toEqual([{ slug: 'pro', status: 'ACTIVE' }]);
      // Refus concurrent arrivé après : sans effet (la formule reste appliquée, la demande reste APPROVED)
      expect(await decidePlan(requestId, 'REJECTED')).toMatchObject({ ok: false, code: 'already_decided' });
      const { rows: request } = await db.query<{ status: string }>(`SELECT status FROM public.subscription_change_requests WHERE id = $1`, [requestId]);
      expect(request).toEqual([{ status: 'APPROVED' }]);
    });

    it('flotte trop grande pour la formule demandée : refus, rien n’est appliqué', async () => {
      await db.query(`UPDATE public.subscription_plans SET max_vehicles = 1 WHERE slug = 'business'`);
      try {
        const requestId = await createRequest(ID.agencyA, 'business');
        expect(await decidePlan(requestId, 'APPROVED')).toMatchObject({ ok: false, code: 'fleet_exceeds_plan' });
        const { rows } = await db.query(`SELECT 1 FROM public.agency_subscriptions WHERE agency_id = $1`, [ID.agencyA]);
        expect(rows).toEqual([]);
      } finally {
        await db.query(`UPDATE public.subscription_plans SET max_vehicles = 35 WHERE slug = 'business'`);
      }
    });

    it('réservée au serveur : EXECUTE refusé à authenticated', async () => {
      const requestId = await createRequest(ID.agencyCap, 'pro');
      const error = await errorOf(
        asRole(db, 'authenticated', ID.admin, (tx) =>
          tx.query(`SELECT public.admin_decide_plan_change($1, 'APPROVED', $2)`, [requestId, ID.admin])
        )
      );
      expect(error).toMatch(/permission denied/i);
    });
  });

  describe('Règle de capacité précisée', () => {
    let seq = 0;
    async function addVehicles(agencyId: string, count: number, archived = false) {
      for (let i = 0; i < count; i += 1) {
        seq += 1;
        await db.query(
          `INSERT INTO public.vehicles (agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, archived_at)
           VALUES ($1, $2, 'Dacia', 'Logan', $3, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, $4)`,
          [agencyId, `C-${seq}`, `p3-cap-${seq}`, archived ? new Date().toISOString() : null]
        );
      }
    }

    it('véhicules archivés exclus du compte ; désarchiver au-delà de la limite est refusé', async () => {
      await addVehicles(ID.agencyCap, 15);
      await addVehicles(ID.agencyCap, 2, true); // archivés : acceptés et non comptés
      expect(await errorOf(addVehicles(ID.agencyCap, 1))).toContain('VEHICLE_CAPACITY_REACHED');
      const unarchive = await errorOf(
        db.query(`UPDATE public.vehicles SET archived_at = NULL WHERE agency_id = $1 AND archived_at IS NOT NULL`, [ID.agencyCap])
      );
      expect(unarchive).toContain('VEHICLE_CAPACITY_REACHED');
      // Archiver libère une place
      await db.query(
        `UPDATE public.vehicles SET archived_at = now() WHERE id = (SELECT id FROM public.vehicles WHERE agency_id = $1 AND archived_at IS NULL LIMIT 1)`,
        [ID.agencyCap]
      );
      await addVehicles(ID.agencyCap, 1);
    });

    it('custom_vehicle_limit de l’abonnement prioritaire ; abonnement annulé = palier déduit', async () => {
      // Formule « starter » (15) avec surcharge à 17
      await db.query(
        `INSERT INTO public.agency_subscriptions (agency_id, plan_id, status, custom_vehicle_limit)
         SELECT $1, id, 'ACTIVE', 17 FROM public.subscription_plans WHERE slug = 'starter'`,
        [ID.agencyCap]
      );
      await addVehicles(ID.agencyCap, 2); // 17/17
      expect(await errorOf(addVehicles(ID.agencyCap, 1))).toContain('VEHICLE_CAPACITY_REACHED');

      // Abonnement « unlimited » mais annulé : la formule ne s'applique plus, palier déduit (17 véhicules → pro, 25)
      await db.query(
        `UPDATE public.agency_subscriptions SET plan_id = (SELECT id FROM public.subscription_plans WHERE slug = 'unlimited'),
                status = 'CANCELLED', custom_vehicle_limit = 100 WHERE agency_id = $1`,
        [ID.agencyCap]
      );
      await addVehicles(ID.agencyCap, 1);
      const { rows } = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.vehicles WHERE agency_id = $1 AND archived_at IS NULL`,
        [ID.agencyCap]
      );
      expect(rows[0].n).toBe(18);
    });
  });
});
