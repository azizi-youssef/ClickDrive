'use client';

import { useId, useState, type ReactNode } from 'react';
import { BarChart3, Minus, Table2, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heading } from '@/lib/design/tokens';
import {
  ANALYTICS_PRESETS,
  comparisonBadge,
  formatCompact,
  formatCount,
  formatDuration,
  formatMetric,
  formatMoney,
  funnelOutcomes,
  funnelSteps,
  monthLabel,
  percentOf,
  rangeError,
  resolveAnalyticsRange,
  type AnalyticsPreset,
  type MetricComparison,
} from '@/lib/analytics/insights';
import type { AnalyticsTotals, BreakdownRow, MonthlyPoint, MrrMonth } from '@/lib/analytics/report';

/*
 * Composants des écrans « Statistiques » (espaces agence et Super-Admin).
 * Graphiques en HTML/CSS : une couleur par série (confirmées en vert, le reste en gris, repère
 * « un an plus tôt » en trait foncé), valeurs écrites, info-bulle au survol, et toujours un tableau
 * (lecteur d'écran en permanence, visible d'un clic) : la couleur et le survol ne sont jamais seuls
 * à porter l'information.
 */

const INK = 'bg-ink';

/** Info-bulle d'une colonne : alignée sur les bords pour les colonnes extrêmes (la carte rogne ce qui dépasse) */
function tooltipAlign(index: number, count: number): string {
  if (index < 2) return 'left-0';
  if (index >= count - 2) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}
const CONFIRMED = 'bg-emerald-700';
const REST = 'bg-slate-300';

/* ── Carte, tableau de données, états ────────────────────────────────── */

export type DataTableProps = {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  /** Colonnes numériques (alignées à droite), par index */
  numeric?: readonly number[];
};

