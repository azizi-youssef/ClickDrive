import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  agencyRow: null as null | { name: string; logo_url: string | null; verified: boolean | null },
  selected: '',
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('./TrackingShell', () => ({ TrackingShell: () => null }));
vi.mock('@/lib/auth/server', () => ({
  getServerAuth: async () => ({
    userId: 'u1', email: 'a@b.c', displayName: 'Youssef', avatarUrl: null, role: 'AGENCY_OWNER',
    agencyIds: ['11111111-1111-4111-8111-111111111111'], memberships: [], agencyName: 'Atlas', agencyLogoUrl: null, agencyVerified: true,
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async () => ({ data: true, error: null }),
    from: () => ({
      select: (columns: string) => {
        mocks.selected = columns;
        return { eq: () => ({ maybeSingle: async () => ({ data: mocks.agencyRow, error: null }) }) };
      },
    }),
  }),
}));

import { TrackingPageFrame } from './TrackingPageFrame';

const agencyProp = async () => {
  const element = (await TrackingPageFrame({ searchParams: Promise.resolve({}), children: null })) as ReactElement<{
    agency: { name: string; verified: boolean };
  }>;
  return element.props.agency;
};

beforeEach(() => {
  mocks.agencyRow = { name: 'Atlas Rent', logo_url: null, verified: true };
  mocks.selected = '';
});

describe('Suivi GPS — bandeau de l’agence', () => {
  it('lit la vérification réelle de l’agence', async () => {
    expect(await agencyProp()).toMatchObject({ name: 'Atlas Rent', verified: true });
    expect(mocks.selected).toContain('verified');
  });

  it('agence non vérifiée : jamais « vérifiée » (le suivi GPS ne l’affirme plus en dur)', async () => {
    mocks.agencyRow = { name: 'Atlas Rent', logo_url: null, verified: false };
    expect((await agencyProp()).verified).toBe(false);
  });

  it('agence introuvable ou valeur nulle : non vérifiée', async () => {
    mocks.agencyRow = null;
    expect((await agencyProp()).verified).toBe(false);
    mocks.agencyRow = { name: 'Atlas Rent', logo_url: null, verified: null };
    expect((await agencyProp()).verified).toBe(false);
  });
});
