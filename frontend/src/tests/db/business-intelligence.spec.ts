import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261123000100 — Analytics & Business Intelligence :
 * - agency_analytics_report() / admin_analytics_report() : droits (reports.read agence, plateforme = SUPER_ADMIN) ;
 * - entonnoir demande → acceptation → remise → restitution, refus, expirations, non-retraits ;
 * - délai de première réponse (médiane, 90e centile), délai d'anticipation, période précédente ;
 * - jours comptés à l'heure du Maroc ; répartitions (voitures / motos, pays, langues, prise en charge) ;
 * - occupation et revenu par véhicule (prorata des nuits, présence en flotte) ;
 * - journal du MRR alimenté par déclencheurs : nouveaux, hausses, baisses, résiliations.
 * Migration 20261123000200 : admin_subscription_statistics() (vue d'ensemble admin), mêmes règles de MRR.
 */

const ID = {
  agencyA: '91000000-0000-4000-8000-00000000000a',
  agencyB: '91000000-0000-4000-8000-00000000000b',
  agencyC: '91000000-0000-4000-8000-00000000000c',
  agencyD: '91000000-0000-4000-8000-00000000000d',
  agencyE: '91000000-0000-4000-8000-00000000000e',
  agencyArchived: '91000000-0000-4000-8000-00000000000f',
  car1: '92000000-0000-4000-8000-000000000001',
  moto1: '92000000-0000-4000-8000-000000000002',
  car2: '92000000-0000-4000-8000-000000000003',
  car3: '92000000-0000-4000-8000-000000000004',
  car4: '92000000-0000-4000-8000-000000000005',
  carB: '92000000-0000-4000-8000-000000000006',
  planStarter: '94000000-0000-4000-8000-000000000001',
  planPro: '94000000-0000-4000-8000-000000000002',
  admin: '01000000-0000-4000-8000-0000000009a1',
  manager: '01000000-0000-4000-8000-0000000009b1',
  agent: '01000000-0000-4000-8000-0000000009c1',
} as const;

/** Octobre 2026 (30 jours) et la période précédente de même durée (1er – 30 septembre) */
const PERIOD = { from: '2026-10-01', to: '2026-10-30' } as const;

type Json = Record<string, unknown>;

let counter = 0;

type BookingSeed = {
  agencyId?: string;
  vehicleId: string;
  status: string;
  /** Création, heure locale du Maroc (« AAAA-MM-JJ HH:MM ») : convertie par la base, quelle que soit sa version tzdata */
  createdAt: string;
  start: string;
  end: string;
  totalDays?: number;
  totalPrice?: number;
  country?: string | null;
  locale?: string | null;
  pickup?: string;
  confirmed?: boolean;
  /** Événements : type et délai en minutes après la création */
  events?: Array<[string, number]>;
};

async function createBooking(db: PGlite, seed: BookingSeed): Promise<string> {
  counter += 1;
  const id = `93000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  const ref = `CD-2026-9${String(counter).padStart(5, '0')}`;
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status,
       created_at, customer_country, customer_locale, pickup_location, confirmed_at)
     VALUES ($1, $2, $2, $3, $4, 'Client', 'client@test.invalid', '0612345678', $5, $6, $7, 300, $8, 3000, $9,
       ($10::timestamp AT TIME ZONE 'Africa/Casablanca'), COALESCE($11, 'Maroc'), $12, COALESCE($13, 'Aéroport Nador Al-Aroui'),
       CASE WHEN $14::boolean THEN ($10::timestamp AT TIME ZONE 'Africa/Casablanca') + interval '1 hour' END)`,
    [
      id,
      ref,
      seed.vehicleId,
      seed.agencyId ?? ID.agencyA,
      seed.start,
      seed.end,
      seed.totalDays ?? 3,
      seed.totalPrice ?? 900,
      seed.status,
      seed.createdAt,
      seed.country ?? null,
      seed.locale ?? null,
      seed.pickup ?? null,
      seed.confirmed ?? false,
    ]
  );
  for (const [eventType, minutes] of seed.events ?? []) {
    await db.query(
      `INSERT INTO public.booking_events (booking_id, actor_role, event_type, created_at)
       VALUES ($1, 'AGENCY_OWNER', $2, ($3::timestamp AT TIME ZONE 'Africa/Casablanca') + make_interval(mins => $4::int))`,
      [id, eventType, seed.createdAt, minutes]
    );
  }
  return id;
}

