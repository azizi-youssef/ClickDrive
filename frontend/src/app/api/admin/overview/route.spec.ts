import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

type Call = { table: string; head: boolean; filters: [string, unknown][] };

const mocks = vi.hoisted(() => ({
  denied: null as null | { status: number },
  permissions: new Set<string>(),
  calls: [] as Call[],
  counts: {} as Record<string, number>,
  failing: new Set<string>(),
}));

vi.mock('@/lib/auth/access-api', () => ({
  requirePlatformPermissionApi: async () => ({
    auth: mocks.denied ? null : { userId: 'admin-1' },
    denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied.status }) : null,
  }),
}));

vi.mock('@/lib/auth/server', () => ({
  hasAccessPermission: async (permission: string) => mocks.permissions.has(permission),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => ({
    from: (table: string) => ({
      select: (_columns: string, options?: { head?: boolean }) => {
        const call: Call = { table, head: Boolean(options?.head), filters: [] };
        mocks.calls.push(call);
        const record = (kind: string) => (column: string, value: unknown) => {
          call.filters.push([`${kind}:${column}`, value]);
          return chain;
        };
        const result = () =>
          mocks.failing.has(table)
            ? { count: null, data: null, error: { message: `échec ${table}` } }
            : call.head
              ? { count: mocks.counts[table] ?? 0, data: null, error: null }
              : { count: mocks.counts[table] ?? 0, data: [], error: null };
        const chain: Record<string, unknown> = {
          in: record('in'),
          eq: record('eq'),
          gt: record('gt'),
          lte: record('lte'),
          or: record('or'),
          order: () => chain,
          limit: () => chain,
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
        };
        return chain;
      },
    }),
  }),
}));

import { GET } from './route';

const callsTo = (table: string) => mocks.calls.filter((call) => call.table === table);

beforeEach(() => {
  mocks.denied = null;
  mocks.permissions = new Set(['agencies.read', 'customers.read']);
  mocks.calls = [];
  mocks.counts = { bookings: 12, agencies: 3, contact_messages: 4, subscription_change_requests: 2 };
  mocks.failing = new Set();
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/admin/overview — messages de contact et demandes de formule', () => {
  it('sans le droit de lire les réservations : refusé, aucune requête en base', async () => {
    mocks.denied = { status: 403 };
    expect((await GET()).status).toBe(403);
    expect(mocks.calls).toHaveLength(0);
  });

  it('compte les messages « Nouveau » et les demandes « en attente de paiement » (même définition que le menu et la carte Abonnements)', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.contactMessages).toEqual({ count: 4 });
    expect(data.planRequests).toEqual({ count: 2 });

    const [messages] = callsTo('contact_messages');
    expect(messages).toMatchObject({ head: true, filters: [['eq:status', 'NEW']] });
    const [requests] = callsTo('subscription_change_requests');
    expect(requests).toMatchObject({ head: true, filters: [['eq:status', 'PENDING_PAYMENT']] });
  });

  it('sans le droit sur les clients : messages « restreints », jamais lus en base ; le reste est inchangé', async () => {
    mocks.permissions = new Set(['agencies.read']);
    const { data } = await (await GET()).json();
    expect(data.contactMessages).toEqual({ count: 0, restricted: true });
    expect(data.planRequests).toEqual({ count: 2 });
    expect(callsTo('contact_messages')).toHaveLength(0);
  });

  it('sans le droit sur les agences : demandes de formule et agences « restreintes », jamais lues en base', async () => {
    mocks.permissions = new Set(['customers.read']);
    const { data } = await (await GET()).json();
    expect(data.planRequests).toEqual({ count: 0, restricted: true });
    expect(data.pendingAgencies).toEqual({ count: 0, items: [], restricted: true });
    expect(data.contactMessages).toEqual({ count: 4 });
    expect(callsTo('subscription_change_requests')).toHaveLength(0);
    expect(callsTo('agencies')).toHaveLength(0);
  });

  it('échec de lecture des messages : « indisponible » (jamais 0), et les réservations restent servies', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.failing = new Set(['contact_messages']);
    const res = await GET();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.contactMessages).toEqual({ count: 0, unavailable: true });
    expect(data.planRequests).toEqual({ count: 2 });
    expect(data.bookings.total).toBe(12);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('messages de contact'), 'échec contact_messages');
  });

  it('échec de lecture des demandes de formule : « indisponible », sans faire tomber la vue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.failing = new Set(['subscription_change_requests']);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data.planRequests).toEqual({ count: 0, unavailable: true });
  });

  it('un échec sur les réservations reste une erreur d’ensemble (500) : les chiffres principaux ne peuvent pas être faux', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.failing = new Set(['bookings']);
    expect((await GET()).status).toBe(500);
  });
});
