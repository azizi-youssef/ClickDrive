import { describe, expect, it } from 'vitest';
import {
  applicableDurationDiscount,
  calculateRentalPrice,
  durationDiscountsIssue,
  effectiveDailyRate,
  normalizeDurationDiscounts,
} from './pricing';

const rates = { daily_price: 350, weekly_price: 2100, monthly_price: 7500 };

describe('Tarifs semaine et mois des agences', () => {
  it('prix par jour sous 7 jours, tarif semaine dès 7 jours, tarif mois dès 30 jours', () => {
    expect(effectiveDailyRate(rates, 6)).toEqual({ rate: 350, applied: 'daily' });
    expect(effectiveDailyRate(rates, 7)).toEqual({ rate: 300, applied: 'weekly' });
    expect(effectiveDailyRate(rates, 30)).toEqual({ rate: 250, applied: 'monthly' });
  });

  it('total : 7 jours au tarif semaine = le tarif semaine ; 10 jours ramenés à la journée', () => {
    expect(calculateRentalPrice(rates, 7).total).toBe(2100);
    expect(calculateRentalPrice(rates, 10).total).toBe(3000);
    expect(calculateRentalPrice(rates, 3).total).toBe(1050);
  });

  it('un tarif semaine plus cher que le prix par jour est ignoré ; sans tarif : prix par jour', () => {
    expect(effectiveDailyRate({ daily_price: 300, weekly_price: 2500 }, 7)).toEqual({ rate: 300, applied: 'daily' });
    expect(effectiveDailyRate({ daily_price: 300 }, 40)).toEqual({ rate: 300, applied: 'daily' });
    expect(calculateRentalPrice({ daily_price: 300, weekly_price: null, monthly_price: null }, 8).applied_rate).toBe('daily');
  });
});

describe('Remises longue durée de l’agence', () => {
  const tiers = [
    { min_days: 3, percent: 5 },
    { min_days: 7, percent: 10 },
    { min_days: 15, percent: 15 },
  ];
  const withAgency = (rates: object) => ({ daily_price: 300, ...rates, agency: { duration_discounts: tiers } });

  it('palier atteint : la plus forte remise parmi les seuils atteints', () => {
    expect(applicableDurationDiscount(tiers, 2)).toBeNull();
    expect(applicableDurationDiscount(tiers, 3)).toEqual({ min_days: 3, percent: 5 });
    expect(applicableDurationDiscount(tiers, 10)).toEqual({ min_days: 7, percent: 10 });
    expect(applicableDurationDiscount(tiers, 40)).toEqual({ min_days: 15, percent: 15 });
  });

  it('remise appliquée au prix par jour, total et économie', () => {
    const price = calculateRentalPrice(withAgency({}), 7);
    expect(price.applied_rate).toBe('duration');
    expect(price.duration_discount).toEqual({ min_days: 7, percent: 10 });
    expect(price.daily_price).toBe(270);
    expect(price.total).toBe(1890);
    expect(price.full_price).toBe(2100);
    // Sous le premier seuil : prix plein
    expect(calculateRentalPrice(withAgency({}), 2)).toMatchObject({ applied_rate: 'daily', total: 600, duration_discount: null });
  });

  it('pas de cumul : le meilleur prix entre tarif semaine/mois et remise longue durée', () => {
    // Tarif semaine 1 800 DH (257,14 DH/jour) plus avantageux que −10 % (270 DH/jour)
    expect(calculateRentalPrice(withAgency({ weekly_price: 1800 }), 7)).toMatchObject({ applied_rate: 'weekly', total: 1800 });
    // Tarif semaine 2 000 DH (285,71 DH/jour) moins avantageux que −10 %
    expect(calculateRentalPrice(withAgency({ weekly_price: 2000 }), 7)).toMatchObject({ applied_rate: 'duration', total: 1890 });
  });

  it('sans agence ou sans paliers : comportement inchangé', () => {
    expect(effectiveDailyRate({ daily_price: 300 }, 10)).toEqual({ rate: 300, applied: 'daily' });
    expect(effectiveDailyRate({ daily_price: 300, agency: { duration_discounts: [] } }, 10)).toEqual({ rate: 300, applied: 'daily' });
    expect(effectiveDailyRate({ daily_price: 300, agency: null }, 10)).toEqual({ rate: 300, applied: 'daily' });
  });

  it('données invalides ignorées : jamais de remise inventée ni excessive', () => {
    expect(
      normalizeDurationDiscounts([
        { min_days: 7, percent: 90 },
        { min_days: 1, percent: 5 },
        { min_days: '7', percent: 10 },
        null,
        { min_days: 10, percent: 12 },
      ])
    ).toEqual([{ min_days: 10, percent: 12 }]);
    expect(normalizeDurationDiscounts('[{"min_days":7}]')).toEqual([]);
  });

  it('cohérence exigée à l’enregistrement : bornes, doublons, progression', () => {
    expect(durationDiscountsIssue(tiers)).toBeNull();
    expect(durationDiscountsIssue([])).toBeNull();
    expect(durationDiscountsIssue([{ min_days: 1, percent: 5 }])).toMatch(/de 2 à 90 jours/);
    expect(durationDiscountsIssue([{ min_days: 7, percent: 60 }])).toMatch(/de 1 à 50 %/);
    expect(durationDiscountsIssue([{ min_days: 7, percent: 5 }, { min_days: 7, percent: 10 }])).toMatch(/même durée/);
    expect(durationDiscountsIssue([{ min_days: 3, percent: 10 }, { min_days: 7, percent: 5 }])).toMatch(/plus forte/);
    expect(durationDiscountsIssue(Array.from({ length: 5 }, (_, i) => ({ min_days: 2 + i, percent: 1 + i })))).toMatch(/4 paliers/);
  });
});
