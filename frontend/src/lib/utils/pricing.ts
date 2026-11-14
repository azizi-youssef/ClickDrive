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

/* -------------------------------------------------------------------------- */
/* Remises longue durée de l'agence                                           */
/* -------------------------------------------------------------------------- */

/** Palier de remise selon la durée, défini par l'agence pour toute sa flotte (« −10 % dès 7 jours ») */
export interface DurationDiscount {
  min_days: number;
  percent: number;
}

/** Bornes communes à l'API, à la base (contrainte CHECK) et au formulaire de l'agence */
export const DURATION_DISCOUNT_RULES = { maxTiers: 4, minDays: 2, maxDays: 90, minPercent: 1, maxPercent: 50 } as const;

function isValidTier(value: unknown): value is DurationDiscount {
  if (!value || typeof value !== 'object') return false;
  const { min_days, percent } = value as Record<string, unknown>;
  const R = DURATION_DISCOUNT_RULES;
  return (
    Number.isInteger(min_days) &&
    Number.isInteger(percent) &&
    (min_days as number) >= R.minDays &&
    (min_days as number) <= R.maxDays &&
    (percent as number) >= R.minPercent &&
    (percent as number) <= R.maxPercent
  );
}

/** Paliers valides, triés par durée ; toute entrée hors règles est ignorée (jamais de remise inventée) */
export function normalizeDurationDiscounts(value: unknown): DurationDiscount[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isValidTier)
    .map(({ min_days, percent }) => ({ min_days, percent }))
    .sort((a, b) => a.min_days - b.min_days)
    .slice(0, DURATION_DISCOUNT_RULES.maxTiers);
}

/** Incohérence d'une liste de paliers saisie par l'agence (mêmes règles côté formulaire et API), ou null */
export function durationDiscountsIssue(tiers: readonly DurationDiscount[]): string | null {
  const R = DURATION_DISCOUNT_RULES;
  if (tiers.length > R.maxTiers) return `${R.maxTiers} paliers au maximum.`;
  for (const tier of tiers) {
    if (!Number.isInteger(tier.min_days) || tier.min_days < R.minDays || tier.min_days > R.maxDays) {
      return `Durée d’un palier : de ${R.minDays} à ${R.maxDays} jours.`;
    }
    if (!Number.isInteger(tier.percent) || tier.percent < R.minPercent || tier.percent > R.maxPercent) {
      return `Remise d’un palier : de ${R.minPercent} à ${R.maxPercent} %.`;
    }
  }
  const sorted = [...tiers].sort((a, b) => a.min_days - b.min_days);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.min_days === sorted[i - 1]!.min_days) return 'Deux paliers ont la même durée.';
    if (sorted[i]!.percent <= sorted[i - 1]!.percent) {
      return 'Chaque palier doit offrir une remise plus forte que le palier plus court.';
    }
  }
  return null;
}

/** Palier atteint pour une durée de location (la plus forte remise parmi les seuils atteints), ou null */
export function applicableDurationDiscount(value: unknown, days: number): DurationDiscount | null {
  return normalizeDurationDiscounts(value)
    .filter((tier) => days >= tier.min_days)
    .reduce<DurationDiscount | null>((best, tier) => (!best || tier.percent > best.percent ? tier : best), null);
}

/* -------------------------------------------------------------------------- */
/* Tarif appliqué à une location                                              */
/* -------------------------------------------------------------------------- */

/** Tarifs d'un véhicule tels que saisis par l'agence (semaine = 7 jours, mois = 30 jours) */
export interface VehicleRates {
  daily_price: number;
  weekly_price?: number | null;
  monthly_price?: number | null;
  /**
   * Agence du véhicule : ses remises longue durée s'appliquent. Côté serveur, le véhicule et son agence
   * sont relus en base : un client ne peut pas imposer une remise.
   */
  agency?: { duration_discounts?: unknown } | null;
}

export type AppliedRate = 'daily' | 'weekly' | 'monthly' | 'duration';

/**
 * Prix par jour appliqué à une location : tarif mois dès 30 jours, tarif semaine dès 7 jours,
 * ramenés à la journée. Un tarif plus cher que le prix par jour est ignoré (jamais au détriment du client).
 * La remise longue durée de l'agence ne se cumule pas : elle n'est retenue que si elle donne un meilleur prix.
 */
export function effectiveDailyRate(
  rates: VehicleRates,
  days: number
): { rate: number; applied: AppliedRate; discount?: DurationDiscount } {
  const daily = Math.max(0, Number(rates.daily_price) || 0);
  const weekly = Number(rates.weekly_price) > 0 ? Number(rates.weekly_price) / 7 : null;
  const monthly = Number(rates.monthly_price) > 0 ? Number(rates.monthly_price) / 30 : null;
  let base: { rate: number; applied: AppliedRate } = { rate: daily, applied: 'daily' };
  if (days >= 30 && monthly !== null && monthly < daily) base = { rate: Math.round(monthly * 100) / 100, applied: 'monthly' };
  else if (days >= 7 && weekly !== null && weekly < daily) base = { rate: Math.round(weekly * 100) / 100, applied: 'weekly' };

  const tier = applicableDurationDiscount(rates.agency?.duration_discounts, days);
  if (tier) {
    const discounted = Math.round(daily * (100 - tier.percent)) / 100;
    if (discounted < base.rate) return { rate: discounted, applied: 'duration', discount: tier };
  }
  return base;
}

/**
 * Prix d'une location avec les tarifs semaine et mois du véhicule et les remises longue durée de l'agence
 * (même calcul côté client et serveur). `full_price` : prix sans aucune réduction, pour afficher l'économie.
 */
export function calculateRentalPrice(
  rates: VehicleRates,
  number_of_days: number,
  commission_rate: number = 0.0
): BookingPriceCalculation & { applied_rate: AppliedRate; duration_discount: DurationDiscount | null; full_price: number } {
  const days = Math.max(1, Math.round(Number(number_of_days) || 1));
  const { rate, applied, discount } = effectiveDailyRate(rates, days);
  const full_price = Math.round(Math.max(0, Number(rates.daily_price) || 0) * days);
  return {
    ...calculateBookingPrice(rate, days, commission_rate),
    applied_rate: applied,
    duration_discount: discount ?? null,
    full_price,
  };
}
