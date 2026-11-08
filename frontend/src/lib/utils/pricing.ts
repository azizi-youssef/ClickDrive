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
