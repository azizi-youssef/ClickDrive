import { requireServiceRoleClient } from '@/lib/supabase/privileged';
import { trackingLog } from './log';
import { callRpc, type TrackingDb } from './rpc';

/**
 * Maintenance planifiée du suivi GPS (appelée par /api/cron/tracking, voir .github/workflows/tracking-maintenance.yml) :
 *  1. alertes « hors ligne » et clôture des trajets abandonnés ;
 *  2. purge par lots selon la conservation configurée par chaque agence (positions, trajets, alertes),
 *     rejets d'ingestion de plus de 30 jours et journal d'audit de plus de 730 jours.
 * Les durées par défaut (90 j positions, 365 j trajets) sont modifiables par l'agence ; elles ne constituent
 * pas un avis juridique (voir docs/gps-tracking.md § Conformité).
 */

export interface MaintenanceReport {
  offline_alerts_created: number;
  stale_trips_closed: number;
  locations_deleted: number;
  trips_deleted: number;
  alerts_deleted: number;
  ingest_failures_deleted: number;
  audit_rows_deleted: number;
  purge_rounds: number;
}

const MAX_PURGE_ROUNDS = 10;
const PURGE_BATCH = 5000;

export async function runTrackingMaintenance(db?: TrackingDb): Promise<MaintenanceReport> {
  const client = db ?? (await requireServiceRoleClient('tracking-maintenance'));

  const sweep = await callRpc<{ offline_alerts_created: number; stale_trips_closed: number }>(client, 'tracking_run_maintenance', {}, { tag: 'maintenance' });

  const report: MaintenanceReport = {
    offline_alerts_created: sweep.offline_alerts_created,
    stale_trips_closed: sweep.stale_trips_closed,
    locations_deleted: 0,
    trips_deleted: 0,
    alerts_deleted: 0,
    ingest_failures_deleted: 0,
    audit_rows_deleted: 0,
    purge_rounds: 0,
  };

  // Purge en plusieurs tours de taille bornée : s'arrête dès qu'un tour ne supprime plus rien
  for (let round = 0; round < MAX_PURGE_ROUNDS; round += 1) {
    const purge = await callRpc<Record<string, number>>(client, 'tracking_purge_expired', { p_batch: PURGE_BATCH }, { tag: 'purge' });
    report.purge_rounds += 1;
    report.locations_deleted += purge.locations_deleted ?? 0;
    report.trips_deleted += purge.trips_deleted ?? 0;
    report.alerts_deleted += purge.alerts_deleted ?? 0;
    report.ingest_failures_deleted += purge.ingest_failures_deleted ?? 0;
    report.audit_rows_deleted += purge.audit_rows_deleted ?? 0;
    const deletedThisRound =
      (purge.locations_deleted ?? 0) + (purge.trips_deleted ?? 0) + (purge.alerts_deleted ?? 0) +
      (purge.ingest_failures_deleted ?? 0) + (purge.audit_rows_deleted ?? 0);
    if (deletedThisRound === 0) break;
  }

  trackingLog('info', 'maintenance.done', { ...report });
  return report;
}
