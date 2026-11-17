'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Focus, Maximize2, Minimize2, RefreshCw, Satellite, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { button } from '@/lib/design/tokens';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import { formatAge } from '@/lib/tracking/geo.utils';
import { matchesFilter, matchesSearch, mappable, vehicleLabel, type FleetFilter } from '@/lib/tracking/fleet-state';
import type { RealtimeStatus } from '@/lib/tracking/tracking-realtime';
import { STATE_LABELS, type FleetVehicle, type TrackingState } from '@/lib/tracking/types';
import { FilterChips, SearchField } from '@/components/agency/shell/Controls';
import { CardSkeleton, EmptyState, ErrorBanner, KpiSkeleton, Skeleton } from '@/components/agency/shell/Feedback';
import { useTrackingAccess } from './TrackingAccess';
import { STATE_STYLES } from './VehicleStatusBadge';
import { VehicleLocationCard } from './VehicleLocationCard';
import { VehicleTrackingList } from './VehicleTrackingList';
import { TrackingMapLazy } from './TrackingMapLazy';
import type { MapVehicle } from './TrackingMap';
import { Card, StatTile, useNow } from './ui';
import { useFleetOverview } from './useFleetOverview';

const REALTIME_LABELS: Record<RealtimeStatus, { label: string; tone: string; icon: typeof Wifi }> = {
  live: { label: 'Direct', tone: 'text-emerald-700', icon: Wifi },
  connecting: { label: 'Connexion…', tone: 'text-slate-500', icon: Wifi },
  reconnecting: { label: 'Reconnexion — actualisation toutes les 15 s', tone: 'text-amber-700', icon: WifiOff },
  disabled: { label: 'Actualisation périodique', tone: 'text-slate-500', icon: WifiOff },
};

export function ConnectionIndicator({ status }: { status: RealtimeStatus }) {
  const { label, tone, icon: Icon } = REALTIME_LABELS[status];
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs font-medium', tone)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function toMapVehicle(vehicle: FleetVehicle): MapVehicle {
  return {
    id: vehicle.id,
    label: vehicleLabel(vehicle),
    state: vehicle.state,
    latitude: vehicle.position!.latitude,
    longitude: vehicle.position!.longitude,
    heading: vehicle.position!.heading_deg,
    moving: vehicle.state === 'MOVING',
  };
}

const LEGEND: TrackingState[] = ['MOVING', 'STATIONARY', 'OFFLINE', 'AWAITING'];

/** Boutons posés sur la carte, sous les boutons de zoom de MapLibre */
const MAP_BUTTON =
  'flex h-8.5 w-8.5 items-center justify-center rounded-md bg-white text-slate-700 shadow transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

