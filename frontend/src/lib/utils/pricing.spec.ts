import { describe, expect, it } from 'vitest';
import {
  applicableDurationDiscount,
  calculateRentalPrice,
  durationDiscountsFor,
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

describe('Remises longue durée : voitures et motos séparées', () => {
  const carTiers = [{ min_days: 7, percent: 10 }];
  const motoTiers = [{ min_days: 3, percent: 5 }, { min_days: 7, percent: 20 }];
  const agency = { duration_discounts: carTiers, motorcycle_duration_discounts: motoTiers };

  it('une voiture reçoit les paliers des voitures, une moto ceux des motos', () => {
    const car = calculateRentalPrice({ daily_price: 300, vehicle_type: 'CAR', agency }, 7);
    expect(car.duration_discount).toEqual({ min_days: 7, percent: 10 });
    expect(car.total).toBe(1890);

    const moto = calculateRentalPrice({ daily_price: 300, vehicle_type: 'MOTORCYCLE', agency }, 7);
    expect(moto.duration_discount).toEqual({ min_days: 7, percent: 20 });
    expect(moto.total).toBe(1680);
  });

  it('un palier des motos ne profite jamais à une voiture, et inversement', () => {
    // 3 jours : seuil des motos (−5 %), pas de seuil pour les voitures (premier palier à 7 jours)
    expect(calculateRentalPrice({ daily_price: 300, vehicle_type: 'CAR', agency }, 3)).toMatchObject({ applied_rate: 'daily', total: 900 });
    expect(calculateRentalPrice({ daily_price: 300, vehicle_type: 'MOTORCYCLE', agency }, 3)).toMatchObject({ applied_rate: 'duration', total: 855 });
  });

  it('le type se déduit de la catégorie quand vehicle_type est absent (anciennes données)', () => {
    expect(calculateRentalPrice({ daily_price: 300, category: 'Scooter', agency }, 7).total).toBe(1680);
    expect(calculateRentalPrice({ daily_price: 300, category: 'SUV', agency }, 7).total).toBe(1890);
    // Sans aucune indication : une voiture
    expect(calculateRentalPrice({ daily_price: 300, agency }, 7).total).toBe(1890);
  });

  it('liste vide des motos = choix de l’agence : aucune remise sur les motos, même si les voitures en ont', () => {
    const noMotoDiscount = { duration_discounts: carTiers, motorcycle_duration_discounts: [] };
    expect(calculateRentalPrice({ daily_price: 300, vehicle_type: 'MOTORCYCLE', agency: noMotoDiscount }, 7)).toMatchObject({
      applied_rate: 'daily',
      total: 2100,
    });
    expect(durationDiscountsFor(noMotoDiscount, { vehicle_type: 'MOTORCYCLE' })).toEqual([]);
  });

  it('base pas encore migrée (colonne des motos absente) : les motos gardent les paliers des voitures, comme avant', () => {
    const legacy = { duration_discounts: carTiers };
    expect(durationDiscountsFor(legacy, { vehicle_type: 'MOTORCYCLE' })).toEqual(carTiers);
    expect(durationDiscountsFor({ ...legacy, motorcycle_duration_discounts: null }, { vehicle_type: 'MOTORCYCLE' })).toEqual(carTiers);
    expect(calculateRentalPrice({ daily_price: 300, vehicle_type: 'MOTORCYCLE', agency: legacy }, 7).total).toBe(1890);
  });

  it('paliers invalides des motos ignorés, jamais remplacés par ceux des voitures', () => {
    const broken = { duration_discounts: carTiers, motorcycle_duration_discounts: [{ min_days: 7, percent: 90 }] };
    expect(durationDiscountsFor(broken, { vehicle_type: 'MOTORCYCLE' })).toEqual([]);
  });

  it('sans agence : aucun palier', () => {
    expect(durationDiscountsFor(null, { vehicle_type: 'MOTORCYCLE' })).toEqual([]);
    expect(durationDiscountsFor(undefined, undefined)).toEqual([]);
  });

  it('pas de cumul avec le tarif semaine, pour les motos aussi : le meilleur prix l’emporte', () => {
    // Tarif semaine 1 500 DH (214 DH/jour) plus avantageux que −20 % (240 DH/jour)
    expect(calculateRentalPrice({ daily_price: 300, weekly_price: 1500, vehicle_type: 'MOTORCYCLE', agency }, 7)).toMatchObject({
      applied_rate: 'weekly',
      total: 1500,
    });
  });
});
