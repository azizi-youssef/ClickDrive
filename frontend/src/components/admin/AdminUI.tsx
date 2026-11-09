import React from 'react';
import Link from 'next/link';
import { bookingStatusLabel, bookingStatusTone } from '@/lib/bookings/status';
import type { BadgeTone } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { formatTrend, trendFigures } from '@/lib/admin/trend';
import { TrendingUp, TrendingDown, Minus, AlertCircle, RotateCcw, ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react';

/* ── KPI Card ──────────────────────────────────────────────────────── */
export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const KPI_TONE: Record<KpiTone, { tile: string; bar: string }> = {
  neutral: { tile: 'bg-[#F5F6F8] text-[#0B1220]', bar: 'bg-[#0B1220]' },
  success: { tile: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  warning: { tile: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
  danger: { tile: 'bg-red-50 text-[#E63946]', bar: 'bg-[#E63946]' },
  info: { tile: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  /** Unité affichée en plus petit après la valeur (« DH », « jours », « % »…) */
  unit?: string;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  /**
   * Évolution entre la période et la précédente (même indicateur que la tuile) : écart absolu, et %
   * seulement si la base compte au moins 10 éléments ; `invert` quand une hausse est une mauvaise nouvelle.
   */
  trend?: { current: number; previous: number; label: string; invert?: boolean } | null;
  /** Jauge 0–100 sous la valeur */
  progress?: number;
  href?: string;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  tone = 'neutral',
  trend,
  progress,
  href,
  loading,
  className,
}: KpiCardProps) {
  const toneStyle = KPI_TONE[tone];
  const base = cn(
    'group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(11,18,32,0.04)]',
    className
  );

  if (loading) {
    return (
      <div className={base} role="status" aria-label={`${label} : chargement`}>
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-3 h-3 w-36 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-[13px] font-semibold leading-snug text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneStyle.tile)}>
            <Icon aria-hidden="true" className="h-4.5 w-4.5" />
          </span>
        )}
      </div>
      <p className="mt-1 flex min-w-0 items-baseline gap-1.5 text-2xl font-extrabold sm:text-[28px] leading-tight tracking-tight tabular-nums text-[#0B1220]">
        <span className="truncate">{value}</span>
        {unit && <span className="text-sm font-bold text-slate-400">{unit}</span>}
      </p>
      {pct !== null && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className={cn('h-full rounded-full transition-[width] duration-500', toneStyle.bar)} style={{ width: `${pct}%` }} />
        </div>
      )}
      {(sub || trend) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5">
          {trend && <TrendBadge {...trend} />}
          {sub && <span className="text-xs text-slate-500">{sub}</span>}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          'outline-none transition-[translate,scale,box-shadow,border-color] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_-18px_rgba(11,18,32,0.35)] focus-visible:ring-2 focus-visible:ring-[#E63946] motion-reduce:transition-none motion-reduce:hover:translate-y-0'
        )}
      >
        {content}
      </Link>
    );
  }
  return <div className={base}>{content}</div>;
}

