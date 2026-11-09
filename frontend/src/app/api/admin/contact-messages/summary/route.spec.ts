import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  denied: null as null | { status: number },
  calls: [] as { columns: string; options?: unknown; filters: [string, unknown][]; limit?: number }[],
  rows: [] as unknown[],
  count: 0,
}));

vi.mock('@/lib/auth/access-api', () => ({
  requirePlatformPermissionApi: async () => ({
    auth: mocks.denied ? null : { userId: 'admin-1' },
    denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied.status }) : null,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => ({
    from: (table: string) => {
      expect(table).toBe('contact_messages');
      return {
        select: (columns: string, options?: { head?: boolean }) => {
          const call = { columns, options, filters: [] as [string, unknown][], limit: undefined as number | undefined };
          mocks.calls.push(call);
          const result = options?.head ? { count: mocks.count, data: null, error: null } : { data: mocks.rows, error: null };
          const chain = {
            eq: (column: string, value: unknown) => {
              call.filters.push([column, value]);
              return chain;
            },
            order: () => chain,
            limit: (value: number) => {
              call.limit = value;
              return chain;
            },
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
          };
          return chain;
        },
      };
    },
  }),
}));

import { GET } from './route';

beforeEach(() => {
  mocks.denied = null;
  mocks.calls = [];
  mocks.count = 0;
  mocks.rows = [];
});

describe('GET /api/admin/contact-messages/summary', () => {
  it('sans la permission de lecture des messages : refusé, aucune requête en base', async () => {
    mocks.denied = { status: 403 };
    expect((await GET()).status).toBe(403);
    expect(mocks.calls).toHaveLength(0);
  });

  it('compte et liste uniquement les messages au statut « Nouveau »', async () => {
    mocks.count = 3;
    mocks.rows = [
      { id: 'm1', reference: 'MSG-20261109-ABCDEF', name: 'Sara', category: 'billing', subject: null, created_at: '2026-11-09T10:00:00Z' },
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true, data: { newCount: 3, latest: mocks.rows } });
    expect(mocks.calls).toHaveLength(2);
    for (const call of mocks.calls) expect(call.filters).toEqual([['status', 'NEW']]);
    // Le résumé ne renvoie jamais le contenu ni les coordonnées de l'expéditeur
    expect(mocks.calls[1].columns).not.toMatch(/message|email|phone/);
    expect(mocks.calls[1].limit).toBe(10);
  });
});
