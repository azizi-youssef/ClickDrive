/**
 * Évolution d'un indicateur entre deux périodes : l'écart en valeur absolue, et le pourcentage
 * seulement quand la base est assez grande pour qu'il ait un sens (2 → 3 n'est pas « +50 % »).
 */
export const MIN_BASE_FOR_PERCENT = 10;

export type TrendFigures = {
  delta: number;
  /** null quand la période précédente compte moins de MIN_BASE_FOR_PERCENT éléments */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
};

export function trendFigures(current: number, previous: number): TrendFigures {
  const delta = current - previous;
  // Arrondi symétrique : −7,5 % s'affiche −8 %, comme +7,5 % s'affiche +8 %
  const ratio = (delta / previous) * 100;
  const percent = previous >= MIN_BASE_FOR_PERCENT ? Math.sign(ratio) * Math.round(Math.abs(ratio)) : null;
  return { delta, percent, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** « +12 (+25 %) », « +1 », « −3 (−8 %) », « stable » */
export function formatTrend({ delta, percent }: TrendFigures): string {
  if (delta === 0) return 'stable';
  const sign = delta > 0 ? '+' : '−';
  const absolute = `${sign}${nf.format(Math.abs(delta))}`;
  return percent === null ? absolute : `${absolute} (${percent > 0 ? '+' : percent < 0 ? '−' : ''}${nf.format(Math.abs(percent))} %)`;
}
