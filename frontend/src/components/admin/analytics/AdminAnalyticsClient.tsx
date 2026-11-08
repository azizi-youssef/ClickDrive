'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  Download,
  RefreshCw,
  Building2,
  Car,
  MapPin,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowUpRight,
  Star,
} from 'lucide-react';
import { AdminCard, Btn, ErrorBanner, KpiCard } from '@/components/admin/AdminUI';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import { cn, formatPrice } from '@/lib/utils';

interface AnalyticsPayload {
  kpis: {
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    confirmationRate: number;
    cancellationRate: number;
    averageRentalDays: number;
    totalAgencies: number;
    totalVehicles: number;
  };
  subscriptions: {
    monthlyRecurringRevenue: number;
    activeSubscribers: number;
    fleetCapacityTotal: number;
  };
  monthlyTrends: Array<{
    month: string;
    bookings: number;
    confirmed: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  topAgencies: Array<{
    name: string;
    city: string;
    count: number;
    rating: number;
  }>;
  topLocations: Array<{
    location: string;
    count: number;
    percentage: number;
  }>;
}

export function AdminAnalyticsClient() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors du chargement des statistiques');
      }
      setData(json.data);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de récupérer les analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Rafraîchissement automatique en direct
  useRealtimeRefresh({
    tables: ['bookings', 'vehicles', 'agencies'],
    onRefresh: () => loadData(false),
    pollingIntervalMs: 60_000, // Realtime pousse les changements ; le polling ne sert que de filet de sécurité
  });

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Rapport Analytics & Performance ClickDrive'],
      ['Date d’exportation', new Date().toLocaleDateString('fr-FR')],
      [],
      ['Indicateurs Clés', 'Valeur'],
      ['Total Réservations', data.kpis.totalBookings],
      ['Réservations Confirmées', data.kpis.confirmedBookings],
      ['Taux de Confirmation', `${data.kpis.confirmationRate}%`],
      ['Taux d’Annulation', `${data.kpis.cancellationRate}%`],
      ['Durée Moyenne Location', `${data.kpis.averageRentalDays} jours`],
      ['Agences Actives', data.kpis.totalAgencies],
      ['Flotte Véhicules', data.kpis.totalVehicles],
      ['MRR Forfaits Abonnements', `${data.subscriptions.monthlyRecurringRevenue} MAD/mois`],
      ['Agences Souscrites', data.subscriptions.activeSubscribers],
      ['Capacité Flotte Souscrite', data.subscriptions.fleetCapacityTotal],
      [],
      ['Tendances Mensuelles', 'Mois', 'Total Réservations', 'Confirmées'],
      ...data.monthlyTrends.map((t) => ['', t.month, t.bookings, t.confirmed]),
      [],
      ['Catégories Véhicules', 'Catégorie', 'Réservations', 'Part'],
      ...data.categoryBreakdown.map((c) => ['', c.category, c.count, `${c.percentage}%`]),
      [],
      ['Top Agences', 'Agence', 'Ville', 'Réservations', 'Note'],
      ...data.topAgencies.map((a) => ['', a.name, a.city, a.count, `${a.rating} / 5`]),
      [],
      ['Lieux Prise en Charge', 'Emplacement', 'Demandes', 'Part'],
      ...data.topLocations.map((l) => ['', l.location, l.count, `${l.percentage}%`]),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ClickDrive-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
      </div>
    );
  }

  if (error && !data) {
    return <ErrorBanner message={error} onRetry={() => loadData(true)} retrying={refreshing} />;
  }

  const kpis = data?.kpis ?? {
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    cancelledBookings: 0,
    confirmationRate: 0,
    cancellationRate: 0,
    averageRentalDays: 0,
    totalAgencies: 0,
    totalVehicles: 0,
  };

  const subs = data?.subscriptions ?? {
    monthlyRecurringRevenue: 0,
    activeSubscribers: 0,
    fleetCapacityTotal: 0,
  };

  const maxMonthBookings = Math.max(
    1,
    ...(data?.monthlyTrends.map((m) => Math.max(m.bookings, m.confirmed)) ?? [1])
  );

  const adoptionRate =
    kpis.totalAgencies > 0 ? Math.round((subs.activeSubscribers / kpis.totalAgencies) * 100) : 0;

  // Évolution des demandes : dernier mois complet comparé au précédent (le mois en cours est partiel)
  const trends = data?.monthlyTrends ?? [];
  const lastFull = trends[trends.length - 2];
  const beforeLast = trends[trends.length - 3];
  const bookingsTrend =
    lastFull && beforeLast && beforeLast.bookings > 0
      ? {
        value: Math.round(((lastFull.bookings - beforeLast.bookings) / beforeLast.bookings) * 100),
        label: `demandes en ${lastFull.month}`,
      }
      : null;

  return (
    <div className="space-y-6">
      {/* ── Top Bar (Actions & Refresh) ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Données en temps réel
          </span>
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              Actualisé à{' '}
              {lastRefresh.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" onClick={() => void loadData(false)} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            Actualiser
          </Btn>
          <Btn variant="secondary" size="sm" onClick={exportCSV} disabled={!data}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exporter CSV
          </Btn>
        </div>
      </div>

      {/* ── Bannière MRR Forfaits Abonnements ─────────────────────────── */}
      <section
        aria-labelledby="mrr-overview-title"
        className="relative overflow-hidden rounded-2xl bg-ink p-6 sm:p-8 shadow-sm"
      >
        <div className="pointer-events-none absolute -top-12 right-0 h-48 w-80 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Modèle Forfaits Mensuels · 0% de commission
            </div>
            <h2 id="mrr-overview-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Revenu Récurrent Mensuel (MRR Plateforme)
            </h2>
            <p className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-[-0.04em] tabular-nums text-white">
              {formatPrice(subs.monthlyRecurringRevenue)}
              <span className="text-base font-normal text-slate-400 ml-2">/ mois</span>
            </p>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              {subs.activeSubscribers} agences souscrites ({adoptionRate}% du réseau) ·{' '}
              {subs.fleetCapacityTotal} véhicules sous licence régionale allouée
            </p>
          </div>

          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-3 text-xs sm:text-sm font-bold text-white transition self-start sm:self-auto shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Gérer les abonnements
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── 4 Cartes Performance Opérationnelle ────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Taux de confirmation"
          value={kpis.confirmationRate}
          unit="%"
          icon={CheckCircle2}
          tone="success"
          progress={kpis.confirmationRate}
          trend={bookingsTrend}
          sub={`${kpis.confirmedBookings} validées sur ${kpis.totalBookings}`}
        />
        <KpiCard
          label="Durée moyenne de location"
          value={kpis.averageRentalDays}
          unit={kpis.averageRentalDays > 1 ? 'jours' : 'jour'}
          icon={Clock}
          tone="info"
          sub="Par contrat validé"
        />
        <KpiCard
          label="Taux d’annulation"
          value={kpis.cancellationRate}
          unit="%"
          icon={XCircle}
          tone={kpis.cancellationRate >= 20 ? 'danger' : 'neutral'}
          progress={kpis.cancellationRate}
          sub={`${kpis.cancelledBookings} annulées ou refusées`}
        />
        <KpiCard
          label="Adoption des forfaits"
          value={adoptionRate}
          unit="%"
          icon={Building2}
          tone="neutral"
          progress={adoptionRate}
          href="/admin/finance"
          sub={`${subs.activeSubscribers} / ${kpis.totalAgencies} agences abonnées`}
        />
      </div>

      {/* ── Graphique des Tendances Mensuelles ─────────────────────────── */}
      <AdminCard noPadding>
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Activité & Tendances Mensuelles</h2>
            <p className="text-xs text-slate-500">Volume des réservations enregistrées sur les 6 derniers mois</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-3 w-3 rounded-sm bg-ink" />
              Total réservations
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" />
              Confirmées
            </span>
          </div>
        </div>

        <div className="p-6">
          {data?.monthlyTrends && data.monthlyTrends.length > 0 ? (
            <div className="grid grid-cols-6 gap-3 sm:gap-6 items-end h-56 pt-6">
              {data.monthlyTrends.map((item) => {
                const totalH = Math.round((item.bookings / maxMonthBookings) * 100);
                const confH = Math.round((item.confirmed / maxMonthBookings) * 100);
                return (
                  <div key={item.month} className="flex flex-col items-center h-full justify-end group">
                    <div className="text-[11px] font-semibold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
                      {item.confirmed}/{item.bookings}
                    </div>
                    <div className="w-full max-w-10 sm:max-w-13 flex items-end justify-center gap-1 h-36 bg-slate-50 rounded-xl p-1 border border-slate-100">
                      {/* Barre totale */}
                      <div
                        className="w-1/2 rounded-md bg-ink transition-all duration-500 group-hover:opacity-90"
                        style={{ height: `${Math.max(6, totalH)}%` }}
                        title={`Total: ${item.bookings}`}
                      />
                      {/* Barre confirmées */}
                      <div
                        className="w-1/2 rounded-md bg-emerald-500 transition-all duration-500 group-hover:opacity-90"
                        style={{ height: `${Math.max(6, confH)}%` }}
                        title={`Confirmées: ${item.confirmed}`}
                      />
                    </div>
                    <span className="mt-3 text-xs font-semibold text-slate-600 capitalize">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Aucune donnée de tendance enregistrée pour le moment.
            </div>
          )}
        </div>
      </AdminCard>

      {/* ── Deux colonnes : Catégories & Lieux ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Répartition par catégorie de véhicules */}
        <AdminCard noPadding>
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Catégories les plus demandées</h2>
              <p className="text-xs text-slate-500">Répartition des réservations par type de véhicule</p>
            </div>
            <Car className="h-4 w-4 text-slate-400" />
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {data?.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
              data.categoryBreakdown.map((cat, idx) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800 capitalize flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      {cat.category}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {cat.count} <span className="text-slate-400 font-normal">({cat.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-ink transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">Aucune catégorie répertoriée.</p>
            )}
          </div>
        </AdminCard>

        {/* Lieux de prise en charge les plus populaires */}
        <AdminCard noPadding>
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Points de prise en charge prisés</h2>
              <p className="text-xs text-slate-500">Emplacements les plus sollicités par les clients</p>
            </div>
            <MapPin className="h-4 w-4 text-slate-400" />
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {data?.topLocations && data.topLocations.length > 0 ? (
              data.topLocations.map((loc, idx) => (
                <div key={loc.location} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800 flex items-center gap-2 truncate">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-[10px] font-bold text-accent-text">
                        {idx + 1}
                      </span>
                      <span className="truncate">{loc.location}</span>
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums shrink-0 ml-2">
                      {loc.count} <span className="text-slate-400 font-normal">({loc.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${loc.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">Aucun emplacement identifié.</p>
            )}
          </div>
        </AdminCard>
      </div>

      {/* ── Classement des Agences Partenaires ───────────────────────── */}
      <AdminCard noPadding>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Agences les plus actives</h2>
            <p className="text-xs text-slate-500">Classement selon le volume de réservations traitées et avis clients</p>
          </div>
          <Link href="/admin/agencies" className="text-xs font-semibold text-accent-text hover:underline">
            Voir toutes les agences →
          </Link>
        </div>

        {data?.topAgencies && data.topAgencies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3 sm:px-6">Rang & Agence</th>
                  <th className="px-5 py-3">Ville</th>
                  <th className="px-5 py-3">Satisfaction</th>
                  <th className="px-5 py-3 text-right sm:px-6">Réservations traitées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topAgencies.map((agency, idx) => (
                  <tr key={agency.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 sm:px-6 font-medium text-slate-900 flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="font-semibold">{agency.name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {agency.city}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {agency.rating.toFixed(1)} / 5
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-slate-900 sm:px-6 tabular-nums">
                      {agency.count} <span className="text-xs font-normal text-slate-500">réservations</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            Aucune agence active répertoriée dans la période.
          </div>
        )}
      </AdminCard>
    </div>
  );
}
