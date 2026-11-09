import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAgencies: vi.fn(),
  getActiveAgenciesWithoutSession: vi.fn(),
  getVehicles: vi.fn(),
  cacheCalls: 0,
}));

// unstable_cache exécute la fonction telle quelle : on vérifie ce qu'elle appelle
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => () => {
    mocks.cacheCalls += 1;
    return fn();
  },
}));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined }));
vi.mock('@/lib/services/agencies.service', () => ({
  agenciesService: {
    getAgencies: mocks.getAgencies,
    getActiveAgenciesWithoutSession: mocks.getActiveAgenciesWithoutSession,
  },
}));
vi.mock('@/lib/services/vehicles.service', () => ({
  vehiclesService: { getVehicles: mocks.getVehicles },
}));

import { getPublicCatalog } from './public-catalog.service';

const agency = { id: 'a1', name: 'Agence Test', slug: 'agence-test', status: 'ACTIVE' };

describe('getPublicCatalog', () => {
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheCalls = 0;
    mocks.getAgencies.mockResolvedValue([agency]);
    mocks.getActiveAgenciesWithoutSession.mockResolvedValue([agency]);
    mocks.getVehicles.mockResolvedValue([]);
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });

  it('en cache, ne lit jamais les cookies (lecture des agences sans session)', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test';
    const catalog = await getPublicCatalog();
    expect(mocks.cacheCalls).toBe(1);
    expect(mocks.getActiveAgenciesWithoutSession).toHaveBeenCalledTimes(1);
    expect(mocks.getAgencies).not.toHaveBeenCalled();
    expect(catalog?.agencies.map((a) => a.id)).toEqual(['a1']);
  });

  it('sans clé serveur, lecture directe hors cache', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await getPublicCatalog();
    expect(mocks.cacheCalls).toBe(0);
    expect(mocks.getAgencies).toHaveBeenCalledWith(true);
    expect(mocks.getActiveAgenciesWithoutSession).not.toHaveBeenCalled();
  });

  it('renvoie null quand la lecture échoue (repli côté navigateur)', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test';
    mocks.getVehicles.mockRejectedValue(new Error('panne'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await getPublicCatalog()).toBeNull();
  });
});
