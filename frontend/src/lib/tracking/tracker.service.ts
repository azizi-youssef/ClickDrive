import { TrackingError, mapDbError } from './errors';
import { isRegistrationAllowed } from './providers/provider.factory';
import { callRpc, type TrackingDb } from './rpc';
import type { TrackerRecord } from './types';

/** Boîtiers GPS : inventaire, enregistrement, affectation, mise en pause, déconnexion (audités en base). */

export async function listTrackers(db: TrackingDb, agencyId: string, includeDisconnected = false): Promise<TrackerRecord[]> {
  const result = await callRpc<{ trackers: TrackerRecord[] }>(
    db,
    'tracking_trackers_list',
    { p_agency_id: agencyId, p_include_disconnected: includeDisconnected },
    { tag: 'trackers-list' }
  );
  return result.trackers;
}

export interface RegisterTrackerInput {
  provider: string;
  external_device_id: string;
  label?: string;
  device_model?: string;
  vehicle_id?: string | null;
  installed_at?: string;
}

export async function registerTracker(db: TrackingDb, agencyId: string, input: RegisterTrackerInput): Promise<string> {
  // Un fournisseur non intégré n'accepte aucun boîtier : il ne recevrait jamais de donnée (rien n'est simulé)
  if (!isRegistrationAllowed(input.provider)) {
    throw new TrackingError(422, 'PROVIDER_PENDING', 'L’intégration de ce fournisseur n’est pas encore disponible.');
  }
  return callRpc<string>(
    db,
    'register_vehicle_tracker',
    {
      p_agency_id: agencyId,
      p_provider: input.provider,
      p_external_device_id: input.external_device_id,
      p_label: input.label ?? null,
      p_vehicle_id: input.vehicle_id ?? null,
      p_installed_at: input.installed_at ?? null,
      p_device_model: input.device_model ?? null,
    },
    { tag: 'tracker-register' }
  );
}

/** Le boîtier doit appartenir à l'agence résolue (contrôle explicite, en plus de la RLS et de la fonction SQL) */
async function assertTrackerInAgency(db: TrackingDb, agencyId: string, trackerId: string): Promise<void> {
  const { data, error } = await db.from('vehicle_trackers').select('id').eq('id', trackerId).eq('agency_id', agencyId).maybeSingle();
  if (error) throw mapDbError(error, 'tracker-lookup');
  if (!data) throw new TrackingError(404, 'NOT_FOUND', 'Élément introuvable.');
}

export type TrackerPatch =
  | { kind: 'fields'; changes: Record<string, unknown> }
  | { kind: 'assign'; vehicle_id: string | null; reason?: string }
  | { kind: 'disconnect'; reason?: string };

export async function updateTracker(db: TrackingDb, agencyId: string, trackerId: string, patch: TrackerPatch): Promise<void> {
  await assertTrackerInAgency(db, agencyId, trackerId);
  if (patch.kind === 'fields') {
    await callRpc(db, 'update_vehicle_tracker', { p_tracker_id: trackerId, p_changes: patch.changes }, { tag: 'tracker-update' });
  } else if (patch.kind === 'assign') {
    await callRpc(db, 'assign_vehicle_tracker', { p_tracker_id: trackerId, p_vehicle_id: patch.vehicle_id, p_reason: patch.reason ?? null }, { tag: 'tracker-assign' });
  } else {
    await callRpc(db, 'disconnect_vehicle_tracker', { p_tracker_id: trackerId, p_reason: patch.reason ?? null }, { tag: 'tracker-disconnect' });
  }
}
