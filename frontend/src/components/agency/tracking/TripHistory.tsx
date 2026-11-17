'use client';

import { useMemo, useState } from 'react';
import { Route } from 'lucide-react';
import { button } from '@/lib/design/tokens';
import { formatDistanceKm } from '@/lib/tracking/geo.utils';
import type { FleetOverview, TripRoute, TripsPage } from '@/lib/tracking/types';
import { DateRangeInputs, FilterChips, Pagination } from '@/components/agency/shell/Controls';
import { EmptyState, ErrorBanner, Skeleton } from '@/components/agency/shell/Feedback';
import { TrackingMapLazy } from './TrackingMapLazy';
import { TripTimeline } from './TripTimeline';
import { Card, SectionTitle, selectClass } from './ui';
import { useTrackingQuery } from './useTrackingQuery';

const PAGE_SIZE = 15;
const MAX_DAYS = 93;

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'custom', label: 'Période' },
];

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function presetRange(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (preset === 'today' ? 0 : preset === '7d' ? 6 : preset === '30d' ? 29 : 89));
  return { from: isoDay(start), to: isoDay(end) };
}

/** Bornes ISO d'une période de jours locaux : du début du premier jour à la fin du dernier (exclusive) */
export function rangeToIso(range: { from: string; to: string }): { from: string; to: string; days: number } | null {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;
  to.setDate(to.getDate() + 1);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return { from: from.toISOString(), to: to.toISOString(), days };
}

/** Historique des trajets de la flotte : période, véhicule, pagination, frise et tracé du trajet sélectionné. */
export function TripHistory({ initialVehicleId = '' }: { initialVehicleId?: string }) {
  const [preset, setPreset] = useState<Preset>('7d');
  const [custom, setCustom] = useState(() => presetRange('7d'));
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [page, setPage] = useState(1);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const range = preset === 'custom' ? custom : presetRange(preset);
  const iso = useMemo(() => rangeToIso(range), [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const rangeError = !iso ? 'Période invalide.' : iso.days > MAX_DAYS ? `La période ne peut pas dépasser ${MAX_DAYS} jours.` : null;

  const fleet = useTrackingQuery<FleetOverview>('/vehicles', { limit: 500 });
  const trips = useTrackingQuery<TripsPage>(
    '/trips',
    iso && !rangeError ? { from: iso.from, to: iso.to, page, page_size: PAGE_SIZE, vehicle_id: vehicleId || undefined } : {},
    Boolean(iso) && !rangeError
  );
  const route = useTrackingQuery<TripRoute>(selectedTripId ? `/trips/${selectedTripId}/route` : null, { max_points: 800 }, Boolean(selectedTripId));

  const routePoints = useMemo<[number, number][] | null>(() => route.data?.points.map((p) => [p.longitude, p.latitude] as [number, number]) ?? null, [route.data]);
  const data = trips.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const pageDistance = data ? data.trips.reduce((sum, trip) => sum + trip.distance_km, 0) : 0;

  const resetSelection = () => {
    setPage(1);
    setSelectedTripId(null);
  };

  return (
    <div className="space-y-5">
      <SectionTitle title="Historique des trajets" description="Trajets détectés à partir des positions GPS : départ, arrivée, distance, durée et vitesse maximale." />

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FilterChips options={PRESETS} value={preset} onChange={(value) => { setPreset(value); resetSelection(); }} label="Période" />
            {preset === 'custom' && <DateRangeInputs value={custom} onChange={(value) => { setCustom(value); resetSelection(); }} />}
          </div>
          <div className="w-full lg:max-w-64">
            <label htmlFor="trip-vehicle" className="mb-1 block text-xs font-medium text-ink-secondary">Véhicule</label>
            <select id="trip-vehicle" value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); resetSelection(); }} className={selectClass}>
              <option value="">Tous les véhicules</option>
              {(fleet.data?.vehicles ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model}{vehicle.unit_number ? ` · ${vehicle.unit_number}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {rangeError && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{rangeError}</p>}
      </Card>

      {trips.error && <ErrorBanner message={trips.error} onRetry={trips.reload} retrying={trips.loading} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {data ? `${data.total} trajet${data.total > 1 ? 's' : ''}` : 'Trajets'}
            </p>
            {data && data.trips.length > 0 && <p className="text-xs text-slate-500">Cette page : {formatDistanceKm(pageDistance)}</p>}
          </div>
          <div className="max-h-[36rem] overflow-y-auto p-4">
            {trips.loading && !data ? (
              <div className="space-y-3" aria-busy="true" aria-label="Chargement des trajets">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : !data || data.trips.length === 0 ? (
              !trips.error && (
                <EmptyState
                  title="Aucun trajet sur cette période"
                  text="Les trajets apparaissent dès qu’un véhicule équipé se déplace. Essayez une période plus large."
                />
              )
            ) : (
              <TripTimeline trips={data.trips} selectedId={selectedTripId} onSelect={setSelectedTripId} showVehicle={!vehicleId} />
            )}
          </div>
          {data && data.total > PAGE_SIZE && (
            <Pagination page={page} pageCount={pageCount} total={data.total} pageSize={PAGE_SIZE} onPage={(next) => { setPage(next); setSelectedTripId(null); }} label="des trajets" />
          )}
        </Card>

        <div className="relative h-[24rem] lg:h-auto lg:min-h-[32rem]">
          <TrackingMapLazy className="h-full w-full" route={routePoints} fitKey={selectedTripId ?? 'none'} ariaLabel="Tracé du trajet sélectionné" />
          {!selectedTripId && (
            <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center justify-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm text-slate-600 shadow">
              <Route aria-hidden="true" className="h-4 w-4" />
              Sélectionnez un trajet pour afficher son tracé.
            </p>
          )}
          {selectedTripId && route.loading && <p role="status" className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-sm text-slate-600 shadow">Chargement du tracé…</p>}
          {selectedTripId && route.error && (
            <div className="absolute inset-x-3 bottom-3 z-10">
              <ErrorBanner message={route.error} onRetry={route.reload} />
            </div>
          )}
        </div>
      </div>
      {preset === 'custom' && !rangeError && <button type="button" className={button.ghost} onClick={() => { setPreset('7d'); resetSelection(); }}>Revenir aux 7 derniers jours</button>}
    </div>
  );
}
