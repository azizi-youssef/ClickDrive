'use client';

import { Bell, Car, Gauge, Motorbike } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge, formatSpeed } from '@/lib/tracking/geo.utils';
import type { FleetVehicle } from '@/lib/tracking/types';
import { VehicleStatusBadge } from './VehicleStatusBadge';

/**
 * Liste des véhicules de la flotte (alternative accessible à la carte : sélection au clavier,
 * annonce de l'état par texte). Les positions affichées sont celles déjà chargées : aucune requête par véhicule.
 */
export function VehicleTrackingList({
  vehicles,
  selectedId,
  onSelect,
  now,
}: {
  vehicles: readonly FleetVehicle[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
  now: number;
}) {
  return (
    <ul aria-label="Véhicules de la flotte" className="divide-y divide-slate-100">
      {vehicles.map((vehicle) => {
        const selected = vehicle.id === selectedId;
        const Icon = vehicle.vehicle_type === 'MOTORCYCLE' ? Motorbike : Car;
        return (
          <li key={vehicle.id}>
            <button
              type="button"
              onClick={() => onSelect(vehicle.id)}
              aria-pressed={selected}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                selected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
              )}
            >
              <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">
                    {vehicle.brand} {vehicle.model}
                  </span>
                  <VehicleStatusBadge state={vehicle.state} />
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-secondary">
                  {[vehicle.unit_number, vehicle.license_plate].filter(Boolean).join(' · ') || 'Sans identifiant'}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {vehicle.position ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Gauge aria-hidden="true" className="h-3.5 w-3.5" />
                        {formatSpeed(vehicle.position.speed_kmh)}
                      </span>
                      <span>{formatAge(vehicle.position.recorded_at, now)}</span>
                    </>
                  ) : (
                    <span>Aucune position reçue</span>
                  )}
                  {vehicle.booking_reference && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">En location</span>}
                  {vehicle.open_alerts > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                      <Bell aria-hidden="true" className="h-3.5 w-3.5" />
                      {vehicle.open_alerts} alerte{vehicle.open_alerts > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
