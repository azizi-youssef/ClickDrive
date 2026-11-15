import { beforeEach, describe, expect, it, vi } from 'vitest';

type AgencyRow = { id: string; name: string; logo_url: string | null; verified: boolean | null };

const state = vi.hoisted(() => ({
  memberships: [] as { agency_id: string; role: string }[],
  agencies: [] as AgencyRow[],
  agencyQuery: null as null | { columns: string; filters: [string, unknown][] },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c', user_metadata: {} } }, error: null }) },
    from: (table: string) => ({
      select: (columns: string) => {
        const filters: [string, unknown][] = [];
        const chain: Record<string, unknown> = {
          eq: (column: string, value: unknown) => {
            filters.push([`eq:${column}`, value]);
            return chain;
          },
          in: (column: string, value: unknown) => {
            filters.push([`in:${column}`, value]);
            return chain;
          },
          is: (column: string, value: unknown) => {
            filters.push([`is:${column}`, value]);
            return chain;
          },
          maybeSingle: async () => ({ data: { id: 'u1', email: 'a@b.c', full_name: 'Youssef', avatar_url: null, role: 'AGENCY_OWNER' }, error: null }),
          then: (resolve: (value: unknown) => unknown) => {
            if (table === 'agency_members') return Promise.resolve({ data: state.memberships, error: null }).then(resolve);
            state.agencyQuery = { columns, filters };
            return Promise.resolve({ data: state.agencies, error: null }).then(resolve);
          },
        };
        return chain;
      },
    }),
  }),
}));

import { getServerAuth } from './server';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  state.memberships = [{ agency_id: A, role: 'agency_admin' }];
  state.agencies = [];
  state.agencyQuery = null;
});

describe('getServerAuth — agence courante', () => {
  it('lit la vérification réelle de l’agence : vérifiée', async () => {
    state.agencies = [{ id: A, name: 'Atlas', logo_url: null, verified: true }];
    expect((await getServerAuth())?.agencyVerified).toBe(true);
  });

  it('agence active mais non vérifiée : false (jamais « vérifiée » par défaut)', async () => {
    state.agencies = [{ id: A, name: 'Atlas', logo_url: null, verified: false }];
    expect((await getServerAuth())?.agencyVerified).toBe(false);
  });

  it('valeur absente ou nulle en base : false', async () => {
    state.agencies = [{ id: A, name: 'Atlas', logo_url: null, verified: null }];
    expect((await getServerAuth())?.agencyVerified).toBe(false);
  });

  it('la colonne est bien demandée à la base, et seules les agences actives non archivées sont lues', async () => {
    state.agencies = [{ id: A, name: 'Atlas', logo_url: null, verified: true }];
    await getServerAuth();
    expect(state.agencyQuery?.columns).toContain('verified');
    expect(state.agencyQuery?.filters).toContainEqual(['eq:status', 'ACTIVE']);
    expect(state.agencyQuery?.filters).toContainEqual(['is:archived_at', null]);
  });

  it('plusieurs agences : nom, logo et vérification sont ceux de l’agence courante (agencyIds[0]), pas de la première ligne renvoyée', async () => {
    state.memberships = [
      { agency_id: A, role: 'agency_admin' },
      { agency_id: B, role: 'agency_admin' },
    ];
    // La base renvoie B avant A ; l'agence courante reste A (première appartenance)
    state.agencies = [
      { id: B, name: 'Agence B', logo_url: 'https://cdn.test/b.png', verified: true },
      { id: A, name: 'Agence A', logo_url: null, verified: false },
    ];
    const auth = await getServerAuth();
    expect(auth?.agencyIds[0]).toBe(A);
    expect(auth).toMatchObject({ agencyName: 'Agence A', agencyLogoUrl: null, agencyVerified: false });
  });

  it('aucune agence active : pas de vérification affirmée', async () => {
    state.agencies = [];
    expect(await getServerAuth()).toMatchObject({ agencyIds: [], agencyName: null, agencyVerified: false });
  });
});
