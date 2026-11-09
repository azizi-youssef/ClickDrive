import { afterEach, describe, expect, it, vi } from 'vitest';
import { signedBookingLink, verifyBookingLink } from '@/lib/auth/booking-access-link';
import {
  FOLLOW_UP_EVENTS,
  isFollowUpHours,
  pickAlternatives,
  planPendingFollowUps,
  planReviewRequests,
  type FollowUpBooking,
} from './follow-up';
import { median, responseMinutes, responseTimeLabel, summarizeResponseTimes } from './response-time';
import { sendBookingTemplate, templateParameter } from './whatsapp-templates';
import { waitingLabel } from './notifications';
import { analyticsConfig } from '@/lib/analytics/config';
import { trackServerEvent } from '@/lib/analytics/server';
import { testVehicle } from '@/tests/fixtures/vehicle';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* 10 h 00 à Casablanca le 9 novembre 2026 (UTC+1) */
const NOW = new Date('2026-11-09T09:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
/** Événement de réservation réduit à son type (seul champ lu par la planification) */
const ev = (eventType: string) => ({ event_type: eventType }) as NonNullable<FollowUpBooking['events']>[number];

function booking(overrides: Partial<FollowUpBooking> = {}): FollowUpBooking {
  return {
    id: 'b1',
    reference: 'CD-2026-100001',
    booking_ref: 'CD-2026-100001',
    status: 'REQUESTED',
    created_at: minutesAgo(45),
    start_date: '2026-11-20',
    end_date: '2026-11-23',
    vehicle_id: 'v1',
    daily_price: 350,
    events: [],
    ...overrides,
  } as FollowUpBooking;
}

describe('Liens signés (suivi, avis)', () => {
  it('un lien ne vaut que pour son usage, sa référence et sa durée', () => {
    vi.stubEnv('BOOKING_LINK_SECRET', 'secret-de-test-0123456789');
    const link = signedBookingLink('track', 'CD-2026-100001', NOW.getTime());
    expect(link).toMatch(/^\/suivi\/CD-2026-100001\?exp=\d+&sig=/);
    const url = new URL(`https://clickdrive.ma${link}`);
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    expect(verifyBookingLink('track', 'CD-2026-100001', exp, sig, NOW.getTime())).toBe(true);
    expect(verifyBookingLink('review', 'CD-2026-100001', exp, sig, NOW.getTime())).toBe(false);
    expect(verifyBookingLink('track', 'CD-2026-100002', exp, sig, NOW.getTime())).toBe(false);
    expect(verifyBookingLink('track', 'CD-2026-100001', exp, `${sig}x`, NOW.getTime())).toBe(false);
    expect(verifyBookingLink('track', 'CD-2026-100001', exp, sig, NOW.getTime() + 200 * 24 * 3600_000)).toBe(false);
  });

  it('sans secret serveur : aucun lien (il ne serait pas vérifiable)', () => {
    vi.stubEnv('BOOKING_LINK_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(signedBookingLink('track', 'CD-2026-100001')).toBeNull();
  });
});

describe('Relances automatiques', () => {
  it('fenêtre horaire du Maroc : 8 h – 22 h', () => {
    expect(isFollowUpHours(NOW)).toBe(true);
    expect(isFollowUpHours(new Date('2026-11-09T02:00:00.000Z'))).toBe(false); // 3 h au Maroc
    expect(isFollowUpHours(new Date('2026-11-09T21:30:00.000Z'))).toBe(false); // 22 h 30
  });

  it('30 min sans réponse : relance de l’agence, une seule fois', () => {
    expect(planPendingFollowUps([booking({ created_at: minutesAgo(20) })], NOW)).toEqual([]);
    const [action] = planPendingFollowUps([booking()], NOW);
    expect(action.action).toBe('remind');
    expect(Math.round(action.waitingMinutes)).toBe(45);
  });

  it('2 h sans réponse après la relance : alternatives au client ; rien en double ; rien la nuit', () => {
    const reminded = booking({ created_at: minutesAgo(150), events: [ev(FOLLOW_UP_EVENTS.agencyReminder)] });
    expect(planPendingFollowUps([reminded], NOW)[0].action).toBe('alternatives');
    const done = booking({
      created_at: minutesAgo(150),
      events: [ev(FOLLOW_UP_EVENTS.agencyReminder), ev(FOLLOW_UP_EVENTS.alternatives)],
    });
    expect(planPendingFollowUps([done], NOW)).toEqual([]);
    expect(planPendingFollowUps([booking({ status: 'CONFIRMED' })], NOW)).toEqual([]);
    expect(planPendingFollowUps([booking()], new Date('2026-11-09T02:00:00.000Z'))).toEqual([]);
  });

  it('avis demandé 3 h après la fin, une fois, et jamais si un avis existe déjà', () => {
    const completed = booking({ status: 'COMPLETED', completed_at: minutesAgo(240) } as Partial<FollowUpBooking>);
    expect(planReviewRequests([completed], new Set(), NOW)).toHaveLength(1);
    expect(planReviewRequests([completed], new Set(['b1']), NOW)).toEqual([]);
    const asked = { ...completed, events: [ev(FOLLOW_UP_EVENTS.reviewRequest)] };
    expect(planReviewRequests([asked], new Set(), NOW)).toEqual([]);
    const tooSoon = booking({ status: 'COMPLETED', completed_at: minutesAgo(60) } as Partial<FollowUpBooking>);
    expect(planReviewRequests([tooSoon], new Set(), NOW)).toEqual([]);
  });

  it('alternatives : même type, sans le véhicule demandé, prix le plus proche d’abord', () => {
    const fleet = [
      testVehicle({ id: 'v1', slug: 'demande', daily_price: 350 }),
      testVehicle({ id: 'v2', slug: 'proche', daily_price: 380 }),
      testVehicle({ id: 'v3', slug: 'lointaine', daily_price: 900 }),
      testVehicle({ id: 'm1', slug: 'scooter', daily_price: 340, vehicle_type: 'MOTORCYCLE', category: 'Scooter' }),
    ];
    const picked = pickAlternatives(fleet, booking({ vehicle: fleet[0] }), 'https://clickdrive.ma');
    expect(picked.map((vehicle) => vehicle.url.split('?')[0])).toEqual([
      'https://clickdrive.ma/cars/proche',
      'https://clickdrive.ma/cars/lointaine',
    ]);
    expect(picked[0].url).toContain('startDate=2026-11-20&endDate=2026-11-23');
  });

  it('durée d’attente lisible', () => {
    expect(waitingLabel(45)).toBe('45 min');
    expect(waitingLabel(130)).toBe('2 h 10');
    expect(waitingLabel(120)).toBe('2 h');
  });
});

describe('Délai de réponse des agences', () => {
  const answered = (created: string, answeredAt: string, type = 'AGENCY_ACCEPTED') => ({
    created_at: created,
    events: [
      { event_type: 'REQUEST_CREATED', created_at: created },
      { event_type: type, created_at: answeredAt },
    ],
  });

  it('première réponse de l’agence (acceptation, refus ou alternative)', () => {
    expect(responseMinutes(answered('2026-11-01T10:00:00Z', '2026-11-01T10:40:00Z'))).toBe(40);
    expect(responseMinutes(answered('2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z', 'AGENCY_REJECTED'))).toBe(60);
    expect(responseMinutes({ created_at: '2026-11-01T10:00:00Z', events: [] })).toBeNull();
  });

  it('médiane affichée à partir de 3 réponses, arrondie vers le haut', () => {
    expect(median([10, 50, 30])).toBe(30);
    expect(responseTimeLabel(25)).toBe('en moins de 30 min');
    expect(responseTimeLabel(61)).toBe('en moins de 2 h');
    const two = [answered('2026-11-01T10:00:00Z', '2026-11-01T10:20:00Z'), answered('2026-11-02T10:00:00Z', '2026-11-02T10:50:00Z')];
    expect(summarizeResponseTimes(two)).toBeNull();
    const three = [...two, answered('2026-11-03T10:00:00Z', '2026-11-03T11:30:00Z')];
    expect(summarizeResponseTimes(three)).toEqual({ medianMinutes: 50, responses: 3, label: 'en moins de 1 h' });
  });
});

describe('Modèles WhatsApp', () => {
  it('paramètres sans saut de ligne ni tabulation, jamais vides', () => {
    expect(templateParameter('Ligne 1\nLigne 2\tfin')).toBe('Ligne 1 Ligne 2 fin');
    expect(templateParameter('')).toBe('—');
  });

  it('sans nom de modèle configuré : « skipped », aucun envoi', async () => {
    vi.stubEnv('WHATSAPP_TEMPLATE_REQUEST_RECEIVED', '');
    expect(await sendBookingTemplate('requestReceived', '0612345678', ['Sara'], { bookingRef: 'CD-2026-100001' })).toBe('skipped');
  });
});

describe('Mesure d’audience', () => {
  it('inactive sans domaine ; refuse une source non HTTPS', () => {
    expect(analyticsConfig({})).toBeNull();
    expect(analyticsConfig({ NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'clickdrive.ma', NEXT_PUBLIC_PLAUSIBLE_SRC: 'http://stats.example/js/script.js' })).toBeNull();
    expect(analyticsConfig({ NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'clickdrive.ma' })).toEqual({
      domain: 'clickdrive.ma',
      src: 'https://plausible.io/js/script.js',
      origin: 'https://plausible.io',
    });
  });

  it('événement serveur : envoyé à l’API Plausible seulement si configurée', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 202 }));
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', '');
    expect(await trackServerEvent('Demande acceptée', 'https://clickdrive.ma/agency', undefined, fetchMock)).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'clickdrive.ma');
    expect(await trackServerEvent('Demande acceptée', 'https://clickdrive.ma/agency', undefined, fetchMock)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://plausible.io/api/event');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Demande acceptée', url: 'https://clickdrive.ma/agency', domain: 'clickdrive.ma' });
  });
});
