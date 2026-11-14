'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Car,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeBookingStatus } from '@clickdrive/shared/booking-status';

/** Statuts d'une réservation acceptée par l'agence, pas encore commencée */
const ACCEPTED_STATUSES = new Set(['APPROVED', 'READY_FOR_PICKUP']);
/** Statuts d'une demande en attente de réponse de l'agence */
const AWAITING_STATUSES = new Set(['REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW']);

export type CalendarEvent = {
  id: string;
  vehicleId: string;
  type: 'BOOKING' | 'BLOCKED' | 'MAINTENANCE';
  status: string;
  isBlocking: boolean;
  title: string;
  subtitle?: string;
  startDate: string;
  endDate: string;
  pickupTime?: string;
  dropoffTime?: string;
  details?: Record<string, any>;
};

export type CalendarVehicle = {
  id: string;
  brand: string;
  model: string;
  licensePlate?: string;
  unitNumber?: string;
  category: string;
  status: string;
  dailyPrice: number;
  primaryImage: string | null;
};

export function AgencyCalendarPanel({
  agencyId,
  canManage,
  initialVehicleId,
  onNotify,
}: {
  agencyId: string;
  canManage: boolean;
  initialVehicleId?: string;
  /** Retour utilisateur (bandeau de notification du portail) */
  onNotify?: (kind: 'success' | 'error', message: string) => void;
}) {
  const [pendingUnblock, setPendingUnblock] = useState<CalendarEvent | null>(null);
  const [vehicles, setVehicles] = useState<CalendarVehicle[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedVehicle, setSelectedVehicle] = useState<string>(initialVehicleId || 'all');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Selected event modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  // Quick block modal
  const [blockingOpen, setBlockingOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    vehicleId: '',
    startDate: '',
    endDate: '',
    type: 'BLOCKED' as 'BLOCKED' | 'MAINTENANCE',
    reason: 'Indisponibilité manuelle',
  });
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Compute start and end for current month or week
  const { startStr, endStr, daysList } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const days: { dateStr: string; dayNum: number; dayName: string; isToday: boolean }[] = [];
      const todayStr = new Date().toISOString().split('T')[0]!;

      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = dateObj.toISOString().split('T')[0]!;
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
        days.push({
          dateStr,
          dayNum: d,
          dayName,
          isToday: dateStr === todayStr,
        });
      }

      return {
        startStr: firstDay.toISOString().split('T')[0]!,
        endStr: lastDay.toISOString().split('T')[0]!,
        daysList: days,
      };
    } else {
      // Week view: 7 days starting from Monday of currentDate
      const dayOfWeek = currentDate.getDay(); // 0 is Sun, 1 is Mon
      const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      // Fix: clone before mutating to avoid stale state reference
      const clone = new Date(currentDate);
      clone.setDate(diff);
      const monday = new Date(clone);

      const days: { dateStr: string; dayNum: number; dayName: string; isToday: boolean }[] = [];
      const todayStr = new Date().toISOString().split('T')[0]!;

      for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i);
        const dateStr = nextDay.toISOString().split('T')[0]!;
        days.push({
          dateStr,
          dayNum: nextDay.getDate(),
          dayName: nextDay.toLocaleDateString('fr-FR', { weekday: 'short' }),
          isToday: dateStr === todayStr,
        });
      }

      return {
        startStr: days[0]!.dateStr,
        endStr: days[days.length - 1]!.dateStr,
        daysList: days,
      };
    }
  }, [currentDate, viewMode]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start: startStr,
        end: endStr,
      });
      if (selectedVehicle !== 'all') {
        params.set('vehicleId', selectedVehicle);
      }

      const res = await fetch(`/api/agencies/${agencyId}/calendar?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors du chargement du calendrier');
      }

      setVehicles(json.data?.vehicles ?? []);
      setEvents(json.data?.events ?? []);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : '') || 'Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  }, [agencyId, startStr, endStr, selectedVehicle]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const prevPeriod = () => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
      else next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const nextPeriod = () => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
      else next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.vehicleId) {
      setBlockError('Veuillez sélectionner un véhicule');
      return;
    }
    setBlockBusy(true);
    setBlockError(null);
    try {
      const res = await fetch(
        `/api/agencies/${agencyId}/vehicles/${blockForm.vehicleId}/availability`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: blockForm.startDate,
            end_date: blockForm.endDate,
            type: blockForm.type,
            reason: blockForm.reason,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec du blocage');
      }
      setBlockingOpen(false);
      void loadCalendar();
    } catch (err: unknown) {
      setBlockError((err instanceof Error ? err.message : '') || 'Échec du blocage');
    } finally {
      setBlockBusy(false);
    }
  };

  const handleUnblock = async (event: CalendarEvent, confirmed = false) => {
    if (event.type === 'BOOKING') return;
    if (!confirmed) {
      setPendingUnblock(event);
      return;
    }

    setUnblocking(true);
    try {
      const res = await fetch(
        `/api/agencies/${agencyId}/vehicles/${event.vehicleId}/availability?periodId=${event.id}&type=${event.type}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Impossible de débloquer');
      setSelectedEvent(null);
      onNotify?.('success', 'Période débloquée.');
      void loadCalendar();
    } catch (err: unknown) {
      onNotify?.('error', err instanceof Error && err.message ? err.message : 'Erreur lors du déblocage.');
    } finally {
      setUnblocking(false);
      setPendingUnblock(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Suivi des réservations en temps réel, maintenances et blocages manuels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setBlockForm({
                  vehicleId: vehicles[0]?.id || '',
                  startDate: new Date().toISOString().split('T')[0]!,
                  endDate: new Date().toISOString().split('T')[0]!,
                  type: 'BLOCKED',
                  reason: 'Indisponibilité manuelle',
                });
                setBlockingOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Bloquer une période
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: Navigation, views & filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        {/* Date Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={prevPeriod}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={nextPeriod}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-900">
            {viewMode === 'week' && daysList.length === 7
              ? `Semaine du ${new Date(daysList[0]!.dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${new Date(daysList[6]!.dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : currentDate.toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
          </h2>
        </div>

        {/* Filters and View toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Vehicle selector */}
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-slate-400" />
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Tous les véhicules ({vehicles.length})</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} ({v.licensePlate || v.unitNumber || 'Véhicule'})
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={cn(
                'rounded-lg px-3 py-1 transition',
                viewMode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              )}
            >
              Mois
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={cn(
                'rounded-lg px-3 py-1 transition',
                viewMode === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              )}
            >
              Semaine
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md bg-amber-400" />
          <span>Demande en attente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md bg-emerald-500" />
          <span>Réservation confirmée</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md bg-blue-500" />
          <span>Location active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md bg-orange-500" />
          <span>Maintenance garage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md bg-slate-700" />
          <span>Blocage manuel</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {/* Calendar Matrix View */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Aucun véhicule disponible dans cette sélection.
          </div>
        ) : (
          <table className="w-full min-w-200 border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 w-56 border-r border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700">
                  Véhicule
                </th>
                {daysList.map((day) => (
                  <th
                    key={day.dateStr}
                    className={cn(
                      'min-w-10.5 border-r border-slate-100 p-2 text-center',
                      day.isToday && 'bg-red-50 text-accent-text'
                    )}
                  >
                    <div className="text-[11px] uppercase text-slate-400">{day.dayName}</div>
                    <div className={cn('text-sm font-bold', day.isToday && 'text-accent-text')}>
                      {day.dayNum}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((v) => {
                const vehicleEvents = events.filter((e) => e.vehicleId === v.id);

                return (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    {/* Vehicle info card sticky column */}
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {v.primaryImage ? (
                            <Image
                              src={v.primaryImage}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <Car className="m-auto h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {v.brand} {v.model}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {v.licensePlate || v.unitNumber || 'Sans immat.'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Timeline Day Cells */}
                    {daysList.map((day) => {
                      // Find any event covering this date
                      const matchingEvent = vehicleEvents.find(
                        (e) => e.startDate <= day.dateStr && e.endDate >= day.dateStr
                      );

                      return (
                        <td
                          key={day.dateStr}
                          className={cn(
                            'border-r border-slate-100 p-1 text-center align-middle',
                            day.isToday && 'bg-red-50/30'
                          )}
                        >
                          {matchingEvent ? (
                            <button
                              type="button"
                              onClick={() => setSelectedEvent(matchingEvent)}
                              title={`${matchingEvent.title} (${matchingEvent.startDate} au ${matchingEvent.endDate})`}
                              className={cn(
                                'h-7 w-full rounded-md text-[11px] font-semibold text-white shadow-xs transition hover:brightness-110',
                                matchingEvent.type === 'MAINTENANCE' && 'bg-orange-500',
                                matchingEvent.type === 'BLOCKED' && 'bg-slate-700',
                                matchingEvent.type === 'BOOKING' &&
                                  matchingEvent.status === 'ACTIVE' &&
                                  'bg-blue-600',
                                matchingEvent.type === 'BOOKING' &&
                                  ACCEPTED_STATUSES.has(normalizeBookingStatus(String(matchingEvent.status))) &&
                                  'bg-emerald-600',
                                matchingEvent.type === 'BOOKING' &&
                                  AWAITING_STATUSES.has(normalizeBookingStatus(String(matchingEvent.status))) &&
                                  'bg-amber-500'
                              )}
                            >
                              •
                            </button>
                          ) : (
                            <div className="h-7 w-full rounded-md opacity-20" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold text-white',
                    selectedEvent.type === 'MAINTENANCE' && 'bg-orange-500',
                    selectedEvent.type === 'BLOCKED' && 'bg-slate-700',
                    selectedEvent.type === 'BOOKING' && 'bg-emerald-600'
                  )}
                >
                  {selectedEvent.type === 'BOOKING'
                    ? `Réservation (${selectedEvent.status})`
                    : selectedEvent.type === 'MAINTENANCE'
                    ? 'Maintenance garage'
                    : 'Période bloquée'}
                </span>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{selectedEvent.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Dates :</span>
                <span className="font-semibold">
                  Du {selectedEvent.startDate} au {selectedEvent.endDate}
                </span>
              </div>
              {selectedEvent.subtitle && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Montant :</span>
                  <span className="font-semibold">{selectedEvent.subtitle}</span>
                </div>
              )}
              {selectedEvent.details?.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Téléphone client :</span>
                  <span className="font-semibold">{selectedEvent.details.customerPhone}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Fermer
              </button>
              {canManage && selectedEvent.type !== 'BOOKING' && (
                <button
                  type="button"
                  disabled={unblocking}
                  onClick={() => void handleUnblock(selectedEvent)}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Débloquer cette période
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Block Modal */}
      {blockingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Bloquer une période de disponibilité</h3>
            <p className="mt-1 text-xs text-slate-500">
              Verrouille le calendrier contre toute nouvelle réservation en ligne.
            </p>

            {blockError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {blockError}
              </div>
            )}

            <form onSubmit={handleCreateBlock} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sélectionner le véhicule *
                </label>
                <select
                  required
                  value={blockForm.vehicleId}
                  onChange={(e) => setBlockForm({ ...blockForm, vehicleId: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2 text-sm"
                >
                  <option value="">Sélectionnez un véhicule</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.licensePlate || v.unitNumber || 'Véhicule'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Type de blocage</label>
                <select
                  value={blockForm.type}
                  onChange={(e) =>
                    setBlockForm({
                      ...blockForm,
                      type: e.target.value as 'BLOCKED' | 'MAINTENANCE',
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 p-2 text-sm"
                >
                  <option value="BLOCKED">Indisponibilité / Réservé hors plateforme</option>
                  <option value="MAINTENANCE">Maintenance atelier / Révision mécanique</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Date début *</label>
                  <input
                    type="date"
                    required
                    value={blockForm.startDate}
                    onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Date fin *</label>
                  <input
                    type="date"
                    required
                    value={blockForm.endDate}
                    onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Motif</label>
                <input
                  type="text"
                  required
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="Ex: Client en direct, Révision constructeur..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-sm"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBlockingOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={blockBusy}
                  className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {blockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enregistrer le blocage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {pendingUnblock && (
        <ConfirmDialog
          title="Débloquer cette période ?"
          message="Le véhicule redeviendra réservable par les clients sur ces dates."
          confirmLabel="Débloquer"
          busy={unblocking}
          onConfirm={() => void handleUnblock(pendingUnblock, true)}
          onCancel={() => setPendingUnblock(null)}
        />
      )}
    </div>
  );
}
