'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, Download, RefreshCw, FileText, Wallet, Receipt, Motorbike } from 'lucide-react';
import { isMotorcycle } from '@/lib/vehicles/kind';
import type { Booking } from '@/types';
import {
  AdminCard,
  TableWrapper,
  Th,
  Td,
  TableSkeletonRows,
  BookingStatusBadge,
  EmptyState,
  Pagination,
  SearchInput,
  SelectFilter,
  Btn,
  ErrorBanner,
  KpiCard,
} from '@/components/admin/AdminUI';
import { fetchAdminBookings } from '@/lib/api/admin-dashboard.api';
import { formatNumber, formatPrice } from '@/lib/utils';

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Voitures et motos' },
  { value: 'CAR', label: 'Voitures' },
  { value: 'MOTORCYCLE', label: 'Motos' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'REQUESTED', label: 'Demandée' },
  { value: 'CONFIRMED', label: 'Confirmée' },
  { value: 'APPROVED', label: 'Approuvée' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminée' },
  { value: 'REJECTED', label: 'Refusée' },
  { value: 'CANCELLED', label: 'Annulée' },
];

function csvExport(rows: Booking[]) {
  const header = ['Dossier', 'Client', 'Email', 'Téléphone', 'Véhicule', 'Agence', 'Début', 'Fin', 'Jours', 'Montant (100% agence)', 'Commission ClickDrive', 'Statut', 'Créé le'];
  const lines = rows.map((b) =>
    [
      b.booking_ref ?? b.reference ?? '',
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      `${b.vehicle?.brand ?? ''} ${b.vehicle?.model ?? ''}`.trim(),
      b.agency?.name ?? '',
      b.start_date,
      b.end_date,
      b.total_days,
      b.total_price,
      '0 DH (0%)',
      b.status,
      b.created_at?.slice(0, 10) ?? '',
    ].map((v) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';')
  );
  const blob = new Blob(['\uFEFF' + [header.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clickdrive-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminBookingsClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await fetchAdminBookings();
      if (!ctrl.signal.aborted) setBookings(data);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      if (!ctrl.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { void load('initial'); return () => abortRef.current?.abort(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && (isMotorcycle(b.vehicle) ? 'MOTORCYCLE' : 'CAR') !== typeFilter) return false;
      if (!q) return true;
      return (
        (b.booking_ref ?? b.reference ?? '').toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        (b.customer_email ?? '').toLowerCase().includes(q) ||
        (b.agency?.name ?? '').toLowerCase().includes(q) ||
        (`${b.vehicle?.brand ?? ''} ${b.vehicle?.model ?? ''}`).toLowerCase().includes(q)
      );
    });
  }, [bookings, search, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  useEffect(() => setPage(0), [search, statusFilter, typeFilter]);

  // Totals for filtered view
  const totalVolume = useMemo(() => filtered.reduce((s, b) => s + (b.total_price ?? 0), 0), [filtered]);

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onRetry={() => void load('refresh')} retrying={refreshing} />}

      {/* Summary strip */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiCard
            label="Réservations affichées"
            value={filtered.length.toLocaleString('fr-FR')}
            icon={CalendarDays}
            sub={statusFilter === 'ALL' && !search ? 'Toutes les réservations' : 'Selon les filtres actifs'}
          />
          <KpiCard
            label="Volume d’affaires"
            value={formatNumber(Math.round(totalVolume))}
            unit="DH"
            icon={Wallet}
            tone="success"
            sub="Encaissé à 100 % par les agences"
          />
          <KpiCard
            label="Panier moyen"
            value={formatNumber(Math.round(filtered.length > 0 ? totalVolume / filtered.length : 0))}
            unit="DH"
            icon={Receipt}
            tone="info"
            sub="Par réservation"
          />
        </div>
      )}

      <AdminCard noPadding>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 border-b border-slate-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Dossier, client, agence, véhicule…"
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <SelectFilter value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
            <SelectFilter
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
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

        {/* Table */}
        <TableWrapper>
          <thead className="bg-slate-50">
            <tr>
              <Th>Dossier</Th>
              <Th>Client</Th>
              <Th className="hidden md:table-cell">Véhicule</Th>
              <Th className="hidden lg:table-cell">Agence</Th>
              <Th className="hidden xl:table-cell">Dates</Th>
              <Th className="hidden sm:table-cell">Montant</Th>
              <Th>Statut</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <TableSkeletonRows cols={8} rows={10} />
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-0">
                  <EmptyState
                    icon={CalendarDays}
                    title="Aucune réservation"
                    description={search || statusFilter !== 'ALL' ? 'Aucun résultat pour ces filtres.' : 'Aucune réservation enregistrée.'}
                  />
                </td>
              </tr>
            ) : (
              paginated.map((b) => {
                const ref = b.booking_ref ?? b.reference ?? b.id.slice(0, 8);
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <Td>
                      <span className="font-mono text-xs font-semibold text-slate-700">{ref}</span>
                    </Td>
                    <Td>
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-35">{b.customer_name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-35">{b.customer_email}</p>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        {isMotorcycle(b.vehicle) && <Motorbike className="h-4 w-4 shrink-0 text-slate-500" aria-label="Moto" />}
                        {b.vehicle?.brand} {b.vehicle?.model}
                      </span>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <span className="text-sm text-slate-700 truncate max-w-30 block">{b.agency?.name ?? '—'}</span>
                    </Td>
                    <Td className="hidden xl:table-cell">
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {b.start_date} → {b.end_date}
                        <br />
                        <span className="text-slate-400">{b.total_days}j</span>
                      </span>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <div>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{formatPrice(b.total_price)}</p>
                        <p className="text-xs text-slate-400 tabular-nums">com. {formatPrice(b.commission_amount)}</p>
                      </div>
                    </Td>
                    <Td>
                      <BookingStatusBadge status={b.status} />
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/api/bookings/${encodeURIComponent(ref)}/pdf`}
                          target="_blank"
                          title="Télécharger PDF"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrapper>

        {/* Pagination */}
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
