'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import motoHeroImage from '../../../public/moto.jpg';
import carHeroImage from '../../../public/voiture.jpg';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/lib/hooks/usePagination';

/** Photo d'en-tête et cadrage (les véhicules sont sur la droite des deux photos) */
const HERO_IMAGES = {
  CAR: { src: carHeroImage, position: 'object-[70%_45%]' },
  MOTORCYCLE: { src: motoHeroImage, position: 'object-[65%_60%]' },
} as const;
import { useSearchParams } from 'next/navigation';
import { VehicleCard, VehicleCardSkeleton } from '@/components/cars/VehicleCard';
import { SearchBar } from '@/components/search/SearchBar';
import {
  ALL_CATEGORIES,
  CatalogFilters,
  DEFAULT_FILTERS,
  PRICE_CEILING,
  countActiveFilters,
  type CatalogFilterState,
} from '@/components/search/CatalogFilters';
import { apiFetch } from '@/lib/api/client';
import { formatLocalDate, getEffectiveRentalDates } from '@/lib/utils/date-only';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatNumber } from '@/lib/i18n/format';
import { categoryLabel, fuelLabel, locationLabel, transmissionLabel } from '@/lib/i18n/labels';
import type { Vehicle, Agency } from '@/types';
import { catalogFacets, sortByRelevance } from '@/lib/catalog/discovery';
import { CATALOG_PATHS, vehicleTypeOf, type VehicleType } from '@/lib/vehicles/kind';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import { BrandMarquee, normalizeBrandKey } from '@/components/shared/BrandMarquee';
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  MapPin,
  Motorbike,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

// « Meilleures agences » retiré : il triait sur une note par défaut, sans avis réels
type SortOption = 'price_asc' | 'price_desc' | 'featured';

const SORT_OPTIONS: SortOption[] = ['featured', 'price_asc', 'price_desc'];

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface SearchPreload {
  vehicles: Vehicle[];
  agencies: Agency[];
  period: { startDate: string; endDate: string };
}

