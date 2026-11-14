'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Info, ShieldCheck } from 'lucide-react';
import { button, input } from '@/lib/design/tokens';
import { errorMessage, trackingApi } from '@/lib/tracking/client';
import { LEGAL_BASIS_LABELS } from '@/lib/tracking/labels';
import { LEGAL_BASES, type LegalBasis, type TrackingSettings } from '@/lib/tracking/types';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';
import { EmptyState, ErrorBanner, Skeleton, Toast } from '@/components/agency/shell/Feedback';
import { useApiAgency, useTrackingAccess } from './TrackingAccess';
import { Card, Field, SectionTitle, Switch, selectClass, useNotice, useNow } from './ui';
import { useTrackingQuery } from './useTrackingQuery';

interface SupportGrant {
  id: string;
  reason: string;
  starts_at: string;
  expires_at: string;
  revoked_at: string | null;
}

interface Draft {
  retention_days: string;
  trip_retention_days: string;
  offline_after_minutes: string;
  moving_speed_kmh: string;
  trip_end_idle_minutes: string;
  speed_alerts_enabled: boolean;
  speed_limit_kmh: string;
  unexpected_movement_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  legal_basis: LegalBasis | '';
  cndp_reference: string;
  customers_informed: boolean;
}

const hhmm = (value: string) => value.slice(0, 5);

function toDraft(settings: TrackingSettings): Draft {
  return {
    retention_days: String(settings.retention_days),
    trip_retention_days: String(settings.trip_retention_days),
    offline_after_minutes: String(settings.offline_after_minutes),
    moving_speed_kmh: String(settings.moving_speed_kmh),
    trip_end_idle_minutes: String(settings.trip_end_idle_minutes),
    speed_alerts_enabled: settings.speed_alerts_enabled,
    speed_limit_kmh: settings.speed_limit_kmh === null ? '' : String(settings.speed_limit_kmh),
    unexpected_movement_enabled: settings.unexpected_movement_enabled,
    quiet_hours_start: hhmm(settings.quiet_hours_start),
    quiet_hours_end: hhmm(settings.quiet_hours_end),
    legal_basis: settings.legal_basis ?? '',
    cndp_reference: settings.cndp_reference ?? '',
    customers_informed: settings.customers_informed_at !== null,
  };
}

const RANGES = {
  retention_days: [7, 730, 'Conservation des positions : 7 à 730 jours.'],
  trip_retention_days: [30, 1825, 'Conservation des trajets et alertes : 30 à 1 825 jours.'],
  offline_after_minutes: [2, 1440, 'Délai « hors ligne » : 2 à 1 440 minutes.'],
  moving_speed_kmh: [1, 30, 'Seuil de mouvement : 1 à 30 km/h.'],
  trip_end_idle_minutes: [1, 60, 'Arrêt de fin de trajet : 1 à 60 minutes.'],
  speed_limit_kmh: [20, 250, 'Limite de vitesse : 20 à 250 km/h.'],
} as const;

