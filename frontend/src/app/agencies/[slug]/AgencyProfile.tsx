'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Clock3,
  Languages,
  Plane,
  Ship,
  Undo2,
  Car,
  ChevronRight,
  ExternalLink,
  FileSignature,
  MapPin,
  MessageSquare,
  Motorbike,
  Send,
  Star,
} from 'lucide-react';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { AgencyBanner } from '@/components/agencies/AgencyBanner';
import { Badge } from '@/components/ui/Badge';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';
import { isMotorcycle } from '@/lib/vehicles/kind';
import { cn } from '@/lib/utils';
import type { Vehicle } from '@/types';
import type { AgencyProfileData } from './data';
import type { AgencyResponseTime } from '@/lib/bookings/response-time';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatDecimal, formatNumber } from '@/lib/i18n/format';

type FleetType = 'ALL' | 'CAR' | 'MOTORCYCLE';
type FleetSort = 'featured' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: FleetSort[] = ['featured', 'price_asc', 'price_desc'];

/** Tranche du délai de réponse médian (minutes) → clé de t.agencies.responseTime */
function responseBucket(minutes: number) {
  if (minutes <= 30) return 'under30' as const;
  if (minutes <= 60) return 'under60' as const;
  if (minutes <= 120) return 'under120' as const;
  if (minutes <= 360) return 'under360' as const;
  if (minutes <= 24 * 60) return 'under1440' as const;
  return 'over1440' as const;
}
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Fiche publique d'une agence partenaire.
 * Rendu serveur (données passées par la page) ; la flotte reste rafraîchie en direct (Supabase Realtime + 20 s).
 * Uniquement des informations réelles, renseignées par l'agence ou mesurées (délai de réponse) ;
 * pas de paiement ni de caution via ClickDrive.
 */
