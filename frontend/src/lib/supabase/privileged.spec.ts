import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  admin: null as unknown,
  throws: false,
}));

vi.mock('./server', () => ({
  createAdminClient: async () => {
    if (state.throws) throw new Error('[Supabase] SUPABASE_SERVICE_ROLE_KEY manquant en production.');
    return state.admin;
  },
}));

import { PrivilegedAccessUnavailableError, requireServiceRoleClient } from './privileged';
import { serverError } from '@/lib/api/server-error';

beforeEach(() => {
  state.admin = null;
  state.throws = false;
});

describe('requireServiceRoleClient', () => {
  it('renvoie le client service-role configuré', async () => {
    state.admin = { from: () => null };
    await expect(requireServiceRoleClient('test')).resolves.toBe(state.admin);
  });

  it('clé absente (développement) : erreur explicite, jamais de repli', async () => {
    const error = await requireServiceRoleClient('bookings.approve').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PrivilegedAccessUnavailableError);
    expect((error as PrivilegedAccessUnavailableError).operation).toBe('bookings.approve');
  });

  it('clé absente (production) : même erreur neutre, sans le nom de la variable', async () => {
    state.throws = true;
    const error = (await requireServiceRoleClient('x').catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(PrivilegedAccessUnavailableError);
    expect(error.message).not.toMatch(/SUPABASE|SERVICE_ROLE/);
  });
});

describe('serverError', () => {
  it('service sécurisé indisponible : 503', async () => {
    const response = serverError(new PrivilegedAccessUnavailableError('op'), 'test');
    expect(response.status).toBe(503);
  });

  it('autre erreur : 500 avec message neutre (détail journalisé côté serveur seulement)', async () => {
    const response = serverError(new Error('relation "vehicles" does not exist'), 'test');
    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain('relation');
  });
});
