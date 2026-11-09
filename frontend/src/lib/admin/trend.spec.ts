import { describe, expect, it } from 'vitest';
import { formatTrend, trendFigures } from './trend';

describe('Évolution d’un indicateur', () => {
  it('petite base : écart absolu seulement, jamais « +50 % » pour 2 → 3', () => {
    expect(trendFigures(3, 2)).toEqual({ delta: 1, percent: null, direction: 'up' });
    expect(formatTrend(trendFigures(3, 2))).toBe('+1');
  });

  it('base suffisante : écart et pourcentage', () => {
    expect(trendFigures(60, 48)).toEqual({ delta: 12, percent: 25, direction: 'up' });
    expect(formatTrend(trendFigures(60, 48))).toBe('+12 (+25 %)');
    expect(formatTrend(trendFigures(37, 40))).toBe('−3 (−8 %)');
  });

  it('aucune variation : « stable »', () => {
    expect(trendFigures(15, 15).direction).toBe('flat');
    expect(formatTrend(trendFigures(15, 15))).toBe('stable');
    expect(formatTrend(trendFigures(0, 0))).toBe('stable');
  });
});