async function agencyReport(db: PGlite, userId: string | null, agencyId: string, from: string | null = PERIOD.from, to: string | null = PERIOD.to) {
  return asRole(db, userId ? 'authenticated' : 'anon', userId, async (tx) => {
    const { rows } = await tx.query<{ report: Json }>(`SELECT public.agency_analytics_report($1, $2, $3) AS report`, [agencyId, from, to]);
    return rows[0].report;
  });
}

async function adminReport(db: PGlite, userId: string, from: string | null = PERIOD.from, to: string | null = PERIOD.to) {
  return asRole(db, 'authenticated', userId, async (tx) => {
    const { rows } = await tx.query<{ report: Json }>(`SELECT public.admin_analytics_report($1, $2) AS report`, [from, to]);
    return rows[0].report;
  });
}

const at = (record: Json, key: string) => record[key] as Json;
const list = (record: Json, key: string) => record[key] as Json[];

describe('Analytics & BI — rapports agence et plateforme (migration 20261123000100)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    await db.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, 'bi.admin@test.invalid'), ($2, 'bi.manager@test.invalid'), ($3, 'bi.agent@test.invalid')`,
      [ID.admin, ID.manager, ID.agent]
    );
    await db.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.admin]);

    const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status, city)
                    VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE', 'Nador')`;
    await db.query(agency, [ID.agencyA, 'Agence Alpha', 'bi-a', 'bia@test.invalid']);
    await db.query(agency, [ID.agencyB, 'Agence Beta', 'bi-b', 'bib@test.invalid']);
    await db.query(agency, [ID.agencyE, 'Agence Epsilon', 'bi-e', 'bie@test.invalid']);

    const member = `INSERT INTO public.agency_members (agency_id, user_id, role, status) VALUES ($1, $2, $3, 'ACTIVE')`;
    await db.query(member, [ID.agencyA, ID.manager, 'agency_manager']);
    await db.query(member, [ID.agencyA, ID.agent, 'agency_agent']);

    const vehicle = `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel,
                       daily_price, published, vehicle_type, created_at, archived_at, license_plate)
                     VALUES ($1, $2, $3, $4, $5, $6, 2025, $7, 'MANUAL', 'GASOLINE', 300, true, $8, $9::timestamptz, $10::timestamptz, $11)`;
    await db.query(vehicle, [ID.car1, ID.agencyA, 'A-1', 'Dacia', 'Logan', 'bi-car1', 'Économique', 'CAR', '2025-01-01T10:00:00Z', null, '1234-A-50']);
    await db.query(vehicle, [ID.moto1, ID.agencyA, 'M-1', 'Yamaha', 'NMAX', 'bi-moto1', 'Scooter', 'MOTORCYCLE', '2025-01-01T10:00:00Z', null, null]);
    // Ajoutée le 21 octobre (heure du Maroc) : 10 jours de présence sur la période
    await db.query(vehicle, [ID.car2, ID.agencyA, 'A-2', 'Renault', 'Clio', 'bi-car2', 'Économique', 'CAR', '2026-10-21T08:00:00+01:00', null, null]);
    // Archivée le 11 octobre : 10 jours de présence
    await db.query(vehicle, [ID.car3, ID.agencyA, 'A-3', 'Peugeot', '208', 'bi-car3', 'Citadine', 'CAR', '2025-01-01T10:00:00Z', '2026-10-11T09:00:00+01:00', null]);
    // Archivée avant la période : absente
    await db.query(vehicle, [ID.car4, ID.agencyA, 'A-4', 'Fiat', 'Panda', 'bi-car4', 'Citadine', 'CAR', '2025-01-01T10:00:00Z', '2026-09-01T09:00:00+01:00', null]);
    await db.query(vehicle, [ID.carB, ID.agencyB, 'B-1', 'Kia', 'Picanto', 'bi-carb', 'Citadine', 'CAR', '2025-01-01T10:00:00Z', null, null]);

    // ── Période (octobre), agence A ──
    await createBooking(db, { vehicleId: ID.car1, status: 'COMPLETED', createdAt: '2026-10-02 09:00', start: '2026-10-10', end: '2026-10-13', totalDays: 3, totalPrice: 900, country: 'france', confirmed: true, events: [['AGENCY_ACCEPTED', 30], ['HANDOVER_PICKUP_COMPLETED', 11_000], ['HANDOVER_RETURN_COMPLETED', 16_000]] });
    await createBooking(db, { vehicleId: ID.car1, status: 'ACTIVE', createdAt: '2026-10-03 09:00', start: '2026-10-20', end: '2026-10-25', totalDays: 5, totalPrice: 1500, country: 'belgique ', locale: 'nl', pickup: 'Port de Beni Ansar', confirmed: true, events: [['AGENCY_ACCEPTED', 90]] });
    await createBooking(db, { vehicleId: ID.moto1, status: 'APPROVED', createdAt: '2026-10-04 09:00', start: '2026-10-28', end: '2026-11-02', totalDays: 5, totalPrice: 1000, country: 'France', pickup: '   ', confirmed: true, events: [['AGENCY_ACCEPTED', 20]] });
    await createBooking(db, { vehicleId: ID.car1, status: 'REJECTED', createdAt: '2026-10-05 09:00', start: '2026-11-05', end: '2026-11-08', totalPrice: 800, events: [['AGENCY_REJECTED', 300]] });
    await createBooking(db, { vehicleId: ID.car1, status: 'EXPIRED', createdAt: '2026-10-06 09:00', start: '2026-11-10', end: '2026-11-13', totalPrice: 700, events: [['BOOKING_EXPIRED', 5_000]] });
    // Acceptée puis jamais retirée : expirée après acceptation (non-retrait)
    await createBooking(db, { vehicleId: ID.car1, status: 'EXPIRED', createdAt: '2026-10-07 09:00', start: '2026-11-15', end: '2026-11-18', totalPrice: 600, confirmed: true, events: [['AGENCY_ACCEPTED', 10]] });
    await createBooking(db, { vehicleId: ID.moto1, status: 'CANCELLED', createdAt: '2026-10-08 09:00', start: '2026-11-20', end: '2026-11-23', totalPrice: 500 });
    // 1er octobre 0 h 30 au Maroc (le 30 septembre en UTC quand le Maroc est à UTC+1) : compte dans la période
    await createBooking(db, { vehicleId: ID.car1, status: 'REQUESTED', createdAt: '2026-10-01 00:30', start: '2026-11-25', end: '2026-11-28', totalPrice: 900 });
    await createBooking(db, { vehicleId: ID.car1, status: 'ALTERNATIVE_PROPOSED', createdAt: '2026-10-09 09:00', start: '2026-11-30', end: '2026-12-03', totalPrice: 900, locale: 'en', events: [['ALTERNATIVE_PROPOSED', 45]] });

    // ── Période précédente (septembre), agence A ──
    await createBooking(db, { vehicleId: ID.car1, status: 'COMPLETED', createdAt: '2026-09-10 09:00', start: '2026-09-15', end: '2026-09-18', totalPrice: 900, confirmed: true, events: [['AGENCY_ACCEPTED', 120]] });
    await createBooking(db, { vehicleId: ID.car1, status: 'REJECTED', createdAt: '2026-09-12 09:00', start: '2026-12-10', end: '2026-12-13', totalPrice: 900, events: [['AGENCY_REJECTED', 60]] });
    // 30 septembre 23 h 30 au Maroc : reste dans la période précédente
    await createBooking(db, { vehicleId: ID.car1, status: 'CANCELLED', createdAt: '2026-09-30 23:30', start: '2026-12-15', end: '2026-12-18', totalPrice: 900 });

    // ── Un an plus tôt (octobre 2025), agence A ──
    await createBooking(db, { vehicleId: ID.car1, status: 'COMPLETED', createdAt: '2025-10-15 09:00', start: '2025-10-20', end: '2025-10-22', totalDays: 2, totalPrice: 500, confirmed: true });

    // ── Agence B ──
    await createBooking(db, { agencyId: ID.agencyB, vehicleId: ID.carB, status: 'APPROVED', createdAt: '2026-10-10 09:00', start: '2026-10-15', end: '2026-10-17', totalDays: 2, totalPrice: 400, confirmed: true, events: [['AGENCY_ACCEPTED', 600]] });
  });

  afterAll(async () => {
    await db?.close();
  });

  describe('droits', () => {
    it('anonyme : aucune exécution', async () => {
      expect(await errorOf(agencyReport(db, null, ID.agencyA))).toMatch(/permission denied/);
    });

    it('gérant de l’agence : son rapport, pas celui d’une autre agence ni celui de la plateforme', async () => {
      await expect(agencyReport(db, ID.manager, ID.agencyA)).resolves.toBeTruthy();
      expect(await errorOf(agencyReport(db, ID.manager, ID.agencyB))).toMatch(/Not authorized/);
      expect(await errorOf(adminReport(db, ID.manager))).toMatch(/Not authorized/);
    });

    it('agent sans reports.read : refusé', async () => {
      expect(await errorOf(agencyReport(db, ID.agent, ID.agencyA))).toMatch(/Not authorized/);
    });

    it('fonctions internes et journal MRR : fermés aux comptes connectés', async () => {
      const internal = asRole(db, 'authenticated', ID.admin, (tx) =>
        tx.query(`SELECT * FROM public.analytics_booking_facts(NULL, '2026-10-01', '2026-10-30')`)
      );
      expect(await errorOf(internal)).toMatch(/permission denied/);
      const journal = asRole(db, 'authenticated', ID.admin, (tx) => tx.query(`SELECT * FROM public.subscription_mrr_events`));
      expect(await errorOf(journal)).toMatch(/permission denied/);
    });

    it('période invalide ou trop longue : refusée', async () => {
      expect(await errorOf(agencyReport(db, ID.manager, ID.agencyA, '2026-10-30', '2026-10-01'))).toMatch(/Invalid date range/);
      expect(await errorOf(agencyReport(db, ID.manager, ID.agencyA, '2020-01-01', '2026-10-01'))).toMatch(/too long/);
    });
  });

  describe('rapport agence', () => {
    let report: Json;

    beforeAll(async () => {
      report = await agencyReport(db, ID.manager, ID.agencyA);
    });

    it('période et période précédente de même durée', () => {
      expect(at(report, 'period')).toEqual({ from: '2026-10-01', to: '2026-10-30', days: 30, previousFrom: '2026-09-01', previousTo: '2026-09-30' });
    });

    it('entonnoir : acceptées, remises, restituées et pertes à chaque étape', () => {
      expect(at(report, 'current')).toMatchObject({
        requests: 9,
        accepted: 4,
        pickedUp: 2,
        returned: 1,
        rejected: 1,
        expiredUnanswered: 1,
        noShow: 1,
        cancelled: 1,
        alternatives: 1,
        awaitingDecision: 2,
        upcoming: 1,
        inProgress: 1,
        confirmed: 3,
        revenue: 3400,
        rentalDays: 13,
      });
    });

    it('délai de réponse : médiane, 90e centile, parts sous 1 h et 24 h ; délai d’anticipation', () => {
      // Réponses : 10, 20, 30, 45, 90, 300 min
      expect(at(report, 'current')).toMatchObject({
        responsesMeasured: 6,
        responseMedianMinutes: 38,
        responseP90Minutes: 195,
        respondedWithin1h: 4,
        respondedWithin24h: 6,
        leadTimeMedianDays: 35,
      });
    });

    it('période précédente : jours au fuseau du Maroc', () => {
      expect(at(report, 'previous')).toMatchObject({ requests: 3, accepted: 1, rejected: 1, cancelled: 1, revenue: 900, responseMedianMinutes: 90 });
    });

    it('répartitions : voitures / motos, pays normalisés, langues, prise en charge', () => {
      const breakdowns = at(report, 'breakdowns');
      expect(list(breakdowns, 'vehicleTypes')).toEqual([
        { label: 'CAR', requests: 7, confirmed: 2, revenue: 2400 },
        { label: 'MOTORCYCLE', requests: 2, confirmed: 1, revenue: 1000 },
      ]);
      expect(list(breakdowns, 'countries').map((row) => [row.label, row.requests])).toEqual([
        ['Maroc', 6],
        ['France', 2],
        ['Belgique', 1],
      ]);
      expect(list(breakdowns, 'locales').map((row) => [row.label, row.requests])).toEqual([
        ['fr', 7],
        // À égalité de demandes : le chiffre d'affaires confirmé départage
        ['nl', 1],
        ['en', 1],
      ]);
      expect(list(breakdowns, 'pickupLocations').map((row) => [row.label, row.requests])).toEqual([
        ['Aéroport Nador Al-Aroui', 7],
        ['Port de Beni Ansar', 1],
        ['Non précisé', 1],
      ]);
      expect(list(breakdowns, 'categories').map((row) => [row.label, row.requests])).toEqual([
        ['Économique', 7],
        ['Scooter', 2],
      ]);
    });

    it('série de 12 mois avec les mêmes mois un an plus tôt', () => {
      const monthly = list(report, 'monthly');
      expect(monthly).toHaveLength(12);
      expect(monthly[0].month).toBe('2025-11');
      expect(monthly.at(-1)).toMatchObject({ month: '2026-10', requests: 9, confirmed: 3, revenue: 3400, previousYearRequests: 1, previousYearRevenue: 500 });
      expect(monthly.at(-2)).toMatchObject({ month: '2026-09', requests: 3, confirmed: 1, revenue: 900, previousYearRequests: 0 });
      expect(monthly.find((row) => row.month === '2026-01')).toMatchObject({ requests: 0, revenue: 0 });
    });

    it('occupation et revenu par véhicule : présence en flotte, prorata des nuits', () => {
      const fleet = at(report, 'fleet');
      expect(fleet).toMatchObject({
        vehicles: 4,
        availableDays: 80,
        bookedDays: 11,
        occupancyRate: 13.8,
        revenue: 3000,
        revenuePerVehicle: 750,
        idleVehicles: 2,
      });
      expect(list(fleet, 'byType')).toEqual([
        { vehicleType: 'CAR', vehicles: 3, occupancyRate: 16, revenue: 2400, revenuePerVehicle: 800 },
        { vehicleType: 'MOTORCYCLE', vehicles: 1, occupancyRate: 10, revenue: 600, revenuePerVehicle: 600 },
      ]);
      const items = list(fleet, 'items');
      expect(items.map((item) => [item.vehicleId, item.availableDays, item.bookedDays, item.revenue])).toEqual([
        [ID.car1, 30, 8, 2400],
        [ID.moto1, 30, 3, 600],
        [ID.car3, 10, 0, 0],
        [ID.car2, 10, 0, 0],
      ]);
      expect(items[0]).toMatchObject({ label: 'Dacia Logan · 1234-A-50', occupancyRate: 26.7, bookings: 2, archived: false });
      expect(items[2]).toMatchObject({ archived: true });
    });

    it('flotte de la période précédente : sans détail par véhicule', () => {
      expect(at(report, 'previousFleet')).toMatchObject({ bookedDays: 3, revenue: 900, items: null });
    });

    it('période par défaut : 30 derniers jours, mois en cours marqué partiel', async () => {
      const latest = await agencyReport(db, ID.manager, ID.agencyA, null, null);
      expect(at(latest, 'period').days).toBe(30);
      expect(list(latest, 'monthly').at(-1)?.partial).toBe(true);
    });
  });

  describe('rapport plateforme', () => {
    let report: Json;

    beforeAll(async () => {
      report = await adminReport(db, ID.admin);
    });

    it('toutes les agences : totaux et réseau', () => {
      expect(at(report, 'current')).toMatchObject({ requests: 10, accepted: 5, confirmed: 4, revenue: 3800 });
      expect(at(report, 'network')).toMatchObject({ agencies: 3, pendingAgencies: 0, agenciesWithoutRequests: 1, vehicles: 4, motorcycles: 1 });
    });

    it('classement des agences : acceptation, délai de réponse, note réelle seulement', () => {
      const agencies = list(report, 'agencies');
      expect(agencies.map((row) => row.name)).toEqual(['Agence Alpha', 'Agence Beta']);
      expect(agencies[0]).toMatchObject({ requests: 9, accepted: 4, rejected: 1, expiredUnanswered: 1, confirmed: 3, revenue: 3400, responseMedianMinutes: 38, responsesMeasured: 6, rating: null, reviewCount: 0 });
      expect(agencies[1]).toMatchObject({ requests: 1, accepted: 1, responseMedianMinutes: 600 });
    });

    it('occupation réseau', () => {
      // A : 80 jours, 11 nuits ; B : 30 jours, 2 nuits (15 → 17 octobre)
      expect(at(report, 'fleet')).toMatchObject({ vehicles: 5, availableDays: 110, bookedDays: 13, occupancyRate: 11.8, revenue: 3400 });
    });
  });

  describe('journal du MRR', () => {
    let subscriptions: Json;

    beforeAll(async () => {
      await db.query(
        `INSERT INTO public.subscription_plans (id, name, slug, min_vehicles, max_vehicles, price_monthly, sort_order)
         VALUES ($1, 'BI Starter', 'bi-starter', 1, 10, 300, 90), ($2, 'BI Pro', 'bi-pro', 1, 50, 500, 91)`,
        [ID.planStarter, ID.planPro]
      );
      const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                      VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
      await db.query(agency, [ID.agencyC, 'Agence Gamma', 'bi-c', 'bic@test.invalid']);
      await db.query(agency, [ID.agencyD, 'Agence Delta', 'bi-d', 'bid@test.invalid']);

      const subscribe = `INSERT INTO public.agency_subscriptions (agency_id, plan_id, status, price_paid) VALUES ($1, $2, $3, $4)`;
      await db.query(subscribe, [ID.agencyA, ID.planStarter, 'ACTIVE', 0]); // nouveau : 300 (prix de la formule)
      await db.query(`UPDATE public.agency_subscriptions SET plan_id = $2, price_paid = 500 WHERE agency_id = $1`, [ID.agencyA, ID.planPro]); // +200
      await db.query(`UPDATE public.agency_subscriptions SET price_paid = 450 WHERE agency_id = $1`, [ID.agencyA]); // −50
      await db.query(`UPDATE public.agency_subscriptions SET notes = 'relance' WHERE agency_id = $1`, [ID.agencyA]); // sans effet
      await db.query(subscribe, [ID.agencyB, ID.planStarter, 'TRIAL', 300]); // nouveau : 300
      await db.query(`UPDATE public.agency_subscriptions SET status = 'CANCELLED' WHERE agency_id = $1`, [ID.agencyB]); // résiliation : 300
      await db.query(subscribe, [ID.agencyC, ID.planPro, 'ACTIVE', 0]); // nouveau : 500
      // Suspension réservée à la plateforme (garde guard_agency_sensitive_update) : claims service-role, transaction validée
      await db.transaction(async (tx) => {
        await tx.query(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
        await tx.query(`UPDATE public.agencies SET status = 'SUSPENDED' WHERE id = $1`, [ID.agencyC]); // résiliation : 500
      });
      await db.query(subscribe, [ID.agencyD, ID.planStarter, 'ACTIVE', 0]); // nouveau : 300
      await db.query(`UPDATE public.subscription_plans SET price_monthly = 350 WHERE id = $1`, [ID.planStarter]); // D : +50

      subscriptions = at(await adminReport(db, ID.admin, null, null), 'subscriptions');
    });

    it('chaque changement de contribution est journalisé une fois, avec sa source', async () => {
      const { rows } = await db.query<{ agency_id: string; previous_mrr: string; mrr: string; source: string }>(
        `SELECT agency_id, previous_mrr, mrr, source FROM public.subscription_mrr_events ORDER BY id`
      );
      expect(rows.map((row) => [row.agency_id, Number(row.previous_mrr), Number(row.mrr), row.source])).toEqual([
        [ID.agencyA, 0, 300, 'SUBSCRIPTION'],
        [ID.agencyA, 300, 500, 'SUBSCRIPTION'],
        [ID.agencyA, 500, 450, 'SUBSCRIPTION'],
        [ID.agencyB, 0, 300, 'SUBSCRIPTION'],
        [ID.agencyB, 300, 0, 'SUBSCRIPTION'],
        [ID.agencyC, 0, 500, 'SUBSCRIPTION'],
        [ID.agencyC, 500, 0, 'AGENCY'],
        [ID.agencyD, 0, 300, 'SUBSCRIPTION'],
        [ID.agencyD, 300, 350, 'PLAN_PRICE'],
      ]);
    });

    it('état actuel : MRR des abonnements facturés d’agences actives, par formule', () => {
      expect(subscriptions).toMatchObject({ mrr: 800, subscribers: 2, trialSubscribers: 0, cancelledOrExpired: 1, averageRevenuePerSubscriber: 400 });
      expect(subscriptions.plans).toEqual([
        { slug: 'bi-starter', name: 'BI Starter', subscribers: 1, mrr: 350 },
        { slug: 'bi-pro', name: 'BI Pro', subscribers: 1, mrr: 450 },
      ]);
    });

    it('mouvements du mois : MRR de fin = début + nouveaux + hausses − baisses − résiliations', () => {
      const monthly = list(subscriptions, 'monthly');
      expect(monthly).toHaveLength(12);
      expect(monthly.at(-1)).toMatchObject({
        mrr: 800,
        newMrr: 1400,
        expansionMrr: 250,
        contractionMrr: 50,
        churnedMrr: 800,
        newSubscribers: 4,
        churnedSubscribers: 2,
        partial: true,
      });
      expect(monthly.at(-2)).toMatchObject({ mrr: 0, newMrr: 0 });
    });
  });

  describe('admin_subscription_statistics (vue d’ensemble admin)', () => {
    const statistics = (userId: string | null) =>
      asRole(db, userId ? 'authenticated' : 'anon', userId, async (tx) => {
        const { rows } = await tx.query<{ stats: Json }>(`SELECT public.admin_subscription_statistics() AS stats`);
        return rows[0].stats;
      });

    beforeAll(async () => {
      // Paiement en retard : capacité conservée, mais pas un revenu
      await db.query(`INSERT INTO public.agency_subscriptions (agency_id, plan_id, status, price_paid) VALUES ($1, $2, 'PAST_DUE', 300)`, [ID.agencyE, ID.planStarter]);
      // Agence archivée : ni agence, ni revenu
      await db.query(
        `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status, archived_at)
         VALUES ($1, 'Agence archivée', 'bi-archived', '0536000000', '0661000000', 'biz@test.invalid', 'Nador', 'ACTIVE', now())`,
        [ID.agencyArchived]
      );
      await db.query(`INSERT INTO public.agency_subscriptions (agency_id, plan_id, status, price_paid) VALUES ($1, $2, 'ACTIVE', 500)`, [ID.agencyArchived, ID.planPro]);
      // Formule retirée de la grille qui garde un abonné facturé (A) : toujours dans la répartition
      await db.query(`UPDATE public.subscription_plans SET is_active = false WHERE id = $1`, [ID.planPro]);
    });

    it('droit agencies.read plateforme : refusé aux agences et aux anonymes', async () => {
      expect(await errorOf(statistics(ID.manager))).toMatch(/Not authorized/);
      expect(await errorOf(statistics(null))).toMatch(/permission denied/);
    });

    it('MRR et abonnés : mêmes règles que le rapport analytique (ACTIVE / TRIAL d’agences actives)', async () => {
      const stats = await statistics(ID.admin);
      const report = at(await adminReport(db, ID.admin, null, null), 'subscriptions');
      expect(stats).toMatchObject({ monthlyRecurringRevenue: 800, activeSubscribers: 2 });
      expect(stats.monthlyRecurringRevenue).toBe(report.mrr);
      expect(stats.activeSubscribers).toBe(report.subscribers);
    });

    it('agences et véhicules non archivés', async () => {
      // A, B, C (suspendue), D, E ; véhicules : 3 actifs chez A, 1 chez B
      expect(await statistics(ID.admin)).toMatchObject({ totalAgencies: 5, fleetCapacityTotal: 4 });
    });

    it('répartition : formules actives dans l’ordre d’affichage, puis formule retirée encore facturée', async () => {
      const plans = list(await statistics(ID.admin), 'plansDistribution');
      expect(plans.find((plan) => plan.slug === 'bi-starter')).toEqual({ slug: 'bi-starter', planName: 'BI Starter', count: 1, revenue: 350 });
      expect(plans.at(-1)).toEqual({ slug: 'bi-pro', planName: 'BI Pro', count: 1, revenue: 450 });
      expect(plans.filter((plan) => plan.slug !== 'bi-starter' && plan.slug !== 'bi-pro').every((plan) => plan.count === 0)).toBe(true);
    });
  });
});
