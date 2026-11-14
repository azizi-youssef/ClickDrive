import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => null,
  createPublicClient: () => null,
  createClient: async () => null,
}));

import { capacitySlugForCount, resolveEffectiveCapacity, subscriptionService } from './subscription.service';

const plans = [
  { id: 'p1', slug: 'starter', name: 'Starter', max_vehicles: 15 },
  { id: 'p2', slug: 'pro', name: 'Pro', max_vehicles: 25 },
  { id: 'p3', slug: 'business', name: 'Business', max_vehicles: 35 },
  { id: 'p4', slug: 'unlimited', name: 'Premium', max_vehicles: 45 },
];

describe('Règle de capacité (identique au trigger enforce_vehicle_capacity)', () => {
  it.each([
    [0, 'starter'],
    [15, 'starter'],
    [16, 'pro'],
    [25, 'pro'],
    [35, 'business'],
    [36, 'unlimited'],
  ])('%i véhicules → palier %s', (count, slug) => {
    expect(capacitySlugForCount(count)).toBe(slug);
  });

  it.each(['ACTIVE', 'TRIAL', 'PAST_DUE'])('abonnement %s : la formule de l’abonnement fixe la limite', (status) => {
    expect(resolveEffectiveCapacity({ status, custom_vehicle_limit: null, plan: plans[1] }, 3, plans)).toEqual({
      plan: plans[1],
      maxVehicles: 25,
      deduced: false,
    });
  });

  it('custom_vehicle_limit prioritaire sur la limite de la formule', () => {
    expect(resolveEffectiveCapacity({ status: 'ACTIVE', custom_vehicle_limit: 18, plan: plans[0] }, 3, plans)?.maxVehicles).toBe(18);
  });

  it.each(['CANCELLED', 'EXPIRED'])('abonnement %s : traité comme une absence d’abonnement (palier déduit)', (status) => {
    expect(resolveEffectiveCapacity({ status, custom_vehicle_limit: 40, plan: plans[3] }, 3, plans)).toEqual({
      plan: plans[0],
      maxVehicles: 15,
      deduced: true,
    });
  });

  it('sans abonnement : palier parmi les formules en base ; aucune formule = null (fail-closed)', () => {
    expect(resolveEffectiveCapacity(null, 15, plans)?.maxVehicles).toBe(15);
    expect(resolveEffectiveCapacity(null, 15, [])).toBeNull();
  });

  it('identifiant d’agence invalide ou service-role absent : ajout refusé, vérification impossible', async () => {
    expect(await subscriptionService.canAgencyAddVehicle('not-a-uuid')).toMatchObject({ allowed: false, unavailable: true });
    expect(await subscriptionService.canAgencyAddVehicle('a1000000-0000-4000-8000-00000000000a')).toMatchObject({
      allowed: false,
      unavailable: true,
    });
  });
});
