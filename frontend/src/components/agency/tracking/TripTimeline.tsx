'use client';

import { Flag, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCoordinates, formatDistanceKm, formatDuration, formatSpeed } from '@/lib/tracking/geo.utils';
import type { TripSummary } from '@/lib/tracking/types';

const CLOSED_REASONS: Record<string, string> = {
  IDLE: 'Arrêt prolongé',
  IGNITION_OFF: 'Contact coupé',
  DEVICE_GAP: 'Interruption du signal',
  DATA_BREAK: 'Rupture de données',
  STALE: 'Signal perdu',
  TRACKER_REASSIGNED: 'Boîtier retiré',
};

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Frise chronologique des trajets, groupés par jour : départ, arrivée, distance, durée, vitesse maximale.
 * Un trajet se sélectionne (carte et tracé) au clavier comme à la souris.
 */
export function TripTimeline({
  trips,
  selectedId,
  onSelect,
  showVehicle = false,
}: {
  trips: readonly TripSummary[];
  selectedId: string | null;
  onSelect: (tripId: string) => void;
  showVehicle?: boolean;
}) {
  const groups = new Map<string, TripSummary[]>();
  for (const trip of trips) {
    const key = day(trip.started_at);
    groups.set(key, [...(groups.get(key) ?? []), trip]);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([label, items]) => (
        <section key={label} aria-label={label}>
          <h3 className="mb-2 text-xs font-bold uppercase capitalize tracking-wide text-slate-500">{label}</h3>
          <ol className="relative space-y-2 border-l-2 border-slate-200 pl-4">
            {items.map((trip) => {
              const selected = trip.id === selectedId;
              return (
                <li key={trip.id} className="relative">
                  <span aria-hidden="true" className={cn('absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-white', trip.status === 'IN_PROGRESS' ? 'bg-emerald-500' : 'bg-slate-400')} />
                  <button
                    type="button"
                    onClick={() => onSelect(trip.id)}
                    aria-pressed={selected}
                    className={cn(
                      'w-full rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E63946]',
                      selected ? 'border-[#0B1220] bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums text-[#0F172A]">
                        {time(trip.started_at)} → {trip.status === 'IN_PROGRESS' ? 'en cours' : time(trip.ended_at)}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-[#0F172A]">{formatDistanceKm(trip.distance_km)}</span>
                    </span>
                    {showVehicle && (
                      <span className="mt-0.5 block text-xs font-medium text-slate-600">
                        {trip.vehicle.brand} {trip.vehicle.model}
                        {trip.vehicle.unit_number ? ` · ${trip.vehicle.unit_number}` : ''}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span>Durée {formatDuration(trip.duration_seconds)}</span>
                      <span>Max {formatSpeed(trip.max_speed_kmh)}</span>
                      {trip.booking_reference && <span>Location {trip.booking_reference}</span>}
                      {trip.closed_reason && trip.status === 'COMPLETED' && <span>{CLOSED_REASONS[trip.closed_reason] ?? trip.closed_reason}</span>}
                    </span>
                    {selected && (
                      <span className="mt-2 grid gap-1 border-t border-slate-200 pt-2 text-xs text-slate-600 sm:grid-cols-2">
                        <span className="flex items-center gap-1.5">
                          <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                          Départ : <span className="tabular-nums">{formatCoordinates(trip.start)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Flag aria-hidden="true" className="h-3.5 w-3.5 text-red-600" />
                          Arrivée : <span className="tabular-nums">{trip.end ? formatCoordinates(trip.end) : '—'}</span>
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
