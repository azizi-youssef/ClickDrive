import { requireServiceRoleClient } from '@/lib/supabase/privileged';
import { decodeCursor, fleetOverviewSchema, historyPageSchema, ingestResultSchema, vehicleDetailSchema } from './schemas';
import { callRpc, type TrackingDb } from './rpc';
import { TrackingError } from './errors';
import type {
  FleetOverview,
  HistoryPage,
  IngestResult,
  NormalizedTrackingEvent,
  TrackingState,
  VehicleDetail,
} from './types';

/**
 * Positions : aperçu de flotte, dernière position, historique paginé et ingestion d'un événement normalisé.
 * Chaque lecture passe par une fonction SQL qui revérifie `tracking.read` et l'appartenance du véhicule à l'agence.
 */

export interface FleetQuery {
  q?: string;
  state?: 'ALL' | 'ALERTS' | TrackingState;
  limit: number;
  offset: number;
}

export async function fetchFleetOverview(db: TrackingDb, agencyId: string, query: FleetQuery): Promise<FleetOverview> {
  return callRpc<FleetOverview>(
    db,
    'tracking_fleet_overview',
    { p_agency_id: agencyId, p_search: query.q ?? null, p_state: query.state ?? 'ALL', p_limit: query.limit, p_offset: query.offset },
    { schema: fleetOverviewSchema, tag: 'fleet-overview' }
  );
}

export async function fetchVehicleDetail(db: TrackingDb, agencyId: string, vehicleId: string): Promise<VehicleDetail> {
  return callRpc<VehicleDetail>(
    db,
    'tracking_vehicle_detail',
    { p_agency_id: agencyId, p_vehicle_id: vehicleId },
    { schema: vehicleDetailSchema, tag: 'vehicle-detail' }
  );
}

/** Dernière position connue et état de connexion (réponse légère pour le rafraîchissement d'un véhicule) */
export async function fetchLatestLocation(db: TrackingDb, agencyId: string, vehicleId: string) {
  const detail = await fetchVehicleDetail(db, agencyId, vehicleId);
  return {
    vehicle_id: detail.vehicle.id,
    state: detail.state,
    position: detail.position,
    tracker: detail.tracker
      ? { id: detail.tracker.id, status: detail.tracker.status, last_seen_at: detail.tracker.last_seen_at }
      : null,
    offline_after_minutes: detail.offline_after_minutes,
  };
}

export interface HistoryQuery {
  from: string;
  to: string;
  limit: number;
  cursor?: string;
  include_suspect?: boolean;
}

export async function fetchVehicleHistory(
  db: TrackingDb,
  agencyId: string,
  vehicleId: string,
  query: HistoryQuery
): Promise<HistoryPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (query.cursor && !cursor) throw new TrackingError(422, 'VALIDATION', 'Curseur de pagination invalide.');
  return callRpc<HistoryPage>(
    db,
    'tracking_vehicle_history',
    {
      p_agency_id: agencyId,
      p_vehicle_id: vehicleId,
      p_from: query.from,
      p_to: query.to,
      p_limit: query.limit,
      p_after_recorded_at: cursor?.recorded_at ?? null,
      p_after_id: cursor?.id ?? null,
      p_include_suspect: query.include_suspect ?? false,
    },
    { schema: historyPageSchema, tag: 'vehicle-history' }
  );
}

/**
 * Ingestion d'un événement normalisé. Exige le client service-role (appel serveur de confiance : webhook).
 * Le boîtier, son véhicule et son agence sont résolus par la base à partir de (provider, device) ; le
 * contenu de l'événement n'est jamais une source d'identité.
 */
export async function ingestTrackingEvent(
  provider: string,
  externalDeviceId: string,
  event: NormalizedTrackingEvent,
  db?: TrackingDb
): Promise<IngestResult> {
  const client = db ?? (await requireServiceRoleClient('tracking-ingest'));
  return callRpc<IngestResult>(
    client,
    'tracking_ingest_event',
    { p_provider: provider, p_external_device_id: externalDeviceId, p_event: event },
    { schema: ingestResultSchema, tag: 'ingest' }
  );
}

export async function recordIngestFailure(
  provider: string,
  reason: string,
  deviceRef?: string,
  detail?: string,
  db?: TrackingDb
): Promise<void> {
  try {
    const client = db ?? (await requireServiceRoleClient('tracking-ingest-failure'));
    await client.rpc('tracking_record_ingest_failure', {
      p_provider: provider,
      p_reason: reason,
      p_device_ref: deviceRef ?? null,
      p_detail: detail ?? null,
    });
  } catch {
    // Le suivi des échecs ne doit jamais faire échouer une livraison
  }
}
