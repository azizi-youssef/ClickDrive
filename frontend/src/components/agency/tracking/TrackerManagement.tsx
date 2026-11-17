'use client';

import { useMemo, useState } from 'react';
import { History, Info, Link2, Pause, Play, Plus, Unplug } from 'lucide-react';
import { button, input } from '@/lib/design/tokens';
import { errorMessage, trackingApi } from '@/lib/tracking/client';
import { formatAge } from '@/lib/tracking/geo.utils';
import { TRACKING_CAPABILITY_LABELS } from '@/lib/tracking/labels';
import { vehicleLabel } from '@/lib/tracking/fleet-state';
import type { FleetOverview, TrackerRecord } from '@/lib/tracking/types';
import { ConfirmDialog, Modal } from '@/components/agency/shell/Dialog';
import { EmptyState, ErrorBanner, Skeleton, Toast } from '@/components/agency/shell/Feedback';
import { useApiAgency, useTrackingAccess } from './TrackingAccess';
import { TrackerStatusBadge } from './VehicleStatusBadge';
import { Card, Field, SectionTitle, selectClass, useNotice, useNow } from './ui';
import { useTrackingQuery } from './useTrackingQuery';

interface ProviderInfo {
  id: string;
  displayName: string;
  status: 'available' | 'pending';
  description: string;
  pendingReason: string | null;
}
interface TrackersPayload {
  trackers: TrackerRecord[];
  providers: ProviderInfo[];
}

