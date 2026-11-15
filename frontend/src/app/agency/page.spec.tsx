import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: null as null | Record<string, unknown>,
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/components/agency/AgencyWorkspace', () => ({ AgencyWorkspace: () => null }));
vi.mock('@/lib/auth/server', () => ({
  getServerAuth: async () => mocks.auth,
  canAccessAgencyArea: (auth: { agencyIds: string[] }) => auth.agencyIds.length > 0,
  hasAccessPermission: async () => false,
}));

import AgencyPage from './page';

const baseAuth = {
  userId: 'u1',
  email: 'a@b.c',
  displayName: 'Youssef',
  avatarUrl: null,
  role: 'AGENCY_OWNER',
  agencyIds: ['ag-1'],
  memberships: [],
  agencyName: 'Atlas Rent',
  agencyLogoUrl: null,
};

/** Propriétés passées à AgencyWorkspace (la page l'enveloppe dans un Suspense) */
async function workspaceProps() {
  const root = (await AgencyPage()) as ReactElement<{ children: ReactElement<{ agency: { verified: boolean; name: string; id: string } }> }>;
  return root.props.children.props;
}

beforeEach(() => {
  mocks.auth = { ...baseAuth, agencyVerified: true };
  mocks.redirect.mockClear();
});

describe('Page /agency — identité de l’agence', () => {
  it('agence vérifiée : « vérifiée »', async () => {
    expect((await workspaceProps()).agency).toMatchObject({ id: 'ag-1', name: 'Atlas Rent', verified: true });
  });

  it('agence active mais non vérifiée : jamais présentée comme vérifiée', async () => {
    mocks.auth = { ...baseAuth, agencyVerified: false };
    expect((await workspaceProps()).agency.verified).toBe(false);
  });

  it('sans session : retour à la connexion du portail agence', async () => {
    mocks.auth = null;
    await expect(AgencyPage()).rejects.toThrow('REDIRECT:/login?portal=agency&error=forbidden');
  });
});
