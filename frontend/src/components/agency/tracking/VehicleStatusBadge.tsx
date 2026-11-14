import { CircleSlash, Clock, Navigation, PauseCircle, ParkingCircle, Wifi, WifiOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATE_LABELS, type TrackingState } from '@/lib/tracking/types';

/**
 * Pastille d'état d'un véhicule suivi. La couleur n'est jamais le seul signal : icône + libellé texte.
 */
export const STATE_STYLES: Record<TrackingState, { icon: LucideIcon; badge: string; dot: string; map: string }> = {
  MOVING: { icon: Navigation, badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', map: '#059669' },
  STATIONARY: { icon: ParkingCircle, badge: 'bg-sky-50 text-sky-800 border-sky-200', dot: 'bg-sky-500', map: '#0284C7' },
  OFFLINE: { icon: WifiOff, badge: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500', map: '#DC2626' },
  AWAITING: { icon: Clock, badge: 'bg-amber-50 text-amber-900 border-amber-200', dot: 'bg-amber-500', map: '#D97706' },
  DISABLED: { icon: PauseCircle, badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', map: '#64748B' },
  UNTRACKED: { icon: CircleSlash, badge: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-300', map: '#94A3B8' },
};

export function VehicleStatusBadge({ state, className, compact = false }: { state: TrackingState; className?: string; compact?: boolean }) {
  const style = STATE_STYLES[state];
  const Icon = style.icon;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.badge, className)}
      data-state={state}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span className={cn(compact && 'sr-only')}>{STATE_LABELS[state]}</span>
    </span>
  );
}

const TRACKER_LABELS: Partial<Record<TrackingState, string>> = {
  OFFLINE: 'Hors ligne',
  AWAITING: 'En attente',
  DISABLED: 'En pause',
  UNTRACKED: 'Non affecté',
};

/** État de communication d'un boîtier (indépendant du mouvement du véhicule) */
export function TrackerStatusBadge({ state, className }: { state: TrackingState; className?: string }) {
  const online = state === 'MOVING' || state === 'STATIONARY';
  const style = online
    ? { icon: Wifi, badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    : STATE_STYLES[state];
  const Icon = style.icon;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.badge, className)} data-state={online ? 'ONLINE' : state}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {online ? 'En ligne' : (TRACKER_LABELS[state] ?? STATE_LABELS[state])}
    </span>
  );
}
