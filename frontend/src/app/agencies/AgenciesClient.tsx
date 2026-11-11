'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import agenciesHeroImage from '../../../public/agences.jpg';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/lib/hooks/usePagination';
import {
  Building2,
  Search,
  BadgeCheck,
  MapPin,
  ArrowRight,
  X,
  RefreshCw,
  CarFront,
  ChevronRight,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react';

import { AgencyCard } from '@/components/agencies/AgencyCard';
import type { Agency } from '@/types';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { Magnet, GsapReveal } from '@/components/ui/react-bits';

type AgencyResponse = {
  success: boolean;
  data: Agency[];
};

type SortOption = 'name' | 'fleet' | 'rating';

const SORT_OPTIONS: SortOption[] = ['name', 'fleet', 'rating'];

function normalizeText(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function AgenciesClient() {
  const { t, locale, fmt, plural } = useTranslation();
  const l = t.agencies.list;
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const directoryRef = useRef<HTMLElement>(null);

  const fetchAgencies = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch('/api/agencies', {
        cache: 'no-store',
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const result: AgencyResponse = await response.json();
      if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid agencies response');

      setAllAgencies(result.data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Agencies loading error:', err);
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAgencies(controller.signal);
    return () => controller.abort();
  }, [fetchAgencies]);

  // Villes réellement couvertes, avec le nombre d'agences
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agency of allAgencies) {
      const city = agency.city?.trim();
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [allAgencies, locale]);

  const totalVehicles = useMemo(
    () => allAgencies.reduce((total, agency) => total + (agency.vehicle_count ?? 0), 0),
    [allAgencies]
  );
  const verifiedCount = useMemo(() => allAgencies.filter((agency) => agency.verified).length, [allAgencies]);

  const filteredAgencies = useMemo(() => {
    const query = normalizeText(searchQuery);

    const results = allAgencies.filter((agency) => {
      const matchesSearch =
        !query ||
        normalizeText(agency.name).includes(query) ||
        normalizeText(agency.address).includes(query) ||
        normalizeText(agency.city).includes(query);
      const matchesCity = cityFilter === 'all' || normalizeText(agency.city) === normalizeText(cityFilter);
      return matchesSearch && matchesCity;
    });

    return [...results].sort((a, b) => {
      if (sortBy === 'fleet') return (b.vehicle_count ?? 0) - (a.vehicle_count ?? 0);
      if (sortBy === 'rating') {
        const ra = a.review_count > 0 ? a.rating : 0;
        const rb = b.review_count > 0 ? b.rating : 0;
        return rb - ra || a.name.localeCompare(b.name, locale);
      }
      return a.name.localeCompare(b.name, locale);
    });
  }, [allAgencies, searchQuery, cityFilter, sortBy, locale]);

  const hasFilters = searchQuery.trim().length > 0 || cityFilter !== 'all';

  // ── Pagination ───────────────────────────────────────────────────────────
  const PAGE_SIZE_AGENCIES = 9; // 3×3 grid

  const { currentPage: agencyPage, totalPages: agencyTotalPages, startIndex: agencyStart, endIndex: agencyEnd, setPage: setAgencyPage, resetPage: resetAgencyPage } =
    usePagination({ pageSize: PAGE_SIZE_AGENCIES, totalItems: filteredAgencies.length, paramName: 'page' });

  // Reset to page 1 whenever search or city filter changes
  const prevSearchRef = React.useRef(searchQuery);
  const prevCityRef = React.useRef(cityFilter);
  const prevSortAgencyRef = React.useRef(sortBy);
  useEffect(() => {
    if (
      prevSearchRef.current !== searchQuery ||
      prevCityRef.current !== cityFilter ||
      prevSortAgencyRef.current !== sortBy
    ) {
      prevSearchRef.current = searchQuery;
      prevCityRef.current = cityFilter;
      prevSortAgencyRef.current = sortBy;
      resetAgencyPage();
    }
  }, [searchQuery, cityFilter, sortBy, resetAgencyPage]);

  const pagedAgencies = filteredAgencies.slice(agencyStart, agencyEnd);

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
  };

  // La recherche du hero filtre l'annuaire : on y amène l'utilisateur pour qu'il voie le résultat
  const scrollToDirectory = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    directoryRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    scrollToDirectory();
  };

  const selectCity = (city: string) => {
    setCityFilter(city);
  };

  const stats = [
    { value: allAgencies.length, label: plural(allAgencies.length, l.statAgencies) },
    { value: totalVehicles, label: plural(totalVehicles, l.statVehicles) },
    { value: cities.length, label: plural(cities.length, l.statCities) },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative isolate overflow-hidden bg-[#0B1220] text-white">
        {/* Photo en fond, voile marine pour garder le texte blanc lisible (contraste AA) — comme /search et /motos */}
        <Image
          src={agenciesHeroImage}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          quality={70}
          className="-z-10 object-cover object-[60%_55%]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-[#0B1220]/95 via-[#0B1220]/82 to-[#0B1220]/50 rtl:bg-linear-to-l"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-[#0B1220]/85 via-transparent to-[#0B1220]/45"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -end-40 -top-40 h-125 w-125 rounded-full border border-white/4" />
          <div className="absolute -end-20 -top-20 h-87.5 w-87.5 rounded-full border border-white/5" />
          <div className="absolute end-0 top-0 h-full w-1/2 bg-linear-to-l from-[#E63946]/10 to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end lg:px-8 lg:pb-16">
          <div>
            <nav aria-label={l.breadcrumbAria} className="mb-6 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Link href="/" className="rounded transition-colors hover:text-white">
                {l.home}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-600 rtl:rotate-180" aria-hidden="true" />
              <span aria-current="page" className="text-slate-200">
                {l.agencies}
              </span>
            </nav>

            <h1 className="max-w-2xl text-[34px] font-black leading-[1.08] tracking-tight sm:text-5xl">
              {l.titleBefore} <span className="text-accent-text">{l.titleAccent}</span> {l.titleAfter}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-400">{l.subtitle}</p>

            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] sm:flex-row sm:items-center"
            >
              <label htmlFor="agency-search" className="sr-only">
                {l.searchLabel}
              </label>
              <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  id="agency-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={l.searchPlaceholder}
                  autoComplete="off"
                  enterKeyHint="search"
                  className="w-full min-w-0 bg-transparent text-[15px] text-[#0B1220] outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={l.clearSearch}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0B1220]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-action px-6 text-sm font-bold text-white outline-none transition-colors hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-[#0B1220] focus-visible:ring-offset-2"
              >
                {l.search}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </form>

            {cities.length > 1 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{l.cities}</span>
                {cities.slice(0, 5).map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      selectCity(city.name);
                      scrollToDirectory();
                    }}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-white/25 hover:bg-white/10"
                  >
                    <MapPin className="h-3 w-3 text-accent-text" aria-hidden="true" />
                    {city.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chiffres réels du réseau */}
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid-cols-1">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#0B1220]/90 px-4 py-4 sm:px-5 lg:flex lg:items-center lg:justify-between lg:gap-4">
                <dt className="order-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 lg:order-1 lg:text-xs">
                  {stat.label}
                </dt>
                <dd className="order-1 text-2xl font-black tabular-nums tracking-tight text-white sm:text-3xl lg:order-2">
                  {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded-md bg-white/10 align-middle" /> : stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═══════════ ANNUAIRE ═══════════ */}
      <section
        ref={directoryRef}
        id="annuaire"
        aria-labelledby="annuaire-title"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="annuaire-title" className="text-2xl font-black tracking-tight text-[#0B1220] sm:text-3xl">
              {l.directoryTitle}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary" aria-live="polite">
              {loading
                ? l.loading
                : error
                  ? l.unavailable
                  : hasFilters
                    ? fmt(l.filteredCount, { shown: plural(filteredAgencies.length, l.agencyCount), total: allAgencies.length })
                    : `${plural(allAgencies.length, l.agencyCount)}${verifiedCount > 0 ? ` · ${plural(verifiedCount, l.verifiedCount)}` : ''}`}
            </p>
          </div>
        </div>

        {/* Barre de filtres */}
        {!loading && !error && allAgencies.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(11,18,32,0.04)] lg:flex-row lg:items-center">
            <div
              role="group"
              aria-label={l.cityFilterAria}
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-1 lg:pb-0"
            >
              {[{ name: 'all', label: l.allCities, count: allAgencies.length }, ...cities.map((c) => ({ ...c, label: c.name }))].map(
                (city) => {
                  const active = cityFilter === city.name;
                  return (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() => selectCity(city.name)}
                      aria-pressed={active}
                      className={
                        active
                          ? 'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#0B1220] px-3.5 text-sm font-bold text-white'
                          : 'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-[#F5F6F8] hover:text-[#0B1220]'
                      }
                    >
                      {city.label}
                      <span
                        className={
                          active
                            ? 'rounded-md bg-white/15 px-1.5 text-[11px] tabular-nums'
                            : 'rounded-md bg-[#F5F6F8] px-1.5 text-[11px] tabular-nums text-ink-tertiary'
                        }
                      >
                        {city.count}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-3 lg:border-s lg:border-t-0 lg:ps-3 lg:pt-0">
              <label htmlFor="agency-sort" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                {l.sortLabel}
              </label>
              <select
                id="agency-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="min-h-10 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white ps-3 pe-8 text-sm font-semibold text-[#0B1220] outline-none transition-colors hover:border-slate-300 focus:border-[#0B1220] focus:ring-4 focus:ring-[#0B1220]/8 lg:flex-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {l.sort[option]}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-accent-text transition-colors hover:bg-red-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {l.clear}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recherche active */}
        {!loading && !error && searchQuery.trim() && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {l.resultsFor}
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-[#0B1220] ring-1 ring-slate-200">
              « {searchQuery.trim()} »
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={l.removeSearch}
                className="-me-1 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#0B1220]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          </p>
        )}

        <div className="mt-6">
          {/* Chargement */}
          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={l.loadingAria}>
              {[1, 2, 3].map((item) => (
                <div key={item} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                  <div className="skeleton h-36 w-full" />
                  <div className="space-y-3 p-5 pt-10">
                    <div className="skeleton h-5 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton mt-6 h-11 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erreur */}
          {!loading && error && (
            <div role="alert" className="rounded-3xl border border-red-100 bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                <AlertCircle className="h-6 w-6 text-accent-text" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-[#0B1220]">{l.errorTitle}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {l.errorText}
              </p>
              <button
                type="button"
                onClick={() => void fetchAgencies()}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0B1220] px-5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {l.retry}
              </button>
            </div>
          )}

          {/* Plateforme sans agence */}
          {!loading && !error && allAgencies.length === 0 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-16 text-center sm:py-20">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B1220]">
                <Building2 className="h-7 w-7 text-white" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-xl font-black text-[#0B1220] sm:text-2xl">{l.emptyTitle}</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
                {l.emptyText}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/search"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-action px-6 text-sm font-bold text-white transition-colors hover:bg-action-hover"
                >
                  <CarFront className="h-4 w-4" aria-hidden="true" />
                  {l.seeVehicles}
                </Link>
                <Link
                  href="/agency/join"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 text-sm font-bold text-[#0B1220] transition-colors hover:bg-slate-50"
                >
                  {l.registerAgency}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}

          {/* Aucun résultat */}
          {!loading && !error && allAgencies.length > 0 && filteredAgencies.length === 0 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F6F8]">
                <Search className="h-6 w-6 text-slate-400" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-[#0B1220]">{l.noMatchTitle}</h3>
              <p className="mt-2 text-sm text-slate-500">{l.noMatchText}</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-[#0B1220] transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {l.clearFilters}
              </button>
            </div>
          )}

          {/* Grille */}
          {!loading && !error && filteredAgencies.length > 0 && (
            <>
              <GsapReveal stagger={0.06} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {pagedAgencies.map((agency) => (
                  <AgencyCard key={agency.id} agency={agency} carCount={agency.vehicle_count ?? 0} />
                ))}
              </GsapReveal>
              {agencyTotalPages > 1 && (
                <Pagination
                  currentPage={agencyPage}
                  totalPages={agencyTotalPages}
                  onPageChange={setAgencyPage}
                  ariaLabel={t.catalog.pagination.navAria}
                  firstPageLabel={t.catalog.pagination.firstPage}
                  previousPageLabel={t.catalog.pagination.previousPage}
                  nextPageLabel={t.catalog.pagination.nextPage}
                  lastPageLabel={t.catalog.pagination.lastPage}
                  className="mt-10"
                />
              )}
            </>
          )}
        </div>

        {/* ═══════════ PARTENARIAT ═══════════ */}
        {!loading && !error && (
          <section
            aria-labelledby="partner-title"
            className="relative mt-14 overflow-hidden rounded-3xl bg-[#0B1220] p-7 text-white sm:p-10 lg:p-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full border-40 border-white/3"
            />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-on-dark">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {l.partnerEyebrow}
                </span>
                <h2 id="partner-title" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                  {l.partnerTitle}
                </h2>
                <ul className="mt-5 grid gap-2.5 text-sm text-slate-300 sm:grid-cols-2">
                  {l.partnerPoints.map(
                    (item) => (
                      <li key={item} className="flex items-start gap-2">
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        {item}
                      </li>
                    )
                  )}
                </ul>
              </div>
              <Magnet strength={0.15} className="shrink-0">
                <Link
                  href="/agency/join"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-action px-7 text-sm font-bold text-white transition-colors hover:bg-action-hover sm:w-auto"
                >
                  {l.becomePartner}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Magnet>
            </div>
          </section>
        )}

        <div className="mt-8 flex justify-center">
          <Link
            href="/search"
            className="group inline-flex min-h-10 items-center gap-2 text-sm font-bold text-ink-tertiary transition-colors hover:text-accent-text"
          >
            {l.allVehicles}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
