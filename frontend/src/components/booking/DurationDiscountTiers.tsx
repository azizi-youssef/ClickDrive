'use client';

import { BadgePercent, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatNumber } from '@/lib/i18n/format';
import type { DurationDiscount } from '@/lib/utils/pricing';
import { reachableNextTier, tierState, type PriceReduction } from '@/lib/utils/promotion';

/**
 * Remises longue durée de l'agence, en paliers : chaque palier est une marche (pourcentage en grand,
 * condition en dessous). Le palier appliqué est rempli et coché (jamais la couleur seule), les paliers
 * dépassés s'effacent, les suivants restent annoncés. Sous les marches : l'économie réelle sur la période
 * et, s'il est à portée, ce qu'il manque pour le palier suivant.
 */
export function DurationDiscountTiers({
  tiers,
  applied,
  days,
  showNext,
  reduction,
}: {
  /** Paliers valides, triés par durée */
  tiers: DurationDiscount[];
  /** Palier réellement appliqué (meilleur prix), ou null */
  applied: DurationDiscount | null;
  days: number;
  /** Faux tant que les dates sont invalides : pas d'invitation chiffrée */
  showNext: boolean;
  /** Économie obtenue grâce au palier appliqué (montants de la période), ou null */
  reduction?: PriceReduction | null;
}) {
  const { t, locale, fmt, plural, money } = useTranslation();
  const c = t.booking.card;
  if (tiers.length === 0) return null;
  const next = showNext ? reachableNextTier(tiers, days) : null;
  const saving = applied && reduction?.kind === 'duration' ? reduction : null;

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-900">
        <BadgePercent className="h-4 w-4 shrink-0" aria-hidden="true" />
        {c.durationTitle}
      </p>

      <ul className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-1.5">
        {tiers.map((tier) => {
          const state = tierState(tier, applied, days);
          const percent = formatNumber(tier.percent, locale);
          const minDays = formatNumber(tier.min_days, locale);
          return (
            <li
              key={tier.min_days}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition-colors',
                state === 'applied' && 'border-emerald-700 bg-emerald-700 text-white shadow-[0_6px_14px_-8px_rgba(4,120,87,0.8)]',
                state === 'passed' && 'border-emerald-100 bg-white/60 text-emerald-900/55',
                state === 'upcoming' && 'border-dashed border-emerald-300 bg-white text-emerald-900'
              )}
            >
              {/* Texte complet pour les lecteurs d'écran ; affichage en deux lignes à l'écran */}
              <span className="sr-only">
                {fmt(c.durationTier, { percent, days: minDays })}
                {state === 'applied' && <span> {c.durationActive}</span>}
              </span>
              {state === 'applied' && (
                <Check className="absolute end-1 top-1 h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span aria-hidden="true" className="text-[15px] font-extrabold leading-tight tabular-nums">
                {fmt(c.durationTierPercent, { percent })}
              </span>
              <span aria-hidden="true" className={cn('text-[11px] font-semibold', state === 'applied' ? 'text-emerald-50' : undefined)}>
                {fmt(c.durationTierFrom, { days: minDays })}
              </span>
            </li>
          );
        })}
      </ul>

      {saving && (
        <p className="mt-2.5 text-[13px] text-emerald-900">
          <strong className="font-extrabold">{fmt(c.durationSaved, { amount: money(saving.saving) })}</strong>
          <span className="text-emerald-800">
            {' · '}
            {fmt(c.durationInsteadOf, { total: money(saving.total), full: money(saving.full) })}
          </span>
        </p>
      )}
      {next && (
        <p className="mt-1.5 text-xs font-medium text-emerald-900">
          {fmt(c.durationNext, {
            days: plural(next.min_days - days, c.days),
            percent: formatNumber(next.percent, locale),
          })}
        </p>
      )}
    </div>
  );
}
