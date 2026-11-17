'use client';

import { Calendar, Car, MapPin, Phone, Sparkles } from 'lucide-react';
import type { AgencySubscription } from '@/types';
import type { AdminAgency } from '@/lib/api/admin-dashboard.api';
import { AgencyStatusBadge, Td } from '@/components/admin/AdminUI';
import { cn } from '@/lib/utils';
import { AgencyActions, agencyInitials, type AgencyActionHandlers } from './AgencyRowActions';

/**
 * Colonnes du tableau qui n'apparaissent que si le conteneur est assez large (container queries : la
 * largeur utile dépend de la barre latérale, pas de la fenêtre). Agence, Ville & Contact, Statut et Actions
 * sont toujours visibles : on ne cache jamais ce qui permet d'agir.
 */
export const COLUMN = {
  plan: 'hidden @5xl:table-cell',
  fleet: 'hidden @6xl:table-cell',
  created: 'hidden @7xl:table-cell',
} as const;

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AgencyAvatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-linear-to-br from-red-600 to-rose-700 text-xs font-bold text-white shadow-xs"
    >
      {agencyInitials(name)}
    </div>
  );
}

function FleetBadge({ count }: { count: AdminAgency['vehicle_count'] }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
      title={count == null ? 'Le nombre de véhicules n’a pas été transmis.' : `${count} véhicule(s) dans cette agence.`}
    >
      <Car className="h-3 w-3" aria-hidden="true" />
      <span>{count == null ? 'Non transmis' : count}</span>
    </span>
  );
}

function PlanBadge({ subscription }: { subscription?: AgencySubscription }) {
  if (!subscription) return <span className="text-xs text-slate-500">Non abonné</span>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-ink">
      <Sparkles className="h-3 w-3 text-amber-500" aria-hidden="true" />
      {subscription.plan.name}
    </span>
  );
}

interface RowProps {
  agency: AdminAgency;
  subscription?: AgencySubscription;
  busy: boolean;
  handlers: AgencyActionHandlers;
}

/** Une agence en carte : tout est lisible et actionnable sans défilement horizontal */
export function AgencyCard({ agency, subscription, busy, handlers }: RowProps) {
  const isArchived = Boolean(agency.archived_at);
  return (
    <li className={cn('p-4', isArchived && 'bg-slate-50')}>
      <div className="flex items-start gap-3">
        <AgencyAvatar name={agency.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{agency.name}</p>
          <p className="truncate font-mono text-xs text-slate-500">{agency.email}</p>
        </div>
        <div className="shrink-0">
          <AgencyStatusBadge status={isArchived ? 'ARCHIVED' : agency.status} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <div className="min-w-0">
          <dt className="text-slate-500">Ville</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-slate-700">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{agency.city}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Téléphone</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-slate-700">
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate font-mono">{agency.phone}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Flotte</dt>
          <dd className="mt-0.5">
            <FleetBadge count={agency.vehicle_count} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Forfait</dt>
          <dd className="mt-0.5">
            <PlanBadge subscription={subscription} />
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-slate-500">Créée le</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-slate-600">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{formatCreatedAt(agency.created_at)}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-3.5 border-t border-slate-100 pt-3">
        <AgencyActions agency={agency} variant="card" busy={busy} handlers={handlers} />
      </div>
    </li>
  );
}

/** Une agence en ligne de tableau */
export function AgencyTableRow({ agency, subscription, busy, handlers }: RowProps) {
  const isArchived = Boolean(agency.archived_at);
  return (
    <tr className={cn('transition-colors hover:bg-slate-50/75', isArchived && 'bg-slate-50')}>
      <Td>
        <div className="flex items-center gap-3">
          <AgencyAvatar name={agency.name} />
          <div className="min-w-0 max-w-44">
            <p className="truncate text-sm font-semibold text-slate-900" title={agency.name}>{agency.name}</p>
            <p className="truncate font-mono text-xs text-slate-500" title={agency.email}>{agency.email}</p>
          </div>
        </div>
      </Td>

      <Td className="whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>{agency.city}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="font-mono">{agency.phone}</span>
        </div>
      </Td>

      <Td className={cn('whitespace-nowrap text-center', COLUMN.fleet)}>
        <FleetBadge count={agency.vehicle_count} />
      </Td>

      <Td className={cn('whitespace-nowrap', COLUMN.plan)}>
        <PlanBadge subscription={subscription} />
      </Td>

      <Td className={cn('whitespace-nowrap', COLUMN.created)}>
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>{formatCreatedAt(agency.created_at)}</span>
        </div>
      </Td>

      <Td className="whitespace-nowrap">
        <AgencyStatusBadge status={isArchived ? 'ARCHIVED' : agency.status} />
      </Td>

      <Td className="whitespace-nowrap text-right">
        <AgencyActions agency={agency} variant="table" busy={busy} handlers={handlers} />
      </Td>
    </tr>
  );
}

/** Lignes d'attente : mêmes colonnes (et mêmes seuils) que le tableau réel, pour ne pas élargir la table */
export function AgencySkeletonRows({ rows = 8 }: { rows?: number }) {
  const bar = (width: string) => (
    <div className="h-4 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" style={{ width }} />
  );
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          <Td>{bar(`${60 + (i % 4) * 10}%`)}</Td>
          <Td>{bar('70%')}</Td>
          <Td className={COLUMN.fleet}>{bar('50%')}</Td>
          <Td className={COLUMN.plan}>{bar('60%')}</Td>
          <Td className={COLUMN.created}>{bar('60%')}</Td>
          <Td>{bar('60%')}</Td>
          <Td>{bar('80%')}</Td>
        </tr>
      ))}
    </>
  );
}
