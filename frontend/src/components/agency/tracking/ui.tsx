'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { shell } from '@/lib/design/tokens';

/** Petites briques d'interface partagées par les écrans de suivi GPS (mêmes jetons que le reste de l'espace agence). */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(shell.card, className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-[#0F172A]">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-[#64748B]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'alert' | 'warn';
  icon?: ReactNode;
}) {
  const toneClass = {
    neutral: 'text-[#0B1220]',
    good: 'text-emerald-700',
    alert: 'text-red-700',
    warn: 'text-amber-700',
  }[tone];
  return (
    <div className={cn(shell.card, 'p-4')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span aria-hidden="true" className="text-slate-400">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-extrabold tabular-nums tracking-tight', toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[#0F172A]">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p id={`${htmlFor}-hint`} className="mt-1 text-xs text-[#64748B]">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-[#0F172A]">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-[#64748B]">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-[#0B1220]' : 'bg-slate-300'
        )}
      >
        <span
          aria-hidden="true"
          className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')}
        />
      </button>
    </div>
  );
}

/** Heure courante rafraîchie à intervalle régulier : les « il y a 3 min » se mettent à jour sans recharger les données */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Notification éphémère partagée (annoncée aux lecteurs d'écran par le composant Toast de l'espace agence) */
export function useNotice() {
  const [notice, setNotice] = useState<{ id: number; kind: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  return {
    notice,
    success: (message: string) => setNotice({ id: Date.now(), kind: 'success', message }),
    error: (message: string) => setNotice({ id: Date.now(), kind: 'error', message }),
    dismiss: () => setNotice(null),
  };
}

export const selectClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-colors hover:border-slate-300 focus:border-[#0B1220] focus:ring-4 focus:ring-[#0B1220]/8 disabled:bg-slate-100 disabled:text-slate-500';
