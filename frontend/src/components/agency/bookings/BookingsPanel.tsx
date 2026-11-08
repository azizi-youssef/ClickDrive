'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Motorbike } from 'lucide-react';
import { isMotorcycle } from '@/lib/vehicles/kind';
import { cn, formatPrice } from '@/lib/utils';
import { Pagination, SearchField, SelectField, Th } from '@/components/agency/shell/Controls';
import { EmptyState, ErrorBanner, TableSkeleton } from '@/components/agency/shell/Feedback';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { bookingStatusLabel as sharedBookingStatusLabel } from '@/lib/bookings/status';

/**
 * Réservation telle que renvoyée par /api/agencies/[id]/bookings.
 * Le tableau n'utilise que les colonnes nécessaires : aucune donnée client détaillée.
 */
export type AgencyBookingRow = {
  id: string;
  booking_ref: string | null;
  reference: string | null;
  vehicle_id: string;
  customer_name: string;
  start_date: string;
  end_date: string;
  total_days: number | null;
  total_price: number;
  commission_rate: number | null;
  commission_amount: number | null;
  agency_amount: number | null;
  status: string;
  created_at: string;
  vehicle: { id: string; brand: string; model: string; category: string | null } | null;
};

export type BookingsPage = {
  data: AgencyBookingRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

/** type : '' (tous), 'CAR' (voitures) ou 'MOTORCYCLE' (motos) */
export type BookingQuery = { q: string; status: string; sort: string; type?: string };

const TYPE_FILTERS = [
  { value: '', label: 'Voitures et motos' },
  { value: 'CAR', label: 'Voitures' },
  { value: 'MOTORCYCLE', label: 'Motos' },
] as const;

export const STATUS_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'REQUESTED', label: 'Nouvelle demande' },
  { value: 'SENT_TO_AGENCY', label: 'À traiter' },
  { value: 'APPROVED', label: 'Confirmée' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminée' },
  { value: 'REJECTED', label: 'Refusée' },
  { value: 'CANCELLED', label: 'Annulée' },
] as const;

const SORTS = [
  { value: 'created_at', label: 'Plus récentes' },
  { value: 'start_date', label: 'Départ à venir' },
  { value: 'amount_desc', label: 'Montant décroissant' },
  { value: 'amount_asc', label: 'Montant croissant' },
] as const;

export function bookingStatusLabel(status: string): string {
  return sharedBookingStatusLabel(status, 'fr', 'business');
}

export function bookingStatusVariant(status: string): 'available' | 'pending' | 'rented' {
  if (['APPROVED', 'ACTIVE', 'COMPLETED'].includes(status)) return 'available';
  if (['REQUESTED', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'UNDER_REVIEW'].includes(status)) {
    return 'pending';
  }
  return 'rented';
}

/** Montants persistés en base — jamais recalculés côté client. */
export function money(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : formatPrice(value);
}

export function bookingReference(booking: AgencyBookingRow): string {
  return booking.booking_ref ?? booking.reference ?? booking.id;
}

export function BookingsPanel({
  page,
  loading,
  error,
  onQueryChange,
  onPageChange,
  onRetry,
  onOpenDetail,
  canAct,
  busy,
}: {
  page: BookingsPage | null;
  loading: boolean;
  error: string | null;
  onQueryChange: (query: BookingQuery) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onOpenDetail: (booking: AgencyBookingRow) => void;
  canAct: boolean;
  busy: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<string>('created_at');
  const [type, setType] = useState('');
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const emit = useCallback((next: BookingQuery) => onQueryChange(next), [onQueryChange]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => emit({ q: value, status, sort, type }), 300);
  };

  const onStatusChange = (value: string) => {
    setStatus(value);
    emit({ q: search, status: value, sort, type });
  };

  const onSortChange = (value: string) => {
    setSort(value);
    emit({ q: search, status, sort: value, type });
  };

  const onTypeChange = (value: string) => {
    setType(value);
    emit({ q: search, status, sort, type: value });
  };

  const rows = page?.data ?? [];
  const meta = page?.meta ?? { page: 1, pageSize: 15, total: 0, totalPages: 1 };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchField
            value={search}
            onChange={onSearchChange}
            label="Rechercher une réservation"
            placeholder="Dossier, client..."
          />
          <SelectField value={status} onChange={onStatusChange} label="Filtrer par statut">
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </SelectField>
          <SelectField value={type} onChange={onTypeChange} label="Voitures ou motos">
            {TYPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </SelectField>
          <SelectField value={sort} onChange={onSortChange} label="Trier les réservations">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={onRetry} retrying={loading} />}

      {loading && !page ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            title="Aucune réservation"
            text="Aucun dossier ne correspond a ces criteres pour votre agence."
          />
        </div>
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-slate-200 bg-white transition-opacity',
            loading && 'opacity-60'
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <caption className="sr-only">Réservations de votre agence</caption>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <Th>Dossier</Th>
                  <Th>Client</Th>
                  <Th>Vehicule</Th>
                  <Th>Période</Th>
                  <Th align="right" numeric>Montant</Th>
                  <Th align="right" numeric>Net agence</Th>
                  <Th>Statut</Th>
                  <Th align="right">Détail</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((booking) => (
                  <tr key={booking.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-mono text-[13px] font-semibold text-[#0F172A]">
                      {bookingReference(booking)}
                    </td>
                    <td className="max-w-40 truncate px-5 py-4 text-slate-800">
                      {booking.customer_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {booking.vehicle ? (
                        <span className="inline-flex items-center gap-1.5">
                          {isMotorcycle(booking.vehicle) && (
                            <Motorbike className="h-4 w-4 shrink-0 text-slate-500" aria-label="Moto" />
                          )}
                          {booking.vehicle.brand} {booking.vehicle.model}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 tabular-nums text-slate-600">
                      {booking.start_date} {'->'} {booking.end_date}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#0F172A]">
                      {money(booking.total_price)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                      {money(booking.agency_amount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={booking.status} audience="business" size="sm" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(booking)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
                      >
                        <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={meta.page}
            pageCount={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onPage={onPageChange}
            label="réservations"
          />
        </div>
      )}

      {loading && page && (
        <p className="flex items-center justify-center gap-2 text-sm text-[#64748B]">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          Chargement...
        </p>
      )}

      {!canAct && (
        <p className="text-xs text-[#64748B]">
          Votre rôle ne permet pas de traiter les demandes de réservation.
        </p>
      )}

      {busy && <p className="text-xs text-[#64748B]">Operation en cours...</p>}
    </div>
  );
}
