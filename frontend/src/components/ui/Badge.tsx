import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react';

/**
 * Badge du design system.
 * Tons sémantiques : success, warning, danger, info, neutral, brand.
 * Variantes historiques conservées (verified, available, rented, pending, outline, accent).
 */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
type LegacyVariant = 'verified' | 'available' | 'rented' | 'pending' | 'outline' | 'accent';

export const BADGE_TONES: Record<BadgeTone, string> = {
  success: 'border-success-line bg-success-soft text-success',
  warning: 'border-warning-line bg-warning-soft text-warning',
  danger: 'border-danger-line bg-danger-soft text-danger',
  info: 'border-info-line bg-info-soft text-info',
  neutral: 'border-line bg-neutral-soft text-slate-700',
  brand: 'border-brand-line bg-brand-soft text-accent-text',
};

const LEGACY: Record<LegacyVariant, BadgeTone> = {
  verified: 'neutral',
  available: 'success',
  rented: 'danger',
  pending: 'warning',
  outline: 'neutral',
  accent: 'brand',
};

interface BadgeProps {
  variant?: LegacyVariant;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  /** Point coloré avant le libellé */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}

export function Badge({ variant = 'outline', tone, size = 'md', dot = false, children, className, icon = false }: BadgeProps) {
  const resolvedTone = tone ?? LEGACY[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        BADGE_TONES[resolvedTone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {icon && variant === 'verified' && <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
      {icon && variant === 'available' && <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />}
      {icon && variant === 'pending' && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
      {icon && variant === 'rented' && <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
