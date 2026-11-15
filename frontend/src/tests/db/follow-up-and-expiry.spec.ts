import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261121000100 :
 * - pending_follow_up_candidates() / review_request_candidates() : seules les réservations qui attendent
 *   encore une relance sont renvoyées, le filtre étant appliqué AVANT la limite (plus de blocage par les
 *   demandes déjà relancées) ; l'adresse de substitution d'un client sans e-mail est écartée des envois
 *   par e-mail ; service-role uniquement ;
 * - expire_completed_bookings() : une demande sans décision dont la date de prise en charge est passée
 *   devient EXPIRED, avec un événement BOOKING_EXPIRED (une seule fois).
 */

const ID = {
  agency: '81000000-0000-4000-8000-00000000000a',
  vehicle: '82000000-0000-4000-8000-00000000000a',
} as const;

let counter = 0;

type BookingSeed = {
  status: string;
  /** Création, en minutes avant maintenant */
  createdMinutesAgo?: number;
  /** Fin de location (COMPLETED), en minutes avant maintenant */
  completedMinutesAgo?: number;
  /** Prise en charge, en jours après aujourd'hui (négatif : passée) ; sinon dates lointaines distinctes */
  startInDays?: number;
  email?: string;
  events?: string[];
};

async function createBooking(db: PGlite, seed: BookingSeed): Promise<string> {
  counter += 1;
  const id = `83000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  const ref = `CD-2027-8${String(counter).padStart(5, '0')}`;
  const start = seed.startInDays ?? 400 + counter * 10;
  await db.query(
    `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email,
       customer_phone, start_date, end_date, total_days, daily_price, total_price, deposit_amount, status,
       created_at, completed_at)
     VALUES ($1, $2, $2, $3, $4, 'Client', $5, '0612345678',
       CURRENT_DATE + $6::int, CURRENT_DATE + $6::int + 3, 3, 300, 900, 3000, $7,
       now() - make_interval(mins => $8::int),
       CASE WHEN $9::int IS NULL THEN NULL ELSE now() - make_interval(mins => $9::int) END)`,
    [
      id,
      ref,
      ID.vehicle,
      ID.agency,
      seed.email ?? 'client@test.invalid',
      start,
      seed.status,
      seed.createdMinutesAgo ?? 60,
      seed.completedMinutesAgo ?? null,
    ]
  );
  for (const eventType of seed.events ?? []) {
    await db.query(
      `INSERT INTO public.booking_events (booking_id, actor_role, event_type) VALUES ($1, 'SYSTEM', $2)`,
      [id, eventType]
    );
  }
  return id;
}

async function pendingCandidates(db: PGlite, limit = 25): Promise<string[]> {
  return asRole(db, 'service_role', null, async (tx) => {
    const { rows } = await tx.query<{ booking_id: string }>(
      `SELECT booking_id FROM public.pending_follow_up_candidates($1, 30, 120)`,
      [limit]
    );
    return rows.map((row) => row.booking_id);
  });
}

async function reviewCandidates(db: PGlite, includeWithoutEmail: boolean): Promise<string[]> {
  return asRole(db, 'service_role', null, async (tx) => {
    const { rows } = await tx.query<{ booking_id: string }>(
      `SELECT booking_id FROM public.review_request_candidates(25, 180, $1)`,
      [includeWithoutEmail]
    );
    return rows.map((row) => row.booking_id);
  });
}

async function bookingStatus(db: PGlite, id: string): Promise<string> {
  const { rows } = await db.query<{ status: string }>(`SELECT status FROM public.bookings WHERE id = $1`, [id]);
  return rows[0].status;
}

async function expiryEvents(db: PGlite, id: string) {
  const { rows } = await db.query<{ actor_role: string; metadata: Record<string, unknown> }>(
    `SELECT actor_role, metadata FROM public.booking_events WHERE booking_id = $1 AND event_type = 'BOOKING_EXPIRED'`,
    [id]
  );
  return rows;
}

describe('Relances sans blocage et expiration des demandes (migration 20261121000100)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;

    await db.query(
      `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
       VALUES ($1, 'Agence relances', 'fu-agency', '0536000000', '0661000000', 'fu@test.invalid', 'Nador', 'ACTIVE')`,
      [ID.agency]
    );
    await db.query(
      `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
       VALUES ($1, $2, 'FU-1', 'Dacia', 'Logan', 'fu-vehicle', 2025, 'Économique', 'MANUAL', 'DIESEL', 300, true)`,
      [ID.vehicle, ID.agency]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  describe('pending_follow_up_candidates', () => {
    let fresh: string;
    let alternativesDue: string;
    let placeholderAlternatives: string;
    let placeholderReminder: string;

    beforeAll(async () => {
      // 30 demandes plus anciennes, déjà relancées et ayant reçu leurs alternatives : ne bloquent plus rien
      for (let i = 0; i < 30; i += 1) {
        await createBooking(db, {
          status: 'REQUESTED',
          createdMinutesAgo: 3 * 24 * 60 + i,
          events: ['AGENCY_REMINDER_SENT', 'CUSTOMER_ALTERNATIVES_SENT'],
        });
      }
      fresh = await createBooking(db, { status: 'REQUESTED', createdMinutesAgo: 45 });
      alternativesDue = await createBooking(db, { status: 'SENT_TO_AGENCY', createdMinutesAgo: 150, events: ['AGENCY_REMINDER_SENT'] });
      placeholderAlternatives = await createBooking(db, {
        status: 'REQUESTED',
        createdMinutesAgo: 160,
        email: '212612345678@clickdrive.ma',
        events: ['AGENCY_REMINDER_SENT'],
      });
      placeholderReminder = await createBooking(db, { status: 'REQUESTED', createdMinutesAgo: 50, email: '212600000000@clickdrive.ma' });
      // Ni rappel ni alternatives à envoyer
      await createBooking(db, { status: 'REQUESTED', createdMinutesAgo: 10 }); // trop récente
      await createBooking(db, { status: 'REQUESTED', createdMinutesAgo: 60, events: ['AGENCY_REMINDER_SENT'] }); // alternatives pas encore dues
      await createBooking(db, { status: 'REQUESTED', createdMinutesAgo: 8 * 24 * 60 }); // hors fenêtre de 7 jours
      await createBooking(db, { status: 'APPROVED', createdMinutesAgo: 45 }); // déjà décidée
    });

    it('les demandes déjà relancées n’occupent plus la limite : les récentes sont traitées', async () => {
      const candidates = await pendingCandidates(db);
      expect(new Set(candidates)).toEqual(new Set([fresh, alternativesDue, placeholderReminder]));
    });

    it('plus ancienne d’abord, limite appliquée après le filtre', async () => {
      expect(await pendingCandidates(db, 2)).toEqual([alternativesDue, placeholderReminder]);
    });

    it('client sans e-mail : rappel à l’agence oui, alternatives par e-mail non', async () => {
      const candidates = await pendingCandidates(db);
      expect(candidates).toContain(placeholderReminder);
      expect(candidates).not.toContain(placeholderAlternatives);
    });
  });

  describe('review_request_candidates', () => {
    let due: string;
    let placeholder: string;

    beforeAll(async () => {
      for (let i = 0; i < 30; i += 1) {
        await createBooking(db, { status: 'COMPLETED', completedMinutesAgo: 20 * 24 * 60 + i, events: ['REVIEW_REQUESTED'] });
      }
      due = await createBooking(db, { status: 'COMPLETED', completedMinutesAgo: 24 * 60 });
      placeholder = await createBooking(db, { status: 'COMPLETED', completedMinutesAgo: 25 * 60, email: '212611111111@clickdrive.ma' });
      const reviewed = await createBooking(db, { status: 'COMPLETED', completedMinutesAgo: 26 * 60 });
      await db.query(
        `INSERT INTO public.reviews (booking_id, vehicle_id, agency_id, author_name, rating, comment)
         VALUES ($1, $2, $3, 'Client vérifié', 5, 'Très bien')`,
        [reviewed, ID.vehicle, ID.agency]
      );
      await createBooking(db, { status: 'COMPLETED', completedMinutesAgo: 60 }); // restitution trop récente
      await createBooking(db, { status: 'COMPLETED', completedMinutesAgo: 40 * 24 * 60 }); // plus de 30 jours
      await createBooking(db, { status: 'ACTIVE', completedMinutesAgo: 24 * 60 }); // location en cours
    });

    it('seules les locations sans demande d’avis ni avis sont renvoyées', async () => {
      expect(await reviewCandidates(db, false)).toEqual([due]);
    });

    it('client sans e-mail : retenu seulement si un canal WhatsApp existe', async () => {
      expect(await reviewCandidates(db, true)).toEqual([placeholder, due]);
    });
  });

  describe('droits', () => {
    it.each(['anon', 'authenticated'] as const)('%s ne peut pas lire les candidats aux relances', async (role) => {
      const pending = await asRole(db, role, null, (tx) => errorOf(tx.query(`SELECT * FROM public.pending_follow_up_candidates(25, 30, 120)`)));
      const reviews = await asRole(db, role, null, (tx) => errorOf(tx.query(`SELECT * FROM public.review_request_candidates(25, 180, true)`)));
      expect(pending).toContain('permission denied');
      expect(reviews).toContain('permission denied');
    });
  });

  describe('expire_completed_bookings', () => {
    it('demande sans décision dont la prise en charge est passée : EXPIRED et journalisée une seule fois', async () => {
      const requested = await createBooking(db, { status: 'REQUESTED', startInDays: -1, createdMinutesAgo: 3 * 24 * 60 });
      const alternative = await createBooking(db, { status: 'ALTERNATIVE_PROPOSED', startInDays: -2, createdMinutesAgo: 4 * 24 * 60 });
      const today = await createBooking(db, { status: 'REQUESTED', startInDays: 0 });
      const later = await createBooking(db, { status: 'UNDER_REVIEW', startInDays: 5 });

      const { rows } = await db.query<{ changed: number }>(`SELECT public.expire_completed_bookings() AS changed`);
      expect(rows[0].changed).toBeGreaterThanOrEqual(2);
      await db.query(`SELECT public.expire_completed_bookings()`);

      expect(await bookingStatus(db, requested)).toBe('EXPIRED');
      expect(await bookingStatus(db, alternative)).toBe('EXPIRED');
      expect(await bookingStatus(db, today)).toBe('REQUESTED');
      expect(await bookingStatus(db, later)).toBe('UNDER_REVIEW');

      expect(await expiryEvents(db, requested)).toEqual([
        { actor_role: 'SYSTEM', metadata: { previous_status: 'REQUESTED', reason: 'start_date_passed' } },
      ]);
      expect(await expiryEvents(db, alternative)).toEqual([
        { actor_role: 'SYSTEM', metadata: { previous_status: 'ALTERNATIVE_PROPOSED', reason: 'start_date_passed' } },
      ]);
      expect(await expiryEvents(db, today)).toEqual([]);
    });

    it('comportement existant conservé : réservation acceptée et terminée → EXPIRED, location en cours terminée → COMPLETED', async () => {
      const approved = await createBooking(db, { status: 'APPROVED', startInDays: -10 });
      const active = await createBooking(db, { status: 'ACTIVE', startInDays: -20 });
      await db.query(`SELECT public.expire_completed_bookings()`);
      expect(await bookingStatus(db, approved)).toBe('EXPIRED');
      expect(await bookingStatus(db, active)).toBe('COMPLETED');
      // Les réservations acceptées gardent leur journal d'origine (pas d'événement de demande expirée)
      expect(await expiryEvents(db, approved)).toEqual([]);
    });
  });
});
