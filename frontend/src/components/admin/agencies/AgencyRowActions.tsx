'use client';

import { CheckCircle, Edit2, KeyRound, RefreshCw, Trash2, XCircle } from 'lucide-react';
import type { AdminAgency } from '@/lib/api/admin-dashboard.api';
import { cn } from '@/lib/utils';

export interface AgencyActionHandlers {
  onToggleStatus: (agency: AdminAgency) => void;
  onEdit: (agency: AdminAgency) => void;
  onResetPassword: (agency: AdminAgency) => void;
  onDelete: (agency: AdminAgency) => void;
}

export function agencyInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] focus-visible:ring-offset-1';

/**
 * Actions d'une agence, en deux présentations d'un même ensemble de gestes :
 *  - `table` : compacte (Modifier + trois icônes), pour que le tableau tienne dans la largeur disponible ;
 *  - `card`  : boutons libellés, pour mobile et tablette (cibles tactiles ≥ 40 px).
 * Chaque bouton a un nom accessible qui contient le nom de l'agence (un lecteur d'écran ne rencontre pas
 * « Modifier » vingt fois sans savoir quelle ligne). Aucune action n'est exécutée ici : les gestes passent
 * par les mêmes gestionnaires (suspension et suppression restent confirmées par le parent).
 */
export function AgencyActions({
  agency,
  variant,
  busy,
  handlers,
}: {
  agency: AdminAgency;
  variant: 'table' | 'card';
  busy: boolean;
  handlers: AgencyActionHandlers;
}) {
  const isSuspended = agency.status === 'SUSPENDED';
  const isArchived = Boolean(agency.archived_at);
  const compact = variant === 'table';

  const base = compact
    ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50'
    : 'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50';
  const neutral = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100';

  const toggleLabel = `${isSuspended ? 'Activer' : 'Suspendre'} ${agency.name}`;

  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'flex-nowrap justify-end' : 'flex-wrap')}>
      <button
        type="button"
        onClick={() => handlers.onEdit(agency)}
        aria-label={`Modifier ${agency.name}`}
        className={cn(
          compact ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold' : base,
          neutral,
          focusRing
        )}
      >
        <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span aria-hidden="true">Modifier</span>
      </button>

      {!isArchived && (
        <button
          type="button"
          disabled={busy}
          onClick={() => handlers.onToggleStatus(agency)}
          aria-label={toggleLabel}
          title={compact ? (isSuspended ? 'Réactiver l’agence' : 'Suspendre l’agence') : undefined}
          className={cn(
            base,
            isSuspended ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : neutral,
            focusRing
          )}
        >
          {busy ? (
            <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : isSuspended ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
          )}
          {!compact && <span aria-hidden="true">{isSuspended ? 'Activer' : 'Suspendre'}</span>}
        </button>
      )}

      <button
        type="button"
        onClick={() => handlers.onResetPassword(agency)}
        aria-label={`Réinitialiser le mot de passe de ${agency.name}`}
        title={compact ? 'Réinitialiser le mot de passe' : undefined}
        className={cn(base, neutral, focusRing)}
      >
        <KeyRound className="h-4 w-4 text-amber-600" aria-hidden="true" />
        {!compact && <span aria-hidden="true">Mot de passe</span>}
      </button>

      {!isArchived && (
        <button
          type="button"
          disabled={busy}
          onClick={() => handlers.onDelete(agency)}
          aria-label={`Supprimer ou archiver ${agency.name}`}
          title={compact ? 'Supprimer ou archiver' : undefined}
          className={cn(base, 'border-red-200 bg-white text-red-700 hover:bg-red-50', focusRing)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {!compact && <span aria-hidden="true">Supprimer / archiver</span>}
        </button>
      )}
    </div>
  );
}
