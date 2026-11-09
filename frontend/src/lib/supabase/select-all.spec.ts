import { describe, expect, it } from 'vitest';
import { selectAll } from './select-all';

describe('Lecture paginée (plafond de l’API Supabase)', () => {
  it('enchaîne les pages jusqu’à la dernière, incomplète', async () => {
    const table = Array.from({ length: 2_350 }, (_, id) => ({ id }));
    const calls: [number, number][] = [];
    const rows = await selectAll(async (from, to) => {
      calls.push([from, to]);
      return { data: table.slice(from, to + 1), error: null };
    });
    expect(rows).toHaveLength(2_350);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('table vide ou multiple exact de la page : une page vide en plus, pas de boucle infinie', async () => {
    expect(await selectAll(async () => ({ data: [], error: null }))).toEqual([]);
    const exact = Array.from({ length: 4 }, (_, id) => ({ id }));
    expect(await selectAll(async (from, to) => ({ data: exact.slice(from, to + 1), error: null }), 2)).toHaveLength(4);
  });

  it('erreur de la base : levée, jamais un résultat partiel', async () => {
    await expect(
      selectAll(async (from) => (from === 0 ? { data: [{ id: 1 }], error: null } : { data: null, error: { message: 'timeout' } }), 1)
    ).rejects.toThrow('timeout');
  });
});
