'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check, Compass, Copy, Gauge, KeyRound, MapPin, RadioTower, X } from 'lucide-react';
import { button, shell } from '@/lib/design/tokens';
import { cn } from '@/lib/utils';
import { compassLabel, formatAge, formatCoordinates, formatSpeed } from '@/lib/tracking/geo.utils';
import type { FleetVehicle } from '@/lib/tracking/types';
import { VehicleStatusBadge } from './VehicleStatusBadge';

const EXPLANATIONS: Record<string, string> = {
  UNTRACKED: 'Aucun boîtier GPS n’est affecté à ce véhicule. Affectez-en un dans « Boîtiers ».',
  DISABLED: 'Le boîtier est en pause : aucune position n’est enregistrée.',
  AWAITING: 'Le boîtier est enregistré mais n’a pas encore transmis de position.',
};

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="flex items-center gap-2 text-slate-500">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * Détail de la dernière position d'un véhicule : identification, état de connexion, vitesse, cap,
 * contact (si le boîtier le fournit), dernière mise à jour et location en cours (référence seulement).
 */
export function VehicleLocationCard({
  vehicle,
  now,
  onClose,
  className,
}: {
  vehicle: FleetVehicle;
  now: number;
  onClose?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const position = vehicle.position;
  const heading = compassLabel(position?.heading_deg);

  const copy = async () => {
    if (!position) return;
    try {
      await navigator.clipboard.writeText(formatCoordinates(position, 6));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // presse-papiers indisponible : sans effet
    }
  };

  return (
    <section aria-label={`Position de ${vehicle.brand} ${vehicle.model}`} className={cn(shell.card, 'p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">
            {vehicle.brand} {vehicle.model}
          </h3>
          <p className="truncate text-xs text-ink-secondary">{[vehicle.unit_number, vehicle.license_plate].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <VehicleStatusBadge state={vehicle.state} />
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fermer le détail" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {position ? (
        <dl className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <Row icon={<MapPin className="h-4 w-4" />} label="Coordonnées">
            <span className="tabular-nums">{formatCoordinates(position)}</span>
          </Row>
          <Row icon={<Gauge className="h-4 w-4" />} label="Vitesse">
            <span className="tabular-nums">{formatSpeed(position.speed_kmh)}</span>
          </Row>
          <Row icon={<Compass className="h-4 w-4" />} label="Direction">
            {heading ? `${heading} (${Math.round(position.heading_deg ?? 0)}°)` : '—'}
          </Row>
          <Row icon={<KeyRound className="h-4 w-4" />} label="Contact">
            {position.ignition === null ? 'Non fourni par le boîtier' : position.ignition ? 'Mis' : 'Coupé'}
          </Row>
          <Row icon={<RadioTower className="h-4 w-4" />} label="Dernière position">
            <time dateTime={position.recorded_at} title={new Date(position.recorded_at).toLocaleString('fr-FR')}>
              {formatAge(position.recorded_at, now)}
            </time>
          </Row>
        </dl>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">{EXPLANATIONS[vehicle.state] ?? 'Aucune position disponible.'}</p>
      )}

      {vehicle.state === 'OFFLINE' && position && (
        <p role="note" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          Le boîtier ne communique plus : la position affichée est la dernière connue.
        </p>
      )}
      {vehicle.booking_reference && (
        <p className="mt-3 text-xs text-slate-600">
          Location en cours : <span className="font-semibold text-ink">{vehicle.booking_reference}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/agency/tracking/vehicles/${vehicle.id}`} className={button.primary}>
          Voir le détail
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        {position && (
          <button type="button" onClick={copy} className={button.secondary}>
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        )}
      </div>
    </section>
  );
}
