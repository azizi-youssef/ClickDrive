import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { adminReportJson } from '@/tests/fixtures/analytics-report';

const mocks = vi.hoisted(() => ({
  denied: null as null | number,
  permission: '' as string,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  result: { data: null as unknown, error: null as null | { code?: string; message: string } },
  adminClientUsed: false,
}));

vi.mock('@/lib/auth/access-api', () => ({
  requirePlatformPermissionApi: async (permission: string) => {
    mocks.permission = permission;
    return {
      auth: mocks.denied ? null : { userId: 'admin-1' },
      denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied }) : null,
    };
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  // Session de l'utilisateur : la base revérifie le droit (jamais la clé service-role ici)
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args });
      return mocks.result;
    },
  }),
  createAdminClient: async () => {
    mocks.adminClientUsed = true;
    return null;
  },
}));

import { GET } from './route';

const request = (query = '') => new NextRequest(`http://localhost/api/admin/analytics${query}`);

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  mocks.denied = null;
  mocks.rpcCalls = [];
  mocks.result = { data: adminReportJson(), error: null };
  mocks.adminClientUsed = false;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/admin/analytics', () => {
  it('droit reports.read plateforme exigé', async () => {
    mocks.denied = 403;
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.permission).toBe('reports.read');
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('agrégats demandés à la base pour la période, avec la session (aucune table lue)', async () => {
    const response = await GET(request('?from=2026-10-01&to=2026-10-30'));
    expect(response.status).toBe(200);
    expect(mocks.rpcCalls).toEqual([{ fn: 'admin_analytics_report', args: { p_from: '2026-10-01', p_to: '2026-10-30' } }]);
    expect(mocks.adminClientUsed).toBe(false);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.current.requests).toBe(40);
    expect(body.data.subscriptions.mrr).toBe(1500);
  });

  it('sans période : valeurs par défaut de la base', async () => {
    await GET(request());
    expect(mocks.rpcCalls[0].args).toEqual({ p_from: null, p_to: null });
  });

  it('période invalide : 400, la base n’est pas appelée', async () => {
    const response = await GET(request('?from=2026-10-30&to=2026-10-01'));
    expect(response.status).toBe(400);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it('période refusée par la base (22023) : 400', async () => {
    mocks.result = { data: null, error: { code: '22023', message: 'Date range too long' } };
    const response = await GET(request('?from=2026-10-01&to=2026-10-30'));
    expect(response.status).toBe(400);
  });

  it('autre erreur : 500 sans détail technique', async () => {
    mocks.result = { data: null, error: { code: '42501', message: 'Not authorized to read platform reports' } };
    const response = await GET(request());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).not.toMatch(/Not authorized/);
  });

  it('réponse malformée : 500 plutôt qu’un rapport faux', async () => {
    mocks.result = { data: { ...adminReportJson(), current: { requests: 'n/a' } }, error: null };
    const response = await GET(request());
    expect(response.status).toBe(500);
  });
});
