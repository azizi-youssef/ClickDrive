'use client';

import { useState, type ReactNode } from 'react';
import {
  Car,
  CheckCircle2,
  Clock3,
  Gauge,
  Globe2,
  Hourglass,
  Inbox,
  Languages,
  MapPin,
  Motorbike,
  Tags,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  formatCount,
  formatDuration,
  formatMetric,
  formatMoney,
  formatRate,
  localeLabel,
  metricComparisons,
  periodLabel,
  responseSummary,
  vehicleTypeLabel,
  type MetricComparison,
} from '@/lib/analytics/insights';
import type { AnalyticsReport } from '@/lib/analytics/report';
import {
  ChartCard,
  ComparisonPill,
  FunnelChart,
  MetricSwitch,
  MonthlyTrendChart,
  ResponseTimeValue,
  ShareList,
  StatTile,
  funnelTable,
  monthlyTable,
  shareTable,
  type MonthlyMetric,
} from './AnalyticsUI';

/* Sections communes aux statistiques de l'agence et de la plateforme */

function metricsByKey(report: AnalyticsReport): Record<string, MetricComparison> {
  return Object.fromEntries(metricComparisons(report).map((metric) => [metric.key, metric]));
}

export function PeriodSummary({ report }: { report: AnalyticsReport }) {
  const { period } = report;
  return (
    <p className="text-xs text-slate-500">
      Demandes reçues du <strong className="font-semibold text-slate-700">{periodLabel(period.from, period.to)}</strong> ({period.days} jours),
      comparées au {periodLabel(period.previousFrom, period.previousTo)} · heure du Maroc
    </p>
  );
}

export function KpiGrid({ report, revenueLabel }: { report: AnalyticsReport; revenueLabel: string }) {
  const metrics = metricsByKey(report);
  const { current, fleet } = report;
  const response = responseSummary(current);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatTile label="Demandes reçues" metric={metrics.requests} icon={Inbox} sub={`${formatCount(current.awaitingDecision)} en attente`} />
      <StatTile label="Taux d’acceptation" metric={metrics.acceptanceRate} icon={CheckCircle2} sub={`${formatCount(current.accepted)} acceptées`} />
      <StatTile label={revenueLabel} metric={metrics.revenue} icon={Wallet} sub={`${formatCount(current.confirmed)} réservation${current.confirmed > 1 ? 's' : ''}`} />
      <StatTile
        label="Délai de réponse médian"
        metric={metrics.responseMedian}
        value={<ResponseTimeValue minutes={current.responseMedianMinutes} measured={current.responsesMeasured} />}
        icon={Clock3}
        sub={response?.within1h !== null && response ? `${response.within1h} % en moins d’1 h` : undefined}
      />
      <StatTile label="Taux de refus" metric={metrics.rejectionRate} icon={XCircle} sub={`${formatCount(current.rejected)} refusée${current.rejected > 1 ? 's' : ''}`} />
      <StatTile
        label="Expirées sans réponse"
        metric={metrics.expiryRate}
        icon={Hourglass}
        sub={`${formatCount(current.expiredUnanswered)} demande${current.expiredUnanswered > 1 ? 's' : ''}`}
      />
      <StatTile
        label="Taux d’occupation"
        metric={metrics.occupancy}
        icon={Gauge}
        sub={`${formatCount(fleet.bookedDays)} nuits sur ${formatCount(fleet.availableDays)} jours-véhicule`}
      />
      <StatTile
        label="Revenu par véhicule"
        metric={metrics.revenuePerVehicle}
        icon={Car}
        sub={`${formatCount(fleet.vehicles)} véhicule${fleet.vehicles > 1 ? 's' : ''} · ${formatCount(fleet.idleVehicles)} sans location`}
      />
    </div>
  );
}

export function FunnelCard({ report }: { report: AnalyticsReport }) {
  return (
    <ChartCard
      title="Entonnoir des demandes"
      subtitle="De la demande à la restitution du véhicule, pour les demandes reçues sur la période"
      icon={TrendingUp}
      table={funnelTable(report.current)}
    >
      <FunnelChart totals={report.current} />
    </ChartCard>
  );
}

function Fact({ label, value, metric, hint }: { label: string; value: ReactNode; metric?: MetricComparison; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
      <dt className="text-sm text-slate-600">
        {label}
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </dt>
      <dd className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#0B1220]">
        {value}
        {metric && <ComparisonPill metric={metric} suffix="" />}
      </dd>
    </div>
  );
}

