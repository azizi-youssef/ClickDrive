'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { AlertOctagon, AlertTriangle, BellRing, Check, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { button } from '@/lib/design/tokens';
import { errorMessage, trackingApi } from '@/lib/tracking/client';
import { useTrackingRealtime } from '@/lib/tracking/tracking-realtime';
import { ALERT_SEVERITIES, ALERT_TYPES, ALERT_TYPE_LABELS, SEVERITY_LABELS, type AlertSeverity, type AlertType, type AlertsPage, type TrackingAlert } from '@/lib/tracking/types';
import { formatAge, formatCoordinates } from '@/lib/tracking/geo.utils';
import { Pagination } from '@/components/agency/shell/Controls';
import { Toast, EmptyState, ErrorBanner, Skeleton } from '@/components/agency/shell/Feedback';
import { useTrackingAccess } from './TrackingAccess';
import { Card, SectionTitle, selectClass, useNotice, useNow } from './ui';
import { useTrackingQuery } from './useTrackingQuery';

const PAGE_SIZE = 20;

const SEVERITY_STYLES: Record<AlertSeverity, { icon: LucideIcon; badge: string; bar: string }> = {
  INFO: { icon: Info, badge: 'bg-sky-50 text-sky-800 border-sky-200', bar: 'bg-sky-500' },
  WARNING: { icon: AlertTriangle, badge: 'bg-amber-50 text-amber-900 border-amber-200', bar: 'bg-amber-500' },
  CRITICAL: { icon: AlertOctagon, badge: 'bg-red-50 text-red-800 border-red-200', bar: 'bg-red-600' },
};

type StatusFilter = 'OPEN' | 'ACKNOWLEDGED' | 'ALL';