/** Différences entre le brouillon et les paramètres enregistrés (seules les clés modifiées sont envoyées) */
export function diffSettings(draft: Draft, saved: TrackingSettings): { changes: Record<string, unknown>; errors: Record<string, string> } {
  const base = toDraft(saved);
  const changes: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const key of ['retention_days', 'trip_retention_days', 'offline_after_minutes', 'moving_speed_kmh', 'trip_end_idle_minutes'] as const) {
    if (draft[key] === base[key]) continue;
    const value = Number(draft[key]);
    const [min, max, message] = RANGES[key];
    if (!Number.isInteger(value) || value < min || value > max) errors[key] = message;
    else changes[key] = value;
  }
  if (draft.speed_alerts_enabled !== base.speed_alerts_enabled) changes.speed_alerts_enabled = draft.speed_alerts_enabled;
  if (draft.speed_limit_kmh !== base.speed_limit_kmh) {
    if (draft.speed_limit_kmh.trim() === '') changes.speed_limit_kmh = null;
    else {
      const value = Number(draft.speed_limit_kmh);
      const [min, max, message] = RANGES.speed_limit_kmh;
      if (!Number.isInteger(value) || value < min || value > max) errors.speed_limit_kmh = message;
      else changes.speed_limit_kmh = value;
    }
  }
  const limitAfter = 'speed_limit_kmh' in changes ? changes.speed_limit_kmh : saved.speed_limit_kmh;
  const alertsAfter = 'speed_alerts_enabled' in changes ? changes.speed_alerts_enabled : saved.speed_alerts_enabled;
  if (alertsAfter && limitAfter === null && !errors.speed_limit_kmh) errors.speed_limit_kmh = 'Renseignez une limite de vitesse pour activer l’alerte.';

  if (draft.unexpected_movement_enabled !== base.unexpected_movement_enabled) changes.unexpected_movement_enabled = draft.unexpected_movement_enabled;
  for (const key of ['quiet_hours_start', 'quiet_hours_end'] as const) {
    if (draft[key] !== base[key]) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft[key])) errors[key] = 'Heure invalide (HH:MM).';
      else changes[key] = draft[key];
    }
  }
  if (draft.legal_basis !== base.legal_basis) changes.legal_basis = draft.legal_basis === '' ? null : draft.legal_basis;
  if (draft.cndp_reference.trim() !== base.cndp_reference.trim()) {
    if (draft.cndp_reference.length > 120) errors.cndp_reference = '120 caractères au maximum.';
    else changes.cndp_reference = draft.cndp_reference.trim() === '' ? null : draft.cndp_reference.trim();
  }
  if (draft.customers_informed !== base.customers_informed) changes.customers_informed = draft.customers_informed;
  return { changes, errors };
}

function noticeText(agencyName: string, retentionDays: number): string {
  return `Ce véhicule est équipé d’un dispositif de géolocalisation (boîtier GPS) installé par ${agencyName}. Il enregistre la position du véhicule afin d’en assurer la sécurité, de prévenir le vol et de vérifier le respect des conditions de location. Ces données ne sont accessibles qu’au personnel habilité de l’agence et sont conservées ${retentionDays} jours. Pour toute question ou pour exercer vos droits, contactez l’agence.`;
}

/**
 * Paramètres du suivi : conservation, détection, alertes, et déclarations de conformité de l'agence.
 * ClickDrive fournit des outils ; l'agence est responsable du traitement et de l'information de ses clients.
 * Aucune conformité légale n'est affirmée ici.
 */
