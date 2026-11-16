'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, Download, MapPin, RefreshCw, Sparkles, Star, Wallet } from 'lucide-react';
import { Btn, ErrorBanner } from '@/components/admin/AdminUI';
import { useRealtimeRefresh, type RealtimeTable } from '@/lib/supabase/realtime';
import { cn } from '@/lib/utils';
import { eyebrow, heading } from '@/lib/design/tokens';
import { csvFileName, downloadCsv } from '@/lib/export/csv';
import { parseAdminAnalyticsReport, type AdminAnalyticsReport } from '@/lib/analytics/report';
import { useAnalyticsReport } from '@/lib/analytics/use-analytics-report';
import {
  MIN_RESPONSES_FOR_MEDIAN,
  adminAnalyticsCsvRows,
  formatCount,
  formatDuration,
  formatMoney,
  monthLabel,
  percentOf,
} from '@/lib/analytics/insights';
import {
  AnalyticsSkeleton,
  ChartCard,
  DataTable,
  MrrChart,
  PeriodPicker,
  initialPeriod,
  mrrTable,
  type PeriodValue,
} from '@/components/analytics/AnalyticsUI';
import {
  BreakdownGrid,
  FunnelCard,
  KpiGrid,
  PeriodSummary,
  ResponseCard,
  TrendCard,
  VehicleTypeCard,
} from '@/components/analytics/AnalyticsSections';

/** Constante de module : un tableau littéral ferait se réabonner le hook à chaque rendu */
const REALTIME_TABLES: RealtimeTable[] = ['bookings', 'agencies'];

/**
 * Statistiques de la plateforme (Super-Admin). Agrégats calculés en base par admin_analytics_report() :
 * le navigateur ne reçoit que le rapport de la période choisie, jamais la liste des réservations.
 */
export function AdminAnalyticsClient() {
  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod('30d'));
  const { data, loading, refreshing, error, lastUpdated, reload } = useAnalyticsReport(
    '/api/admin/analytics',
    period,
    parseAdminAnalyticsReport
  );

  // Les changements arrivent en direct ; le polling n'est qu'un filet de sécurité
  useRealtimeRefresh({ tables: REALTIME_TABLES, onRefresh: reload, pollingIntervalMs: 120_000 });

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(csvFileName(`clickdrive-statistiques-${data.period.from}-au-${data.period.to}`), adminAnalyticsCsvRows(data));
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
          <Btn variant="secondary" size="sm" onClick={() => void reload()} disabled={loading || refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            Actualiser
          </Btn>
          <Btn variant="secondary" size="sm" onClick={exportCsv} disabled={!data}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exporter CSV
          </Btn>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} retrying={refreshing || loading} />}

      {loading && !data ? (
        <AnalyticsSkeleton />
      ) : data ? (
        <div className={cn('space-y-6 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          <PeriodSummary report={data} />
          <MrrBanner report={data} />
          <KpiGrid report={data} revenueLabel="Volume confirmé des agences" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <FunnelCard report={data} />
            <ResponseCard report={data} />
          </div>
          <TrendCard report={data} scopeLabel="Toutes les agences" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ChartCard
              title="Revenu récurrent mensuel"
              subtitle="MRR en fin de mois et mouvements (nouveaux, hausses, baisses, résiliations)"
              icon={Wallet}
              table={mrrTable(data.subscriptions.monthly)}
            >
              <MrrChart months={data.subscriptions.monthly} />
            </ChartCard>
            <PlansCard report={data} />
          </div>
          <VehicleTypeCard report={data} />
          <BreakdownGrid report={data} />
          <AgencyRanking report={data} />
        </div>
      ) : null}
    </div>
  );
}

