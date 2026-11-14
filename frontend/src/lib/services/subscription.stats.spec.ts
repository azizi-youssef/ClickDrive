import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeCall } from '@/tests/support/fake-supabase';

const state = vi.hoisted(() => ({
  service: null as unknown,
  publicClient: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => state.service,
  createPublicClient: () => state.publicClient,
  createClient: async () => null,
}));

import { subscriptionService } from './subscription.service';

const PLANS = [
  { id: 'c1000000-0000-4000-8000-000000000001', name: 'Starter', slug: 'starter', min_vehicles: 5, max_vehicles: 15, price_monthly: 300, is_active: true, sort_order: 1, features: [] },
  { id: 'c1000000-0000-4000-8000-000000000002', name: 'Pro', slug: 'pro', min_vehicles: 15, max_vehicles: 25, price_monthly: 400, is_active: true, sort_order: 2, features: [] },
  { id: 'c1000000-0000-4000-8000-000000000003', name: 'Business', slug: 'business', min_vehicles: 25, max_vehicles: 35, price_monthly: 500, is_active: true, sort_order: 3, features: [] },
  { id: 'c1000000-0000-4000-8000-000000000004', name: 'Premium', slug: 'unlimited', min_vehicles: 35, max_vehicles: 45, price_monthly: 600, is_active: true, sort_order: 4, features: [] },
];

const AGENCIES = [
  { id: 'a0000000-0000-4000-8000-00000000000a', name: 'A — Pro payant', status: 'ACTIVE', archived_at: null },
  { id: 'a0000000-0000-4000-8000-00000000000b', name: 'B — sans abonnement', status: 'ACTIVE', archived_at: null },
  { id: 'a0000000-0000-4000-8000-00000000000c', name: 'C — suspendue', status: 'SUSPENDED', archived_at: null },
  { id: 'a0000000-0000-4000-8000-00000000000d', name: 'D — abonnement annulé', status: 'ACTIVE', archived_at: null },
];

function subscription(agencyId: string, slug: string, status: string, pricePaid: number, custom: number | null = null) {
  return {
    id: `sub-row-${agencyId.slice(-1)}`,
    agency_id: agencyId,
    status,
    custom_vehicle_limit: custom,
    price_paid: pricePaid,
    billing_cycle_start: '2026-11-01',
    billing_cycle_end: '2026-12-01',
    auto_renew: true,
    payment_method: 'VIREMENT',
    created_at: '2026-11-01T00:00:00.000Z',
    plan: PLANS.find((plan) => plan.slug === slug),
  };
}

let serviceCalls: FakeCall[] = [];

beforeEach(() => {
  const service = createFakeSupabase((call) => {
    if (call.table === 'agencies') return { data: AGENCIES };
    if (call.table === 'agency_subscriptions') {
      return {
        data: [
          subscription(AGENCIES[0].id, 'pro', 'ACTIVE', 400),
          subscription(AGENCIES[2].id, 'starter', 'ACTIVE', 300),
          subscription(AGENCIES[3].id, 'unlimited', 'CANCELLED', 600),
        ],
      };
    }
    if (call.table === 'vehicles') {
      // 20 véhicules pour A, 3 pour B (non archivés)
      return {
        data: [
          ...Array.from({ length: 20 }, (_, i) => ({ id: `va-${i}`, agency_id: AGENCIES[0].id })),
          ...Array.from({ length: 3 }, (_, i) => ({ id: `vb-${i}`, agency_id: AGENCIES[1].id })),
        ],
      };
    }
    return undefined;
  });
  const publicClient = createFakeSupabase((call) => (call.table === 'subscription_plans' ? { data: PLANS } : undefined));
  state.service = service.client;
  state.publicClient = publicClient.client;
  serviceCalls = service.calls;
});

describe('Vue plateforme des abonnements', () => {
  it('nombre de requêtes constant, quel que soit le nombre d’agences (plus de N+1)', async () => {
    const subs = await subscriptionService.getAllAgencySubscriptions();
    expect(subs).toHaveLength(4);
    expect(serviceCalls.length).toBeLessThanOrEqual(3);
  });

  it('revenu mensuel : seuls les abonnements réels ACTIVE/TRIAL d’agences actives', async () => {
    const stats = await subscriptionService.getSubscriptionStats();
    // A (400) seulement : B sans abonnement (formule déduite), C suspendue, D annulé
    expect(stats.monthlyRecurringRevenue).toBe(400);
    expect(stats.activeSubscribers).toBe(1);
    expect(stats.totalAgencies).toBe(4);
    expect(stats.fleetCapacityTotal).toBe(23);
    expect(stats.plansDistribution.find((plan) => plan.slug === 'pro')).toMatchObject({ count: 1, revenue: 400 });
    expect(stats.plansDistribution.find((plan) => plan.slug === 'unlimited')).toMatchObject({ count: 0, revenue: 0 });
  });

  it('capacité affichée : formule de l’abonnement, palier déduit sinon (même règle que le contrôle d’ajout)', async () => {
    const subs = await subscriptionService.getAllAgencySubscriptions();
    const byName = Object.fromEntries(subs.map((sub) => [sub.agency_name, sub]));
    expect(byName['A — Pro payant']).toMatchObject({ vehicle_capacity: 25, is_deduced: false, current_vehicles_count: 20 });
    expect(byName['B — sans abonnement']).toMatchObject({ vehicle_capacity: 15, is_deduced: true });
    expect(byName['D — abonnement annulé']).toMatchObject({ vehicle_capacity: 15, is_deduced: true, status: 'CANCELLED' });
  });
});