export function TrackingSettingsPanel() {
  const access = useTrackingAccess();
  const apiAgency = useApiAgency();
  const toast = useNotice();
  const now = useNow(30_000);
  const canEdit = access.permissions.settings;
  const settings = useTrackingQuery<TrackingSettings>('/settings', {});
  const grants = useTrackingQuery<{ grants: SupportGrant[] }>('/support-grants', {}, canEdit);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<SupportGrant | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialise le brouillon à la réception des paramètres
    if (settings.data) setDraft(toDraft(settings.data));
  }, [settings.data]);

  const pendingChanges = useMemo(() => (draft && settings.data ? diffSettings(draft, settings.data) : null), [draft, settings.data]);
  // Validation affichée en direct : l'erreur apparaît dès la saisie, l'enregistrement reste bloqué tant qu'elle subsiste
  const errors: Record<string, string> = pendingChanges?.errors ?? {};
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!draft || !settings.data || !pendingChanges) return;
    if (Object.keys(pendingChanges.errors).length > 0 || Object.keys(pendingChanges.changes).length === 0) return;
    setSaving(true);
    try {
      await trackingApi('/settings', { method: 'PATCH', body: pendingChanges.changes, agencyId: apiAgency });
      toast.success('Paramètres enregistrés.');
      settings.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await trackingApi(`/support-grants/${revoking.id}`, { method: 'DELETE', agencyId: apiAgency });
      toast.success('Accès de support révoqué.');
      setRevoking(null);
      grants.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRevokeBusy(false);
    }
  };

  if (settings.error && !settings.data) return <ErrorBanner message={settings.error} onRetry={settings.reload} retrying={settings.loading} />;
  if (!draft || !settings.data) {
    return <div className="space-y-4" aria-busy="true" aria-label="Chargement des paramètres">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>;
  }

  const retention = Number(draft.retention_days) || settings.data.retention_days;
  const template = noticeText(access.agencyName, retention);
  const activeGrants = (grants.data?.grants ?? []).filter((g) => !g.revoked_at && Date.parse(g.expires_at) > now);
  const numberField = (key: keyof typeof RANGES, label: string, hint?: string) => (
    <Field label={label} htmlFor={`st-${key}`} hint={hint} error={errors[key]}>
      <input id={`st-${key}`} inputMode="numeric" disabled={!canEdit} value={draft[key]} onChange={(event) => set(key, event.target.value as Draft[typeof key])} className={input} aria-invalid={Boolean(errors[key])} />
    </Field>
  );

  return (
    <div className="space-y-5">
      {toast.notice && <Toast kind={toast.notice.kind} message={toast.notice.message} onDismiss={toast.dismiss} />}
      <SectionTitle title="Paramètres du suivi" description="Conservation des données, détection des trajets, alertes et conformité." />
      {!canEdit && (
        <p role="note" className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Seul un administrateur de l’agence peut modifier ces paramètres.
        </p>
      )}

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-bold text-[#0F172A]">Conservation des données</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {numberField('retention_days', 'Positions (jours)', 'Au-delà, les positions sont supprimées automatiquement.')}
          {numberField('trip_retention_days', 'Trajets et alertes (jours)')}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-bold text-[#0F172A]">Détection</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {numberField('offline_after_minutes', 'Hors ligne après (min)', 'Sans communication du boîtier.')}
          {numberField('moving_speed_kmh', 'Mouvement dès (km/h)')}
          {numberField('trip_end_idle_minutes', 'Fin de trajet après (min)', 'Arrêt prolongé.')}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-bold text-[#0F172A]">Alertes</h3>
        <Switch id="st-speed" label="Alerte de vitesse excessive" description="Une alerte est créée au dépassement de la limite, puis résolue au retour sous la limite." checked={draft.speed_alerts_enabled} onChange={(value) => set('speed_alerts_enabled', value)} disabled={!canEdit} />
        {numberField('speed_limit_kmh', 'Limite de vitesse (km/h)')}
        <Switch id="st-unexpected" label="Mouvement inattendu" description="Départ d’un véhicule hors réservation pendant les heures calmes." checked={draft.unexpected_movement_enabled} onChange={(value) => set('unexpected_movement_enabled', value)} disabled={!canEdit} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heures calmes : début" htmlFor="st-quiet-start" hint="Heure du Maroc." error={errors.quiet_hours_start}>
            <input id="st-quiet-start" type="time" disabled={!canEdit} value={draft.quiet_hours_start} onChange={(event) => set('quiet_hours_start', event.target.value)} className={input} />
          </Field>
          <Field label="Heures calmes : fin" htmlFor="st-quiet-end" error={errors.quiet_hours_end}>
            <input id="st-quiet-end" type="time" disabled={!canEdit} value={draft.quiet_hours_end} onChange={(event) => set('quiet_hours_end', event.target.value)} className={input} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A]"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-slate-400" />Vie privée et conformité</h3>
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          La localisation de véhicules loués est un traitement de données personnelles dont l’agence est responsable. ClickDrive fournit les outils (accès restreint, journal d’audit, durée de conservation) mais ne certifie aucune conformité :
          vérifiez les formalités applicables (notamment auprès de la CNDP) et l’information de vos clients.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base légale invoquée (déclaration de l’agence)" htmlFor="st-legal">
            <select id="st-legal" className={selectClass} disabled={!canEdit} value={draft.legal_basis} onChange={(event) => set('legal_basis', event.target.value as LegalBasis | '')}>
              <option value="">Non renseignée</option>
              {LEGAL_BASES.map((value) => <option key={value} value={value}>{LEGAL_BASIS_LABELS[value]}</option>)}
            </select>
          </Field>
          <Field label="Référence CNDP (déclaration / autorisation)" htmlFor="st-cndp" hint="Numéro ou intitulé, tel que vous l’avez obtenu." error={errors.cndp_reference}>
            <input id="st-cndp" disabled={!canEdit} maxLength={120} value={draft.cndp_reference} onChange={(event) => set('cndp_reference', event.target.value)} className={input} />
          </Field>
        </div>
        <Switch
          id="st-informed"
          label="Je confirme informer mes clients de la présence d’un dispositif GPS"
          description={settings.data.customers_informed_at ? `Confirmé le ${new Date(settings.data.customers_informed_at).toLocaleDateString('fr-FR')}.` : 'Information à intégrer à votre contrat de location.'}
          checked={draft.customers_informed}
          onChange={(value) => set('customers_informed', value)}
          disabled={!canEdit}
        />
        <div>
          <p className="text-sm font-medium text-[#0F172A]">Modèle d’information des locataires (à adapter)</p>
          <p className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{template}</p>
          <button
            type="button"
            className={`${button.secondary} mt-2`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(template);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // presse-papiers indisponible
              }
            }}
          >
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier le texte'}
          </button>
        </div>
      </Card>

      {canEdit && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-[#0F172A]">Accès de support plateforme</h3>
          <p className="mt-1 text-sm text-[#64748B]">Un administrateur de ClickDrive n’a aucun accès à vos positions, sauf autorisation motivée, limitée dans le temps et journalisée. Vous pouvez y mettre fin à tout moment.</p>
          {grants.loading && !grants.data ? (
            <Skeleton className="mt-3 h-10 w-full" />
          ) : grants.data && grants.data.grants.length === 0 ? (
            <EmptyState title="Aucun accès de support" text="Aucune autorisation n’a été accordée à ce jour." />
          ) : (
            <ul aria-label="Accès de support" className="mt-3 divide-y divide-slate-100">
              {(grants.data?.grants ?? []).slice(0, 10).map((grant) => {
                const active = !grant.revoked_at && Date.parse(grant.expires_at) > now;
                return (
                  <li key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[#0F172A]">{grant.reason}</span>
                      <span className="text-xs text-slate-500">{new Date(grant.starts_at).toLocaleString('fr-FR')} → {new Date(grant.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{grant.revoked_at ? ' · révoqué' : active ? ' · actif' : ' · expiré'}</span>
                    </span>
                    {active && <button type="button" className={button.danger} onClick={() => setRevoking(grant)}>Révoquer</button>}
                  </li>
                );
              })}
            </ul>
          )}
          {activeGrants.length > 0 && <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{activeGrants.length} accès de support actif{activeGrants.length > 1 ? 's' : ''} en ce moment.</p>}
        </Card>
      )}

      {canEdit && (
        <div className="sticky bottom-20 z-10 flex flex-col items-stretch gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
          <p className="text-sm text-slate-600" aria-live="polite">
            {pendingChanges && Object.keys(pendingChanges.changes).length > 0 ? `${Object.keys(pendingChanges.changes).length} modification(s) non enregistrée(s)` : 'Aucune modification'}
          </p>
          <div className="flex gap-2">
            <button type="button" className={button.secondary} disabled={saving} onClick={() => { if (settings.data) setDraft(toDraft(settings.data)); }}>Annuler</button>
            <button type="button" className={button.primary} disabled={saving || !pendingChanges || Object.keys(pendingChanges.changes).length === 0 || Object.keys(pendingChanges.errors).length > 0} onClick={() => void save()}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}

      {revoking && (
        <ConfirmDialog
          destructive
          title="Révoquer cet accès de support ?"
          message="L’administrateur de la plateforme perd immédiatement l’accès à vos positions."
          confirmLabel="Révoquer"
          busy={revokeBusy}
          onConfirm={() => void revoke()}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  );
}
