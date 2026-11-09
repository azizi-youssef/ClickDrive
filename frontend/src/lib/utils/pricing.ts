/**
 * ClickDrive Centralized Financial Engine
 * Calculates booking prices, commission amounts, and agency payouts.
 * 
 * Rules (Modèle Abonnement Mensuel par Capacité) :
 * - Le modèle économique repose sur un abonnement mensuel fixe selon la flotte.
 * - Le taux de commission par défaut sur les réservations est de 0% (les agences conservent 100%).
 * - subtotal = daily_price * number_of_days
 * - commission_amount = round(subtotal * commission_rate / 100) (0 DH par défaut)
 * - agency_amount = subtotal - commission_amount
 */

export interface BookingPriceCalculation {
  daily_price: number;
  number_of_days: number;
  subtotal: number;
  commission_rate: number;
  commission_amount: number;
  agency_amount: number;
  total: number;
}

export function calculateBookingPrice(
  daily_price: number,
  number_of_days: number,
  commission_rate: number = 0.00
): BookingPriceCalculation {
  const safeDailyPrice = Math.max(0, Number(daily_price) || 0);
  const safeDays = Math.max(1, Math.round(Number(number_of_days) || 1));
  const safeRate = Math.max(0, Math.min(100, Number(commission_rate) || 0.00));

  const subtotal = Math.round(safeDailyPrice * safeDays);
  // Arrondi au Dirham supérieur ou le plus proche pour une précision financière nette
  const commission_amount = Math.round((subtotal * safeRate) / 100);
  const agency_amount = subtotal - commission_amount;
  const total = subtotal;

  return {
    daily_price: safeDailyPrice,
    number_of_days: safeDays,
    subtotal,
    commission_rate: safeRate,
    commission_amount,
    agency_amount,
    total,
  };
}

export function calculateRentalDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

/** Tarifs d'un véhicule tels que saisis par l'agence (semaine = 7 jours, mois = 30 jours) */
export interface VehicleRates {
  daily_price: number;
  weekly_price?: number | null;
  monthly_price?: number | null;
}

export type AppliedRate = 'daily' | 'weekly' | 'monthly';

/**
 * Prix par jour appliqué à une location : tarif mois dès 30 jours, tarif semaine dès 7 jours,
 * ramenés à la journée. Un tarif plus cher que le prix par jour est ignoré (jamais au détriment du client).
 */
export function effectiveDailyRate(rates: VehicleRates, days: number): { rate: number; applied: AppliedRate } {
  const daily = Math.max(0, Number(rates.daily_price) || 0);
  const weekly = Number(rates.weekly_price) > 0 ? Number(rates.weekly_price) / 7 : null;
  const monthly = Number(rates.monthly_price) > 0 ? Number(rates.monthly_price) / 30 : null;
  if (days >= 30 && monthly !== null && monthly < daily) return { rate: Math.round(monthly * 100) / 100, applied: 'monthly' };
  if (days >= 7 && weekly !== null && weekly < daily) return { rate: Math.round(weekly * 100) / 100, applied: 'weekly' };
  return { rate: daily, applied: 'daily' };
}

/** Prix d'une location avec les tarifs semaine et mois de l'agence (même calcul côté client et serveur) */
export function calculateRentalPrice(
  rates: VehicleRates,
  number_of_days: number,
  commission_rate: number = 0.0
): BookingPriceCalculation & { applied_rate: AppliedRate } {
  const days = Math.max(1, Math.round(Number(number_of_days) || 1));
  const { rate, applied } = effectiveDailyRate(rates, days);
  return { ...calculateBookingPrice(rate, days, commission_rate), applied_rate: applied };
}