export function ResponseCard({ report }: { report: AnalyticsReport }) {
  const metrics = metricsByKey(report);
  const { current } = report;
  const response = responseSummary(current);
  return (
    <ChartCard title="Réactivité et réservations" subtitle="Délai entre la demande et la première réponse de l’agence" icon={Zap}>
      <dl className="divide-y divide-slate-100">
        <Fact
          label="Délai médian"
          value={<ResponseTimeValue minutes={current.responseMedianMinutes} measured={current.responsesMeasured} />}
          metric={metrics.responseMedian}
          hint={`${formatCount(current.responsesMeasured)} réponse${current.responsesMeasured > 1 ? 's' : ''} mesurée${current.responsesMeasured > 1 ? 's' : ''}`}
        />
        <Fact label="9 réponses sur 10 en moins de" value={response ? formatDuration(response.p90Minutes) : '—'} />
        <Fact label="Répondues en moins d’1 h" value={response ? formatRate(response.within1h) : '—'} />
        <Fact label="Répondues en moins de 24 h" value={response ? formatRate(response.within24h) : '—'} />
        <Fact label="Alternatives proposées" value={formatCount(current.alternatives)} />
        <Fact
          label="Délai d’anticipation médian"
          value={current.leadTimeMedianDays === null ? '—' : `${formatMetric('days', current.leadTimeMedianDays)}`}
          hint="Entre la demande et la prise en charge"
        />
        <Fact label="Panier moyen" value={formatMetric('money', metrics.averageBasket.current)} metric={metrics.averageBasket} />
        <Fact label="Durée moyenne de location" value={formatMetric('days', metrics.averageRentalDays.current)} metric={metrics.averageRentalDays} />
      </dl>
    </ChartCard>
  );
}

export function TrendCard({ report, scopeLabel }: { report: AnalyticsReport; scopeLabel: string }) {
  const [metric, setMetric] = useState<MonthlyMetric>('requests');
  const points = report.monthly;
  return (
    <ChartCard
      title={metric === 'requests' ? 'Demandes par mois' : 'Chiffre d’affaires confirmé par mois'}
      subtitle={`${scopeLabel} · 12 mois jusqu’au mois de fin de période, comparés aux mêmes mois un an plus tôt`}
      icon={TrendingUp}
      action={<MetricSwitch value={metric} onChange={setMetric} />}
      table={monthlyTable(points, 'Demandes et chiffre d’affaires par mois')}
    >
      <MonthlyTrendChart points={points} metric={metric} />
    </ChartCard>
  );
}

export function VehicleTypeCard({ report }: { report: AnalyticsReport }) {
  const requests = new Map(report.breakdowns.vehicleTypes.map((row) => [row.label, row]));
  const usage = new Map(report.fleet.byType.map((row) => [row.vehicleType, row]));
  const types = (['CAR', 'MOTORCYCLE'] as const).filter((type) => requests.has(type) || usage.has(type));
  return (
    <ChartCard title="Voitures et motos" subtitle="Demandes de la période et utilisation de la flotte" icon={Car}>
      {types.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun véhicule ni demande sur la période.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {types.map((type) => {
            const demand = requests.get(type);
            const fleet = usage.get(type);
            const Icon = type === 'MOTORCYCLE' ? Motorbike : Car;
            return (
              <div key={type} className="rounded-xl border border-slate-200 p-4">
                <h4 className="flex items-center gap-2 text-sm font-extrabold text-[#0B1220]">
                  <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  {vehicleTypeLabel(type)}
                  <span className="ml-auto text-xs font-semibold text-slate-500">
                    {formatCount(fleet?.vehicles ?? 0)} en flotte
                  </span>
                </h4>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <dt className="text-slate-500">Demandes</dt>
                  <dd className="text-right font-bold tabular-nums">{formatCount(demand?.requests ?? 0)}</dd>
                  <dt className="text-slate-500">Confirmées</dt>
                  <dd className="text-right font-bold tabular-nums">{formatCount(demand?.confirmed ?? 0)}</dd>
                  <dt className="text-slate-500">Chiffre d’affaires</dt>
                  <dd className="text-right font-bold tabular-nums">{formatMoney(demand?.revenue ?? 0)}</dd>
                  <dt className="text-slate-500">Occupation</dt>
                  <dd className="text-right font-bold tabular-nums">{formatRate(fleet?.occupancyRate ?? null)}</dd>
                  <dt className="text-slate-500">Revenu par véhicule</dt>
                  <dd className="text-right font-bold tabular-nums">{fleet?.revenuePerVehicle === null || !fleet ? '—' : formatMoney(fleet.revenuePerVehicle)}</dd>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

export function BreakdownGrid({ report }: { report: AnalyticsReport }) {
  const total = report.current.requests;
  const { categories, pickupLocations, countries, locales } = report.breakdowns;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Catégories demandées" subtitle="Part des demandes par catégorie de véhicule" icon={Tags} table={shareTable('Demandes par catégorie', 'Catégorie', categories, total)}>
        <ShareList rows={categories} total={total} />
      </ChartCard>
      <ChartCard
        title="Points de prise en charge"
        subtitle="Lieux demandés par les clients"
        icon={MapPin}
        table={shareTable('Demandes par point de prise en charge', 'Lieu', pickupLocations, total)}
      >
        <ShareList rows={pickupLocations} total={total} />
      </ChartCard>
      <ChartCard title="Pays des clients" subtitle="Pays de résidence déclaré dans la demande" icon={Globe2} table={shareTable('Demandes par pays de résidence', 'Pays', countries, total)}>
        <ShareList rows={countries} total={total} />
      </ChartCard>
      <ChartCard
        title="Langues des clients"
        subtitle="Langue du site au moment de la demande"
        icon={Languages}
        table={shareTable('Demandes par langue', 'Langue', locales, total, localeLabel)}
      >
        <ShareList rows={locales} total={total} labelFor={localeLabel} />
      </ChartCard>
    </div>
  );
}
