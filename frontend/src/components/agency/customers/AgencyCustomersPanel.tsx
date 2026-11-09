'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

export type CustomerRow = {
  id: string;
  booking_ref: string;
  reference: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  cin?: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  created_at: string;
  vehicle?: { brand: string; model: string };
};

export function AgencyCustomersPanel({ agencyId }: { agencyId: string }) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '15',
        q: search,
      });

      const res = await fetch(`/api/agencies/${agencyId}/customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Impossible de charger les dossiers clients.');
      }
      setCustomers(json.data ?? []);
      setTotalPages(json.meta?.totalPages ?? 1);
      setTotalCount(json.meta?.total ?? 0);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : '') || 'Erreur lors du chargement des clients.');
    } finally {
      setLoading(false);
    }
  }, [agencyId, page, search]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {totalCount} dossier{totalCount > 1 ? 's' : ''} client{totalCount > 1 ? 's' : ''} associé{totalCount > 1 ? 's' : ''} aux réservations de votre agence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCustomers()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, CIN, référence dossier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-[#E63946] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Aucun client ne correspond à votre recherche.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Coordonnées</th>
                  <th className="px-4 py-3">Véhicule loué</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div>{c.customer_name}</div>
                      {c.cin && <div className="text-[11px] text-slate-400">CIN : {c.cin}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{c.customer_phone}</span>
                      </div>
                      {c.customer_email && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Mail className="h-3 w-3" />
                          <span>{c.customer_email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium">
                        {c.vehicle ? `${c.vehicle.brand} ${c.vehicle.model}` : 'Véhicule'}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {c.reference || c.booking_ref}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      Du {c.start_date} au {c.end_date}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatPrice(c.total_price)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-700">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
          <p className="text-slate-500">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
