import type { FleetSummary, FleetVehicle, TrackingState } from './types';
import type { PositionPatch } from './tracking-realtime';

/**
 * État de la flotte côté interface : application des événements temps réel (jamais une position plus ancienne
 * qu'une position déjà affichée), recalcul des compteurs, filtres. Fonctions pures (testées sans navigateur).
 */

/** Applique un lot d'événements ; renvoie la même référence si rien n'a changé (aucun rendu inutile) */
export function applyPositionPatches(vehicles: FleetVehicle[], patches: readonly PositionPatch[]): FleetVehicle[] {
  if (patches.length === 0) return vehicles;
  const byVehicle = new Map(patches.map((patch) => [patch.vehicle_id, patch]));
  let changed = false;

  const next = vehicles.map((vehicle) => {
    const patch = byVehicle.get(vehicle.id);
    if (!patch) return vehicle;
    // Un boîtier absent ou en pause ne reçoit pas de position ; une observation plus ancienne est ignorée
    if (!vehicle.tracker || vehicle.tracker.status === 'DISABLED') return vehicle;
    if (vehicle.position && Date.parse(patch.recorded_at) <= Date.parse(vehicle.position.recorded_at)) return vehicle;
    changed = true;
    const state: TrackingState = patch.movement_state === 'MOVING' ? 'MOVING' : 'STATIONARY';
    return {
      ...vehicle,
      state,
      position: {
        latitude: patch.latitude,
        longitude: patch.longitude,
        speed_kmh: patch.speed_kmh,
        heading_deg: patch.heading_deg,
        ignition: patch.ignition,
        accuracy_m: patch.accuracy_m,
        recorded_at: patch.recorded_at,
      },
      tracker: { ...vehicle.tracker, last_seen_at: patch.recorded_at, status: vehicle.tracker.status === 'PENDING' ? 'ACTIVE' : vehicle.tracker.status },
    };
  });
  return changed ? next : vehicles;
}

export function deriveSummary(vehicles: readonly FleetVehicle[], openAlerts: number): FleetSummary {
  const count = (state: TrackingState) => vehicles.filter((vehicle) => vehicle.state === state).length;
  const moving = count('MOVING');
  const stationary = count('STATIONARY');
  const untracked = count('UNTRACKED');
  return {
    total_vehicles: vehicles.length,
    tracked: vehicles.length - untracked,
    online: moving + stationary,
    moving,
    stationary,
    offline: count('OFFLINE'),
    awaiting: count('AWAITING'),
    disabled: count('DISABLED'),
    untracked,
    open_alerts: openAlerts,
  };
}

export type FleetFilter = 'ALL' | 'MOVING' | 'STATIONARY' | 'OFFLINE' | 'ALERTS' | 'OTHER';

export function matchesFilter(vehicle: FleetVehicle, filter: FleetFilter): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'ALERTS':
      return vehicle.open_alerts > 0;
    case 'OTHER':
      return vehicle.state === 'UNTRACKED' || vehicle.state === 'AWAITING' || vehicle.state === 'DISABLED';
    default:
      return vehicle.state === filter;
  }
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function matchesSearch(vehicle: FleetVehicle, query: string): boolean {
  const needle = normalize(query.trim());
  if (!needle) return true;
  const haystack = normalize([vehicle.brand, vehicle.model, vehicle.unit_number, vehicle.license_plate, vehicle.tracker?.label].filter(Boolean).join(' '));
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

export function vehicleLabel(vehicle: Pick<FleetVehicle, 'brand' | 'model' | 'unit_number'>): string {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ') + (vehicle.unit_number ? ` · ${vehicle.unit_number}` : '');
}

/** Véhicules placables sur la carte : position connue et valide */
export function mappable(vehicles: readonly FleetVehicle[]): FleetVehicle[] {
  return vehicles.filter(
    (vehicle) =>
      vehicle.position !== null &&
      Number.isFinite(vehicle.position.latitude) &&
      Number.isFinite(vehicle.position.longitude)
  );
}
