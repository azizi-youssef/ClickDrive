'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/catalog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatNumber } from '@/lib/i18n/format';
import { categoryLabel, fuelLabel, transmissionLabel } from '@/lib/i18n/labels';
import type { Agency } from '@/types';
import type { Facet } from '@/lib/catalog/discovery';

export const ALL_CATEGORIES = 'Tous les types';
export const PRICE_CEILING = 5000;
const PRICE_FLOOR = 200;

export type CatalogFilterState = {
  category: string;
  transmission: 'ALL' | 'AUTOMATIC' | 'MANUAL';
  fuel: 'ALL' | 'DIESEL' | 'GASOLINE' | 'HYBRID' | 'ELECTRIC';
  brand: string;
  brandQuery: string;
  agency: string;
  maxPrice: number;
};

export const DEFAULT_FILTERS: CatalogFilterState = {
  category: ALL_CATEGORIES,
  transmission: 'ALL',
  fuel: 'ALL',
  brand: 'ALL',
  brandQuery: '',
  agency: 'ALL',
  maxPrice: PRICE_CEILING,
};

export const TRANSMISSION_LABELS: Record<Exclude<CatalogFilterState['transmission'], 'ALL'>, string> = {
  AUTOMATIC: 'Automatique',
  MANUAL: 'Manuelle',
};

export const FUEL_LABELS: Record<Exclude<CatalogFilterState['fuel'], 'ALL'>, string> = {
  DIESEL: 'Diesel',
  GASOLINE: 'Essence',
  HYBRID: 'Hybride',
  ELECTRIC: 'Électrique',
};

function sameText(a: string, b: string): boolean {
  return a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
    b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Nombre de critères actifs (le tri n'est pas un filtre). */
export function countActiveFilters(filters: CatalogFilterState): number {
  return [
    filters.category !== ALL_CATEGORIES,
    filters.transmission !== 'ALL',
    filters.fuel !== 'ALL',
    filters.brand !== 'ALL',
    filters.brandQuery.trim() !== '',
    filters.agency !== 'ALL',
    filters.maxPrice < PRICE_CEILING,
  ].filter(Boolean).length;
}

function FilterSection({
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="border-b border-slate-200/80 py-4 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-8 w-full items-center justify-between gap-3 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E63946]"
        >
          <span className="text-[13px] font-bold text-[#0B1220]">{title}</span>
          <span className="flex min-w-0 items-center gap-2">
            {summary && (
              <span className="truncate text-xs font-semibold text-accent-text">{summary}</span>
            )}
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
              aria-hidden="true"
            />
          </span>
        </button>
      </h3>
      <div id={contentId} hidden={!open} className="pt-3">
        {children}
      </div>
    </section>
  );
}

function OptionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-10 rounded-xl border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]',
        active
          ? 'border-[#0B1220] bg-[#0B1220] text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  );
}

const selectClass =
  'h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 transition focus:border-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#0B1220]/10';

interface CatalogFiltersProps {
  filters: CatalogFilterState;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
  brands: string[];
  agencies: Agency[];
  /** Masque l'en-tête (le tiroir mobile a le sien). */
  hideHeader?: boolean;
  /** Options réellement présentes dans le catalogue (sinon : listes par défaut) */
  facets?: { categories: Facet[]; transmissions: Facet[]; fuels: Facet[] };
}

