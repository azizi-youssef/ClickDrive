import { describe, expect, it } from 'vitest';
import { calculateRentalPrice } from './pricing';
import { priceReduction, reachableNextTier, tierState } from './promotion';

const tiers = [
  { min_days: 3, percent: 5 },
  { min_days: 7, percent: 10 },
  { min_days: 30, percent: 20 },
];

describe('priceReduction : une seule règle pour les remises et les tarifs semaine / mois', () => {
  it('remise longue durée : pourcentage du palier, prix barré et économie', () => {
    expect(priceReduction({ applied_rate: 'duration', duration_discount: { min_days: 7, percent: 10 }, full_price: 2800, subtotal: 2520 })).toEqual({
      kind: 'duration',
      percent: 10,
      saving: 280,
      full: 2800,
      total: 2520,
    });
  });

  it('tarif semaine (calcul réel) : l’économie réelle devient le pourcentage annoncé', () => {
    // 550 DH / jour, 3 300 DH / semaine, 8 jours : 3 771 DH au lieu de 4 400 DH
    expect(priceReduction(calculateRentalPrice({ daily_price: 550, weekly_price: 3300 }, 8))).toEqual({
      kind: 'weekly',
      percent: 14,
      saving: 629,
      full: 4400,
      total: 3771,
    });
  });

  it('tarif du jour, ou tarif « réduit » qui ne fait rien gagner : aucune promotion affichée', () => {
    expect(priceReduction({ applied_rate: 'daily', duration_discount: null, full_price: 900, subtotal: 900 })).toBeNull();
    expect(priceReduction({ applied_rate: 'weekly', duration_discount: null, full_price: 2100, subtotal: 2100 })).toBeNull();
    expect(priceReduction({ applied_rate: 'monthly', duration_discount: null, full_price: 0, subtotal: 0 })).toBeNull();
  });
});

describe('reachableNextTier : le palier suivant n’est annoncé que s’il est à portée', () => {
  it('à une semaine ou moins : annoncé', () => {
    expect(reachableNextTier(tiers, 3)).toEqual({ min_days: 7, percent: 10 });
    expect(reachableNextTier(tiers, 1)).toEqual({ min_days: 3, percent: 5 });
  });

  it('plus loin que la durée déjà choisie et qu’une semaine : pas d’invitation', () => {
    expect(reachableNextTier(tiers, 8)).toBeNull(); // encore 22 jours
  });

  it('location déjà longue : l’écart toléré grandit avec elle', () => {
    expect(reachableNextTier(tiers, 20)).toEqual({ min_days: 30, percent: 20 }); // encore 10 jours
  });

  it('dernier palier atteint : rien à annoncer', () => {
    expect(reachableNextTier(tiers, 30)).toBeNull();
  });
});

describe('tierState', () => {
  it('appliqué, dépassé ou à venir selon la durée', () => {
    const applied = { min_days: 7, percent: 10 };
    expect(tiers.map((tier) => tierState(tier, applied, 8))).toEqual(['passed', 'applied', 'upcoming']);
    expect(tiers.map((tier) => tierState(tier, null, 2))).toEqual(['upcoming', 'upcoming', 'upcoming']);
  });
});