/* ── Trend badge ───────────────────────────────────────────────────── */
function TrendBadge({ current, previous, label, invert }: { current: number; previous: number; label: string; invert?: boolean }) {
  const figures = trendFigures(current, previous);
  const Icon = figures.direction === 'up' ? TrendingUp : figures.direction === 'down' ? TrendingDown : Minus;
  const good = invert ? figures.direction === 'down' : figures.direction === 'up';
  const bad = invert ? figures.direction === 'up' : figures.direction === 'down';
  return (
    <span
      title={`${current} contre ${previous} ${label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
        good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-[#B4232F]' : 'bg-slate-100 text-slate-500'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatTrend(figures)} {label}
    </span>
  );
}

/* ── Status badge ──────────────────────────────────────────────────── */
type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const STATUS_STYLES: Record<StatusVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  error: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STATUS_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Booking status badge (source unique : lib/bookings/status.ts) ── */
const TONE_TO_VARIANT: Record<BadgeTone, StatusVariant> = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  neutral: 'neutral',
  brand: 'neutral',
};

export function BookingStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge variant={TONE_TO_VARIANT[bookingStatusTone(status)]}>
      {bookingStatusLabel(status, 'fr', 'business')}
    </StatusBadge>
  );
}

/* ── Agency status badge ───────────────────────────────────────────── */
const AGENCY_STATUS_CONFIG: Record<string, { label: string; variant: StatusVariant }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  PENDING: { label: 'En attente', variant: 'warning' },
  SUSPENDED: { label: 'Suspendue', variant: 'error' },
  REJECTED: { label: 'Rejetée', variant: 'error' },
};

export function AgencyStatusBadge({ status }: { status: string }) {
  const cfg = AGENCY_STATUS_CONFIG[status] ?? { label: status, variant: 'neutral' as StatusVariant };
  return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
}

/* ── Section header ────────────────────────────────────────────────── */
export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-[#0B1220]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────── */
export function AdminCard({
  children,
  className,
  noPadding,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(11,18,32,0.04)]',
        !noPadding && 'p-5 sm:p-6',
        className
      )}
    >
      {title && (
        <div className="border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-[15px] font-extrabold text-[#0B1220]">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Table wrapper ─────────────────────────────────────────────────── */
export function TableWrapper({
  children,
  className,
  tableClassName,
}: {
  children: React.ReactNode;
  className?: string;
  tableClassName?: string;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className={cn('min-w-full divide-y divide-slate-100', tableClassName)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'bg-[#F8F9FA] px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-500 first:ps-5 sm:first:ps-6 last:pe-5 sm:last:pe-6',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle text-sm text-slate-700 first:ps-5 sm:first:ps-6 last:pe-5 sm:last:pe-6',
        className
      )}
    >
      {children}
    </td>
  );
}

/* ── Skeleton rows ─────────────────────────────────────────────────── */
export function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5 first:pl-5 sm:first:pl-6">
              <div
                className="h-4 rounded bg-slate-100 animate-pulse"
                style={{ width: `${60 + ((i * cols + j) % 4) * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4 rounded-2xl bg-[#F5F6F8] p-4">
          <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-bold text-[#0B1220]">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Error banner ──────────────────────────────────────────────────── */
export function ErrorBanner({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
      <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#B4232F]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-900">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <RotateCcw className={cn('h-3.5 w-3.5', retrying && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
          {retrying ? 'Chargement…' : 'Réessayer'}
        </button>
      )}
    </div>
  );
}

/* ── Alert ─────────────────────────────────────────────────────────── */
export function Alert({
  variant,
  title,
  children,
  action,
}: {
  variant: 'warning' | 'info' | 'success' | 'error';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const styles = {
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  };
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
        styles[variant]
      )}
    >
      <div>
        {title && <p className="font-semibold text-sm">{title}</p>}
        <p className="text-sm">{children}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Pagination ────────────────────────────────────────────────────── */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500 font-medium">
        {total === 0 ? '0 résultat' : `${from}–${to} sur ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 0}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#F5F6F8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Précédent
        </button>
        <span className="text-xs text-slate-500 tabular-nums">
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount - 1}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#F5F6F8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suivant
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/* ── Btn ───────────────────────────────────────────────────────────── */
export function Btn({
  variant = 'secondary',
  size = 'md',
  children,
  className,
  loading = false,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary:
      'bg-action font-bold text-white shadow-[0_10px_20px_-12px_rgba(230,57,70,0.8)] hover:bg-action-hover focus-visible:ring-[#0B1220]',
    secondary:
      'border border-slate-200 bg-white text-[#0B1220] hover:border-slate-300 hover:bg-[#F8F9FA] focus-visible:ring-[#0B1220]/30',
    outline:
      'bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/50',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/50 shadow-sm',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/50',
  };
  const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
  };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin text-current motion-reduce:animate-none"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

/* ── Search input ──────────────────────────────────────────────────── */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Rechercher…'}
        aria-label={placeholder ?? 'Rechercher'}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-4 text-sm text-[#0B1220] outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0B1220] focus:ring-4 focus:ring-[#0B1220]/8"
      />
    </div>
  );
}

/* ── Select filter ─────────────────────────────────────────────────── */
export function SelectFilter({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={options[0]?.label}
      className={cn(
        'h-10 cursor-pointer rounded-xl border border-slate-200 bg-white ps-3 pe-8 text-sm font-medium text-[#0B1220] outline-none transition-colors hover:border-slate-300 focus:border-[#0B1220] focus:ring-4 focus:ring-[#0B1220]/8',
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ── Price display ─────────────────────────────────────────────────── */
export function Price({
  value,
  size = 'md',
  muted,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}) {
  const formatted = new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  const sizes = { sm: 'text-xs', md: 'text-sm font-semibold', lg: 'text-2xl font-bold' };
  return (
    <span className={cn(sizes[size], muted ? 'text-slate-500' : 'text-slate-900 tabular-nums')}>
      {formatted} <span className="text-slate-400 font-normal">DH</span>
    </span>
  );
}
