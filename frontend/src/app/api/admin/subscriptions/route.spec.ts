import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  denied: null as null | number,
  calls: [] as string[],
  statsError: null as Error | null,
}));

vi.mock('@/lib/auth/access-api', () => ({
  requirePlatformPermissionApi: async () => ({
    auth: mocks.denied ? null : { userId: 'admin-1' },
    denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied }) : null,
  }),
}));

vi.mock('@/lib/services/subscription.service', () => ({
  subscriptionService: {
    getAllAgencySubscriptions: async () => {
      mocks.calls.push('list');
      return [{ agency_id: 'a1' }];
    },
    getSubscriptionStats: async () => {
      mocks.calls.push('stats');
      if (mocks.statsError) throw mocks.statsError;
      return { monthlyRecurringRevenue: 800, activeSubscribers: 2, totalAgencies: 5, fleetCapacityTotal: 4, plansDistribution: [] };
    },
    getSubscriptionPlans: async () => {
      mocks.calls.push('plans');
      return [];
    },
  },
}));

import { GET } from './route';

const get = (query = '') => GET(new NextRequest(`http://localhost/api/admin/subscriptions${query}`));

beforeEach(() => {
  mocks.denied = null;
  mocks.calls = [];
  mocks.statsError = null;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('GET /api/admin/subscriptions', () => {
  it('?only=stats : statistiques seules, la liste des agences n’est pas construite', async () => {
    const response = await get('?only=stats');
    expect(response.status).toBe(200);
    expect(mocks.calls).toEqual(['stats']);
    expect(await response.json()).toEqual({
      success: true,
      data: { stats: { monthlyRecurringRevenue: 800, activeSubscribers: 2, totalAgencies: 5, fleetCapacityTotal: 4, plansDistribution: [] } },
    });
  });

  it('sans paramètre : liste, statistiques et formules (pages Finance et Agences)', async () => {
    const body = await (await get()).json();
    expect(new Set(mocks.calls)).toEqual(new Set(['list', 'stats', 'plans']));
    expect(Object.keys(body.data).sort()).toEqual(['plans', 'stats', 'subscriptions']);
  });

  it('droit refusé : aucune lecture', async () => {
    mocks.denied = 403;
    expect((await get('?only=stats')).status).toBe(403);
    expect(mocks.calls).toEqual([]);
  });

  it('erreur de calcul : 500 neutre', async () => {
    mocks.statsError = new Error('Not authorized to read subscription statistics');
    const response = await get('?only=stats');
    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toMatch(/Not authorized/);
  });
});
