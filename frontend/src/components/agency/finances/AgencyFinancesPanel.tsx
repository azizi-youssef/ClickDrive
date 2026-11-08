'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CircleDollarSign,
  TrendingUp,
  Percent,
  Wallet,
  ArrowDownToLine,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import type { AgencySubscription, SubscriptionPlan } from '@/types';
import { AgencySubscriptionModal } from '../subscription/AgencySubscriptionModal';

export type TransactionItem = {
  id: string;
  reference: string;
  date: string;
  customerName: string;
  vehicle: string;
  totalPrice: number;
  commissionRate: number;
  commissionAmount: number;
  agencyAmount: number;
  status: string;
  commissionStatus: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFinances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, plansRes] = await Promise.all([
        fetch(`/api/agencies/${agencyId}/finances`),
        fetch('/api/subscriptions/plans'),
      ]);
      const json = await res.json();
      const plansJson = await plansRes.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Impossible de charger le relevé financier.');
      }
      setData(json.data);
      if (plansJson.success && plansJson.data) {
        setPlans(plansJson.data);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données financières.');
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadFinances();
  }, [loadFinances]);

  const exportCSV = () => {
    if (!data || data.transactions.length === 0) return;
    const headers = [
      'Référence',
      'Date',
      'Client',
      'Véhicule',
      'Montant Brut (MAD)',
      'Taux Comm (%)',
      'Commission ClickDrive (MAD)',
      'Net Agence (MAD)',
      'Statut Réservation',
      'Statut Commission',
    ];
    const rows = data.transactions.map((t) => [
      t.reference,
      new Date(t.date).toLocaleDateString('fr-FR'),
      `"${t.customerName.replace(/"/g, '""')}"`,
      `"${t.vehicle.replace(/"/g, '""')}"`,
      t.totalPrice,
      t.commissionRate,
      t.commissionAmount,
      t.agencyAmount,
      t.status,
      t.commissionStatus,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clickdrive_finances_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <h3 className="font-bold text-slate-900">Grand livre des réservations</h3>
          <p className="text-xs text-slate-500">
            Relevé exhaustif des commissions et répartitions financières certifiées par ClickDrive.
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
                  <th className="px-4 py-3 text-right">Commission (0%)</th>
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
                    <td className="px-4 py-3 text-right font-medium text-accent-text">
                      -{formatPrice(t.commissionAmount)}
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
                        {t.status}
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
          onSuccess={(updatedSub) => {
            setData((prev) => (prev ? { ...prev, subscription: updatedSub } : prev));
          }}
        />
      )}
    </div>
  );
}