export function AgencyProfile({
  agency,
  initialVehicles,
  responseTime = null,
}: {
  agency: AgencyProfileData;
  initialVehicles: Vehicle[] | null;
  /** Délai de réponse mesuré (au moins 3 réponses), sinon null */
  responseTime?: AgencyResponseTime | null;
}) {
  const { t, locale, fmt, plural } = useTranslation();
  const p = t.agencies.profile;
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles ?? []);
  const [fleetLoading, setFleetLoading] = useState(initialVehicles === null);
  const [fleetType, setFleetType] = useState<FleetType>('ALL');
  const [sort, setSort] = useState<FleetSort>('featured');
  const nameId = useId();
  const fleetTitleId = useId();

  const loadVehicles = useCallback(async () => {
    try {
      const response = await fetch(`/api/vehicles?agencyId=${encodeURIComponent(agency.id)}`, { cache: 'no-store' }).then((r) =>
        r.json()
      );
      if (response.success && Array.isArray(response.data)) setVehicles(response.data);
    } catch (error) {
      console.warn('Error refreshing agency vehicles:', error);
    } finally {
      setFleetLoading(false);
    }
  }, [agency.id]);

  // Flotte non préchargée par le serveur (erreur passagère) : chargement côté navigateur
  useEffect(() => {
    if (initialVehicles === null) void loadVehicles();
  }, [initialVehicles, loadVehicles]);

  useRealtimeRefresh({
    tables: ['vehicles', 'bookings'],
    onRefresh: loadVehicles,
    pollingIntervalMs: 20_000,
  });

  const cars = useMemo(() => vehicles.filter((v) => !isMotorcycle(v)), [vehicles]);
  const motos = useMemo(() => vehicles.filter((v) => isMotorcycle(v)), [vehicles]);
  const hasBothTypes = cars.length > 0 && motos.length > 0;
  const minPrice = vehicles.length > 0 ? Math.min(...vehicles.map((v) => v.daily_price)) : null;

  const shown = useMemo(() => {
    const scoped = fleetType === 'CAR' ? cars : fleetType === 'MOTORCYCLE' ? motos : vehicles;
    const list = [...scoped];
    if (sort === 'price_asc') list.sort((a, b) => a.daily_price - b.daily_price);
    else if (sort === 'price_desc') list.sort((a, b) => b.daily_price - a.daily_price);
    else list.sort((a, b) => (a.status === 'AVAILABLE' ? 0 : 1) - (b.status === 'AVAILABLE' ? 0 : 1) || a.daily_price - b.daily_price);
    return list;
  }, [cars, motos, vehicles, fleetType, sort]);

  const location = agency.address && !sameText(agency.address, agency.city) ? `${agency.address}, ${agency.city}` : agency.city || 'Nador';
  const hasCoordinates =
    Number.isFinite(agency.latitude) && Number.isFinite(agency.longitude) && (agency.latitude !== 0 || agency.longitude !== 0);
  const mapsUrl = hasCoordinates ? `https://www.google.com/maps/search/?api=1&query=${agency.latitude},${agency.longitude}` : null;
  const memberSince = agency.created_at
    ? new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' }).format(new Date(agency.created_at))
    : null;
  const hasReviews = agency.review_count > 0 && agency.rating > 0;

  // Infos pratiques renseignées par l'agence (rien d'affiché pour un champ vide)
  const fee = (value: number | null | undefined) =>
    value == null ? null : value === 0 ? p.free : fmt(p.feePayable, { amount: formatNumber(value, locale) });
  const languageLabels = (agency.languages ?? []).map((code) => t.agencies.spokenLanguages[code]).filter(Boolean);
  const practical = [
    { key: 'hours', icon: Clock3, label: p.hours, value: agency.opening_hours },
    { key: 'languages', icon: Languages, label: p.languages, value: languageLabels.length ? languageLabels.join(', ') : null },
    { key: 'airport', icon: Plane, label: p.airportDelivery, value: fee(agency.delivery_fee_airport) },
    { key: 'port', icon: Ship, label: p.portDelivery, value: fee(agency.delivery_fee_port) },
    { key: 'cancellation', icon: Undo2, label: p.cancellation, value: agency.cancellation_policy },
  ].filter((item): item is typeof item & { value: string } => Boolean(item.value));
  const fleetLabel = vehicles.length > 0 ? plural(vehicles.length, p.seeVehicles) : p.seeFleet;
  const fleetBreakdown = hasBothTypes
    ? `${plural(cars.length, p.cars)} · ${plural(motos.length, p.motos)}`
    : motos.length > 0
      ? plural(motos.length, p.motos)
      : plural(cars.length, p.cars);

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-20">
      {/* Fil d'Ariane */}
      <div className="border-b border-slate-200 bg-white">
        <nav aria-label={t.agencies.list.breadcrumbAria} className="mx-auto flex max-w-7xl min-w-0 items-center gap-2 px-4 py-3 text-xs font-medium text-slate-500 sm:px-6 lg:px-8">
          <Link href="/" className="rounded hover:text-[#0B1220]">{t.agencies.list.home}</Link>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400 rtl:rotate-180" />
          <Link href="/agencies" className="rounded hover:text-[#0B1220]">{t.agencies.list.agencies}</Link>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400 rtl:rotate-180" />
          <span aria-current="page" className="min-w-0 truncate font-semibold text-[#0B1220]">{agency.name}</span>
        </nav>
      </div>

      {/* Bannière */}
      <div className="relative h-40 w-full bg-[#0B1220] sm:h-56 lg:h-64">
        <AgencyBanner name={agency.name} bannerUrl={agency.banner_url} priority sizes="100vw" className="object-cover opacity-60" />
        <div className="absolute inset-0 bg-linear-to-t from-[#0B1220] via-[#0B1220]/40 to-transparent" aria-hidden="true" />
      </div>

      <div className="relative mx-auto -mt-20 max-w-7xl px-4 sm:-mt-24 sm:px-6 lg:px-8">
        {/* ── Carte d'identité de l'agence ───────────────────────────── */}
        <section aria-labelledby={nameId} className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(11,18,32,0.35)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative -mt-14 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg sm:-mt-16">
                <AgencyLogo slug={agency.slug} name={agency.name} logoUrl={agency.logo_url} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 id={nameId} className="break-words text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-[32px]">
                    {agency.name}
                  </h1>
                  {agency.verified && (
                    <Badge variant="verified" icon>
                      {p.verifiedPartner}
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 text-[#E63946]" aria-hidden="true" />
                    {location}
                  </span>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap-44 inline-flex min-h-8 items-center gap-1 font-semibold text-[#0B1220] underline-offset-4 hover:underline"
                    >
                      {p.seeOnMap}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">{p.opensInMaps}</span>
                    </a>
                  )}
                </p>
                <p className="mt-1 text-sm">
                  {hasReviews ? (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                      <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                      {formatDecimal(agency.rating, locale)}
                      <span className="font-normal text-slate-500">{plural(agency.review_count, p.reviews)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">{p.newPartner}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <a
                href="#agency-fleet"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E63946] px-5 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(230,57,70,0.8)] transition-colors hover:bg-[#C92F3B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1220]"
              >
                {fleetLabel}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </a>
              <a
                href={clickdriveWhatsAppUrl(fmt(p.whatsappQuestion, { agency: agency.name, city: agency.city }))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-[#0B1220] transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1220]"
              >
                <MessageSquare className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                {p.askQuestion}
                <span className="sr-only">{p.whatsappNewTab}</span>
              </a>
            </div>
          </div>

          {/* Faits réels de l'agence */}
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-100 pt-6 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.fleet}</dt>
              <dd className="mt-1 text-lg font-extrabold text-[#0B1220]">
                {fleetLoading ? '…' : plural(vehicles.length, p.vehicles)}
              </dd>
              {!fleetLoading && vehicles.length > 0 && <dd className="text-xs text-slate-500">{fleetBreakdown}</dd>}
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.from}</dt>
              <dd className="mt-1 text-lg font-extrabold text-[#0B1220]">
                {minPrice !== null ? (
                  <>
                    <span className="tabular-nums">{formatNumber(minPrice, locale)}</span> DH
                    <span className="text-sm font-semibold text-slate-500"> {p.perDay}</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            {memberSince && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.memberSince}</dt>
                <dd className="mt-1 text-lg font-extrabold capitalize text-[#0B1220]">{memberSince}</dd>
              </div>
            )}
            {responseTime && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.answers}</dt>
                <dd className="mt-1 text-lg font-extrabold first-letter:uppercase text-[#0B1220]">
                  {t.agencies.responseTime[responseBucket(responseTime.medianMinutes)]}
                </dd>
                <dd className="text-xs text-slate-500">{plural(responseTime.responses, p.responseMedian)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.payment}</dt>
              <dd className="mt-1 text-lg font-extrabold text-[#0B1220]">{p.atAgency}</dd>
            </div>
          </dl>
        </section>

        {practical.length > 0 && (
          <section aria-labelledby="agency-practical" className="mt-6 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7">
            <h2 id="agency-practical" className="text-lg font-extrabold text-[#0B1220]">
              {p.practical}
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {practical.map(({ key, icon: Icon, label, value }) => (
                <div key={key} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F6F8] text-[#0B1220]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-sm leading-6 text-slate-700">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* À propos : uniquement si l'agence a rédigé une présentation */}
          {agency.description.trim() && (
            <section aria-labelledby="agency-about" className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7">
              <h2 id="agency-about" className="flex items-center gap-2 text-lg font-extrabold text-[#0B1220]">
                <Building2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
                {fmt(p.about, { agency: agency.name })}
              </h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-600">{agency.description}</p>
              {locale !== 'fr' && <p className="mt-2 text-xs text-slate-500">{p.agencyTextNote}</p>}
            </section>
          )}

          {/* Déroulé de la réservation chez cette agence (remplace la liste d'engagements) */}
          <section
            aria-labelledby="agency-how"
            className={cn('rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7', !agency.description.trim() && 'lg:col-span-2')}
          >
            <h2 id="agency-how" className="text-lg font-extrabold text-[#0B1220]">
              {fmt(p.bookWith, { agency: agency.name })}
            </h2>
            <ol className={cn('mt-4 grid gap-4', !agency.description.trim() && 'sm:grid-cols-3')}>
              {[
                { icon: Car, title: p.step1Title, text: p.step1Text },
                { icon: Send, title: p.step2Title, text: p.step2Text },
                { icon: CalendarCheck, title: p.step3Title, text: p.step3Text },
              ].map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E63946] text-[10px] font-bold">
                      {index + 1}
                    </span>
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-[#0B1220]">{title}</span>
                    <span className="block text-sm text-slate-600">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            {agency.verified && (
              <p className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <FileSignature className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                {p.verifiedNote}
              </p>
            )}
          </section>
        </div>

        {/* ── Flotte ─────────────────────────────────────────────────── */}
        <section id="agency-fleet" aria-labelledby={fleetTitleId} className="mt-12 scroll-mt-28">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id={fleetTitleId} className="text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-[28px]">
                {fmt(p.fleetTitle, { agency: agency.name })}
              </h2>
              <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                {fleetLoading
                  ? p.loadingVehicles
                  : shown.length === 0
                    ? p.noVehicles
                    : `${plural(shown.length, p.shown)} · ${p.pricesNote}`}
              </p>
            </div>

            {vehicles.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {hasBothTypes && (
                  <div role="group" aria-label={p.typeAria} className="inline-flex rounded-xl bg-slate-200/60 p-1">
                    {(
                      [
                        { value: 'ALL', label: p.all, count: vehicles.length, icon: null },
                        { value: 'CAR', label: p.carsLabel, count: cars.length, icon: Car },
                        { value: 'MOTORCYCLE', label: p.motosLabel, count: motos.length, icon: Motorbike },
                      ] as const
                    ).map(({ value, label, count, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={fleetType === value}
                        onClick={() => setFleetType(value)}
                        className={cn(
                          'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E63946]',
                          fleetType === value ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-600 hover:text-[#0B1220]'
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                        {label}
                        <span className="tabular-nums text-slate-400">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <label htmlFor="agency-fleet-sort" className="sr-only">
                  {p.sortFleet}
                </label>
                <select
                  id="agency-fleet-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as FleetSort)}
                  className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0B1220] outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {p.sort[option]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {fleetLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-96 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <Car className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {fmt(p.noneYet, { agency: agency.name })}
              </p>
              <Link
                href="/search"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0B1220] px-5 text-sm font-bold text-white hover:bg-slate-800"
              >
                {p.fullCatalog}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((vehicle) => (
                <li key={vehicle.id}>
                  <VehicleCard vehicle={vehicle} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
