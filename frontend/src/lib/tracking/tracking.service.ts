import { callRpc, type TrackingDb } from './rpc';
import type { TrackingSettings } from './types';

/** Paramètres de l'agence, journalisation des accès sensibles et autorisations de support plateforme. */

export async function getTrackingSettings(db: TrackingDb, agencyId: string): Promise<TrackingSettings> {
  return callRpc<TrackingSettings>(db, 'tracking_get_settings', { p_agency_id: agencyId }, { tag: 'settings-get' });
}

export async function updateTrackingSettings(db: TrackingDb, agencyId: string, changes: Record<string, unknown>): Promise<TrackingSettings> {
  return callRpc<TrackingSettings>(db, 'update_tracking_settings', { p_agency_id: agencyId, p_changes: changes }, { tag: 'settings-update' });
}

export type SensitiveAccessAction = 'history.read' | 'trip_route.read' | 'support.read';

/**
 * Journalise une consultation sensible (historique de positions, tracé de trajet, lecture de support).
 * Échec = échec de la requête : on ne livre pas une donnée sensible dont l'accès n'a pu être tracé.
 */
export async function recordSensitiveAccess(
  db: TrackingDb,
  agencyId: string,
  action: SensitiveAccessAction,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await callRpc(
    db,
    'tracking_record_access',
    { p_agency_id: agencyId, p_action: action, p_entity_type: entityType, p_entity_id: entityId, p_metadata: metadata },
    { tag: 'audit-access' }
  );
}

export async function grantSupportAccess(db: TrackingDb, agencyId: string, reason: string, minutes: number): Promise<string> {
  return callRpc<string>(db, 'grant_tracking_support_access', { p_agency_id: agencyId, p_reason: reason, p_minutes: minutes }, { tag: 'support-grant' });
}

export async function revokeSupportAccess(db: TrackingDb, grantId: string): Promise<void> {
  await callRpc(db, 'revoke_tracking_support_access', { p_grant_id: grantId }, { tag: 'support-revoke' });
}
