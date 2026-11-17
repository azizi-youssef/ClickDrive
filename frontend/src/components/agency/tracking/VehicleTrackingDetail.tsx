'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Bell, MapPinned, ShieldCheck } from 'lucide-react';
import { button } from '@/lib/design/tokens';
import { formatAge, formatDistanceKm, formatSpeed } from '@/lib/tracking/geo.utils';
import { TRACKING_CAPABILITY_LABELS } from '@/lib/tracking/labels';
import { useTrackingRealtime, type PositionPatch } from '@/lib/tracking/tracking-realtime';
import type { FleetVehicle, HistoryPage, TripRoute, TripsPage, VehicleDetail } from '@/lib/tracking/types';
import { vehicleLabel } from '@/lib/tracking/fleet-state';
import { EmptyState, ErrorBanner, Skeleton } from '@/components/agency/shell/Feedback';
import { FilterChips } from '@/components/agency/shell/Controls';
import { useApiAgency, useTrackingAccess } from './TrackingAccess';
import { TrackingMapLazy } from './TrackingMapLazy';
import { TripTimeline } from './TripTimeline';
import { VehicleLocationCard } from './VehicleLocationCard';
import { VehicleStatusBadge } from './VehicleStatusBadge';
import type { MapVehicle } from './TrackingMap';
import { Card, StatTile, useNow } from './ui';
import { useTrackingQuery } from './useTrackingQuery';
import { trackingApi, errorMessage, isAbortError } from '@/lib/tracking/client';

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function toFleetVehicle(detail: VehicleDetail, live: PositionPatch | null): FleetVehicle {
  const newer = live && (!detail.position || Date.parse(live.recorded_at) > Date.parse(detail.position.recorded_at));
  const position = newer ? { ...live } : detail.position;
  const state = newer && detail.tracker && detail.state !== 'DISABLED' ? live.movement_state : detail.state;
  return {
    id: detail.vehicle.id,
    brand: detail.vehicle.brand,
    model: detail.vehicle.model,
    unit_number: detail.vehicle.unit_number,
    license_plate: detail.vehicle.license_plate,
    vehicle_type: detail.vehicle.vehicle_type,
    state,
    open_alerts: detail.open_alerts,
    booking_reference: detail.booking?.reference ?? null,
    tracker: detail.tracker
      ? { id: detail.tracker.id, provider: detail.tracker.provider, label: detail.tracker.label, status: detail.tracker.status, last_seen_at: live?.recorded_at ?? detail.tracker.last_seen_at }
      : null,
    position: position
      ? { latitude: position.latitude, longitude: position.longitude, speed_kmh: position.speed_kmh, heading_deg: position.heading_deg, ignition: position.ignition, accuracy_m: position.accuracy_m, recorded_at: position.recorded_at }
      : null,
  };
}

type HistoryWindow = '1' | '6' | '24';

