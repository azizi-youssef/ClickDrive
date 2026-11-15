import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FollowUpBooking } from './follow-up';

/**
 * Tâche de relance : la sélection « reste-t-il une action ? » est faite en base avant la limite
 * (pending_follow_up_candidates / review_request_candidates, migration 20261121000100).
 * Les fonctions SQL elles-mêmes sont testées sur PostgreSQL : src/tests/db/follow-up-and-expiry.spec.ts.
 */

type DbResult = { data: unknown; error: { code?: string; message: string } | null };

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  remindAgency: vi.fn(),
  offerPendingAlternatives: vi.fn(),
  requestReview: vi.fn(),
  logEvent: vi.fn(),
  getVehicles: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock('./notifications', () => ({
  remindAgency: mocks.remindAgency,
  offerPendingAlternatives: mocks.offerPendingAlternatives,
  requestReview: mocks.requestReview,
}));
vi.mock('@/lib/services/bookings.service', () => ({ bookingsService: { logEvent: mocks.logEvent } }));
vi.mock('@/lib/services/vehicles.service', () => ({ vehiclesService: { getVehicles: mocks.getVehicles } }));

import { runBookingFollowUp } from './follow-up-runner';

/** Requête PostgREST simulée : chaque méthode est chaînable, l'attente renvoie `result` */
function query(result: DbResult) {
  const builder: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') {
          return (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return () => builder;
      },
    }
  );
  return builder;
}

/* 12 h UTC : dans la fenêtre des relances (8 h – 22 h au Maroc) quel que soit le décalage horaire */
const NOW = new Date('2026-11-09T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function booking(id: string, overrides: Partial<FollowUpBooking> = {}): FollowUpBooking {
  return {
    id,
    reference: `CD-2026-${id.padStart(6, '0')}`,
    status: 'REQUESTED',
    created_at: minutesAgo(45),
    start_date: '2026-11-20',
    end_date: '2026-11-23',
    vehicle_id: 'v1',
    customer_name: 'Sara Benali',
    customer_email: 'sara@example.com',
    customer_phone: '0612345678',
    events: [],
    ...overrides,
  } as FollowUpBooking;
}

/** Résultats des appels RPC (par nom de fonction) et des lectures de tables */
function database(options: {
  pending?: DbResult;
  reviews?: DbResult;
  bookings?: FollowUpBooking[];
}) {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'expire_completed_bookings') return { data: 0, error: null };
    if (name === 'pending_follow_up_candidates') return options.pending ?? { data: [], error: null };
    if (name === 'review_request_candidates') return options.reviews ?? { data: [], error: null };
    return { data: null, error: { code: 'PGRST202', message: `inconnue : ${name}` } };
  });
  mocks.from.mockImplementation((table: string) =>
    query(table === 'bookings' ? { data: options.bookings ?? [], error: null } : { data: [], error: null })
  );
}

const ids = (...values: string[]) => ({ data: values.map((booking_id) => ({ booking_id })), error: null });
const sent = { email: 'sent', whatsapp: 'skipped' };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.remindAgency.mockResolvedValue(sent);
  mocks.offerPendingAlternatives.mockResolvedValue(sent);
  mocks.requestReview.mockResolvedValue(sent);
  mocks.logEvent.mockResolvedValue({ persisted: true });
  mocks.getVehicles.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Relances : sélection en base', () => {
  it('demande à la base les seules demandes à relancer, avec les délais de l’application', async () => {
    database({});
    await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(mocks.rpc).toHaveBeenCalledWith('pending_follow_up_candidates', {
      p_limit: 25,
      p_reminder_after_minutes: 30,
      p_alternatives_after_minutes: 120,
    });
  });

  it('traite les demandes dans l’ordre renvoyé par la base (la plus ancienne d’abord)', async () => {
    // La lecture par identifiants ne garantit pas l'ordre : la tâche le rétablit
    database({ pending: ids('b2', 'b1'), bookings: [booking('b1'), booking('b2', { created_at: minutesAgo(90) })] });
    const report = await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(mocks.remindAgency.mock.calls.map(([b]) => b.id)).toEqual(['b2', 'b1']);
    expect(mocks.logEvent).toHaveBeenCalledWith('b1', 'AGENCY_REMINDER_SENT', 'SYSTEM', undefined, sent);
    expect(report.reminders).toBe(2);
  });

  it('client sans e-mail : aucune alternative cherchée ni envoyée, aucun échec compté', async () => {
    database({
      pending: ids('b3'),
      bookings: [
        booking('b3', {
          created_at: minutesAgo(150),
          customer_email: '212612345678@clickdrive.ma',
          events: [{ event_type: 'AGENCY_REMINDER_SENT' }] as FollowUpBooking['events'],
        }),
      ],
    });
    const report = await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(mocks.getVehicles).not.toHaveBeenCalled();
    expect(mocks.offerPendingAlternatives).not.toHaveBeenCalled();
    expect(mocks.logEvent).not.toHaveBeenCalled();
    expect(report).toEqual({ reminders: 0, alternatives: 0, reviewRequests: 0, failures: 0 });
  });

  it('avis : les clients sans e-mail ne sont retenus que si le modèle WhatsApp d’avis est configuré', async () => {
    database({});
    await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(mocks.rpc).toHaveBeenCalledWith('review_request_candidates', {
      p_limit: 25,
      p_review_after_minutes: 180,
      p_include_without_email: false,
    });

    vi.stubEnv('WHATSAPP_TEMPLATE_REVIEW_REQUEST', 'clickdrive_review_request');
    await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(mocks.rpc).toHaveBeenLastCalledWith('review_request_candidates', expect.objectContaining({ p_include_without_email: true }));
  });

  it('demande d’avis envoyée puis journalisée', async () => {
    const completed = booking('b4', { status: 'COMPLETED', completed_at: minutesAgo(240) } as Partial<FollowUpBooking>);
    database({ reviews: ids('b4'), bookings: [completed] });
    const report = await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(mocks.requestReview).toHaveBeenCalledWith(expect.objectContaining({ id: 'b4' }), 'https://clickdrive.ma');
    expect(mocks.logEvent).toHaveBeenCalledWith('b4', 'REVIEW_REQUESTED', 'SYSTEM', undefined, sent);
    expect(report.reviewRequests).toBe(1);
  });

  it('migration absente : ancienne lecture, avec un avertissement', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const missing = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    database({ pending: missing, reviews: missing, bookings: [booking('b5')] });
    const report = await runBookingFollowUp('https://clickdrive.ma', NOW);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('migration 20261121000100'));
    expect(mocks.remindAgency).toHaveBeenCalledWith(expect.objectContaining({ id: 'b5' }), 'https://clickdrive.ma', 45);
    expect(report.reminders).toBe(1);
  });

  it('autre erreur de la base : la tâche échoue (pas de lecture de repli silencieuse)', async () => {
    database({ pending: { data: null, error: { code: 'XX000', message: 'connexion perdue' } } });
    await expect(runBookingFollowUp('https://clickdrive.ma', NOW)).rejects.toThrow('connexion perdue');
    expect(mocks.remindAgency).not.toHaveBeenCalled();
  });
});