function MrrBanner({ report }: { report: AdminAnalyticsReport }) {
  const { subscriptions, network } = report;
  const adoption = percentOf(subscriptions.subscribers, network.agencies);
  const thisMonth = subscriptions.monthly.at(-1);
  const net = thisMonth ? thisMonth.newMrr + thisMonth.expansionMrr - thisMonth.contractionMrr - thisMonth.churnedMrr : 0;
  return (
    <section aria-labelledby="mrr-overview-title" className="relative overflow-hidden rounded-2xl bg-ink p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -top-12 right-0 h-48 w-80 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Modèle forfaits mensuels · 0 % de commission
          </div>
          <h2 id="mrr-overview-title" className={cn(eyebrow, 'text-slate-400')}>
            Revenu récurrent mensuel (MRR plateforme)
          </h2>
          <p className="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
            {formatMoney(subscriptions.mrr)}
            <span className="ml-2 text-base font-normal text-slate-400">/ mois</span>
          </p>
          <p className="mt-2 text-xs text-slate-300 sm:text-sm">
            {formatCount(subscriptions.subscribers)} agence{subscriptions.subscribers > 1 ? 's' : ''} abonnée{subscriptions.subscribers > 1 ? 's' : ''}
            {adoption !== null && ` (${adoption} % du réseau actif)`}
            {subscriptions.averageRevenuePerSubscriber !== null && ` · ${formatMoney(subscriptions.averageRevenuePerSubscriber)} par agence`}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {thisMonth ? `${monthLabel(thisMonth.month, 'long')} : ${net >= 0 ? '+' : '−'}${formatMoney(Math.abs(net))} net` : null}
            {subscriptions.trialSubscribers > 0 && ` · ${formatCount(subscriptions.trialSubscribers)} en essai`}
            {subscriptions.pastDue > 0 && ` · ${formatCount(subscriptions.pastDue)} paiement${subscriptions.pastDue > 1 ? 's' : ''} en retard`}
          </p>
        </div>
        <Link
          href="/admin/finance"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-white/15 sm:self-auto sm:text-sm"
        >
          <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Gérer les abonnements
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function PlansCard({ report }: { report: AdminAnalyticsReport }) {
  const { plans, mrr } = report.subscriptions;
  return (
    <ChartCard title="Répartition par formule" subtitle="Agences abonnées et part du MRR" icon={Building2}>
      {plans.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun abonnement facturé.</p>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => {
            const share = percentOf(plan.mrr, mrr) ?? 0;
            return (
              <li key={plan.slug}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-800">{plan.name}</span>
                  <span className="tabular-nums text-slate-900">
                    <strong>{formatMoney(plan.mrr)}</strong>
                    <span className="ml-1 text-xs text-slate-500">
                      · {formatCount(plan.subscribers)} agence{plan.subscribers > 1 ? 's' : ''} ({share} %)
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#0B1220]" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}

function AgencyRanking({ report }: { report: AdminAnalyticsReport }) {
  const { agencies, network } = report;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(11,18,32,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className={heading.block}>Agences les plus sollicitées</h2>
          <p className="text-xs text-slate-500">
            Demandes, acceptation et réactivité sur la période
            {network.agenciesWithoutRequests > 0 &&
              ` · ${formatCount(network.agenciesWithoutRequests)} agence${network.agenciesWithoutRequests > 1 ? 's' : ''} active${network.agenciesWithoutRequests > 1 ? 's' : ''} sans aucune demande`}
          </p>
        </div>
        <Link href="/admin/agencies" className="text-xs font-semibold text-accent-text hover:underline">
          Voir toutes les agences →
        </Link>
      </div>
      {agencies.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Aucune agence n’a reçu de demande sur la période.</p>
      ) : (
        <DataTable
          caption="Classement des agences par demandes reçues"
          columns={['Agence', 'Ville', 'Demandes', 'Acceptation', 'Refusées', 'Expirées', 'Chiffre d’affaires', 'Délai médian', 'Satisfaction']}
          numeric={[2, 3, 4, 5, 6, 7]}
          rows={agencies.map((agency) => [
            agency.name,
            agency.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {agency.city}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            ),
            formatCount(agency.requests),
            `${percentOf(agency.accepted, agency.requests) ?? 0} %`,
            formatCount(agency.rejected),
            formatCount(agency.expiredUnanswered),
            formatMoney(agency.revenue),
            agency.responsesMeasured >= MIN_RESPONSES_FOR_MEDIAN ? formatDuration(agency.responseMedianMinutes) : <span className="text-xs text-slate-400">—</span>,
            agency.rating === null ? (
              <span className="text-xs text-slate-500">Aucun avis</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                {agency.rating.toFixed(1)} / 5
              </span>
            ),
          ])}
        />
      )}
    </section>
  );
}
