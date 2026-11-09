'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  RefreshCw,
  Download,
  Settings,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { Booking, AgencySubscription, SubscriptionPlan } from '@/types';
import {
  AdminCard,
  SectionHeader,
  TableWrapper,
  Th,
  Td,
  TableSkeletonRows,
  BookingStatusBadge,
  EmptyState,
  Pagination,
  SearchInput,
  Btn,
  ErrorBanner,
} from '@/components/admin/AdminUI';
import { fetchAdminBookings } from '@/lib/api/admin-dashboard.api';
import { formatPrice } from '@/lib/utils';

const PAGE_SIZE = 20;

function csvExport(rows: Booking[]) {
  const header = ['Dossier', 'Client', 'Agence', 'Début', 'Fin', 'Total', 'Commission', 'Net agence', 'Statut'];
  const lines = rows.map((b) =>
    [
      b.booking_ref ?? b.reference ?? '',
      b.customer_name,
      b.agency?.name ?? '',
      b.start_date,
      b.end_date,
      b.total_price,
      b.commission_amount ?? 0,
      b.agency_amount ?? b.total_price,
      b.status,
    ]
      .map((v) => {
        const s = String(v ?? '');
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(';')
  );
  const blob = new Blob(['\uFEFF' + [header.join(';'), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clickdrive-finances-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminFinanceClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subscriptions, setSubscriptions] = useState<AgencySubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [updatingAgencyId, setUpdatingAgencyId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [bookingsData, subsRes] = await Promise.all([
        fetchAdminBookings(),
        fetch('/api/admin/subscriptions'),
      ]);

      if (!ctrl.signal.aborted) {
        setBookings(bookingsData);
      }

      const subsJson = await subsRes.json();
      if (!ctrl.signal.aborted && subsJson.success && subsJson.data) {
        setSubscriptions(subsJson.data.subscriptions || []);
        setPlans(subsJson.data.plans || []);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load('initial');
    return () => abortRef.current?.abort();
  }, [load]);

  const handleUpdatePlan = async (agencyId: string, newPlanSlug: string) => {
    setUpdatingAgencyId(agencyId);
    setPlanError(null);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId, planSlug: newPlanSlug }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPlanError(json.error || 'Erreur lors de la modification du forfait.');
        return;
      }
      // Recharger les données
      void load('refresh');
    } catch (err: unknown) {
      setPlanError(err instanceof Error && err.message ? err.message : 'Erreur réseau.');
    } finally {
      setUpdatingAgencyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        (b.booking_ref ?? b.reference ?? '').toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        (b.agency?.name ?? '').toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );
  useEffect(() => setPage(0), [search]);

  return (
    <div className="space-y-8">
      {error && <ErrorBanner message={error} onRetry={() => void load('refresh')} retrying={refreshing} />}
      {planError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span><strong>Forfait non modifié.</strong> {planError}</span>
          <button type="button" onClick={() => setPlanError(null)} className="shrink-0 font-semibold underline">Fermer</button>
        </div>
      )}

      {/* Monetization Model Info Banner */}
      <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50/90 via-white to-slate-50 px-6 py-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B1220] text-white shadow-xs">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B1220]">
                  Modèle Économique Actif
                </span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5">
                  Abonnement Mensuel Flotte (0% Commission)
                </span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                Rémunération par abonnement mensuel basé sur la capacité en véhicules
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Chaque concession souscrit un abonnement proportionnel à la taille de sa flotte (Starter, Pro, Business, Illimité). Les réservations de véhicules génèrent 0% de prélèvement, garantissant 100% des fonds aux concessions.
              </p>
            </div>
          </div>

          <Link
            href="/admin/settings/commission"
            className="flex items-center gap-2 whitespace-nowrap self-start sm:self-center rounded-xl bg-white border border-blue-200 px-4 py-2.5 text-xs font-bold text-[#0B1220] hover:bg-blue-50 shadow-xs transition"
          >
            <Settings className="h-4 w-4" />
            <span>Configurer les forfaits</span>
          </Link>
        </div>
      </div>

      {/* Section 1: Agency Subscriptions Table */}
      <AdminCard noPadding>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 border-b border-slate-100">
          <div>
            <SectionHeader title="Abonnements & Capacité des concessions" />
            <p className="text-xs text-slate-500 mt-0.5">
              Suivi des quotas de véhicules, forfaits souscrits et renouvellements.
            </p>
          </div>
          <Btn variant="secondary" size="sm" onClick={() => void load('refresh')} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Btn>
        </div>

        <TableWrapper>
          <thead className="bg-slate-50">
            <tr>
              <Th>Concession</Th>
              <Th>Forfait Souscrit</Th>
              <Th>Capacité du Parc</Th>
              <Th>Tarif Mensuel</Th>
              <Th>Échéance</Th>
              <Th>Statut</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableSkeletonRows cols={7} rows={4} />
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                  Aucune concession enregistrée.
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => {
                const isUpdating = updatingAgencyId === sub.agency_id;
                const isUnlimited = sub.vehicle_capacity === null;

                return (
                  <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                          {sub.agency_name?.substring(0, 2).toUpperCase() || 'AG'}
                        </div>
                        <span className="font-bold text-slate-900 text-sm">
                          {sub.agency_name}
                        </span>
                      </div>
                    </Td>

                    <Td>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 border border-blue-200">
                        <Sparkles className="h-3 w-3 text-[#0B1220]" />
                        <span className="text-xs font-bold text-[#0B1220]">
                          {sub.plan.name}
                        </span>
                      </div>
                    </Td>

                    <Td>
                      <div className="space-y-1 w-36">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-900">
                            {sub.current_vehicles_count} / {isUnlimited ? '∞' : sub.vehicle_capacity}
                          </span>
                          <span
                            className={
                              sub.is_at_capacity
                                ? 'text-red-600'
                                : sub.capacity_usage_pct > 80
                                ? 'text-amber-600'
                                : 'text-slate-500'
                            }
                          >
                            {isUnlimited ? 'Illimité' : `${sub.capacity_usage_pct}%`}
                          </span>
                        </div>
                        {!isUnlimited && (
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                sub.is_at_capacity
                                  ? 'bg-red-500'
                                  : sub.capacity_usage_pct > 80
                                  ? 'bg-amber-500'
                                  : 'bg-[#0B1220]'
                              }`}
                              style={{ width: `${sub.capacity_usage_pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </Td>

                    <Td>
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        {formatPrice(sub.price_monthly)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium"> / mois</span>
                    </Td>

                    <Td>
                      <span className="text-xs text-slate-600 whitespace-nowrap">
                        {sub.billing_cycle_end}
                      </span>
                    </Td>

                    <Td>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        {sub.status}
                      </span>
                    </Td>

                    <Td className="text-right">
                      {isUpdating ? (
                        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0B1220]" />
                          <span>Mise à jour...</span>
                        </div>
                      ) : (
                        <select
                          value={sub.plan.slug}
                          onChange={(e) => handleUpdatePlan(sub.agency_id, e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-[#0B1220]"
                        >
                          {plans.map((p) => (
                            <option key={p.id} value={p.slug}>
                              {p.name} ({formatPrice(p.price_monthly)})
                            </option>
                          ))}
                        </select>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrapper>
      </AdminCard>

      {/* Section 2: Bookings Ledger (With 0% commission notation) */}
      <AdminCard noPadding>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 border-b border-slate-100">
          <div>
            <SectionHeader title="Grand livre des réservations clients" />
            <p className="text-xs text-slate-500 mt-0.5">
              Historique des flux transactionnels (0% de commission prélevée sur le modèle actuel).
            </p>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Dossier, client, agence…"
              className="w-60"
            />
            <Btn variant="secondary" size="sm" onClick={() => void load('refresh')} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => csvExport(filtered)} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Btn>
          </div>
        </div>

        <TableWrapper>
          <thead className="bg-slate-50">
            <tr>
              <Th>Dossier</Th>
              <Th className="hidden md:table-cell">Agence</Th>
              <Th className="hidden lg:table-cell">Dates</Th>
              <Th>Total (MAD)</Th>
              <Th>Commission ClickDrive</Th>
              <Th className="hidden sm:table-cell">Net Agence</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <TableSkeletonRows cols={7} rows={6} />
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6">
                  <EmptyState icon={DollarSign} title="Aucune réservation trouvée" />
                </td>
              </tr>
            ) : (
              paginated.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <Td>
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {b.booking_ref ?? b.reference ?? b.id.slice(0, 8)}
                    </span>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <span className="text-sm font-medium text-slate-700 truncate max-w-35 block">
                      {b.agency?.name ?? '—'}
                    </span>
                  </Td>
                  <Td className="hidden lg:table-cell">
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {b.start_date} → {b.end_date}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm font-bold tabular-nums text-slate-900">
                      {formatPrice(b.total_price)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs font-semibold tabular-nums text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      0 MAD (Inclus)
                    </span>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <span className="text-sm font-extrabold tabular-nums text-emerald-700">
                      {formatPrice(b.agency_amount ?? b.total_price)}
                    </span>
                  </Td>
                  <Td>
                    <BookingStatusBadge status={b.status} />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrapper>

        <div className="px-5 pb-4 sm:px-6">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </div>
      </AdminCard>
    </div>
  );
}