/** Fiche de suivi d'un véhicule : position en direct, trajets du jour, tracé, positions historisées, zones et boîtier. */
export function VehicleTrackingDetail({ vehicleId }: { vehicleId: string }) {
  const access = useTrackingAccess();
  const apiAgency = useApiAgency();
  const now = useNow();
  const detail = useTrackingQuery<VehicleDetail>(`/vehicles/${vehicleId}`, {});
  const [live, setLive] = useState<PositionPatch | null>(null);
  const [day, setDay] = useState(() => isoDay(new Date()));
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const dayRange = useMemo(() => {
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return Number.isNaN(from.getTime()) ? null : { from: from.toISOString(), to: to.toISOString() };
  }, [day]);
  const trips = useTrackingQuery<TripsPage>(`/vehicles/${vehicleId}/trips`, dayRange ? { ...dayRange, page: 1, page_size: 50 } : {}, Boolean(dayRange));
  const route = useTrackingQuery<TripRoute>(selectedTripId ? `/trips/${selectedTripId}/route` : null, { max_points: 800 }, Boolean(selectedTripId));

  // Temps réel : la position de CE véhicule seulement ; une relecture complète sur reconnexion ou alerte
  const reload = detail.reload;
  useTrackingRealtime({
    agencyId: access.agencyId,
    onPositions: useCallback((patches: PositionPatch[]) => {
      const mine = patches.find((patch) => patch.vehicle_id === vehicleId);
      if (mine) setLive((current) => (!current || Date.parse(mine.recorded_at) > Date.parse(current.recorded_at) ? mine : current));
    }, [vehicleId]),
    onAlertChange: reload,
    onResync: reload,
  });

  // Positions historisées (tracé brut) : fenêtre récente, pagination par curseur
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow | 'off'>('off');
  const [historyPoints, setHistoryPoints] = useState<[number, number][]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async (window: HistoryWindow, cursor: string | null, append: boolean) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - Number(window) * 3_600_000);
      const { data, meta } = await trackingApi<HistoryPage>(`/vehicles/${vehicleId}/history`, {
        query: { from: from.toISOString(), to: new Date(to.getTime() + 60_000).toISOString(), limit: 1000, cursor },
        agencyId: apiAgency,
      });
      const points = data.points.map((p) => [p.longitude, p.latitude] as [number, number]);
      setHistoryPoints((current) => (append ? [...current, ...points] : points));
      setHistoryCursor(typeof meta.next_cursor === 'string' ? meta.next_cursor : null);
    } catch (error) {
      if (!isAbortError(error)) setHistoryError(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }, [vehicleId, apiAgency]);

  const d = detail.data;
  const vehicle = useMemo(() => (d ? toFleetVehicle(d, live) : null), [d, live]);
  const tripRoute = useMemo<[number, number][] | null>(() => route.data?.points.map((p) => [p.longitude, p.latitude] as [number, number]) ?? null, [route.data]);
  const shownRoute = tripRoute ?? (historyWindow !== 'off' && historyPoints.length > 1 ? historyPoints : null);
  const mapVehicles = useMemo<MapVehicle[]>(
    () =>
      vehicle?.position
        ? [{ id: vehicle.id, label: vehicleLabel(vehicle), state: vehicle.state, latitude: vehicle.position.latitude, longitude: vehicle.position.longitude, heading: vehicle.position.heading_deg, moving: vehicle.state === 'MOVING' }]
        : [],
    [vehicle]
  );

  if (detail.error && !d) {
    return (
      <div className="space-y-4">
        <Link href="/agency/tracking" className={button.ghost}><ArrowLeft aria-hidden="true" className="h-4 w-4" />Retour à la carte</Link>
        <ErrorBanner message={detail.error} onRetry={detail.reload} retrying={detail.loading} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/agency/tracking" aria-label="Retour à la carte" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
          {vehicle ? (
            <div className="min-w-0">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-ink">{vehicle.brand} {vehicle.model}</h2>
              <p className="truncate text-sm text-ink-secondary">{[vehicle.unit_number, vehicle.license_plate].filter(Boolean).join(' · ')}</p>
            </div>
          ) : (
            <Skeleton className="h-9 w-56" />
          )}
        </div>
        {vehicle && <VehicleStatusBadge state={vehicle.state} className="self-start sm:self-auto" />}
      </div>

      {detail.error && d && <ErrorBanner message={detail.error} onRetry={detail.reload} retrying={detail.loading} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          {vehicle ? <VehicleLocationCard vehicle={vehicle} now={now} /> : <Skeleton className="h-64 w-full rounded-2xl" />}

          {d && (
            <>
              <section aria-label="Aujourd’hui" className="grid grid-cols-3 gap-3">
                <StatTile label="Trajets" value={d.today.trips} />
                <StatTile label="Distance" value={formatDistanceKm(d.today.distance_km)} />
                <StatTile label="Vitesse max" value={formatSpeed(d.today.max_speed_kmh || null)} />
              </section>

              <Card className="p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-slate-400" />Boîtier GPS</h3>
                {d.tracker ? (
                  <dl className="mt-2 divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between gap-3 py-2"><dt className="text-slate-500">Fournisseur</dt><dd className="font-medium">{d.tracker.provider}</dd></div>
                    <div className="flex justify-between gap-3 py-2"><dt className="text-slate-500">Dernière communication</dt><dd className="font-medium">{formatAge(d.tracker.last_seen_at, now)}</dd></div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-slate-500">Fonctions constatées</dt>
                      <dd className="text-right font-medium">
                        {Object.keys(d.tracker.capabilities).length > 0
                          ? Object.keys(d.tracker.capabilities).map((key) => TRACKING_CAPABILITY_LABELS[key] ?? key).join(', ')
                          : 'Position seule'}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-ink-secondary">Aucun boîtier affecté. {access.permissions.manage && <Link href="/agency/tracking/devices" className="font-semibold text-ink underline">Affecter un boîtier</Link>}</p>
                )}
              </Card>

              {d.geofences.length > 0 && (
                <Card className="p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><MapPinned aria-hidden="true" className="h-4 w-4 text-slate-400" />Zones</h3>
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {d.geofences.map((zone) => (
                      <li key={zone.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="truncate">{zone.name}{!zone.enabled && <span className="ml-1 text-xs text-slate-400">(désactivée)</span>}</span>
                        <span className="shrink-0 text-xs font-medium text-slate-600">{zone.inside === null ? 'Inconnu' : zone.inside ? 'Dans la zone' : 'Hors de la zone'}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {d.open_alerts > 0 && (
                <Link href={`/agency/tracking/alerts?vehicle_id=${vehicleId}`} className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <Bell aria-hidden="true" className="h-4 w-4" />
                  {d.open_alerts} alerte{d.open_alerts > 1 ? 's' : ''} ouverte{d.open_alerts > 1 ? 's' : ''} sur ce véhicule
                </Link>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="relative h-[26rem] lg:h-[30rem]">
            <TrackingMapLazy className="h-full w-full" vehicles={mapVehicles} selectedId={vehicleId} route={shownRoute} fitKey={`${selectedTripId ?? 'live'}|${historyWindow}|${historyPoints.length}|${d ? 'ready' : 'wait'}`} ariaLabel="Position et tracé du véhicule" />
            {d && !d.position && (
              <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-sm text-slate-600 shadow">
                Aucune position connue pour ce véhicule.
              </p>
            )}
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">Positions enregistrées</h3>
              <FilterChips
                options={[{ value: 'off', label: 'Masquées' }, { value: '1', label: '1 h' }, { value: '6', label: '6 h' }, { value: '24', label: '24 h' }] as const}
                value={historyWindow}
                label="Fenêtre des positions"
                onChange={(value) => {
                  setHistoryWindow(value);
                  setSelectedTripId(null);
                  setHistoryPoints([]);
                  setHistoryCursor(null);
                  if (value !== 'off') void loadHistory(value, null, false);
                }}
              />
            </div>
            {historyWindow !== 'off' && (
              <div className="mt-3 text-sm text-slate-600" aria-live="polite">
                {historyLoading ? 'Chargement…' : historyError ? <ErrorBanner message={historyError} onRetry={() => void loadHistory(historyWindow, null, false)} /> : `${historyPoints.length} position${historyPoints.length > 1 ? 's' : ''} affichée${historyPoints.length > 1 ? 's' : ''} (accès journalisé).`}
                {historyCursor && !historyLoading && (
                  <button type="button" className={`${button.secondary} ml-3`} onClick={() => void loadHistory(historyWindow, historyCursor, true)}>Charger la suite</button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">Trajets du jour</h3>
              <div>
                <label htmlFor="trip-day" className="sr-only">Jour</label>
                <input id="trip-day" type="date" value={day} max={isoDay(new Date())} onChange={(event) => { setDay(event.target.value); setSelectedTripId(null); }} className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-ink/8" />
              </div>
            </div>
            <div className="mt-3">
              {trips.error && <ErrorBanner message={trips.error} onRetry={trips.reload} retrying={trips.loading} />}
              {trips.loading && !trips.data ? (
                <div className="space-y-2" aria-busy="true"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /></div>
              ) : trips.data && trips.data.trips.length === 0 ? (
                <EmptyState title="Aucun trajet ce jour-là" text="Le véhicule est resté à l’arrêt, ou aucune position n’a été reçue." />
              ) : trips.data ? (
                <TripTimeline trips={trips.data.trips} selectedId={selectedTripId} onSelect={(id) => { setHistoryWindow('off'); setSelectedTripId(id); }} />
              ) : null}
              {selectedTripId && route.loading && <p role="status" className="mt-2 text-sm text-slate-500">Chargement du tracé…</p>}
              {selectedTripId && route.error && <div className="mt-2"><ErrorBanner message={route.error} onRetry={route.reload} /></div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
