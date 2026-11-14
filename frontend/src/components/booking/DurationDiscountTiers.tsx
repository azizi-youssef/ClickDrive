'use client';

import { BadgePercent, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatNumber } from '@/lib/i18n/format';
import type { DurationDiscount } from '@/lib/utils/pricing';

/**
 * Remises longue durée de l'agence, présentées en paliers : le palier appliqué à la durée choisie est
 * mis en avant (coche + texte, jamais la couleur seule) et le client voit combien de jours lui manquent
 * pour le palier suivant.
 */
export function DurationDiscountTiers({
  tiers,
  applied,
  days,
  showNext,
}: {
  /** Paliers valides, triés par durée */
  tiers: DurationDiscount[];
  /** Palier réellement appliqué (meilleur prix), ou null */
  applied: DurationDiscount | null;
  days: number;
  /** Faux tant que les dates sont invalides : pas d'invitation chiffrée */
  showNext: boolean;
}) {
  const { t, locale, fmt, plural } = useTranslation();
  const c = t.booking.card;
  if (tiers.length === 0) return null;
  const next = showNext ? tiers.find((tier) => tier.min_days > days) : undefined;

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-900">
        <BadgePercent className="h-4 w-4 shrink-0" aria-hidden="true" />
        {c.durationTitle}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {tiers.map((tier) => {
          const active = applied?.min_days === tier.min_days;
          return (
            <li
              key={tier.min_days}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums',
                active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-emerald-200 bg-white text-emerald-900'
              )}
            >
              {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {fmt(c.durationTier, { percent: formatNumber(tier.percent, locale), days: formatNumber(tier.min_days, locale) })}
              {active && <span className="sr-only"> {c.durationActive}</span>}
            </li>
          );
        })}
      </ul>
      {next && (
        <p className="mt-2 text-xs font-medium text-emerald-900">
          {fmt(c.durationNext, {
            days: plural(next.min_days - days, c.days),
            percent: formatNumber(next.percent, locale),
          })}
        </p>
      )}
    </div>
  );
}
