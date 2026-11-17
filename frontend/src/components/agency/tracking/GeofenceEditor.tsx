'use client';

import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { button, input } from '@/lib/design/tokens';
import { isValidCoordinate } from '@/lib/tracking/geo.utils';
import type { GeofenceRecord } from '@/lib/tracking/types';
import { Modal } from '@/components/agency/shell/Dialog';
import { TrackingMapLazy } from './TrackingMapLazy';
import { Field, Switch } from './ui';

export interface GeofenceFormValue {
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_m: number;
  enabled: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  vehicle_ids: string[];
}

interface Errors {
  name?: string;
  center?: string;
  radius?: string;
  form?: string;
}

/**
 * Création / modification d'une zone circulaire : nom, centre (clic sur la carte ou saisie des coordonnées),
 * rayon, alertes d'entrée/sortie, véhicules concernés. Validation côté interface ; l'API et la base revalident.
 */
export function GeofenceEditor({
  geofence,
  vehicles,
  initialCenter,
  onSave,
  onClose,
}: {
  geofence: GeofenceRecord | null;
  vehicles: readonly { id: string; label: string }[];
  initialCenter?: { latitude: number; longitude: number } | null;
  onSave: (value: GeofenceFormValue) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(geofence?.name ?? '');
  const [radius, setRadius] = useState(String(geofence?.radius_m ?? 300));
  const [latitude, setLatitude] = useState(geofence ? String(geofence.center_latitude) : initialCenter ? String(initialCenter.latitude) : '');
  const [longitude, setLongitude] = useState(geofence ? String(geofence.center_longitude) : initialCenter ? String(initialCenter.longitude) : '');
  const [enabled, setEnabled] = useState(geofence?.enabled ?? true);
  const [onEnter, setOnEnter] = useState(geofence?.alert_on_enter ?? true);
  const [onExit, setOnExit] = useState(geofence?.alert_on_exit ?? true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(geofence?.vehicle_ids ?? []));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const center = useMemo(() => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    return latitude.trim() !== '' && longitude.trim() !== '' && isValidCoordinate(lat, lon) ? { latitude: lat, longitude: lon } : null;
  }, [latitude, longitude]);
  const radiusNumber = Number(radius);
  const previewRadius = Number.isFinite(radiusNumber) && radiusNumber >= 25 ? Math.min(radiusNumber, 100_000) : 25;
  const pick = useMemo(() => ({ center, radius_m: previewRadius }), [center, previewRadius]);

  const toggleVehicle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Donnez un nom à la zone.';
    else if (name.trim().length > 80) next.name = '80 caractères au maximum.';
    if (!center) next.center = 'Cliquez sur la carte ou saisissez des coordonnées valides.';
    if (!Number.isInteger(radiusNumber) || radiusNumber < 25 || radiusNumber > 100_000) next.radius = 'Rayon entier entre 25 m et 100 000 m.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !center) return;

    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        center_latitude: center.latitude,
        center_longitude: center.longitude,
        radius_m: radiusNumber,
        enabled,
        alert_on_enter: onEnter,
        alert_on_exit: onExit,
        vehicle_ids: [...selected],
      });
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Enregistrement impossible.' });
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={geofence ? 'Modifier la zone' : 'Nouvelle zone'}
      description="Zone circulaire : une alerte est créée quand un véhicule affecté y entre ou en sort."
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className={button.secondary} onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className={button.primary} onClick={() => void submit()} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Nom de la zone" htmlFor="gf-name" error={errors.name}>
            <input id="gf-name" data-autofocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className={input} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'gf-name-error' : undefined} />
          </Field>
          <Field label="Rayon (mètres)" htmlFor="gf-radius" hint="De 25 m à 100 km." error={errors.radius}>
            <input id="gf-radius" inputMode="numeric" value={radius} onChange={(event) => setRadius(event.target.value)} className={input} aria-invalid={Boolean(errors.radius)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="gf-lat">
              <input id="gf-lat" inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} className={input} />
            </Field>
            <Field label="Longitude" htmlFor="gf-lon">
              <input id="gf-lon" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} className={input} />
            </Field>
          </div>
          {errors.center && <p role="alert" className="-mt-2 text-xs font-medium text-red-700">{errors.center}</p>}

          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Alertes</legend>
            <Switch id="gf-enabled" checked={enabled} onChange={setEnabled} label="Zone active" description="Une zone désactivée ne génère aucune alerte." />
            <Switch id="gf-enter" checked={onEnter} onChange={setOnEnter} label="Alerte à l’entrée" />
            <Switch id="gf-exit" checked={onExit} onChange={setOnExit} label="Alerte à la sortie" />
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-ink">Véhicules concernés ({selected.size})</legend>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {vehicles.length === 0 && <p className="px-2 py-1.5 text-sm text-slate-500">Aucun véhicule.</p>}
              {vehicles.map((vehicle) => (
                <label key={vehicle.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={selected.has(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} className="h-4 w-4 rounded border-slate-300 accent-ink" />
                  <span className="truncate">{vehicle.label}</span>
                </label>
              ))}
            </div>
            {vehicles.length > 0 && (
              <div className="mt-2 flex gap-3 text-xs">
                <button type="button" className="font-medium text-slate-600 underline" onClick={() => setSelected(new Set(vehicles.map((v) => v.id)))}>Tout sélectionner</button>
                <button type="button" className="font-medium text-slate-600 underline" onClick={() => setSelected(new Set())}>Aucun</button>
              </div>
            )}
          </fieldset>
          {errors.form && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errors.form}</p>}
        </div>

        <div className="space-y-2">
          <div className="relative h-72 md:h-full md:min-h-[26rem]">
            <TrackingMapLazy
              className="h-full w-full"
              pick={pick}
              onPick={(point) => {
                setLatitude(point.latitude.toFixed(6));
                setLongitude(point.longitude.toFixed(6));
              }}
              fitKey={center ? `${center.latitude}|${center.longitude}` : 'none'}
              ariaLabel="Carte : cliquez pour placer le centre de la zone"
            />
            <p className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Cliquez sur la carte pour placer le centre de la zone.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
