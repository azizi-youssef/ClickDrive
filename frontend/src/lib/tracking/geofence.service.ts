import { TrackingError, mapDbError } from './errors';
import { callRpc, type TrackingDb } from './rpc';
import type { GeofenceRecord } from './types';

/** Zones géographiques circulaires (la structure `shape`/`geometry` prépare les polygones). */

export interface GeofenceInput {
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_m: number;
  enabled: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  vehicle_ids: string[];
}

export async function listGeofences(db: TrackingDb, agencyId: string): Promise<GeofenceRecord[]> {
  const result = await callRpc<{ geofences: GeofenceRecord[] }>(db, 'tracking_geofences_list', { p_agency_id: agencyId }, { tag: 'geofences-list' });
  return result.geofences;
}

async function assertGeofenceInAgency(db: TrackingDb, agencyId: string, geofenceId: string): Promise<void> {
  const { data, error } = await db.from('vehicle_geofences').select('id').eq('id', geofenceId).eq('agency_id', agencyId).maybeSingle();
  if (error) throw mapDbError(error, 'geofence-lookup');
  if (!data) throw new TrackingError(404, 'NOT_FOUND', 'Élément introuvable.');
}

/** Crée (geofenceId absent) ou met à jour une zone et ses véhicules affectés, de façon atomique */
export async function saveGeofence(db: TrackingDb, agencyId: string, geofenceId: string | null, input: GeofenceInput): Promise<string> {
  if (geofenceId) await assertGeofenceInAgency(db, agencyId, geofenceId);
  return callRpc<string>(
    db,
    'save_vehicle_geofence',
    {
      p_agency_id: agencyId,
      p_geofence_id: geofenceId,
      p_name: input.name,
      p_center_latitude: input.center_latitude,
      p_center_longitude: input.center_longitude,
      p_radius_m: input.radius_m,
      p_enabled: input.enabled,
      p_alert_on_enter: input.alert_on_enter,
      p_alert_on_exit: input.alert_on_exit,
      p_vehicle_ids: input.vehicle_ids,
    },
    { tag: 'geofence-save' }
  );
}

export async function deleteGeofence(db: TrackingDb, agencyId: string, geofenceId: string): Promise<void> {
  await assertGeofenceInAgency(db, agencyId, geofenceId);
  await callRpc(db, 'delete_vehicle_geofence', { p_geofence_id: geofenceId }, { tag: 'geofence-delete' });
}
