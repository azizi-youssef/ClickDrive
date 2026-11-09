'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Car,
  CalendarDays,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Inbox,
  ShieldCheck,
  Loader2,
  Wallet,
} from 'lucide-react';
import type { AdminStats } from '@/lib/api/stats.api';
import { AdminCard, BookingStatusBadge, AgencyStatusBadge, Btn, ErrorBanner, EmptyState, KpiCard } from '@/components/admin/AdminUI';
import {
  fetchAdminStats,
  fetchAdminOverview,
  fetchHealth,
  patchAgencyVerification,
  type HealthReport,
} from '@/lib/api/admin-dashboard.api';
import type { AdminOverview, AdminOverviewAgency } from '@/lib/admin/overview';
import type { SubscriptionStats } from '@/types';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';

interface Props {
  initialStats: AdminStats | null;
  statsError: string | null;
}

/* L'export des réservations se fait depuis la page Réservations (filtres, liste complète paginée) */

const HEALTH_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'error' }> = {
  ok: { label: 'Opérationnel', tone: 'ok' },
  configured: { label: 'Configuré', tone: 'ok' },
  skipped: { label: 'Non configuré', tone: 'warn' },
  error: { label: 'Erreur', tone: 'error' },
};
const HEALTH_NAME: Record<string, string> = {
  app: 'Application',
  database: 'Base de données',
  supabase: 'Supabase',
};
const TONE_DOT = { ok: 'bg-emerald-500', warn: 'bg-amber-500', error: 'bg-[#E63946]' } as const;
const TONE_TEXT = { ok: 'text-emerald-700', warn: 'text-amber-700', error: 'text-[#B4232F]' } as const;

const nf = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function formatDay(iso?: string) {
  if (!iso) return '—';
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : shortDate.format(date);
}

