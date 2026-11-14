'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  CheckSquare,
  Clock,
  BarChart3,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { bookingStatusLabel } from '@/lib/bookings/status';
import { normalizeBookingStatus } from '@clickdrive/shared/booking-status';
import { csvDate, csvFileName, downloadCsv } from '@/lib/export/csv';
import type { AgencySubscription, PlanChangeRequest, SubscriptionPlan } from '@/types';
import { AgencySubscriptionModal } from '../subscription/AgencySubscriptionModal';
import { PendingPlanChangeBanner } from '../subscription/PendingPlanChangeBanner';

export type TransactionItem = {
  id: string;
  reference: string;
  date: string;
  customerName: string;
  vehicle: string;
  totalPrice: number;
  agencyAmount: number;
  status: string;
};

export type FinanceData = {
  platformRate: number;
  subscription?: AgencySubscription;
  kpis: {
    grossRevenue: number;
    platformCommission: number;
    agencyNet: number;
    settledNet: number;
    pendingNet: number;
    totalBookingsCount: number;
    completedBookingsCount: number;
  };
  transactions: TransactionItem[];
};

export function AgencyFinancesPanel({ agencyId }: { agencyId: string }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<PlanChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFinances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, plansRes, subRes] = await Promise.all([
        fetch(`/api/agencies/${agencyId}/finances`),
        fetch('/api/subscriptions/plans'),
        fetch(`/api/agencies/${agencyId}/subscription`),
      ]);
      const json = await res.json();
      const plansJson = await plansRes.json();
      const subJson = await subRes.json().catch(() => null);
      setPendingChange(subJson?.pendingChange ?? null);

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Impossible de charger le relevé financier.');
      }
      setData(json.data);
      if (plansJson.success && plansJson.data) {
        setPlans(plansJson.data);
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : '') || 'Erreur lors du chargement des données financières.');
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadFinances();
  }, [loadFinances]);

  const exportCSV = () => {
    if (!data || data.transactions.length === 0) return;
    downloadCsv(csvFileName('clickdrive-finances'), [
      ['Référence', 'Date', 'Client', 'Véhicule', 'Montant (DH)', 'Part agence (DH)', 'Statut'],
      ...data.transactions.map((t) => [
        t.reference,
        csvDate(t.date),
        t.customerName,
        t.vehicle,
        t.totalPrice,
        t.agencyAmount,
        bookingStatusLabel(t.status, 'fr', 'business'),
      ]),
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Modèle par abonnement mensuel : <strong>0% de commission ClickDrive</strong>. Vous conservez 100% de vos montants de location.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadFinances()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 shadow-xs"
            title="Actualiser"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={exportCSV}
            disabled={!data || data.transactions.length === 0}
            className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Subscription Status Banner */}
      {data?.subscription && (
        <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50/80 via-white to-slate-50 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white shadow-xs">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Forfait Concession Actif
                </span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5">
                  {data.subscription.status}
                </span>
              </div>
              <p className="text-base font-extrabold text-slate-900">
                {data.subscription.plan.name} — {formatPrice(data.subscription.price_monthly)} / mois
              </p>
              <p className="text-xs text-slate-500">
                Capacité : {data.subscription.current_vehicles_count} / {data.subscription.vehicle_capacity === null ? 'Illimité' : `${data.subscription.vehicle_capacity} véhicules`} • Renouvellement : {data.subscription.billing_cycle_end}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-ink hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <span>Changer de formule</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingChange && (
        <PendingPlanChangeBanner agencyId={agencyId} request={pendingChange} onCancelled={() => setPendingChange(null)} />
      )}

      {/* KPI Cards — montants cumulés depuis l'ouverture du compte (pas de filtre de période ici) */}
      {data && (
        <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3', data.platformRate > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-3')}>
          {/* Brut et commission : seulement si une commission s'applique (0 % avec les forfaits) ;
              sinon ils répéteraient le montant net et contrediraient le « 0 % de commission » ci-dessus */}
          {data.platformRate > 0 && (
            <>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">CA Brut</span>
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{formatPrice(data.kpis.grossRevenue)}</p>
                <p className="text-xs text-slate-500">Total réservations confirmées</p>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commission</span>
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{formatPrice(data.kpis.platformCommission)}</p>
                <p className="text-xs text-slate-500">Part plateforme ({(data.platformRate * 100).toFixed(0)}%)</p>
              </div>
            </>
          )}

          {/* Net agence */}
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Net Agence</span>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-800">{formatPrice(data.kpis.agencyNet)}</p>
            <p className="text-xs text-emerald-700">Votre part, toutes périodes</p>
          </div>

          {/* Réglé */}
          <div className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Réglé</span>
              <CheckSquare className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-extrabold text-blue-800">{formatPrice(data.kpis.settledNet)}</p>
            <p className="text-xs text-blue-700">{data.kpis.completedBookingsCount} dossiers clôturés</p>
          </div>

          {/* En attente */}
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">En attente</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-extrabold text-amber-800">{formatPrice(data.kpis.pendingNet)}</p>
            <p className="text-xs text-amber-700">{data.kpis.totalBookingsCount - data.kpis.completedBookingsCount} dossiers actifs</p>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <h3 className="font-bold text-slate-900">Grand livre des réservations</h3>
          <p className="text-xs text-slate-500">
            Relevé de vos réservations et des montants associés.
          </p>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
          </div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Aucune opération financière enregistrée pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Dossier</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Véhicule</th>
                  <th className="px-4 py-3 text-right">Montant Brut</th>
                  <th className="px-4 py-3 text-right">Part Agence</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{t.reference}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{t.customerName}</td>
                    <td className="px-4 py-3 text-slate-600">{t.vehicle}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatPrice(t.totalPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {formatPrice(t.agencyAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase',
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'ACTIVE'
                              ? 'bg-blue-100 text-blue-800'
                              : t.status === 'REJECTED' || t.status === 'CANCELLED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {t.status === 'COMPLETED'
                          ? 'Clôturé'
                          : t.status === 'ACTIVE'
                            ? 'En cours'
                            : t.status === 'REJECTED'
                              ? 'Refusé'
                              : t.status === 'CANCELLED'
                                ? 'Annulé'
                                : normalizeBookingStatus(t.status) === 'REQUESTED'
                                  ? 'En attente'
                                  : ['APPROVED', 'READY_FOR_PICKUP'].includes(normalizeBookingStatus(t.status))
                                    ? 'Confirmé'
                                    : t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.subscription && (
        <AgencySubscriptionModal
          agencyId={agencyId}
          subscription={data.subscription}
          plans={plans}
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          pendingChange={pendingChange}
          onRequested={setPendingChange}
        />
      )}
    </div>
  );
}
