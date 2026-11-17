'use client';

import { useMemo, useState } from 'react';
import { MapPinned, Pencil, Plus, Trash2 } from 'lucide-react';
import { button } from '@/lib/design/tokens';
import { errorMessage, trackingApi } from '@/lib/tracking/client';
import { formatDistanceKm } from '@/lib/tracking/geo.utils';
import { vehicleLabel } from '@/lib/tracking/fleet-state';
import type { FleetOverview, GeofenceRecord } from '@/lib/tracking/types';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';
import { EmptyState, ErrorBanner, Skeleton, Toast } from '@/components/agency/shell/Feedback';
import { GeofenceEditor, type GeofenceFormValue } from './GeofenceEditor';
import { useApiAgency, useTrackingAccess } from './TrackingAccess';
import { TrackingMapLazy } from './TrackingMapLazy';
import { Card, SectionTitle, Switch, useNotice } from './ui';
import { useTrackingQuery } from './useTrackingQuery';

/** Zones de l'agence : liste, carte, création, modification, activation, suppression (avec confirmation). */
export function GeofencesPanel() {
  const access = useTrackingAccess();
  const apiAgency = useApiAgency();
  const toast = useNotice();
  const zones = useTrackingQuery<{ geofences: GeofenceRecord[] }>('/geofences', {});
  const fleet = useTrackingQuery<FleetOverview>('/vehicles', { limit: 500 });
  const [editing, setEditing] = useState<GeofenceRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<GeofenceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = access.permissions.manage;

  const vehicles = useMemo(() => (fleet.data?.vehicles ?? []).map((v) => ({ id: v.id, label: vehicleLabel(v) })), [fleet.data]);
  const list = zones.data?.geofences ?? [];
  const labelById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.label])), [vehicles]);
  const firstPosition = fleet.data?.vehicles.find((v) => v.position)?.position ?? null;

  const save = async (value: GeofenceFormValue) => {
    const isNew = editing === 'new';
    await trackingApi(isNew ? '/geofences' : `/geofences/${(editing as GeofenceRecord).id}`, { method: isNew ? 'POST' : 'PATCH', body: value, agencyId: apiAgency });
    setEditing(null);
    toast.success(isNew ? 'Zone créée.' : 'Zone mise à jour.');
    zones.reload();
  };

  const toggle = async (zone: GeofenceRecord, enabled: boolean) => {
    try {
      await trackingApi(`/geofences/${zone.id}`, {
        method: 'PATCH',
        agencyId: apiAgency,
        body: { name: zone.name, center_latitude: zone.center_latitude, center_longitude: zone.center_longitude, radius_m: zone.radius_m, enabled, alert_on_enter: zone.alert_on_enter, alert_on_exit: zone.alert_on_exit, vehicle_ids: zone.vehicle_ids },
      });
      toast.success(enabled ? 'Zone activée.' : 'Zone désactivée.');
      zones.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await trackingApi(`/geofences/${deleting.id}`, { method: 'DELETE', agencyId: apiAgency });
      toast.success('Zone supprimée.');
      setDeleting(null);
      zones.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {toast.notice && <Toast kind={toast.notice.kind} message={toast.notice.message} onDismiss={toast.dismiss} />}
      <SectionTitle
        title="Zones géographiques"
        description="Alertes d’entrée et de sortie pour les véhicules choisis. Zones circulaires ; d’autres formes pourront être ajoutées."
        action={canManage ? <button type="button" className={button.primary} onClick={() => setEditing('new')}><Plus aria-hidden="true" className="h-4 w-4" />Nouvelle zone</button> : undefined}
      />

      {zones.error && <ErrorBanner message={zones.error} onRetry={zones.reload} retrying={zones.loading} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          {zones.loading && !zones.data ? (
            <div className="space-y-3 p-4" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState
              title="Aucune zone"
              text="Créez une zone (agence, aéroport, port…) pour être alerté quand un véhicule y entre ou en sort."
              action={canManage ? <button type="button" className={button.primary} onClick={() => setEditing('new')}>Créer une zone</button> : undefined}
            />
          ) : (
            <ul aria-label="Zones" className="divide-y divide-slate-100">
              {list.map((zone) => (
                <li key={zone.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink"><MapPinned aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{zone.name}</span></p>
                      <p className="mt-1 text-xs text-slate-500">
                        Rayon {formatDistanceKm(zone.radius_m / 1000)} · {zone.vehicle_ids.length} véhicule{zone.vehicle_ids.length > 1 ? 's' : ''} ·{' '}
                        {[zone.alert_on_enter && 'entrée', zone.alert_on_exit && 'sortie'].filter(Boolean).join(' + ') || 'aucune alerte'}
                      </p>
                      {zone.vehicle_ids.length > 0 && (
                        <p className="mt-1 truncate text-xs text-slate-500">{zone.vehicle_ids.map((id) => labelById.get(id) ?? 'Véhicule').slice(0, 3).join(', ')}{zone.vehicle_ids.length > 3 ? '…' : ''}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => setEditing(zone)} aria-label={`Modifier la zone ${zone.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Pencil aria-hidden="true" className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setDeleting(zone)} aria-label={`Supprimer la zone ${zone.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <Switch id={`zone-${zone.id}`} checked={zone.enabled} disabled={!canManage} onChange={(value) => void toggle(zone, value)} label={zone.enabled ? 'Zone active' : 'Zone désactivée'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="relative h-[24rem] lg:h-auto lg:min-h-[30rem]">
          <TrackingMapLazy className="h-full w-full" geofences={list} fitKey={list.map((z) => z.id).join(',')} ariaLabel="Carte des zones géographiques" />
        </div>
      </div>

      {editing && (
        <GeofenceEditor
          geofence={editing === 'new' ? null : editing}
          vehicles={vehicles}
          initialCenter={firstPosition}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          destructive
          title="Supprimer cette zone ?"
          message={`La zone « ${deleting.name} » ne générera plus d’alertes. Les alertes passées sont conservées.`}
          confirmLabel="Supprimer"
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
