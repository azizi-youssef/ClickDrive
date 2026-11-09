import { describe, expect, it } from 'vitest';
import { calculateRentalPrice, effectiveDailyRate } from './pricing';

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
