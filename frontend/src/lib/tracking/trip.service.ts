import { callRpc, type TrackingDb } from './rpc';
import type { TripRoute, TripsPage } from './types';

/** Trajets : liste paginée (par véhicule ou pour toute l'agence) et tracé rééchantillonné d'un trajet. */

export interface TripsQuery {
  from: string;
  to: string;
  page: number;
  page_size: number;
  vehicle_id?: string;
}

export async function fetchTripsPage(db: TrackingDb, agencyId: string, query: TripsQuery): Promise<TripsPage> {
  return callRpc<TripsPage>(
    db,
    'tracking_trips_page',
    {
      p_agency_id: agencyId,
      p_vehicle_id: query.vehicle_id ?? null,
      p_from: query.from,
      p_to: query.to,
      p_limit: query.page_size,
      p_offset: (query.page - 1) * query.page_size,
    },
    { tag: 'trips-page' }
  );
}

export async function fetchTripRoute(db: TrackingDb, agencyId: string, tripId: string, maxPoints = 800): Promise<TripRoute> {
  return callRpc<TripRoute>(
    db,
    'tracking_trip_route',
    { p_agency_id: agencyId, p_trip_id: tripId, p_max_points: maxPoints },
    { tag: 'trip-route' }
  );
}
