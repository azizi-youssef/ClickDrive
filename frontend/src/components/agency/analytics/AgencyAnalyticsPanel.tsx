'use client';

import { useMemo, useState } from 'react';
import { Car, FileSpreadsheet, Motorbike, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { csvFileName, downloadCsv } from '@/lib/export/csv';
import { parseAgencyAnalyticsReport, type AgencyAnalyticsReport, type VehicleUsage } from '@/lib/analytics/report';
import { useAnalyticsReport } from '@/lib/analytics/use-analytics-report';
import { agencyAnalyticsCsvRows, formatCount, formatMoney, formatRate } from '@/lib/analytics/insights';
import { ErrorBanner } from '@/components/agency/shell/Feedback';
import { AnalyticsSkeleton, ChartCard, PeriodPicker, initialPeriod, type PeriodValue } from '@/components/analytics/AnalyticsUI';
import {
  BreakdownGrid,
  FunnelCard,
  KpiGrid,
  PeriodSummary,
  ResponseCard,
  TrendCard,
  VehicleTypeCard,
} from '@/components/analytics/AnalyticsSections';

type VehicleSort = 'revenue' | 'occupancy';

/**
 * Statistiques de l'agence : agrégats calculés en base par agency_analytics_report() (reports.read),
 * comparés à la période précédente de même durée. Aucune liste de réservations n'est chargée.
 */
export function AgencyAnalyticsPanel({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod('30d'));
  const endpoint = `/api/stats/agency/${encodeURIComponent(agencyId)}/analytics`;
  const { data, loading, refreshing, error, lastUpdated, reload } = useAnalyticsReport(endpoint, period, parseAgencyAnalyticsReport);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(csvFileName(`clickdrive-statistiques-agence-${data.period.from}-au-${data.period.to}`), agencyAnalyticsCsvRows(data, agencyName));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Actualisé à {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading || refreshing}
            aria-label="Actualiser les statistiques"
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            Actualiser
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="flex min-h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Exporter CSV
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}

      {loading && !data ? (
        <AnalyticsSkeleton />
      ) : data ? (
        <div className={cn('space-y-6 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          <PeriodSummary report={data} />
          <KpiGrid report={data} revenueLabel="Chiffre d’affaires confirmé" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <FunnelCard report={data} />
            <ResponseCard report={data} />
          </div>
          <TrendCard report={data} scopeLabel="Votre agence" />
          <VehicleUsageCard report={data} />
          <VehicleTypeCard report={data} />
          <BreakdownGrid report={data} />
        </div>
      ) : null}
    </div>
  );
}

function VehicleUsageCard({ report }: { report: AgencyAnalyticsReport }) {
  const [sort, setSort] = useState<VehicleSort>('revenue');
  const items = useMemo(() => {
    const list = [...(report.fleet.items ?? [])];
    if (sort === 'occupancy') list.sort((a, b) => (b.occupancyRate ?? -1) - (a.occupancyRate ?? -1) || b.revenue - a.revenue);
    return list;
  }, [report.fleet.items, sort]);

  return (
    <ChartCard
      title="Occupation et revenu par véhicule"
      subtitle="Nuits réservées sur les jours où le véhicule était dans la flotte ; revenu au prorata des nuits de la période"
      icon={Car}
      action={
        <div role="group" aria-label="Trier les véhicules" className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {([
            { value: 'revenue', label: 'Par revenu' },
            { value: 'occupancy', label: 'Par occupation' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              onClick={() => setSort(option.value)}
              className={cn(
                'min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]',
                sort === option.value ? 'bg-[#0B1220] text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun véhicule dans la flotte sur cette période.</p>
      ) : (
        <>
        {/* Téléphone : une carte par véhicule (le tableau défilerait à l'horizontale) */}
        <ul className="-mx-5 -my-5 divide-y divide-slate-100 sm:hidden" aria-label="Véhicules de la flotte">
          {items.map((item) => (
            <VehicleCard key={item.vehicleId} item={item} />
          ))}
        </ul>
        <div className="-mx-5 -my-5 hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Occupation et revenu par véhicule sur la période</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2.5">Véhicule</th>
                <th scope="col" className="px-4 py-2.5">Occupation</th>
                <th scope="col" className="px-4 py-2.5 text-right">Nuits / jours</th>
                <th scope="col" className="px-4 py-2.5 text-right">Réservations</th>
                <th scope="col" className="px-5 py-2.5 text-right">Revenu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <VehicleRow key={item.vehicleId} item={item} />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </ChartCard>
  );
}

function OccupancyBar({ item }: { item: VehicleUsage }) {
  if (item.bookedDays === 0) {
    return <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">Aucune location</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className="block h-full rounded-full bg-[#0B1220]" style={{ width: `${Math.min(100, item.occupancyRate ?? 0)}%` }} />
      </span>
      <span className="text-xs font-bold tabular-nums text-slate-900">{formatRate(item.occupancyRate)}</span>
    </span>
  );
}

function VehicleCard({ item }: { item: VehicleUsage }) {
  const Icon = item.vehicleType === 'MOTORCYCLE' ? Motorbike : Car;
  return (
    <li className="px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
            <span className="block text-xs text-slate-500">
              {item.category}
              {item.archived && ' · archivé'}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{formatMoney(item.revenue)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-600">
        <OccupancyBar item={item} />
        <span className="tabular-nums">
          {formatCount(item.bookedDays)} / {formatCount(item.availableDays)} nuits · {formatCount(item.bookings)} rés.
        </span>
      </div>
    </li>
  );
}

function VehicleRow({ item }: { item: VehicleUsage }) {
  const Icon = item.vehicleType === 'MOTORCYCLE' ? Motorbike : Car;
  return (
    <tr>
      <th scope="row" className="px-5 py-3 font-normal">
        <span className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900">{item.label}</span>
            <span className="block text-xs text-slate-500">
              {item.category}
              {item.archived && ' · archivé'}
            </span>
          </span>
        </span>
      </th>
      <td className="min-w-40 px-4 py-3">
        <OccupancyBar item={item} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
        {formatCount(item.bookedDays)} / {formatCount(item.availableDays)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(item.bookings)}</td>
      <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-900">{formatMoney(item.revenue)}</td>
    </tr>
  );
}