function SearchPageContent({ preload, vehicleType }: { preload: SearchPreload | null; vehicleType: VehicleType }) {
  const searchParams = useSearchParams();
  const { t, locale, fmt, plural, date } = useTranslation();
  const catalog = t.catalog;
  // « 2026-11-08 » → « 8 nov. » dans la langue de la page (date sans heure : même jour partout)
  const shortDate = (value: string) => date(value, 'dayMonth');

  const initialCategory = searchParams.get('category') || ALL_CATEGORIES;
  const initialBrand = searchParams.get('brand') || 'ALL';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  const initialLocation = searchParams.get('location') || '';
  // Recherche libre par marque ou modèle (?q=…), par exemple depuis la page 404
  const initialQuery = (searchParams.get('q') || '').trim().slice(0, 60);

  const [filters, setFilters] = useState<CatalogFilterState>({
    ...DEFAULT_FILTERS,
    category: initialCategory,
    brand: initialBrand,
    brandQuery: initialQuery,
  });
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  // Mobile : formulaire de recherche replié en un résumé, pour afficher les véhicules dès le premier écran
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Préchargés côté serveur quand c'est possible (résultats présents dès le HTML)
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>(preload?.vehicles ?? []);
  const [searchPeriod, setSearchPeriod] = useState(
    preload?.period ?? { startDate: initialStartDate, endDate: initialEndDate }
  );
  const [agencies, setAgencies] = useState<Agency[]>(preload?.agencies ?? []);
  const [vehiclesLoading, setVehiclesLoading] = useState(!preload);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  const updateFilters = useCallback((patch: Partial<CatalogFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const loadData = useCallback(async (isInitial = false) => {
    // Le chargement initial doit toujours aboutir, même dans un onglet ouvert en arrière-plan.
    if (!isInitial && document.visibilityState !== 'visible') return;
    if (isInitial) setVehiclesLoading(true);
    try {
      const params = new URLSearchParams();
      const period =
        initialStartDate && initialEndDate
          ? getEffectiveRentalDates(
            initialStartDate,
            initialEndDate,
            formatLocalDate(new Date())
          )
          : { startDate: '', endDate: '' };
      if (period.startDate && period.endDate) {
        params.set('startDate', period.startDate);
        params.set('endDate', period.endDate);
      }
      const query = params.size ? `?${params.toString()}` : '';
      const vehiclesRes = await apiFetch<Vehicle[]>(`/api/vehicles${query}`, {
        cache: 'no-store',
      });
      if (!vehiclesRes.success || !vehiclesRes.data) {
        throw new Error(vehiclesRes.error || 'Impossible de vérifier les disponibilités.');
      }
      setAllVehicles(vehiclesRes.data);
      setSearchPeriod(period);
      setVehiclesError(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Impossible de vérifier les disponibilités.';
      console.error('[SearchPage] Vehicle availability lookup failed:', message);
      setVehiclesError(message);
    } finally {
      if (isInitial) setVehiclesLoading(false);
    }
  }, [initialStartDate, initialEndDate]);

  useEffect(() => {
    if (!preload) void loadData(true);
  }, [loadData, preload]);

  // Rafraîchissement automatique en direct (Supabase Realtime + Multi-onglets + Focus)
  useRealtimeRefresh({
    tables: ['vehicles', 'bookings', 'vehicle_unavailability'],
    onRefresh: () => loadData(false),
    pollingIntervalMs: 20_000,
  });

  useEffect(() => {
    if (preload) return;
    let isMounted = true;
    apiFetch<Agency[]>('/api/agencies')
      .then((response) => {
        if (isMounted && response.success && response.data) setAgencies(response.data);
      })
      .catch((error: unknown) => {
        console.error('[SearchPage] Agency lookup failed:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [preload]);

  // Catalogue séparé : seuls les véhicules du type de la page (voitures sur /search, motos sur /motos)
  const typeScopedVehicles = useMemo(
    () => allVehicles.filter((v) => vehicleTypeOf(v) === vehicleType),
    [allVehicles, vehicleType]
  );
  const typeCounts = useMemo(() => {
    const counts: Record<VehicleType, number> = { CAR: 0, MOTORCYCLE: 0 };
    for (const v of allVehicles) counts[vehicleTypeOf(v)] += 1;
    return counts;
  }, [allVehicles]);

  // Marques réellement présentes dans le catalogue
  const brands = useMemo(
    () => Array.from(new Set(typeScopedVehicles.map((v) => v.brand))).sort((a, b) => a.localeCompare(b, 'fr')),
    [typeScopedVehicles]
  );

  const filteredVehicles = useMemo(() => {
    let result = [...typeScopedVehicles];

    if (filters.category && filters.category !== ALL_CATEGORIES) {
      const normSelected = normalize(filters.category);
      result = result.filter((v) => normalize(v.category || '') === normSelected);
    }
    if (filters.transmission !== 'ALL') {
      result = result.filter((v) => v.transmission === filters.transmission);
    }
    if (filters.fuel !== 'ALL') {
      result = result.filter((v) => v.fuel === filters.fuel);
    }
    if (filters.brand !== 'ALL') {
      result = result.filter((v) => v.brand.toLowerCase() === filters.brand.toLowerCase());
    }
    if (filters.brandQuery.trim()) {
      const q = filters.brandQuery.trim().toLowerCase();
      result = result.filter(
        (v) => v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q)
      );
    }
    if (filters.agency !== 'ALL') {
      result = result.filter((v) => v.agency_id === filters.agency);
    }
    result = result.filter((v) => filters.maxPrice >= PRICE_CEILING || v.daily_price <= filters.maxPrice);

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.daily_price - b.daily_price);
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.daily_price - a.daily_price);
    } else {
      // Recommandés : score déterministe et explicable (lib/catalog/discovery.ts)
      result = sortByRelevance(result, {
        periodChecked: Boolean(searchPeriod.startDate && searchPeriod.endDate),
        maxPrice: filters.maxPrice < PRICE_CEILING ? filters.maxPrice : undefined,
      });
    }

    return result;
  }, [typeScopedVehicles, filters, sortBy, searchPeriod]);

  // ── Pagination ───────────────────────────────────────────────────────────
  const PAGE_SIZE = 12; // 3 columns × 4 rows

  const { currentPage, totalPages, startIndex, endIndex, setPage, resetPage } = usePagination({
    pageSize: PAGE_SIZE,
    totalItems: filteredVehicles.length,
    paramName: 'page',
  });

  // Reset to page 1 whenever filters or sort change
  const prevFiltersRef = React.useRef(filters);
  const prevSortRef = React.useRef(sortBy);
  useEffect(() => {
    if (prevFiltersRef.current !== filters || prevSortRef.current !== sortBy) {
      prevFiltersRef.current = filters;
      prevSortRef.current = sortBy;
      resetPage();
    }
  }, [filters, sortBy, resetPage]);

  const pagedVehicles = filteredVehicles.slice(startIndex, endIndex);

  // Options de filtres issues des véhicules réellement présents (catégories du type choisi)
  const facets = useMemo(() => catalogFacets(typeScopedVehicles), [typeScopedVehicles]);
  const categoryOptions = useMemo(() => facets.categories.map((facet) => facet.value), [facets]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSortBy('featured');
  }, []);

  // Carrousel des marques : nombre réel de véhicules du catalogue affiché par marque, sur la période recherchée
  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const vehicle of typeScopedVehicles) {
      if (!vehicle.brand) continue;
      const key = normalizeBrandKey(vehicle.brand);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [typeScopedVehicles]);

  /**
   * Clic sur une marque du carrousel, sur la page même : filtre appliqué sans rechargement,
   * URL mise à jour (lien partageable), retour aux résultats avec le focus sur leur titre.
   */
  const selectBrandFromMarquee = useCallback(
    (brand: string) => {
      // Orthographe du catalogue si la marque y figure (« SUZUKI » pour « Suzuki »)
      const catalogBrand = brands.find((value) => normalizeBrandKey(value) === normalizeBrandKey(brand)) ?? brand;
      updateFilters({ brand: catalogBrand });
      const query = new URLSearchParams(window.location.search);
      query.set('brand', catalogBrand);
      window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
      const heading = document.getElementById('results-heading');
      if (heading) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        heading.focus({ preventScroll: true });
      }
    },
    [brands, updateFilters]
  );

  const activeFilterCount = countActiveFilters(filters);
  const agencyName = agencies.find((agency) => agency.id === filters.agency)?.name;

  // Puces des filtres actifs, chacune retirable individuellement
  const activeChips: { key: string; label: string; clear: Partial<CatalogFilterState> }[] = [];
  if (filters.category !== ALL_CATEGORIES) {
    activeChips.push({ key: 'category', label: categoryLabel(t, filters.category), clear: { category: ALL_CATEGORIES } });
  }
  if (filters.transmission !== 'ALL') {
    activeChips.push({ key: 'transmission', label: transmissionLabel(t, filters.transmission), clear: { transmission: 'ALL' } });
  }
  if (filters.fuel !== 'ALL') {
    activeChips.push({ key: 'fuel', label: fuelLabel(t, filters.fuel), clear: { fuel: 'ALL' } });
  }
  if (filters.brand !== 'ALL') {
    activeChips.push({ key: 'brand', label: filters.brand, clear: { brand: 'ALL' } });
  }
  if (filters.brandQuery.trim()) {
    activeChips.push({ key: 'brandQuery', label: `« ${filters.brandQuery.trim()} »`, clear: { brandQuery: '' } });
  }
  if (filters.agency !== 'ALL') {
    activeChips.push({ key: 'agency', label: agencyName ?? catalog.agencyFallback, clear: { agency: 'ALL' } });
  }
  if (filters.maxPrice < PRICE_CEILING) {
    activeChips.push({ key: 'price', label: fmt(catalog.priceChip, { amount: formatNumber(filters.maxPrice, locale) }), clear: { maxPrice: PRICE_CEILING } });
  }

  const hasPeriod = Boolean(searchPeriod.startDate && searchPeriod.endDate);
  const placeLabel = initialLocation ? locationLabel(t, initialLocation) : catalog.regionDefault;
  const isMotoView = vehicleType === 'MOTORCYCLE';
  // Bascule voitures / motos en conservant le lieu et les dates de la recherche
  const switchQuery = (() => {
    const query = new URLSearchParams();
    for (const key of ['location', 'startDate', 'endDate']) {
      const value = searchParams.get(key);
      if (value) query.set(key, value);
    }
    const text = query.toString();
    return text ? `?${text}` : '';
  })();

  return (
    <>
      <div className="min-h-screen bg-[#F5F6F8] pb-20">
        {/* ── En-tête graphite + recherche ─────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#0B1220] text-white">
          {/* Photo en fond (voitures ou motos), voile marine pour garder le texte blanc lisible (contraste AA) */}
          <Image
            key={vehicleType}
            src={HERO_IMAGES[vehicleType].src}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            quality={70}
            className={cn('object-cover', HERO_IMAGES[vehicleType].position)}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-r from-[#0B1220]/95 via-[#0B1220]/80 to-[#0B1220]/45 rtl:bg-linear-to-l"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#0B1220]/80 via-transparent to-[#0B1220]/40"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-[#E63946]/20 blur-3xl"
          />
          <div className="relative mx-auto max-w-[1360px] px-4 pb-20 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-24">
            <nav aria-label={catalog.breadcrumbAria} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Link href="/" className="transition-colors hover:text-white">{catalog.home}</Link>
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              <span aria-current="page" className="text-slate-200">{isMotoView ? catalog.motosCrumb : catalog.carsCrumb}</span>
            </nav>

            <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-on-dark">
              <span className="h-px w-6 bg-[#E63946]" aria-hidden="true" />
              {catalog.eyebrow}
            </p>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
              {isMotoView ? catalog.titleMoto : catalog.titleCar}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                <span className="truncate">{placeLabel}</span>
              </span>
              {hasPeriod && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                  {fmt(catalog.period, { start: shortDate(searchPeriod.startDate), end: shortDate(searchPeriod.endDate) })}
                </span>
              )}
            </div>

            {/* Catalogues séparés : voitures / motos */}
            <nav aria-label={catalog.typeNavAria} className="mt-5 inline-flex rounded-2xl bg-white/8 p-1 ring-1 ring-white/10">
              {(['CAR', 'MOTORCYCLE'] as const).map((type) => {
                const active = type === vehicleType;
                const Icon = type === 'MOTORCYCLE' ? Motorbike : Car;
                return (
                  <Link
                    key={type}
                    href={`${CATALOG_PATHS[type]}${switchQuery}`}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-extrabold text-[#0B1220] shadow-sm'
                        : 'inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-slate-200 transition-colors hover:bg-white/10 hover:text-white'
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t.vehicle.type[type].plural}
                    {!vehiclesLoading && (
                      <span className={active ? 'font-semibold text-slate-500' : 'font-medium text-slate-400'}>
                        {typeCounts[type]}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-14 max-w-[1360px] px-4 sm:px-6 lg:-mt-16 lg:px-8">
          <div className="rounded-2xl bg-white p-2 shadow-[0_18px_50px_-20px_rgba(11,18,32,0.35)] ring-1 ring-slate-200/70 sm:p-2.5">
            {/* Mobile : résumé de la recherche (lieu, dates) ; le formulaire complet s'ouvre à la demande */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-expanded={mobileSearchOpen}
              aria-controls="catalog-search-form"
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] sm:hidden"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E63946]/10 text-accent-text" aria-hidden="true">
                <Search className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-[#0B1220]">{placeLabel}</span>
                <span className="block truncate text-[13px] text-slate-600">
                  {hasPeriod ? `${shortDate(searchPeriod.startDate)} → ${shortDate(searchPeriod.endDate)}` : catalog.flexibleDates}
                  {filters.category && filters.category !== ALL_CATEGORIES ? ` · ${categoryLabel(t, filters.category)}` : ''}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-[#0B1220]">
                {mobileSearchOpen ? catalog.close : catalog.edit}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', mobileSearchOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </span>
            </button>
            <div id="catalog-search-form" className={cn(mobileSearchOpen ? 'mt-2 block' : 'hidden', 'sm:mt-0 sm:block')}>
              <SearchBar
                initialLocation={initialLocation || undefined}
                initialStartDate={initialStartDate}
                initialEndDate={initialEndDate}
                initialCategory={filters.category}
                initialBrand={filters.brand !== 'ALL' ? filters.brand : undefined}
                isCompact
                categories={categoryOptions}
                basePath={CATALOG_PATHS[vehicleType]}
              />
            </div>
          </div>
        </div>

        {/* ── Barre de résultats ───────────────────────────────────────── */}
        <div className="mx-auto max-w-[1360px] px-4 pt-8 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-8">
            {/* Sidebar filtres (desktop) */}
            <aside className="hidden lg:block" aria-label={catalog.filtersAria}>
              <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(11,18,32,0.04)]">
                <CatalogFilters
                  filters={filters}
                  onChange={updateFilters}
                  onReset={resetFilters}
                  brands={brands}
                  agencies={agencies}
                  facets={facets}
                />
              </div>
            </aside>

            <section aria-labelledby="results-heading" className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="results-heading"
                    tabIndex={-1}
                    className="scroll-mt-32 text-lg font-extrabold text-[#0B1220] outline-none sm:text-xl"
                  >
                    {vehiclesLoading
                      ? isMotoView
                        ? catalog.searchingMoto
                        : catalog.searchingCar
                      : vehiclesError
                        ? catalog.notVerified
                        : plural(
                            filteredVehicles.length,
                            isMotoView
                              ? hasPeriod
                                ? catalog.resultsMotoAvailable
                                : catalog.resultsMoto
                              : hasPeriod
                                ? catalog.resultsCarAvailable
                                : catalog.resultsCar
                          )}
                  </h2>
                  {!vehiclesLoading && !vehiclesError && (
                    <p className="mt-0.5 text-[13px] text-ink-tertiary" aria-live="polite">
                      {hasPeriod ? catalog.periodNote : catalog.todayNote}
                      {/* Explication du classement : visible sur tablette et ordinateur ; sur mobile, elle est
                        lue par les lecteurs d'écran mais ne repousse pas les résultats sous le premier écran */}
                      {sortBy === 'featured' && (
                        <span className="sr-only sm:not-sr-only sm:block sm:text-xs sm:text-ink-secondary">
                          {fmt(catalog.ranking, { explanation: catalog.relevance })}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(true)}
                    className="inline-flex h-11 flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-[#0B1220] shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-colors hover:border-slate-300 sm:flex-none lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    {catalog.filters}
                    {activeFilterCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[11px] text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <div className="relative flex-1 sm:flex-none">
                    <ArrowUpDown
                      className="pointer-events-none absolute start-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-400 sm:block"
                      aria-hidden="true"
                    />
                    <label htmlFor="sort-select" className="sr-only">{catalog.sortBy}</label>
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pe-9 ps-3.5 text-[13px] font-bold text-[#0B1220] shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-colors hover:border-slate-300 focus:border-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#0B1220]/10 sm:w-56 sm:ps-9"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {catalog.sort[option]}
                        </option>
                      ))}
                    </select>
                    <ChevronRight
                      className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              {activeChips.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={catalog.activeFiltersAria}>
                  {activeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => updateFilters(chip.clear)}
                      className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white pe-2 ps-3 text-xs font-semibold text-slate-700 transition-colors hover:border-[#E63946]/40 hover:text-accent-text"
                      aria-label={fmt(catalog.removeFilter, { label: chip.label })}
                    >
                      <span className="truncate">{chip.label}</span>
                      <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-8 px-2 text-xs font-bold text-accent-text hover:underline"
                  >
                    {catalog.clearAll}
                  </button>
                </div>
              )}

              {/* ── Résultats ─────────────────────────────────────────── */}
              <div className="mt-5">
                {vehiclesError ? (
                  <div
                    role="alert"
                    className="flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-white p-6 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-accent-text">
                      <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0B1220]">{catalog.loadErrorTitle}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{catalog.loadError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadData(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1220] px-4 text-[13px] font-bold text-white transition-colors hover:bg-slate-800"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      {catalog.retry}
                    </button>
                  </div>
                ) : vehiclesLoading ? (
                  <div role="status" aria-label={isMotoView ? catalog.loadingMoto : catalog.loadingCar} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <VehicleCardSkeleton key={i} />
                    ))}
                  </div>
                ) : filteredVehicles.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {pagedVehicles.map((car, index) => (
                        <VehicleCard
                          key={car.id}
                          vehicle={car}
                          priority={index < 3}
                          availabilityChecked={Boolean(initialStartDate && initialEndDate)}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        ariaLabel={catalog.pagination.navAria}
                        firstPageLabel={catalog.pagination.firstPage}
                        previousPageLabel={catalog.pagination.previousPage}
                        nextPageLabel={catalog.pagination.nextPage}
                        lastPageLabel={catalog.pagination.lastPage}
                        className="mt-10"
                      />
                    )}
                  </>
                ) : (
                  <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F6F8] text-[#0B1220]">
                      {isMotoView ? <Motorbike className="h-7 w-7" aria-hidden="true" /> : <Car className="h-7 w-7" aria-hidden="true" />}
                    </div>
                    <h3 className="mt-4 text-lg font-extrabold text-[#0B1220]">
                      {typeScopedVehicles.length === 0 && !hasPeriod
                        ? isMotoView
                          ? catalog.emptyMotoNone
                          : catalog.emptyCarNone
                        : isMotoView
                          ? catalog.emptyMotoMatch
                          : catalog.emptyCarMatch}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {typeScopedVehicles.length === 0 && !hasPeriod
                        ? isMotoView
                          ? catalog.emptyMotoNoneText
                          : catalog.emptyCarNoneText
                        : typeScopedVehicles.length === 0
                          ? isMotoView
                            ? catalog.emptyMotoDates
                            : catalog.emptyCarDates
                          : catalog.emptyFiltersText}
                    </p>
                    {typeScopedVehicles.length === 0 && typeCounts[isMotoView ? 'CAR' : 'MOTORCYCLE'] > 0 && (
                      <Link
                        href={`${CATALOG_PATHS[isMotoView ? 'CAR' : 'MOTORCYCLE']}${switchQuery}`}
                        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-[13px] font-bold text-[#0B1220] transition-colors hover:bg-slate-50"
                      >
                        {isMotoView ? <Car className="h-4 w-4" aria-hidden="true" /> : <Motorbike className="h-4 w-4" aria-hidden="true" />}
                        {isMotoView ? catalog.seeCars : catalog.seeMotos}
                      </Link>
                    )}
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1220] px-5 text-[13px] font-bold text-white transition-colors hover:bg-slate-800"
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        {catalog.resetFilters}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <MobileFilterDrawer
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          resultCount={filteredVehicles.length}
          isMoto={isMotoView}
          activeCount={activeFilterCount}
          onReset={resetFilters}
        >
          <CatalogFilters
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            brands={brands}
            agencies={agencies}
            facets={facets}
            hideHeader
          />
        </MobileFilterDrawer>
      </div>

      {/* Carrousel animé des marques du catalogue affiché (voitures ou motos) — dernière section, juste avant le footer */}
      <BrandMarquee
        kind={isMotoView ? 'motorcycles' : 'cars'}
        vehicleCounts={brandCounts}
        countsLoading={vehiclesLoading}
        activeBrand={filters.brand !== 'ALL' ? filters.brand : undefined}
        onBrandSelect={selectBrandFromMarquee}
      />
    </>
  );
}

function MobileFilterDrawer({
  open,
  onClose,
  resultCount,
  isMoto,
  activeCount,
  onReset,
  children,
}: {
  open: boolean;
  onClose: () => void;
  resultCount: number;
  isMoto: boolean;
  activeCount: number;
  onReset: () => void;
  children: React.ReactNode;
}) {
  // Panneau modal : focus sur « Fermer », Tab piégé, Échap, page inerte, focus rendu au bouton « Filtres »
  const dialogRef = useModalDialog<HTMLDivElement>(open, { onClose });
  const { t, plural } = useTranslation();
  const catalog = t.catalog;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button
        type="button"
        aria-label={catalog.closeFilters}
        tabIndex={-1}
        data-modal-backdrop
        onClick={onClose}
        className="absolute inset-0 bg-[#0B1220]/55 backdrop-blur-[2px] motion-safe:animate-[cd-fade-in_150ms_ease-out]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-filters-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex outline-none max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-y-0 sm:end-0 sm:start-auto sm:max-h-none sm:w-[400px] sm:rounded-none"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 id="mobile-filters-title" className="text-base font-extrabold text-[#0B1220]">
            {catalog.filters}
          </h2>
          <button
            data-autofocus
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label={catalog.close}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5">{children}</div>
        <div className="flex gap-3 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            className="h-12 flex-1 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            {catalog.reset}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-[1.4] rounded-xl bg-action text-[13px] font-bold text-white transition-colors hover:bg-action-hover"
          >
            {plural(resultCount, isMoto ? catalog.showMoto : catalog.showCar)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SearchClient({ preload, vehicleType = 'CAR' }: { preload: SearchPreload | null; vehicleType?: VehicleType }) {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] p-8 text-center text-sm text-ink-tertiary">
          {vehicleType === 'MOTORCYCLE' ? t.catalog.suspenseMoto : t.catalog.suspenseCar}
        </div>
      }
    >
      <SearchPageContent preload={preload} vehicleType={vehicleType} />
    </Suspense>
  );
}
