'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Motorbike } from 'lucide-react';
import { isMotorcycle } from '@/lib/vehicles/kind';
import { TO_PROCESS_FILTER } from '@/lib/bookings/agency-queue';
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
  // Toute la file des demandes qui attendent une décision de l'agence (cible du lien « À traiter »)
  { value: TO_PROCESS_FILTER, label: 'Toutes les demandes à traiter' },
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

/* ── Dates : « 15 nov. → 18 nov. », jamais « 2026-11-15 -> 2026-11-18 » ───────────────────── */

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function parseDay(value: string): Date | null {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Période d'une location ; l'année n'apparaît que si elle n'est pas l'année en cours (`now` injectable pour les tests) */
export function formatBookingPeriod(start: string, end: string, now: Date = new Date()): string {
  const from = parseDay(start);
  const to = parseDay(end);
  if (!from || !to) return `${start} → ${end}`;
  const withYear = from.getFullYear() !== now.getFullYear() || to.getFullYear() !== now.getFullYear();
  const format = withYear ? dayYearFormat : dayFormat;
  return `${format.format(from)} → ${format.format(to)}`;
}

function formatDuration(days: number | null): string | null {
  return days && days > 0 ? `${days} jour${days > 1 ? 's' : ''}` : null;
}

function vehicleLabel(booking: AgencyBookingRow): string {
  return booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : '—';
}

/** Une demande qui attend une réponse est repérée par une barre d'accent (le statut reste écrit en toutes lettres) */
const isWaiting = (booking: AgencyBookingRow) => bookingStatusVariant(booking.status) === 'pending';

function OpenButton({ booking, onOpen, className }: { booking: AgencyBookingRow; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ouvrir la réservation ${bookingReference(booking)}`}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]',
        className
      )}
    >
      <FileText aria-hidden="true" className="h-3.5 w-3.5" />
      Ouvrir
    </button>
  );
}

export function BookingsPanel({
  page,
  loading,
  error,
  query,
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
  /** Filtres en vigueur : l'état vit dans l'espace agence (statut dans l'adresse), le panneau les affiche */
  query: BookingQuery;
  onQueryChange: (query: BookingQuery) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onOpenDetail: (booking: AgencyBookingRow) => void;
  canAct: boolean;
  busy: boolean;
}) {
  // Saisie locale (réactive) ; la requête n'est émise qu'après une courte pause
  const [search, setSearch] = useState(query.q);
  const debounce = useRef<number | undefined>(undefined);
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  });

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const onSearchChange = (value: string) => {
    setSearch(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => onQueryChange({ ...latest.current, q: value }), 300);
  };

  const rows = page?.data ?? [];
  const meta = page?.meta ?? { page: 1, pageSize: 15, total: 0, totalPages: 1 };
  const nothingToProcess =
    query.status === TO_PROCESS_FILTER && !query.q && !query.type && rows.length === 0 && !loading;

  return (
    <div className="@container space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
        <div className="col-span-2 sm:col-auto sm:min-w-64">
          <SearchField
            value={search}
            onChange={onSearchChange}
            label="Rechercher une réservation"
            placeholder="Dossier, client…"
          />
        </div>
        <div className="col-span-2 sm:col-auto">
          <SelectField value={query.status} onChange={(status) => onQueryChange({ ...query, status })} label="Filtrer par statut">
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField value={query.type ?? ''} onChange={(type) => onQueryChange({ ...query, type })} label="Voitures ou motos">
          {TYPE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </SelectField>
        <SelectField value={query.sort} onChange={(sort) => onQueryChange({ ...query, sort })} label="Trier les réservations">
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      {error && <ErrorBanner message={error} onRetry={onRetry} retrying={loading} />}

      {loading && !page ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          {nothingToProcess ? (
            <EmptyState
              title="Aucune demande à traiter"
              text="Toutes les demandes reçues ont reçu une réponse."
              action={
                <button
                  type="button"
                  onClick={() => onQueryChange({ ...query, status: '' })}
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
                >
                  Voir toutes les réservations
                </button>
              }
            />
          ) : (
            <EmptyState title="Aucune réservation" text="Aucun dossier ne correspond à ces critères pour votre agence." />
          )}
        </div>
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-slate-200 bg-white transition-opacity',
            loading && 'opacity-60'
          )}
        >
          {/*
            Cartes sous 56 rem de largeur utile, tableau au-delà (container query : la barre latérale retire
            16 rem à la page). Un tableau à largeur minimale cachait « Statut » et « Ouvrir » hors de l'écran.
          */}
          <ul aria-label="Réservations de votre agence" aria-busy={loading} className="grid grid-cols-1 divide-y divide-slate-100 @4xl:hidden">
            {rows.map((booking) => {
              const duration = formatDuration(booking.total_days);
              return (
                <li
                  key={booking.id}
                  className={cn('p-4', isWaiting(booking) && 'border-s-4 border-s-amber-400 bg-amber-50/40')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-semibold text-[#0F172A]">{bookingReference(booking)}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{booking.customer_name}</p>
                    </div>
                    <StatusBadge status={booking.status} audience="business" size="sm" className="shrink-0" />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    <div className="min-w-0">
                      <dt className="text-slate-500">Véhicule</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 text-slate-700">
                        {booking.vehicle && isMotorcycle(booking.vehicle) && (
                          <Motorbike className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-label="Moto" />
                        )}
                        <span className="truncate">{vehicleLabel(booking)}</span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-slate-500">Montant</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{money(booking.total_price)}</dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="text-slate-500">Période</dt>
                      <dd className="mt-0.5 tabular-nums text-slate-700">
                        {formatBookingPeriod(booking.start_date, booking.end_date)}
                        {duration && <span className="text-slate-500"> · {duration}</span>}
                      </dd>
                    </div>
                  </dl>

                  <OpenButton booking={booking} onOpen={() => onOpenDetail(booking)} className="mt-3.5 min-h-11 w-full" />
                </li>
              );
            })}
          </ul>

          <div className="hidden @4xl:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Réservations de votre agence</caption>
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <Th className="px-4">Dossier</Th>
                    <Th className="px-4">Client & véhicule</Th>
                    <Th className="px-4">Période</Th>
                    <Th align="right" numeric className="px-4">Montant</Th>
                    <Th className="px-4">Statut</Th>
                    <Th align="right" className="px-4">Détail</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((booking) => {
                    const duration = formatDuration(booking.total_days);
                    return (
                      <tr
                        key={booking.id}
                        className={cn('transition-colors hover:bg-slate-50/70', isWaiting(booking) && 'bg-amber-50/40')}
                      >
                        <td
                          className={cn(
                            'whitespace-nowrap px-4 py-3.5 font-mono text-[13px] font-semibold text-[#0F172A]',
                            isWaiting(booking) && 'shadow-[inset_3px_0_0_0_var(--color-amber-400)]'
                          )}
                        >
                          {bookingReference(booking)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="max-w-52 min-w-0">
                            <p className="truncate font-semibold text-slate-900" title={booking.customer_name}>
                              {booking.customer_name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                              {booking.vehicle && isMotorcycle(booking.vehicle) && (
                                <Motorbike className="h-3.5 w-3.5 shrink-0" aria-label="Moto" />
                              )}
                              <span className="truncate">{vehicleLabel(booking)}</span>
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-700">
                          {formatBookingPeriod(booking.start_date, booking.end_date)}
                          {duration && <p className="mt-0.5 text-xs text-slate-500">{duration}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-[#0F172A]">
                          {money(booking.total_price)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <StatusBadge status={booking.status} audience="business" size="sm" />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <OpenButton booking={booking} onOpen={() => onOpenDetail(booking)} className="min-h-9 px-3" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-[#64748B]">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          Chargement…
        </p>
      )}

      {!canAct && (
        <p className="text-xs text-[#64748B]">
          Votre rôle ne permet pas de traiter les demandes de réservation.
        </p>
      )}

      {busy && <p role="status" className="text-xs text-[#64748B]">Opération en cours…</p>}
    </div>
  );
}
