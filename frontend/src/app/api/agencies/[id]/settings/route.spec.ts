import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  denied: null as null | { status: number },
  updates: [] as Record<string, unknown>[],
  row: { id: 'ag-1', duration_discounts: [], motorcycle_duration_discounts: [] } as Record<string, unknown>,
}));

vi.mock('@/lib/auth/access-api', () => ({
  requireAgencyPermissionApi: async () => ({
    auth: mocks.denied ? null : { userId: 'u1' },
    denied: mocks.denied ? NextResponse.json({ success: false }, { status: mocks.denied.status }) : null,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.row, error: null }) }) }),
      update: (payload: Record<string, unknown>) => {
        mocks.updates.push(payload);
        return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...mocks.row, ...payload }, error: null }) }) }) };
      },
    }),
  }),
}));

import { PATCH } from './route';

const patch = (body: unknown) =>
  PATCH(
    new NextRequest('http://localhost/api/agencies/ag-1/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: 'ag-1' }) }
  );

beforeEach(() => {
  mocks.denied = null;
  mocks.updates = [];
});

describe('PATCH /api/agencies/[id]/settings — remises voitures et motos', () => {
  it('refusé sans le droit de modifier l’agence', async () => {
    mocks.denied = { status: 403 };
    expect((await patch({ motorcycle_duration_discounts: [] })).status).toBe(403);
    expect(mocks.updates).toHaveLength(0);
  });

  it('les paliers des motos s’enregistrent seuls, sans toucher à ceux des voitures', async () => {
    const res = await patch({ motorcycle_duration_discounts: [{ min_days: 3, percent: 15 }] });
    expect(res.status).toBe(200);
    expect(mocks.updates).toEqual([{ motorcycle_duration_discounts: [{ min_days: 3, percent: 15 }] }]);
    expect(mocks.updates[0]).not.toHaveProperty('duration_discounts');
  });

  it('les paliers des voitures s’enregistrent seuls, sans toucher à ceux des motos', async () => {
    await patch({ duration_discounts: [{ min_days: 7, percent: 10 }] });
    expect(mocks.updates).toEqual([{ duration_discounts: [{ min_days: 7, percent: 10 }] }]);
    expect(mocks.updates[0]).not.toHaveProperty('motorcycle_duration_discounts');
  });

  it('deux listes différentes dans la même requête : chacune est enregistrée telle quelle, triée par durée', async () => {
    await patch({
      duration_discounts: [{ min_days: 15, percent: 20 }, { min_days: 7, percent: 10 }],
      motorcycle_duration_discounts: [{ min_days: 5, percent: 8 }],
    });
    expect(mocks.updates[0]).toEqual({
      duration_discounts: [{ min_days: 7, percent: 10 }, { min_days: 15, percent: 20 }],
      motorcycle_duration_discounts: [{ min_days: 5, percent: 8 }],
    });
  });

  it('liste vide : « aucune remise » (effaçable séparément)', async () => {
    await patch({ motorcycle_duration_discounts: [] });
    expect(mocks.updates).toEqual([{ motorcycle_duration_discounts: [] }]);
  });

  it.each([
    ['5 paliers', Array.from({ length: 5 }, (_, i) => ({ min_days: 2 + i, percent: 1 + i }))],
    ['remise excessive', [{ min_days: 7, percent: 60 }]],
    ['durée de 1 jour', [{ min_days: 1, percent: 5 }]],
    ['même durée deux fois', [{ min_days: 7, percent: 5 }, { min_days: 7, percent: 10 }]],
    ['remise qui ne progresse pas', [{ min_days: 3, percent: 10 }, { min_days: 7, percent: 5 }]],
    ['champ inconnu', [{ min_days: 7, percent: 10, extra: true }]],
    ['décimale', [{ min_days: 7, percent: 7.5 }]],
  ])('liste des motos refusée (422), rien n’est enregistré : %s', async (_label, tiers) => {
    const res = await patch({ motorcycle_duration_discounts: tiers });
    expect(res.status).toBe(422);
    expect(mocks.updates).toHaveLength(0);
  });

  it('une liste des motos invalide empêche aussi l’enregistrement d’une liste des voitures valide envoyée avec elle', async () => {
    const res = await patch({
      duration_discounts: [{ min_days: 7, percent: 10 }],
      motorcycle_duration_discounts: [{ min_days: 7, percent: 60 }],
    });
    expect(res.status).toBe(422);
    expect(mocks.updates).toHaveLength(0);
  });
});
