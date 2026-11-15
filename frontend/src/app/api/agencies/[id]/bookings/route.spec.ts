import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

type Filter = [string, unknown];

const mocks = vi.hoisted(() => ({
  denied: null as null | { status: number },
  filters: [] as Filter[],
  total: 0,
}));

vi.mock('@/lib/auth/access-api', () => ({
  requireAgencyPermissionApi: async () => ({
    auth: mocks.denied ? null : { userId: 'u1' },
    denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied.status }) : null,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select: () => {
        const record = (kind: string) => (column: string, value: unknown) => {
          mocks.filters.push([`${kind}:${column}`, value]);
          return chain;
        };
        const chain: Record<string, unknown> = {
          eq: record('eq'),
          in: record('in'),
          or: record('or'),
          order: () => chain,
          range: async () => ({ data: [], error: null, count: mocks.total }),
        };
        return chain;
      },
    }),
  }),
}));

import { GET } from './route';

const call = (query: string) =>
  GET(new NextRequest(`http://localhost/api/agencies/ag-1/bookings${query}`), { params: Promise.resolve({ id: 'ag-1' }) });

beforeEach(() => {
  mocks.denied = null;
  mocks.filters = [];
  mocks.total = 0;
});

describe('GET /api/agencies/[id]/bookings — filtre de statut', () => {
  it('refusé sans le droit de lecture des réservations', async () => {
    mocks.denied = { status: 403 };
    expect((await call('')).status).toBe(403);
    expect(mocks.filters).toHaveLength(0);
  });

  it('un statut précis : égalité', async () => {
    await call('?status=APPROVED');
    expect(mocks.filters).toContainEqual(['eq:status', 'APPROVED']);
    expect(mocks.filters.some(([key]) => key === 'in:status')).toBe(false);
  });

  it('TO_PROCESS : toute la file des demandes qui attendent l’agence, jamais un statut littéral « TO_PROCESS »', async () => {
    await call('?status=TO_PROCESS');
    expect(mocks.filters).toContainEqual(['in:status', ['PENDING', 'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW']]);
    expect(mocks.filters.some(([key, value]) => key === 'eq:status' && value === 'TO_PROCESS')).toBe(false);
  });

  it('sans statut : pas de filtre de statut ; l’agence reste toujours filtrée', async () => {
    await call('');
    expect(mocks.filters.some(([key]) => key.endsWith(':status'))).toBe(false);
    expect(mocks.filters).toContainEqual(['eq:agency_id', 'ag-1']);
  });

  it('renvoie le total, utilisé tel quel pour le compteur « à traiter »', async () => {
    mocks.total = 7;
    const body = await (await call('?status=TO_PROCESS&pageSize=1')).json();
    expect(body.meta).toMatchObject({ total: 7, pageSize: 1, totalPages: 7 });
  });
});