/** Écran principal : indicateurs de flotte, carte centrale, liste filtrable et détail du véhicule sélectionné. */
export function TrackingDashboard() {
  const access = useTrackingAccess();
  const fleet = useFleetOverview();
  const now = useNow();
  const [filter, setFilter] = useState<FleetFilter>('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualFit, setManualFit] = useState(0);
  // Carte agrandie à tout l'écran (dans la page : fonctionne aussi sur mobile). La carte n'est pas recréée :
  // seul son cadre change de taille et MapLibre suit le redimensionnement. Échap ou le même bouton la réduit ;
  // le reste de la page devient inerte et ne défile plus, le focus revient au bouton à la fermeture.
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useModalDialog<HTMLDivElement>(expanded, { onClose: () => setExpanded(false) });

  const visible = useMemo(() => fleet.vehicles.filter((v) => matchesFilter(v, filter) && matchesSearch(v, query)), [fleet.vehicles, filter, query]);
  const mapVehicles = useMemo(() => mappable(visible).map(toMapVehicle), [visible]);
  const selected = useMemo(() => fleet.vehicles.find((v) => v.id === selectedId) ?? null, [fleet.vehicles, selectedId]);

  // Cadrage de la carte : au premier chargement, quand le filtre ou la recherche changent, ou à la demande
  const [loadedOnce, setLoadedOnce] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- le premier chargement déclenche un seul cadrage
    if (!fleet.loading) setLoadedOnce(true);
  }, [fleet.loading]);
  const fitKey = `${loadedOnce}|${filter}|${query}|${manualFit}`;

  const summary = fleet.summary;
  const counts = useMemo(
    () => ({
      ALL: fleet.vehicles.length,
      MOVING: fleet.vehicles.filter((v) => v.state === 'MOVING').length,
      STATIONARY: fleet.vehicles.filter((v) => v.state === 'STATIONARY').length,
      OFFLINE: fleet.vehicles.filter((v) => v.state === 'OFFLINE').length,
      ALERTS: fleet.vehicles.filter((v) => v.open_alerts > 0).length,
      OTHER: fleet.vehicles.filter((v) => ['UNTRACKED', 'AWAITING', 'DISABLED'].includes(v.state)).length,
    }),
    [fleet.vehicles]
  );
  const filterOptions: { value: FleetFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'Tous', count: counts.ALL },
    { value: 'MOVING', label: 'En mouvement', count: counts.MOVING },
    { value: 'STATIONARY', label: 'À l’arrêt', count: counts.STATIONARY },
    { value: 'OFFLINE', label: 'Hors ligne', count: counts.OFFLINE },
    { value: 'ALERTS', label: 'Alertes', count: counts.ALERTS },
    { value: 'OTHER', label: 'Autres', count: counts.OTHER },
  ];

  const noVehicle = !fleet.loading && fleet.vehicles.length === 0 && !fleet.error;
  const noTracker = !fleet.loading && summary !== null && summary.tracked === 0 && fleet.vehicles.length > 0;

  return (
    <div className="space-y-5">
      {/* Indicateurs */}
      <section aria-label="Indicateurs de la flotte" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summary === null ? (
          Array.from({ length: 6 }, (_, index) => <KpiSkeleton key={index} />)
        ) : (
          <>
            <StatTile label="Véhicules suivis" value={`${summary.tracked} / ${summary.total_vehicles}`} hint={summary.untracked > 0 ? `${summary.untracked} sans boîtier` : 'Flotte entièrement équipée'} icon={<Satellite className="h-4 w-4" />} />
            <StatTile label="En mouvement" value={summary.moving} tone={summary.moving > 0 ? 'good' : 'neutral'} />
            <StatTile label="À l’arrêt" value={summary.stationary} />
            <StatTile label="Hors ligne" value={summary.offline} tone={summary.offline > 0 ? 'alert' : 'neutral'} hint={summary.awaiting > 0 ? `${summary.awaiting} en attente de position` : undefined} />
            <Link href="/agency/tracking/alerts" className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <StatTile label="Alertes ouvertes" value={summary.open_alerts} tone={summary.open_alerts > 0 ? 'warn' : 'neutral'} icon={<Bell className="h-4 w-4" />} hint="Voir les alertes" />
            </Link>
            <StatTile label="Mise à jour" value={fleet.lastLoadedAt ? formatAge(new Date(fleet.lastLoadedAt).toISOString(), now) : '—'} hint={fleet.realtime === 'live' ? 'Positions en direct' : 'Actualisation périodique'} />
          </>
        )}
      </section>

      {fleet.error && <ErrorBanner message={fleet.error} onRetry={fleet.reload} retrying={fleet.refreshing} />}

      {noVehicle && (
        <Card>
          <EmptyState title="Aucun véhicule dans votre flotte" text="Ajoutez des véhicules depuis l’espace agence, puis affectez-leur un boîtier GPS." action={<Link href="/agency" className={button.secondary}>Aller à la flotte</Link>} />
        </Card>
      )}

      {noTracker && (
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Aucun boîtier GPS n’est encore enregistré</p>
              <p className="mt-0.5 text-sm text-ink-secondary">Enregistrez un boîtier et affectez-le à un véhicule : sa position apparaît ici dès la première transmission.</p>
            </div>
            {access.permissions.manage && (
              <Link href="/agency/tracking/devices" className={button.primary}>
                Enregistrer un boîtier
              </Link>
            )}
          </div>
        </Card>
      )}

      {!noVehicle && (
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
          {/* Liste */}
          <Card className="order-2 flex min-h-0 flex-col overflow-hidden lg:order-1 lg:h-[calc(100vh-15rem)] lg:min-h-[34rem]">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <SearchField value={query} onChange={setQuery} label="Rechercher un véhicule" placeholder="Marque, modèle, plaque, n° interne…" />
              <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
                <FilterChips options={filterOptions} value={filter} onChange={setFilter} label="Filtrer par état" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {fleet.loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex gap-3">
                      <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <EmptyState title="Aucun véhicule ne correspond" text="Modifiez la recherche ou le filtre pour afficher d’autres véhicules." action={<button type="button" className={button.secondary} onClick={() => { setQuery(''); setFilter('ALL'); }}>Réinitialiser</button>} />
              ) : (
                <VehicleTrackingList vehicles={visible} selectedId={selectedId} onSelect={setSelectedId} now={now} />
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
              <ConnectionIndicator status={fleet.realtime} />
              <button type="button" onClick={fleet.reload} disabled={fleet.refreshing} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50">
                <RefreshCw aria-hidden="true" className={cn('h-3.5 w-3.5', fleet.refreshing && 'animate-spin')} />
                Actualiser
              </button>
            </div>
            {fleet.total > fleet.vehicles.length && (
              <p role="note" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                Affichage limité aux {fleet.vehicles.length} premiers véhicules sur {fleet.total}.
              </p>
            )}
          </Card>

          {/* Carte (cadre agrandi à tout l'écran à la demande ; même arbre d'éléments : la carte reste montée) */}
          <div
            ref={expandedRef}
            {...(expanded ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Carte de la flotte agrandie' } : {})}
            className={cn(
              'order-1 lg:order-2',
              expanded
                ? 'fixed inset-0 z-[70] bg-canvas p-2 sm:p-3'
                : 'h-[58vh] min-h-[22rem] lg:h-[calc(100vh-15rem)] lg:min-h-[34rem]'
            )}
          >
          <div className="relative h-full w-full">
            {fleet.loading ? (
              <CardSkeleton tall rows={0} />
            ) : (
              <TrackingMapLazy
                className="h-full w-full"
                vehicles={mapVehicles}
                selectedId={selectedId}
                onSelect={setSelectedId}
                fitKey={fitKey}
                ariaLabel="Carte de la flotte : position des véhicules"
              />
            )}
            {!fleet.loading && (
              <>
                <ul aria-label="Légende" className="pointer-events-none absolute left-3 top-3 z-10 hidden flex-wrap gap-x-3 gap-y-1 rounded-xl bg-white/95 px-3 py-2 text-xs shadow sm:flex">
                  {LEGEND.map((state) => (
                    <li key={state} className="flex items-center gap-1.5 text-slate-700">
                      <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', STATE_STYLES[state].dot)} />
                      {STATE_LABELS[state]}
                    </li>
                  ))}
                </ul>
                <div className="absolute right-3 top-24 z-10 flex flex-col gap-2">
                  <button
                    type="button"
                    data-autofocus
                    onClick={() => setExpanded((value) => !value)}
                    className={MAP_BUTTON}
                    aria-label={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
                    title={expanded ? 'Réduire la carte (Échap)' : 'Agrandir la carte'}
                  >
                    {expanded ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualFit((n) => n + 1)}
                    className={MAP_BUTTON}
                    aria-label="Afficher tous les véhicules"
                    title="Afficher tous les véhicules"
                  >
                    <Focus aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                {mapVehicles.length === 0 && fleet.vehicles.length > 0 && (
                  <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-sm text-slate-600 shadow">
                    Aucune position à afficher pour ce filtre.
                  </p>
                )}
                {selected && (
                  <VehicleLocationCard vehicle={selected} now={now} onClose={() => setSelectedId(null)} className="absolute inset-x-3 bottom-3 z-20 shadow-xl sm:right-auto sm:w-[22rem]" />
                )}
              </>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