function AlertCard({ alert, now, canAcknowledge, busy, onAcknowledge }: { alert: TrackingAlert; now: number; canAcknowledge: boolean; busy: boolean; onAcknowledge: () => void }) {
  const style = SEVERITY_STYLES[alert.severity];
  const Icon = style.icon;
  const acknowledged = alert.status === 'ACKNOWLEDGED';
  return (
    <li className={cn('relative overflow-hidden rounded-2xl border bg-white', acknowledged ? 'border-slate-200' : 'border-slate-300')}>
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', acknowledged ? 'bg-slate-300' : style.bar)} />
      <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.badge)}>
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {SEVERITY_LABELS[alert.severity]}
            </span>
            <span className="text-sm font-bold text-ink">{ALERT_TYPE_LABELS[alert.type] ?? alert.title}</span>
            {alert.ongoing && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">En cours</span>}
            {alert.resolved_at && !acknowledged && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Résolue</span>}
          </div>
          <p className="mt-1.5 text-sm text-slate-700">{alert.description}</p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <Link href={`/agency/tracking/vehicles/${alert.vehicle.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
              {alert.vehicle.brand} {alert.vehicle.model}{alert.vehicle.unit_number ? ` · ${alert.vehicle.unit_number}` : ''}
            </Link>
            <time dateTime={alert.occurred_at} title={new Date(alert.occurred_at).toLocaleString('fr-FR')}>{formatAge(alert.occurred_at, now)}</time>
            {alert.geofence_name && <span>Zone : {alert.geofence_name}</span>}
            {alert.booking_reference && <span>Location {alert.booking_reference}</span>}
            {alert.position && <span className="tabular-nums">{formatCoordinates(alert.position, 4)}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          {acknowledged ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
              Prise en compte {formatAge(alert.acknowledged_at, now)}
            </span>
          ) : canAcknowledge ? (
            <button type="button" onClick={onAcknowledge} disabled={busy} className={button.secondary}>
              <Check aria-hidden="true" className="h-4 w-4" />
              {busy ? 'Enregistrement…' : 'Prendre en compte'}
            </button>
          ) : (
            <span className="text-xs text-slate-500">En attente</span>
          )}
        </div>
      </div>
    </li>
  );
}

/** Alertes de suivi : filtres, pagination, accusé de réception ; mise à jour en direct des nouvelles alertes. */
export function TrackingAlerts({ initialVehicleId = '' }: { initialVehicleId?: string }) {
  const access = useTrackingAccess();
  const now = useNow();
  const toast = useNotice();
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [type, setType] = useState<AlertType | ''>('');
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const alerts = useTrackingQuery<AlertsPage>('/alerts', {
    status: status === 'ALL' ? undefined : status,
    type: type || undefined,
    severity: severity || undefined,
    vehicle_id: initialVehicleId || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const { reload } = alerts;

  useTrackingRealtime({ agencyId: access.agencyId, onPositions: () => undefined, onAlertChange: reload, onResync: reload });

  const acknowledge = useCallback(
    async (alert: TrackingAlert) => {
      setBusyId(alert.id);
      try {
        await trackingApi(`/alerts/${alert.id}`, { method: 'PATCH', body: { action: 'acknowledge' } });
        toast.success('Alerte prise en compte.');
        reload();
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    // `toast` change à chaque rendu : seules ses fonctions stables importent ici
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload]
  );

  const data = alerts.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const onFilter = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };

  return (
    <div className="space-y-5">
      {toast.notice && <Toast kind={toast.notice.kind} message={toast.notice.message} onDismiss={toast.dismiss} />}
      <SectionTitle
        title="Alertes de suivi"
        description="Boîtier hors ligne, zones, vitesse, mouvement inattendu et signaux matériels (uniquement si le boîtier les fournit)."
        action={data ? <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink"><BellRing aria-hidden="true" className="h-4 w-4 text-slate-400" />{data.open_total} ouverte{data.open_total > 1 ? 's' : ''}</p> : undefined}
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="alert-status" className="mb-1 block text-xs font-medium text-ink-secondary">Statut</label>
            <select id="alert-status" className={selectClass} value={status} onChange={(event) => onFilter(setStatus)(event.target.value as StatusFilter)}>
              <option value="OPEN">Ouvertes</option>
              <option value="ACKNOWLEDGED">Prises en compte</option>
              <option value="ALL">Toutes</option>
            </select>
          </div>
          <div>
            <label htmlFor="alert-type" className="mb-1 block text-xs font-medium text-ink-secondary">Type</label>
            <select id="alert-type" className={selectClass} value={type} onChange={(event) => onFilter(setType)(event.target.value as AlertType | '')}>
              <option value="">Tous les types</option>
              {ALERT_TYPES.map((value) => <option key={value} value={value}>{ALERT_TYPE_LABELS[value]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="alert-severity" className="mb-1 block text-xs font-medium text-ink-secondary">Gravité</label>
            <select id="alert-severity" className={selectClass} value={severity} onChange={(event) => onFilter(setSeverity)(event.target.value as AlertSeverity | '')}>
              <option value="">Toutes</option>
              {ALERT_SEVERITIES.map((value) => <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>)}
            </select>
          </div>
        </div>
        {initialVehicleId && <p className="mt-3 text-xs text-slate-500">Filtré sur un véhicule. <Link href="/agency/tracking/alerts" className="font-semibold underline">Voir toutes les alertes</Link></p>}
      </Card>

      {alerts.error && <ErrorBanner message={alerts.error} onRetry={alerts.reload} retrying={alerts.loading} />}

      {alerts.loading && !data ? (
        <div className="space-y-3" aria-busy="true" aria-label="Chargement des alertes">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : data && data.alerts.length === 0 ? (
        <Card>
          <EmptyState title={status === 'OPEN' ? 'Aucune alerte ouverte' : 'Aucune alerte'} text="Tout est calme : aucune alerte ne correspond à ces filtres." />
        </Card>
      ) : data ? (
        <>
          <ul aria-label="Alertes" className="space-y-3">
            {data.alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} now={now} canAcknowledge={access.permissions.alerts} busy={busyId === alert.id} onAcknowledge={() => void acknowledge(alert)} />
            ))}
          </ul>
          {data.total > PAGE_SIZE && (
            <Card><Pagination page={page} pageCount={pageCount} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} label="des alertes" /></Card>
          )}
        </>
      ) : null}
    </div>
  );
}