function RegisterModal({
  providers,
  freeVehicles,
  onClose,
  onDone,
}: {
  providers: ProviderInfo[];
  freeVehicles: { id: string; label: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const apiAgency = useApiAgency();
  const available = providers.filter((p) => p.status === 'available');
  const pending = providers.filter((p) => p.status === 'pending');
  const [provider, setProvider] = useState(available[0]?.id ?? '');
  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [model, setModel] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [installedAt, setInstalledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(deviceId.trim())) {
      setFieldError('Identifiant requis : lettres, chiffres, . _ : - (128 caractères au maximum).');
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await trackingApi('/trackers', {
        method: 'POST',
        agencyId: apiAgency,
        body: {
          provider,
          external_device_id: deviceId.trim(),
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(model.trim() ? { device_model: model.trim() } : {}),
          ...(vehicleId ? { vehicle_id: vehicleId } : {}),
          ...(installedAt ? { installed_at: new Date(`${installedAt}T12:00:00`).toISOString() } : {}),
        },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Enregistrer un boîtier GPS"
      description="Le boîtier passe « actif » dès qu’il transmet sa première position."
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className={button.secondary} onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className={button.primary} onClick={() => void submit()} disabled={busy || !provider}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Fournisseur" htmlFor="tr-provider">
          <select id="tr-provider" className={selectClass} value={provider} onChange={(event) => setProvider(event.target.value)}>
            {available.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </Field>
        {pending.length > 0 && (
          <p className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Intégrations à venir (non sélectionnables) : {pending.map((p) => p.displayName).join(', ')}. Elles seront proposées une fois validées avec du matériel réel.</span>
          </p>
        )}
        <Field label="Identifiant du boîtier" htmlFor="tr-device" hint="Identifiant tel qu’envoyé par le fournisseur (IMEI, numéro de série…)." error={fieldError}>
          <input id="tr-device" data-autofocus value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className={input} autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Libellé (facultatif)" htmlFor="tr-label">
          <input id="tr-label" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} className={input} placeholder="ex. OBD Logan 12" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modèle (facultatif)" htmlFor="tr-model">
            <input id="tr-model" value={model} maxLength={80} onChange={(event) => setModel(event.target.value)} className={input} />
          </Field>
          <Field label="Date d’installation" htmlFor="tr-installed">
            <input id="tr-installed" type="date" value={installedAt} onChange={(event) => setInstalledAt(event.target.value)} className={input} />
          </Field>
        </div>
        <Field label="Véhicule (facultatif)" htmlFor="tr-vehicle" hint="Un véhicule ne peut avoir qu’un seul boîtier à la fois.">
          <select id="tr-vehicle" className={selectClass} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">Affecter plus tard</option>
            {freeVehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </Field>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      </div>
    </Modal>
  );
}

type Action =
  | { kind: 'assign'; tracker: TrackerRecord }
  | { kind: 'disconnect'; tracker: TrackerRecord };

/**
 * Gestion des boîtiers : inventaire, enregistrement, affectation / réaffectation (historique conservé),
 * pause, déconnexion (confirmée). Toutes les écritures sont revérifiées et auditées côté base.
 */
export function TrackerManagement() {
  const access = useTrackingAccess();
  const apiAgency = useApiAgency();
  const now = useNow();
  const toast = useNotice();
  const trackers = useTrackingQuery<TrackersPayload>('/trackers', {});
  const fleet = useTrackingQuery<FleetOverview>('/vehicles', { limit: 500 });
  const [registering, setRegistering] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [targetVehicle, setTargetVehicle] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const canManage = access.permissions.manage;

  const list = trackers.data?.trackers ?? [];
  const freeVehicles = useMemo(
    () => (fleet.data?.vehicles ?? []).filter((v) => v.tracker === null).map((v) => ({ id: v.id, label: vehicleLabel(v) })),
    [fleet.data]
  );

  const patch = async (tracker: TrackerRecord, body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      await trackingApi(`/trackers/${tracker.id}`, { method: 'PATCH', body, agencyId: apiAgency });
      toast.success(success);
      setAction(null);
      setReason('');
      setTargetVehicle('');
      trackers.reload();
      fleet.reload();
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
        title="Boîtiers GPS"
        description="Appareils OBD-II enregistrés et leur véhicule. Un véhicule n’a qu’un boîtier actif à la fois."
        action={canManage ? <button type="button" className={button.primary} onClick={() => setRegistering(true)}><Plus aria-hidden="true" className="h-4 w-4" />Enregistrer un boîtier</button> : undefined}
      />

      <Card className="p-4">
        <p className="flex gap-2 text-sm text-slate-600">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Les positions arrivent par le webhook sécurisé <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/tracking/&lt;fournisseur&gt;</code>, signé avec un secret serveur.
            Aucune position n’est simulée : sans émetteur configuré, un boîtier reste « en attente de position ».
          </span>
        </p>
      </Card>

      {trackers.error && <ErrorBanner message={trackers.error} onRetry={trackers.reload} retrying={trackers.loading} />}

      {trackers.loading && !trackers.data ? (
        <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            title="Aucun boîtier enregistré"
            text="Enregistrez votre premier boîtier OBD-II pour suivre la position de vos véhicules."
            action={canManage ? <button type="button" className={button.primary} onClick={() => setRegistering(true)}>Enregistrer un boîtier</button> : undefined}
          />
        </Card>
      ) : (
        <ul aria-label="Boîtiers GPS" className="space-y-3">
          {list.map((tracker) => (
            <li key={tracker.id}>
              <Card className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-ink">{tracker.label || tracker.external_device_id}</h3>
                      <TrackerStatusBadge state={tracker.state} />
                      {tracker.status === 'PENDING' && <span className="text-xs text-amber-800">En attente de première position</span>}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {tracker.provider} · <span className="tabular-nums">{tracker.external_device_id}</span>{tracker.device_model ? ` · ${tracker.device_model}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Véhicule : <span className="font-semibold text-ink">{tracker.vehicle ? vehicleLabel(tracker.vehicle) : 'non affecté'}</span>
                      {' · '}Dernière communication : {formatAge(tracker.last_seen_at, now)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Fonctions constatées : {Object.keys(tracker.capabilities).length ? Object.keys(tracker.capabilities).map((k) => TRACKING_CAPABILITY_LABELS[k] ?? k).join(', ') : 'position seule (rien d’autre reçu pour l’instant)'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <>
                        <button type="button" className={button.secondary} onClick={() => { setTargetVehicle(tracker.vehicle?.id ?? ''); setAction({ kind: 'assign', tracker }); }}>
                          <Link2 aria-hidden="true" className="h-4 w-4" />{tracker.vehicle ? 'Réaffecter' : 'Affecter'}
                        </button>
                        <button type="button" className={button.secondary} disabled={busy} onClick={() => void patch(tracker, { enabled: tracker.status === 'DISABLED' }, tracker.status === 'DISABLED' ? 'Boîtier réactivé.' : 'Boîtier mis en pause.')}>
                          {tracker.status === 'DISABLED' ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
                          {tracker.status === 'DISABLED' ? 'Réactiver' : 'Pause'}
                        </button>
                        <button type="button" className={button.danger} onClick={() => setAction({ kind: 'disconnect', tracker })}>
                          <Unplug aria-hidden="true" className="h-4 w-4" />Déconnecter
                        </button>
                      </>
                    )}
                    <button type="button" className={button.ghost} aria-expanded={expanded === tracker.id} onClick={() => setExpanded(expanded === tracker.id ? null : tracker.id)}>
                      <History aria-hidden="true" className="h-4 w-4" />Historique
                    </button>
                  </div>
                </div>
                {expanded === tracker.id && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {tracker.history.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucune affectation enregistrée.</p>
                    ) : (
                      <ol aria-label="Historique d’affectation" className="space-y-1.5 text-sm">
                        {tracker.history.map((entry, index) => (
                          <li key={`${entry.assigned_at}-${index}`} className="flex flex-wrap justify-between gap-2 text-slate-700">
                            <span className="font-medium">{entry.vehicle_label}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(entry.assigned_at).toLocaleDateString('fr-FR')} → {entry.unassigned_at ? new Date(entry.unassigned_at).toLocaleDateString('fr-FR') : 'aujourd’hui'}
                              {entry.reason ? ` · ${entry.reason}` : ''}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {registering && trackers.data && (
        <RegisterModal providers={trackers.data.providers} freeVehicles={freeVehicles} onClose={() => setRegistering(false)} onDone={() => { setRegistering(false); toast.success('Boîtier enregistré.'); trackers.reload(); fleet.reload(); }} />
      )}

      {action?.kind === 'assign' && (
        <Modal
          title={action.tracker.vehicle ? 'Réaffecter le boîtier' : 'Affecter le boîtier'}
          description={action.tracker.vehicle ? 'La réaffectation est conservée dans l’historique du boîtier.' : undefined}
          onClose={busy ? () => undefined : () => setAction(null)}
          footer={
            <>
              <button type="button" className={button.secondary} onClick={() => setAction(null)} disabled={busy}>Annuler</button>
              <button type="button" className={button.primary} disabled={busy || targetVehicle === (action.tracker.vehicle?.id ?? '')} onClick={() => void patch(action.tracker, { vehicle_id: targetVehicle || null, ...(reason.trim() ? { reason: reason.trim() } : {}) }, targetVehicle ? 'Boîtier affecté.' : 'Boîtier retiré du véhicule.')}>{busy ? 'Enregistrement…' : 'Valider'}</button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Véhicule" htmlFor="as-vehicle" hint="Seuls les véhicules sans boîtier sont proposés.">
              <select id="as-vehicle" data-autofocus className={selectClass} value={targetVehicle} onChange={(event) => setTargetVehicle(event.target.value)}>
                <option value="">Aucun (retirer du véhicule)</option>
                {action.tracker.vehicle && <option value={action.tracker.vehicle.id}>{vehicleLabel(action.tracker.vehicle)} (actuel)</option>}
                {freeVehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Motif (facultatif)" htmlFor="as-reason">
              <input id="as-reason" className={input} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
        </Modal>
      )}

      {action?.kind === 'disconnect' && (
        <ConfirmDialog
          destructive
          title="Déconnecter ce boîtier ?"
          message="Le boîtier est retiré du service : ses positions ne seront plus acceptées et le véhicule n’est plus suivi. L’historique déjà enregistré est conservé."
          confirmLabel="Déconnecter"
          busy={busy}
          reason={reason}
          onReasonChange={setReason}
          reasonLabel="Motif de la déconnexion"
          onConfirm={() => void patch(action.tracker, { disconnect: true, reason: reason.trim() }, 'Boîtier déconnecté.')}
          onCancel={() => { setAction(null); setReason(''); }}
        />
      )}
    </div>
  );
}
