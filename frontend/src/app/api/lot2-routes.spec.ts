import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  booking: null as null | { id: string; vehicle_id: string; agency_id: string; customer_id: string | null; status: string },
  insertError: null as null | { code: string; message: string },
  inserted: [] as unknown[],
}));

vi.mock('@/lib/bookings/follow-up-runner', () => ({ runBookingFollowUp: mocks.run }));
vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: async () => ({ ok: true }),
  checkRateLimit: () => ({ ok: true }),
  clientIpFromRequest: () => '203.0.113.9',
}));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => ({
    from: (table: string) => {
      if (table === 'bookings') {
        return { select: () => ({ or: () => ({ maybeSingle: async () => ({ data: mocks.booking, error: null }) }) }) };
      }
      return {
        insert: (row: unknown) => {
          mocks.inserted.push(row);
          return {
            select: () => ({
              single: async () =>
                mocks.insertError ? { data: null, error: mocks.insertError } : { data: { id: 'r1', rating: 5 }, error: null },
            }),
          };
        },
      };
    },
  }),
}));

import { GET as cronGET } from './cron/booking-follow-up/route';
import { POST as reviewPOST } from './reviews/invitation/route';
import { signedBookingLink } from '@/lib/auth/booking-access-link';

beforeEach(() => {
  vi.stubEnv('BOOKING_LINK_SECRET', 'secret-de-test-0123456789');
  mocks.run.mockReset().mockResolvedValue({ reminders: 1, alternatives: 0, reviewRequests: 0, failures: 0 });
  mocks.booking = { id: 'b1', vehicle_id: 'v1', agency_id: 'a1', customer_id: null, status: 'COMPLETED' };
  mocks.insertError = null;
  mocks.inserted = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/booking-follow-up', () => {
  const call = (authorization?: string) =>
    cronGET(new NextRequest('https://clickdrive.ma/api/cron/booking-follow-up', { headers: authorization ? { authorization } : {} }));

  it('sans CRON_SECRET configuré : 503, rien n’est lancé', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer x')).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('secret absent ou faux : 401 ; bon secret : relances lancées', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-de-test');
    expect((await call()).status).toBe(401);
    expect((await call('Bearer mauvais')).status).toBe(401);
    const ok = await call('Bearer cron-secret-de-test');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ success: true, reminders: 1 });
  });
});

describe('POST /api/reviews/invitation', () => {
  function post(overrides: Record<string, unknown> = {}, link = signedBookingLink('review', 'CD-2026-100001')) {
    const url = new URL(`https://clickdrive.ma${link}`);
    return reviewPOST(
      new NextRequest('https://clickdrive.ma/api/reviews/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: 'CD-2026-100001',
          exp: url.searchParams.get('exp'),
          sig: url.searchParams.get('sig'),
          rating: 5,
          comment: 'Voiture propre, remise des clés rapide à l’aéroport.',
          ...overrides,
        }),
      })
    );
  }

  it('lien valide et location terminée : avis vérifié publié', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect(mocks.inserted[0]).toMatchObject({ booking_id: 'b1', author_name: 'Client vérifié', rating: 5 });
  });

  it('lien de suivi (autre usage) ou signature altérée : refusé', async () => {
    expect((await post({}, signedBookingLink('track', 'CD-2026-100001'))).status).toBe(403);
    expect((await post({ sig: 'x'.repeat(43) })).status).toBe(403);
    expect(mocks.inserted).toEqual([]);
  });

  it('location pas terminée : refusé ; deuxième avis : 409', async () => {
    mocks.booking = { id: 'b1', vehicle_id: 'v1', agency_id: 'a1', customer_id: null, status: 'CONFIRMED' };
    expect((await post()).status).toBe(403);
    mocks.booking = { id: 'b1', vehicle_id: 'v1', agency_id: 'a1', customer_id: null, status: 'COMPLETED' };
    mocks.insertError = { code: '23505', message: 'duplicate' };
    expect((await post()).status).toBe(409);
  });

  it('avis trop court ou note hors limites : 400', async () => {
    expect((await post({ comment: 'Bien' })).status).toBe(400);
    expect((await post({ rating: 6 })).status).toBe(400);
  });
});