export function DataTable({ caption, columns, rows, numeric = [] }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
          <tr>
            {columns.map((column, index) => (
              <th key={column} scope="col" className={cn('px-4 py-2.5', numeric.includes(index) && 'text-right')}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className="px-4 py-2.5 font-semibold text-slate-800">
                    {cell}
                  </th>
                ) : (
                  <td key={index} className={cn('px-4 py-2.5 text-slate-700', numeric.includes(index) && 'text-right tabular-nums')}>
                    {cell}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Carte de graphique. Avec `table` : bouton « Tableau / Graphique », et le tableau reste lisible par
 * les lecteurs d'écran quand le graphique est affiché (le graphique lui-même est décoratif pour eux).
 */
export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  action,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  table?: DataTableProps;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 id={headingId} className={cn('flex items-center gap-2', heading.block)}>
            {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((value) => !value)}
              aria-pressed={showTable}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {showTable ? <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Table2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {showTable ? 'Graphique' : 'Tableau'}
            </button>
          )}
        </div>
      </div>
      {table && showTable ? (
        <DataTable {...table} />
      ) : (
        <>
          <div className="flex-1 p-5" aria-hidden={table ? true : undefined}>
            {children}
          </div>
          {table && (
            <div className="sr-only">
              <DataTable {...table} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-slate-500">{children}</p>;
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement des statistiques">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 motion-reduce:animate-none" />
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/* ── Comparaison et tuiles ───────────────────────────────────────────── */

export function ComparisonPill({ metric, suffix = 'vs période préc.' }: { metric: MetricComparison; suffix?: string }) {
  const badge = comparisonBadge(metric);
  if (!badge) return <span className="text-[11px] text-slate-400">Pas de comparaison</span>;
  const Icon = badge.direction === 'up' ? TrendingUp : badge.direction === 'down' ? TrendingDown : Minus;
  return (
    <span
      title={`${formatMetric(metric.unit, metric.current)} contre ${formatMetric(metric.unit, metric.previous)} sur la période précédente`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
        badge.tone === 'good' ? 'bg-emerald-50 text-emerald-700' : badge.tone === 'bad' ? 'bg-red-50 text-action-hover' : 'bg-slate-100 text-slate-500'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {badge.text} {suffix}
    </span>
  );
}

export function StatTile({
  label,
  metric,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  metric?: MetricComparison;
  /** Valeur affichée (sinon : la valeur de `metric`, formatée) */
  value?: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-[13px] font-semibold leading-snug text-slate-500">{label}</p>
        {Icon && (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-[28px]">
        {value ?? (metric ? formatMetric(metric.unit, metric.current) : '—')}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5">
        {metric && <ComparisonPill metric={metric} />}
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
    </article>
  );
}

/* ── Tendance mensuelle ──────────────────────────────────────────────── */

/** Libellé d'axe : initiale du mois sur petit écran (12 colonnes), « oct. 26 » au-delà */
function MonthAxisLabel({ month }: { month: string }) {
  return (
    <span className="mt-1.5 w-full text-center text-[10px] font-semibold capitalize text-slate-600 sm:text-[11px]">
      <span className="sm:hidden">{monthLabel(month, 'narrow')}</span>
      <span className="hidden sm:inline">{monthLabel(month)}</span>
    </span>
  );
}

export type MonthlyMetric = 'requests' | 'revenue';

export function MonthlyTrendChart({ points, metric }: { points: readonly MonthlyPoint[]; metric: MonthlyMetric }) {
  if (points.length === 0 || points.every((point) => point.requests === 0 && point.previousYearRequests === 0)) {
    return <EmptyChart>Aucune demande sur ces douze mois.</EmptyChart>;
  }
  const valueOf = (point: MonthlyPoint) => (metric === 'requests' ? point.requests : point.revenue);
  const previousOf = (point: MonthlyPoint) => (metric === 'requests' ? point.previousYearRequests : point.previousYearRevenue);
  const max = Math.max(1, ...points.map((point) => Math.max(valueOf(point), previousOf(point))));
  const format = (value: number) => (metric === 'requests' ? formatCount(value) : formatMoney(value));

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {metric === 'requests' ? (
          <>
            <li className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-sm', CONFIRMED)} />
              Confirmées
            </li>
            <li className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-sm', REST)} />
              Autres demandes
            </li>
          </>
        ) : (
          <li className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm', CONFIRMED)} />
            Chiffre d’affaires confirmé
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span className={cn('h-0.5 w-3.5 rounded-full', INK)} />
          Même mois, un an plus tôt
        </li>
        {points.some((point) => point.partial) && (
          <li className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm opacity-60', CONFIRMED)} />
            Mois en cours (incomplet)
          </li>
        )}
      </ul>
      <div className="grid items-end gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => {
          const value = valueOf(point);
          const previous = previousOf(point);
          const height = (value / max) * 100;
          const confirmedShare = metric === 'requests' && point.requests > 0 ? (point.confirmed / point.requests) * 100 : 100;
          return (
            <div key={point.month} className="group relative flex min-w-0 flex-col items-center">
              <span className="mb-1 hidden text-[11px] font-bold tabular-nums text-slate-900 sm:block">
                {value > 0 ? formatCompact(value) : ''}
              </span>
              <div className="relative flex h-40 w-full max-w-10 items-end border-b border-slate-300">
                {value > 0 && (
                  <div
                    data-bar="value"
                    className={cn('flex w-full flex-col justify-end gap-[2px] overflow-hidden rounded-t', point.partial && 'opacity-60')}
                    style={{ height: `${height}%` }}
                  >
                    {metric === 'requests' && confirmedShare < 100 && <div className={cn('w-full flex-1', REST)} />}
                    <div className={cn('w-full', CONFIRMED)} style={{ height: `${confirmedShare}%` }} />
                  </div>
                )}
                {previous > 0 && (
                  <span
                    data-bar="previous-year"
                    className={cn('absolute inset-x-0 h-0.5 rounded-full', INK)}
                    style={{ bottom: `${(previous / max) * 100}%` }}
                  />
                )}
              </div>
              <MonthAxisLabel month={point.month} />
              {point.partial && <span className="hidden text-[10px] text-slate-500 sm:block">en cours</span>}
              <div
                role="tooltip"
                className={cn(
                  'pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-48 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block',
                  tooltipAlign(index, points.length)
                )}
              >
                <strong className="block capitalize">
                  {monthLabel(point.month, 'long')}
                  {point.partial ? ' (en cours)' : ''}
                </strong>
                {metric === 'requests' ? (
                  <>
                    <span className="block">
                      {formatCount(point.requests)} demande{point.requests > 1 ? 's' : ''} · {formatCount(point.confirmed)} confirmée{point.confirmed > 1 ? 's' : ''}
                    </span>
                    <span className="block text-slate-300">Un an plus tôt : {formatCount(point.previousYearRequests)}</span>
                  </>
                ) : (
                  <>
                    <span className="block">{format(point.revenue)}</span>
                    <span className="block text-slate-300">Un an plus tôt : {format(point.previousYearRevenue)}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function monthlyTable(points: readonly MonthlyPoint[], caption: string): DataTableProps {
  return {
    caption,
    columns: ['Mois', 'Demandes', 'Confirmées', 'Chiffre d’affaires', 'Demandes un an plus tôt', 'CA un an plus tôt'],
    numeric: [1, 2, 3, 4, 5],
    rows: points.map((point) => [
      `${monthLabel(point.month)}${point.partial ? ' (en cours)' : ''}`,
      formatCount(point.requests),
      formatCount(point.confirmed),
      formatMoney(point.revenue),
      formatCount(point.previousYearRequests),
      formatMoney(point.previousYearRevenue),
    ]),
  };
}

export function MetricSwitch({ value, onChange }: { value: MonthlyMetric; onChange: (value: MonthlyMetric) => void }) {
  return (
    <div role="group" aria-label="Indicateur affiché" className="inline-flex rounded-lg border border-slate-200 p-0.5">
      {([
        { value: 'requests', label: 'Demandes' },
        { value: 'revenue', label: 'Chiffre d’affaires' },
      ] as const).map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            value === option.value ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ── Entonnoir ───────────────────────────────────────────────────────── */

export function FunnelChart({ totals }: { totals: AnalyticsTotals }) {
  if (totals.requests === 0) return <EmptyChart>Aucune demande reçue sur la période.</EmptyChart>;
  const steps = funnelSteps(totals);
  const outcomes = funnelOutcomes(totals).filter((outcome) => outcome.value > 0);
  return (
    <div className="space-y-5">
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-800">{step.label}</span>
              <span className="shrink-0 tabular-nums">
                <strong className="text-ink">{formatCount(step.value)}</strong>
                {index > 0 && (
                  <span className="ml-1.5 text-xs text-slate-500">
                    {step.conversion === null ? '—' : `${step.conversion} %`} de l’étape précédente
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={cn('h-full rounded-full', INK)} style={{ width: `${step.ofRequests ?? 0}%` }} />
            </div>
          </li>
        ))}
      </ol>
      {outcomes.length > 0 && (
        <div>
          <h3 className={cn('mb-2', heading.sub)}>Devenir des autres demandes</h3>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <li key={outcome.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    aria-hidden="true"
                    className={cn('h-2 w-2 rounded-full', outcome.tone === 'loss' ? 'bg-action-hover' : 'bg-slate-400')}
                  />
                  {outcome.label}
                </span>
                <span className="tabular-nums text-slate-900">
                  <strong>{formatCount(outcome.value)}</strong>
                  <span className="ml-1 text-xs text-slate-500">({outcome.share ?? 0} %)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function funnelTable(totals: AnalyticsTotals): DataTableProps {
  return {
    caption: 'Entonnoir des demandes de la période',
    columns: ['Étape', 'Demandes', 'Taux depuis l’étape précédente', 'Part des demandes reçues'],
    numeric: [1, 2, 3],
    rows: [
      ...funnelSteps(totals).map((step) => [
        step.label,
        formatCount(step.value),
        step.conversion === null ? '—' : `${step.conversion} %`,
        step.ofRequests === null ? '—' : `${step.ofRequests} %`,
      ]),
      ...funnelOutcomes(totals).map((outcome) => [outcome.label, formatCount(outcome.value), '—', outcome.share === null ? '—' : `${outcome.share} %`]),
    ],
  };
}

/* ── Répartitions ────────────────────────────────────────────────────── */

export function ShareList({
  rows,
  total,
  labelFor = (value) => value,
  emptyText = 'Aucune donnée sur la période.',
}: {
  rows: readonly BreakdownRow[];
  total: number;
  labelFor?: (value: string) => string;
  emptyText?: string;
}) {
  if (rows.length === 0 || total === 0) return <EmptyChart>{emptyText}</EmptyChart>;
  const max = Math.max(1, ...rows.map((row) => row.requests));
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const share = percentOf(row.requests, total);
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-slate-800">{labelFor(row.label)}</span>
              <span className="shrink-0 tabular-nums text-slate-900">
                <strong>{formatCount(row.requests)}</strong>
                <span className="ml-1 text-xs text-slate-500">({share ?? 0} %)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={cn('h-full rounded-full', INK)} style={{ width: `${(row.requests / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function shareTable(caption: string, firstColumn: string, rows: readonly BreakdownRow[], total: number, labelFor: (value: string) => string = (v) => v): DataTableProps {
  return {
    caption,
    columns: [firstColumn, 'Demandes', 'Part', 'Confirmées', 'Chiffre d’affaires'],
    numeric: [1, 2, 3, 4],
    rows: rows.map((row) => [
      labelFor(row.label),
      formatCount(row.requests),
      `${percentOf(row.requests, total) ?? 0} %`,
      formatCount(row.confirmed),
      formatMoney(row.revenue),
    ]),
  };
}

/* ── Revenu récurrent mensuel ────────────────────────────────────────── */

export function MrrChart({ months }: { months: readonly MrrMonth[] }) {
  if (months.length === 0 || months.every((month) => month.mrr === 0 && month.newMrr === 0 && month.churnedMrr === 0)) {
    return <EmptyChart>Aucun abonnement facturé sur ces douze mois.</EmptyChart>;
  }
  const max = Math.max(1, ...months.map((month) => month.mrr));
  return (
    <div className="grid items-end gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
      {months.map((month, index) => {
        const gained = month.newMrr + month.expansionMrr;
        const lost = month.contractionMrr + month.churnedMrr;
        return (
          <div key={month.month} className="group relative flex min-w-0 flex-col items-center">
            {/* Étiquette directe sur le dernier mois seulement : la valeur qui compte */}
            <span className="mb-1 h-4 text-[11px] font-bold tabular-nums text-slate-900">
              {index === months.length - 1 && month.mrr > 0 ? formatCompact(month.mrr) : ''}
            </span>
            <div className="flex h-36 w-full max-w-10 items-end border-b border-slate-300">
              {month.mrr > 0 && (
                <div
                  data-bar="mrr"
                  className={cn('w-full rounded-t', INK, month.partial && 'opacity-60')}
                  style={{ height: `${(month.mrr / max) * 100}%` }}
                />
              )}
            </div>
            <MonthAxisLabel month={month.month} />
            <span className="hidden text-[10px] tabular-nums text-slate-500 sm:block">
              {gained === 0 && lost === 0 ? '·' : `${gained > 0 ? `+${formatCount(gained)}` : ''}${gained > 0 && lost > 0 ? ' ' : ''}${lost > 0 ? `−${formatCount(lost)}` : ''}`}
            </span>
            <div
              role="tooltip"
              className={cn(
                'pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-52 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block',
                tooltipAlign(index, months.length)
              )}
            >
              <strong className="block capitalize">
                {monthLabel(month.month, 'long')}
                {month.partial ? ' (à ce jour)' : ''}
              </strong>
              <span className="block">MRR : {formatMoney(month.mrr)}</span>
              <span className="block text-slate-300">
                Nouveaux +{formatMoney(month.newMrr)} · Hausses +{formatMoney(month.expansionMrr)}
              </span>
              <span className="block text-slate-300">
                Baisses −{formatMoney(month.contractionMrr)} · Résiliations −{formatMoney(month.churnedMrr)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function mrrTable(months: readonly MrrMonth[]): DataTableProps {
  return {
    caption: 'Revenu récurrent mensuel et mouvements par mois',
    columns: ['Mois', 'MRR fin de mois', 'Nouveaux', 'Hausses', 'Baisses', 'Résiliations', 'Agences gagnées', 'Agences perdues'],
    numeric: [1, 2, 3, 4, 5, 6, 7],
    rows: months.map((month) => [
      `${monthLabel(month.month)}${month.partial ? ' (à ce jour)' : ''}`,
      formatMoney(month.mrr),
      `+${formatMoney(month.newMrr)}`,
      `+${formatMoney(month.expansionMrr)}`,
      `−${formatMoney(month.contractionMrr)}`,
      `−${formatMoney(month.churnedMrr)}`,
      formatCount(month.newSubscribers),
      formatCount(month.churnedSubscribers),
    ]),
  };
}

/* ── Délai de réponse ────────────────────────────────────────────────── */

export function ResponseTimeValue({ minutes, measured }: { minutes: number | null; measured: number }) {
  if (minutes === null || measured < 3) {
    return <span className="text-slate-400">Pas assez de réponses</span>;
  }
  return <>{formatDuration(minutes)}</>;
}

/* ── Sélecteur de période ────────────────────────────────────────────── */

export type PeriodValue = { preset: AnalyticsPreset; from: string; to: string };

export function initialPeriod(preset: Exclude<AnalyticsPreset, 'custom'> = '30d', now = new Date()): PeriodValue {
  return { preset, ...resolveAnalyticsRange(preset, now) };
}

export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (value: PeriodValue) => void }) {
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const fromId = useId();
  const toId = useId();
  const error = customOpen ? rangeError(draft.from, draft.to) : null;

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Période analysée" className="inline-flex flex-wrap rounded-xl border border-slate-300 bg-white p-0.5">
        {ANALYTICS_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            aria-pressed={value.preset === preset.value}
            onClick={() => {
              setCustomOpen(false);
              onChange(initialPeriod(preset.value));
            }}
            className={cn(
              'min-h-9 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand',
              value.preset === preset.value ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value.preset === 'custom'}
          aria-expanded={customOpen}
          onClick={() => {
            setDraft({ from: value.from, to: value.to });
            setCustomOpen((open) => !open);
          }}
          className={cn(
            'min-h-9 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand',
            value.preset === 'custom' ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          Personnalisée
        </button>
      </div>
      {customOpen && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!rangeError(draft.from, draft.to)) onChange({ preset: 'custom', ...draft });
          }}
        >
          <div>
            <label htmlFor={fromId} className="mb-1 block text-xs font-medium text-slate-500">
              Du
            </label>
            <input
              id={fromId}
              type="date"
              required
              value={draft.from}
              max={draft.to || undefined}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
              className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor={toId} className="mb-1 block text-xs font-medium text-slate-500">
              Au
            </label>
            <input
              id={toId}
              type="date"
              required
              value={draft.to}
              min={draft.from || undefined}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
              className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={Boolean(error)}
            className="min-h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Appliquer
          </button>
          {error && (
            <p role="alert" className="w-full text-xs font-medium text-action-hover">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