/* ── Sous-composants ─────────────────────────────────────────────────── */
function CardHeader({ title, href, linkLabel, badge }: { title: string; href: string; linkLabel: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-extrabold text-[#0B1220]">{title}</h2>
        {badge}
      </div>
      <Link
        href={href}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-accent-text outline-none hover:bg-[#E63946]/5 focus-visible:ring-2 focus-visible:ring-[#E63946]"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function Initial({ name, dark }: { name: string; dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
        dark ? 'bg-[#0B1220] text-white' : 'bg-[#F5F6F8] text-slate-600'
      )}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export function AdminOverviewClient({ initialStats, statsError }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(initialStats);
  // Décomptes, tendance et listes courtes calculés en base (aucune liste complète dans le navigateur)
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [healthLoaded, setHealthLoaded] = useState(false);
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(statsError);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AdminOverviewAgency | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [newStats, newOverview, healthData, subJson] = await Promise.all([
        fetchAdminStats(),
        fetchAdminOverview(),
        fetchHealth(),
        fetch('/api/admin/subscriptions')
          .then((r) => r.json())
          .catch(() => null),
      ]);
      if (ctrl.signal.aborted) return;
      setStats(newStats);
      setOverview(newOverview);
      if (subJson?.success && subJson.data?.stats) {
        setSubscriptionStats(subJson.data.stats);
      }
      setHealth(healthData);
      setLastRefresh(new Date());
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
        setHealthLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    void load('initial');
    return () => abortRef.current?.abort();
  }, [load]);

  const handleVerify = async (agency: AdminOverviewAgency, verified: boolean, confirmed = false) => {
    if (!verified && !confirmed) {
      setPendingRevoke(agency);
      return;
    }
    setPendingRevoke(null);
    setVerifyingId(agency.id);
    try {
      await patchAgencyVerification(agency.id, { status: verified ? 'ACTIVE' : 'SUSPENDED', verified });
      showToast('success', verified ? `${agency.name} est maintenant vérifiée.` : 'Vérification révoquée.');
      void load('refresh');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erreur');
    } finally {
      setVerifyingId(null);
    }
  };

  /* ── Dérivés ─────────────────────────────────────────────────────── */
  const counts = overview?.bookings;
  const total = counts?.total ?? 0;
  const pendingBookings = counts?.pending ?? 0;
  const confirmedBookings = counts?.confirmed ?? 0;
  const completedBookings = counts?.completed ?? 0;
  const closedBookings = counts?.closed ?? 0;
  const bookings = overview?.recentBookings ?? [];
  const pendingAgencies = overview?.pendingAgencies.items ?? [];
  const pendingAgencyCount = overview?.pendingAgencies.count ?? 0;
  const verificationRate =
    stats && stats.totalAgencies > 0 ? Math.round((stats.verifiedAgencies / stats.totalAgencies) * 100) : 0;
  const healthEntries = health ? Object.entries(health.checks) : [];
  const healthIssues = healthEntries.filter(([, value]) => (HEALTH_LABEL[value]?.tone ?? 'warn') !== 'ok');
  // Demandes reçues sur 30 jours glissants, comparées aux 30 jours précédents (décomptes en base)
  const bookingsTrend = counts
    ? { current: counts.createdLast30Days, previous: counts.createdPrevious30Days, label: 'vs 30 j. précédents' }
    : null;
  const confirmationRate = total > 0 ? Math.round(((confirmedBookings + completedBookings) / total) * 100) : 0;
  const plans = (subscriptionStats?.plansDistribution ?? []).filter((plan) => plan.count > 0);
  const planTotal = plans.reduce((sum, plan) => sum + plan.count, 0);

  const distribution = [
    { label: 'En attente', value: pendingBookings, color: 'bg-amber-400' },
    { label: 'Confirmées / en cours', value: confirmedBookings, color: 'bg-emerald-500' },
    { label: 'Terminées', value: completedBookings, color: 'bg-[#0B1220]' },
    { label: 'Annulées / refusées', value: closedBookings, color: 'bg-slate-300' },
  ];

  const todos = [
    pendingAgencyCount > 0 && {
      key: 'agencies',
      href: '/admin/agencies?filter=PENDING',
      icon: Building2,
      title: `${pendingAgencyCount} agence${pendingAgencyCount > 1 ? 's' : ''} à vérifier`,
      text: 'Validez les nouvelles agences pour les rendre visibles.',
      tone: 'amber',
    },
    pendingBookings > 0 && {
      key: 'bookings',
      href: '/admin/bookings',
      icon: Inbox,
      title: `${pendingBookings} réservation${pendingBookings > 1 ? 's' : ''} en attente`,
      text: 'Demandes pas encore confirmées par les agences.',
      tone: 'slate',
    },
    healthIssues.length > 0 && {
      key: 'health',
      href: '/admin/health',
      icon: AlertTriangle,
      title: `${healthIssues.length} service${healthIssues.length > 1 ? 's' : ''} à surveiller`,
      text: healthIssues.map(([key]) => HEALTH_NAME[key] ?? key).join(', '),
      tone: 'red',
    },
  ].filter(Boolean) as { key: string; href: string; icon: React.ElementType; title: string; text: string; tone: 'amber' | 'slate' | 'red' }[];

  const todoTone = {
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-[#F5F6F8] text-[#0B1220]',
    red: 'bg-red-50 text-[#B4232F]',
  } as const;

  return (
    <div className="space-y-6">
      {/* ── Toast ────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-6 end-6 z-50">
        {toast && (
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg',
              toast.type === 'success'
                ? 'border-emerald-200 bg-white text-emerald-800'
                : 'border-red-200 bg-white text-[#B4232F]'
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {toast.msg}
          </div>
        )}
      </div>

      {/* ── Barre d'actions ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {lastRefresh ? (
            <>
              Données actualisées à{' '}
              <span className="font-semibold text-slate-700">
                {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          ) : (
            'Chargement des données de la plateforme…'
          )}
        </p>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={() => void load('refresh')} disabled={refreshing || loading} className="flex-1 sm:flex-none">
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            Actualiser
          </Btn>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load('refresh')} retrying={refreshing} />}

      {/* ── À traiter ────────────────────────────────────────────────── */}
      {!loading && (
        <section aria-labelledby="admin-todo">
          <h2 id="admin-todo" className="sr-only">
            À traiter
          </h2>
          {todos.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-emerald-900">
                Tout est à jour : aucune agence ni réservation en attente, tous les services répondent.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {todos.map((todo) => {
                const Icon = todo.icon;
                return (
                  <li key={todo.key}>
                    <Link
                      href={todo.href}
                      className="group flex h-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 outline-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-[#E63946]"
                    >
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', todoTone[todo.tone])}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-[#0B1220]">{todo.title}</span>
                        <span className="block truncate text-xs text-slate-500">{todo.text}</span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text motion-reduce:transition-none rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ── KPI ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          href="/admin/agencies"
          loading={loading}
          icon={Building2}
          label="Agences vérifiées"
          value={stats?.verifiedAgencies ?? 0}
          unit={`/ ${stats?.totalAgencies ?? 0}`}
          progress={verificationRate}
          sub={`${verificationRate} % du réseau vérifié`}
        />
        <KpiCard
          href="/admin/fleet"
          loading={loading}
          icon={Car}
          label="Véhicules référencés"
          value={nf.format(stats?.totalVehicles ?? 0)}
          sub={
            typeof stats?.totalMotorcycles === 'number'
              ? `${nf.format(Math.max(0, (stats?.totalVehicles ?? 0) - stats.totalMotorcycles))} voitures · ${nf.format(stats.totalMotorcycles)} motos`
              : `${nf.format(subscriptionStats?.fleetCapacityTotal ?? 0)} places couvertes par les forfaits`
          }
        />
        <KpiCard
          href="/admin/bookings"
          loading={loading}
          icon={CalendarDays}
          label="Réservations"
          value={nf.format(counts?.total ?? stats?.totalBookings ?? 0)}
          trend={bookingsTrend}
          sub={`${counts?.createdLast30Days ?? 0} reçues sur 30 jours · ${confirmationRate} % confirmées ou terminées`}
        />
        <KpiCard
          href="/admin/analytics"
          loading={loading}
          icon={Wallet}
          tone="success"
          label="Volume d’affaires"
          value={nf.format(stats?.totalVolume ?? 0)}
          unit="DH"
          sub="Encaissé à 100 % par les agences"
        />
      </div>

      {/* ── MRR ──────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="admin-mrr"
        className="relative overflow-hidden rounded-2xl bg-[#0B1220] px-6 py-6 text-white sm:px-8"
      >
        <div className="pointer-events-none absolute -top-16 end-0 h-48 w-72 rounded-full bg-[#E63946]/15 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
              <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
              Modèle abonnement · 0 % de commission
            </span>
            <h2 id="admin-mrr" className="mt-4 text-sm font-semibold text-slate-400">
              Revenu récurrent mensuel
            </h2>
            {loading ? (
              <span className="mt-2 block h-10 w-44 animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
            ) : (
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
                {nf.format(subscriptionStats?.monthlyRecurringRevenue ?? 0)}
                <span className="ms-2 text-lg font-semibold text-slate-400">DH / mois</span>
              </p>
            )}
            <p className="mt-1.5 text-sm text-slate-400">
              {nf.format(subscriptionStats?.activeSubscribers ?? 0)} agence
              {(subscriptionStats?.activeSubscribers ?? 0) > 1 ? 's' : ''} abonnée
              {(subscriptionStats?.activeSubscribers ?? 0) > 1 ? 's' : ''}
            </p>
            <Link
              href="/admin/finance"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0B1220] outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#E63946] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220]"
            >
              Gérer les forfaits
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/4 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Répartition des forfaits</p>
            {loading ? (
              <span className="mt-4 block h-3 animate-pulse rounded-full bg-white/10" aria-hidden="true" />
            ) : planTotal === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Aucun forfait actif pour le moment.</p>
            ) : (
              <>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  {plans.map((plan, i) => (
                    <div
                      key={plan.slug}
                      className={cn('h-full', ['bg-[#E63946]', 'bg-amber-300', 'bg-white', 'bg-slate-400'][i % 4])}
                      style={{ width: `${(plan.count / planTotal) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-4 space-y-2">
                  {plans.map((plan, i) => (
                    <li key={plan.slug} className="flex items-center gap-2.5 text-sm">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', ['bg-[#E63946]', 'bg-amber-300', 'bg-white', 'bg-slate-400'][i % 4])} aria-hidden="true" />
                      <span className="flex-1 truncate font-semibold text-slate-200">{plan.planName}</span>
                      <span className="tabular-nums text-slate-400">
                        {plan.count} agence{plan.count > 1 ? 's' : ''}
                      </span>
                      <span className="w-24 text-end font-bold tabular-nums">{nf.format(plan.revenue)} DH</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Réservations + colonne droite ───────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <AdminCard noPadding>
          <CardHeader title="Réservations récentes" href="/admin/bookings" linkLabel="Tout voir" />

          {/* Répartition par statut */}
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={distribution.map((d) => `${d.label} : ${d.value}`).join(', ')}>
              {total > 0 &&
                distribution.map((d) => (
                  <div key={d.label} className={cn('h-full transition-[width] duration-500', d.color)} style={{ width: `${(d.value / total) * 100}%` }} />
                ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {distribution.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', d.color)} aria-hidden="true" />
                  <dt className="truncate text-xs text-slate-500">{d.label}</dt>
                  <dd className="ms-auto text-sm font-extrabold tabular-nums text-[#0B1220]">{loading ? '—' : d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Aucune réservation" description="Les réservations apparaîtront ici dès qu'elles arrivent." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#F8F9FA] sm:px-6">
                  <Initial name={b.customer_name ?? ''} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-bold text-[#0B1220]">{b.customer_name}</span>
                      {(b.booking_ref || b.reference) && (
                        <span className="hidden shrink-0 font-mono text-[11px] text-slate-400 sm:inline">{b.booking_ref ?? b.reference}</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[`${b.vehicle?.brand ?? ''} ${b.vehicle?.model ?? ''}`.trim(), b.agency?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-end md:block">
                    <p className="text-xs font-semibold text-slate-700">
                      {formatDay(b.start_date)} → {formatDay(b.end_date)}
                    </p>
                    {typeof b.total_price === 'number' && b.total_price > 0 && (
                      <p className="text-xs tabular-nums text-slate-500">{nf.format(b.total_price)} DH</p>
                    )}
                  </div>
                  <BookingStatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <div className="space-y-6">
          {/* Agences à vérifier */}
          <AdminCard noPadding>
            <CardHeader
              title="Agences à vérifier"
              href="/admin/agencies?filter=PENDING"
              linkLabel="Gérer"
              badge={
                !loading && pendingAgencyCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-bold text-white">
                    {pendingAgencyCount}
                  </span>
                ) : undefined
              }
            />
            {loading ? (
              <div className="space-y-2 px-5 py-4 sm:px-6" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : pendingAgencies.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Tout est à jour" description="Aucune agence en attente de vérification." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingAgencies.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <Initial name={a.name} dark />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0B1220]">{a.name}</p>
                      <p className="truncate text-xs text-slate-500">{[a.city, a.email].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden sm:inline-flex">
                        <AgencyStatusBadge status={a.status} />
                      </span>
                      <button
                        type="button"
                        disabled={verifyingId === a.id}
                        onClick={() => void handleVerify(a, true)}
                        aria-label={`Vérifier ${a.name}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0B1220] px-3 text-xs font-bold text-white outline-none transition-colors hover:bg-[#1a2333] focus-visible:ring-2 focus-visible:ring-[#E63946] disabled:opacity-50"
                      >
                        {verifyingId === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Vérifier
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          {/* Santé plateforme : uniquement des contrôles réels */}
          <AdminCard noPadding>
            <CardHeader
              title="Santé de la plateforme"
              href="/admin/health"
              linkLabel="Détails"
              badge={<Zap className="h-4 w-4 text-accent-text" aria-hidden="true" />}
            />
            {!healthLoaded ? (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500 sm:px-6">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Vérification en cours…
              </div>
            ) : healthEntries.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500 sm:px-6">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                État du système indisponible pour le moment.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {healthEntries.map(([key, value]) => {
                  const meta = HEALTH_LABEL[value] ?? { label: value, tone: 'warn' as const };
                  return (
                    <li key={key} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[meta.tone])} aria-hidden="true" />
                      <span className="flex-1 text-sm font-semibold text-slate-700">{HEALTH_NAME[key] ?? key}</span>
                      <span className={cn('text-xs font-bold', TONE_TEXT[meta.tone])}>{meta.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>

      {pendingRevoke && (
        <ConfirmDialog
          title="Révoquer la vérification ?"
          message={`${pendingRevoke.name} perdra son badge « vérifiée » et son accès sera suspendu.`}
          confirmLabel="Révoquer"
          destructive
          busy={verifyingId === pendingRevoke.id}
          onConfirm={() => void handleVerify(pendingRevoke, false, true)}
          onCancel={() => setPendingRevoke(null)}
        />
      )}
    </div>
  );
}
