import type { AppliedRate, DurationDiscount } from './pricing';

/**
 * Présentation des promotions (remises longue durée de l'agence, tarifs semaine et mois) : une seule
 * règle pour le catalogue et la fiche. Calculs purs, à partir du résultat de calculateRentalPrice().
 */

export type PriceReduction = {
  kind: Exclude<AppliedRate, 'daily'>;
  /** Pourcentage annoncé : celui du palier pour une remise, l'économie réelle arrondie pour un tarif */
  percent: number;
  /** Économie en dirhams par rapport au prix du jour × durée */
  saving: number;
  /** Prix du jour × durée (prix barré) */
  full: number;
  /** Montant après réduction */
  total: number;
};

type PriceLike = {
  applied_rate: AppliedRate;
  full_price: number;
  subtotal: number;
  duration_discount: DurationDiscount | null;
};

/** Réduction réellement obtenue sur la période, ou null (tarif du jour, ou aucune économie) */
export function priceReduction(price: PriceLike): PriceReduction | null {
  if (price.applied_rate === 'daily') return null;
  const full = Math.round(price.full_price);
  const total = Math.round(price.subtotal);
  const saving = full - total;
  if (!(full > 0) || !(saving > 0)) return null;
  const percent =
    price.applied_rate === 'duration' && price.duration_discount
      ? price.duration_discount.percent
      : Math.round((saving / full) * 100);
  return { kind: price.applied_rate, percent, saving, full, total };
}

/**
 * Palier suivant annoncé seulement s'il est à portée : au plus une semaine de plus, ou au plus la durée
 * déjà choisie (« encore 22 jours » pour une location de 8 jours ne serait qu'un bruit).
 */
export function reachableNextTier(tiers: readonly DurationDiscount[], days: number): DurationDiscount | null {
  const next = tiers.find((tier) => tier.min_days > days);
  if (!next) return null;
  return next.min_days - days <= Math.max(7, days) ? next : null;
}

/** État d'un palier pour la durée choisie : appliqué (meilleur palier atteint), dépassé, ou à venir */
export type TierState = 'applied' | 'passed' | 'upcoming';

export function tierState(tier: DurationDiscount, applied: DurationDiscount | null, days: number): TierState {
  if (applied && tier.min_days === applied.min_days) return 'applied';
  return tier.min_days <= days ? 'passed' : 'upcoming';
}