export function CatalogFilters({
  filters,
  onChange,
  onReset,
  brands,
  agencies,
  hideHeader = false,
  facets,
}: CatalogFiltersProps) {
  const uid = useId();
  const { t, locale, fmt } = useTranslation();
  const copy = t.catalog;
  const f = copy.filter;
  const activeCount = countActiveFilters(filters);
  const selectedAgencyName = agencies.find((agency) => agency.id === filters.agency)?.name;

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 pb-1">
          <h2 className="text-base font-extrabold text-[#0B1220]">
            {copy.filters}
            {activeCount > 0 && (
              <span className="ms-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            className="inline-flex items-center gap-1.5 min-h-8 rounded-lg px-2 py-1 text-xs font-semibold text-ink-tertiary transition-colors hover:text-accent-text disabled:cursor-default disabled:opacity-40 disabled:hover:text-slate-500"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.reset}
          </button>
        </div>
      )}

      <FilterSection
        title={f.budgetTitle}
        summary={filters.maxPrice < PRICE_CEILING ? `≤ ${formatNumber(filters.maxPrice, locale)} MAD` : undefined}
      >
        <label htmlFor={`${uid}-price`} className="sr-only">
          {f.budgetLabel}
        </label>
        <input
          id={`${uid}-price`}
          type="range"
          min={PRICE_FLOOR}
          max={PRICE_CEILING}
          step={50}
          value={filters.maxPrice}
          onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
          aria-valuetext={
            filters.maxPrice >= PRICE_CEILING ? f.allPrices : fmt(f.maxValue, { amount: formatNumber(filters.maxPrice, locale) })
          }
          className="w-full cursor-pointer accent-[#E63946]"
        />
        <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>{formatNumber(PRICE_FLOOR, locale)} MAD</span>
          <span className="font-bold text-[#0B1220]">
            {filters.maxPrice >= PRICE_CEILING ? f.allPrices : `${formatNumber(filters.maxPrice, locale)} MAD`}
          </span>
        </div>
      </FilterSection>

      <FilterSection
        title={f.categoryTitle}
        summary={filters.category !== ALL_CATEGORIES ? categoryLabel(t, filters.category) : undefined}
      >
        <div className="flex flex-wrap gap-2">
          {/* Catégories réellement présentes, avec leur nombre ; la catégorie active reste proposée pour pouvoir la retirer */}
          {(facets
            ? [
                { value: ALL_CATEGORIES, count: facets.categories.reduce((sum, facet) => sum + facet.count, 0) },
                ...facets.categories,
                ...(filters.category !== ALL_CATEGORIES &&
                !facets.categories.some((facet) => sameText(facet.value, filters.category))
                  ? [{ value: filters.category, count: 0 }]
                  : []),
              ]
            : CATEGORIES.map((value) => ({ value, count: undefined as number | undefined }))
          ).map(({ value, count }) => (
            <OptionChip
              key={value}
              active={sameText(filters.category, value)}
              onClick={() => onChange({ category: value })}
            >
              {value === ALL_CATEGORIES ? f.allCategories : categoryLabel(t, value)}
              {count !== undefined && <span className="ms-1 font-medium opacity-70">({count})</span>}
            </OptionChip>
          ))}
        </div>
      </FilterSection>

      <FilterSection
        title={f.transmissionTitle}
        summary={filters.transmission !== 'ALL' ? transmissionLabel(t, filters.transmission) : undefined}
      >
        <div className="grid grid-cols-3 gap-2">
          <OptionChip active={filters.transmission === 'ALL'} onClick={() => onChange({ transmission: 'ALL' })}>
            {f.allTransmissions}
          </OptionChip>
          {(['AUTOMATIC', 'MANUAL'] as const)
            .filter((value) => !facets || facets.transmissions.some((facet) => facet.value === value) || filters.transmission === value)
            .map((value) => (
              <OptionChip key={value} active={filters.transmission === value} onClick={() => onChange({ transmission: value })}>
                {value === 'AUTOMATIC' ? f.autoShort : transmissionLabel(t, value)}
              </OptionChip>
            ))}
        </div>
      </FilterSection>

      <FilterSection
        title={f.fuelTitle}
        summary={filters.fuel !== 'ALL' ? fuelLabel(t, filters.fuel) : undefined}
      >
        <div className="grid grid-cols-2 gap-2">
          <OptionChip active={filters.fuel === 'ALL'} onClick={() => onChange({ fuel: 'ALL' })}>
            {f.allFuels}
          </OptionChip>
          {(Object.keys(FUEL_LABELS) as (keyof typeof FUEL_LABELS)[])
            .filter((fuel) => !facets || facets.fuels.some((facet) => facet.value === fuel) || filters.fuel === fuel)
            .map((fuel) => (
            <OptionChip key={fuel} active={filters.fuel === fuel} onClick={() => onChange({ fuel })}>
              {fuelLabel(t, fuel)}
            </OptionChip>
          ))}
        </div>
      </FilterSection>

      <FilterSection
        title={f.brandTitle}
        summary={filters.brand !== 'ALL' ? filters.brand : filters.brandQuery.trim() || undefined}
      >
        <div className="relative mb-2.5">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor={`${uid}-brand-query`} className="sr-only">
            {f.brandSearchLabel}
          </label>
          <input
            id={`${uid}-brand-query`}
            type="search"
            value={filters.brandQuery}
            onChange={(e) => onChange({ brandQuery: e.target.value })}
            placeholder={f.brandPlaceholder}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pe-9 ps-9 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#0B1220]/10"
          />
          {filters.brandQuery && (
            <button
              type="button"
              onClick={() => onChange({ brandQuery: '' })}
              className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={f.clearBrandSearch}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <label htmlFor={`${uid}-brand`} className="sr-only">
          {f.brandTitle}
        </label>
        <select
          id={`${uid}-brand`}
          value={filters.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">{f.allBrands}</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection title={f.agencyTitle} summary={selectedAgencyName}>
        <label htmlFor={`${uid}-agency`} className="sr-only">
          {f.agencyTitle}
        </label>
        <select
          id={`${uid}-agency`}
          value={filters.agency}
          onChange={(e) => onChange({ agency: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">{f.allAgencies}</option>
          {agencies.map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.name}
            </option>
          ))}
        </select>
      </FilterSection>
    </div>
  );
}
