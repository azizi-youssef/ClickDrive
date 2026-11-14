import { TrackingError, mapDbError } from './errors';
import { callRpc, type TrackingDb } from './rpc';
import type { AlertSeverity, AlertStatus, AlertType, AlertsPage } from './types';

/** Alertes : liste paginée et accusé de réception (idempotent). */

export interface AlertsQuery {
  status?: AlertStatus;
  type?: AlertType;
  severity?: AlertSeverity;
  vehicle_id?: string;
  page: number;
  page_size: number;
}

export async function fetchAlerts(db: TrackingDb, agencyId: string, query: AlertsQuery): Promise<AlertsPage> {
  return callRpc<AlertsPage>(
    db,
    'tracking_alerts_page',
    {
      p_agency_id: agencyId,
      p_status: query.status ?? null,
      p_type: query.type ?? null,
      p_severity: query.severity ?? null,
      p_vehicle_id: query.vehicle_id ?? null,
      p_limit: query.page_size,
      p_offset: (query.page - 1) * query.page_size,
    },
    { tag: 'alerts-page' }
  );
}

export interface AcknowledgeResult {
  changed: boolean;
  status: AlertStatus;
  acknowledged_at: string | null;
}

/**
 * Accuse réception d'une alerte. L'alerte doit appartenir à l'agence résolue pour la requête (contrôle
 * explicite en plus de la permission revérifiée par la fonction SQL).
 */
export async function acknowledgeAlert(db: TrackingDb, agencyId: string, alertId: string): Promise<AcknowledgeResult> {
  const { data, error } = await db.from('tracking_alerts').select('id').eq('id', alertId).eq('agency_id', agencyId).maybeSingle();
  if (error) throw mapDbError(error, 'alert-lookup');
  if (!data) throw new TrackingError(404, 'NOT_FOUND', 'Élément introuvable.');
  return callRpc<AcknowledgeResult>(db, 'acknowledge_tracking_alert', { p_alert_id: alertId }, { tag: 'alert-ack' });
}
