'use client';

import { useId } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eyebrowMuted, input } from '@/lib/design/tokens';

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  // Identifiant généré : le libellé (avec espaces et accents) n'est pas un identifiant HTML valide
  const id = useId();
  return (
    <div className="relative w-full md:max-w-sm">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${input} pl-10`}
      />
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap rounded-xl border border-slate-300 bg-white p-0.5"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'min-h-11 rounded-lg px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E63946] sm:min-h-0',
              isActive ? 'bg-[#0B1220] text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {option.label}
            {typeof option.count === 'number' && (
              <span className="ml-1.5 tabular-nums text-slate-400">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SelectField({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${input} md:max-w-48`}
      >
        {children}
      </select>
    </div>
  );
}

export function DateRangeInputs({
  value,
  onChange,
}: {
  value: { from: string; to: string };
  onChange: (value: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="range-from" className="mb-1 block text-xs font-medium text-[#64748B]">
          Du
        </label>
        <input
          id="range-from"
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className={`${input} md:max-w-40`}
        />
      </div>
      <div>
        <label htmlFor="range-to" className="mb-1 block text-xs font-medium text-[#64748B]">
          Au
        </label>
        <input
          id="range-to"
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className={`${input} md:max-w-40`}
        />
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  label,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  label: string;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label={`Pagination ${label}`}
      className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-[#64748B]">
        <span className="tabular-nums font-semibold text-[#0F172A]">{first}</span>
        {' – '}
        <span className="tabular-nums font-semibold text-[#0F172A]">{last}</span>
        {' sur '}
        <span className="tabular-nums font-semibold text-[#0F172A]">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#64748B]">
          Page <span className="tabular-nums">{page}</span> /{' '}
          <span className="tabular-nums">{pageCount}</span>
        </span>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Page suivante"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] disabled:opacity-40"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function Th({
  children,
  align = 'left',
  numeric = false,
  className,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-5 py-3',
        eyebrowMuted,
        align === 'right' && 'text-right',
        numeric && 'tabular-nums',
        className
      )}
    >
      {children}
    </th>
  );
}
