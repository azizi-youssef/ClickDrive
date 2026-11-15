import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { agencyReportJson } from '@/tests/fixtures/analytics-report';

const mocks = vi.hoisted(() => ({
  denied: null as null | number,
  gate: null as null | { agencyId: string; permission: string },
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  result: { data: null as unknown, error: null as null | { code?: string; message: string } },
}));

vi.mock('@/lib/auth/access-api', () => ({
  requireAgencyPermissionApi: async (agencyId: string, permission: string) => {
    mocks.gate = { agencyId, permission };
    return {
      auth: mocks.denied ? null : { userId: 'manager-1' },
      denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied }) : null,
    };
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args });
      return mocks.result;
    },
  }),
  createAdminClient: async () => null,
}));

import { GET } from './route';

const AGENCY = '11111111-1111-4111-8111-111111111111';
const call = (query = '') =>
  GET(new NextRequest(`http://localhost/api/stats/agency/${AGENCY}/analytics${query}`), { params: Promise.resolve({ id: AGENCY }) });

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  mocks.denied = null;
  mocks.gate = null;
  mocks.rpcCalls = [];
  mocks.result = { data: agencyReportJson(), error: null };
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/stats/agency/[id]/analytics', () => {
  it('reports.read exigé sur cette agence', async () => {
    mocks.denied = 403;
    const response = await call();
    expect(response.status).toBe(403);
    expect(mocks.gate).toEqual({ agencyId: AGENCY, permission: 'reports.read' });
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('rapport de l’agence calculé en base pour la période', async () => {
    const response = await call('?from=2026-10-01&to=2026-10-30');
    expect(response.status).toBe(200);
    expect(mocks.rpcCalls).toEqual([
      { fn: 'agency_analytics_report', args: { p_agency_id: AGENCY, p_from: '2026-10-01', p_to: '2026-10-30' } },
    ]);
    const body = await response.json();
    expect(body.data.fleet.items).toHaveLength(3);
  });

  it('date mal formée : 400', async () => {
    const response = await call('?from=hier');
    expect(response.status).toBe(400);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('erreur de la base : 500 neutre', async () => {
    mocks.result = { data: null, error: { code: 'XX000', message: 'relation "bookings" does not exist' } };
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Impossible de charger les statistiques de l'agence.");
  });
});
