'use client';

import { CLICKDRIVE_WHATSAPP_NUMBER } from '@/lib/constants/contact';
import React, { useState, useEffect, useCallback } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { findSameModelAlternatives } from '@/lib/availability/engine';
import { BookingCard, type BookingAvailability } from '@/components/booking/BookingCard';
import { VehicleGallery } from '@/components/cars/VehicleGallery';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatDecimal, formatNumber } from '@/lib/i18n/format';
import { categoryLabel, featureLabel, fuelLabel, licenseLabel as licenseText, transmissionLabel } from '@/lib/i18n/labels';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import type { Vehicle, Review } from '@/types';
import {
  Baby,
  CalendarClock,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  DoorOpen,
  FileText,
  Fuel,
  Gauge,
  Heart,
  IdCard,
  Info,
  Link2,
  MessageCircle,
  Motorbike,
  Gauge as Odometer,
  Share2,
  ShieldCheck,
  Snowflake,
  Star,
  Tag,
  Truck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { formatEngineCc, isMotorcycle } from '@/lib/vehicles/kind';
import type { RentalPeriod } from '@/lib/utils/date-only';
import { calculateRentalDays } from '@/lib/utils/pricing';
import { searchContextQuery } from '@/lib/catalog/search-context';
import { toggleFavorite, useFavoriteIds } from '@/lib/ui/use-favorites';

interface CarDetailsClientProps {
  slug: string;
  /** Véhicule public chargé côté serveur (contenu présent dès le HTML) */
  initialVehicle: Vehicle;
  /** Véhicules du même modèle chez d'autres agences (alternatives), chargés côté serveur */
  alternativesPool: Vehicle[];
  /** Dates choisies dans la recherche (adresse), reprises par la carte de réservation */
  requestedPeriod?: RentalPeriod;
  /** Lieu de prise en charge choisi dans la recherche (adresse), repris par la demande */
  requestedLocation?: string;
}

export function CarDetailsClient({ slug, initialVehicle, alternativesPool, requestedPeriod, requestedLocation }: CarDetailsClientProps) {
  const { t, locale, fmt, plural, date, money } = useTranslation();
  // Ajout aux favoris : le cœur se gonfle une fois après le clic (même retour que sur les cartes)
  const [heartPop, setHeartPop] = useState(0);
  const c = t.car;
  const num = (value: number) => formatNumber(value, locale);

  const [vehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const [reviews, setReviews] = useState<Review[]>([]);
  // Favori mémorisé dans le navigateur (même liste que les cartes et le filtre du catalogue)
  const favorite = useFavoriteIds().includes(vehicle.id);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [dateAvailability, setDateAvailability] = useState<BookingAvailability>('checking');
  // Période affichée par la carte de réservation : reprise par les véhicules similaires et le catalogue
  const [period, setPeriod] = useState<RentalPeriod | null>(requestedPeriod ?? null);
  const hadRequestedPeriod = Boolean(requestedPeriod);
  const handlePeriodChange = useCallback(
    (next: RentalPeriod | null, chosen: boolean) => {
      setPeriod(next);
      // Adresse tenue à jour quand le visiteur change ses dates (ou en avait déjà) : rechargement, partage
      // et retour arrière les gardent. Les dates proposées par défaut n'y sont pas ajoutées.
      if (!next || (!chosen && !hadRequestedPeriod)) return;
      const query = new URLSearchParams(window.location.search);
      if (query.get('startDate') === next.startDate && query.get('endDate') === next.endDate) return;
      query.set('startDate', next.startDate);
      query.set('endDate', next.endDate);
      window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
    },
    [hadRequestedPeriod]
  );

  // Rafraîchissement : la fiche (prix, statut) et ses avis. Le catalogue complet n'est plus rechargé
  // (les alternatives du même modèle sont fournies par le serveur).
  const load = useCallback(async () => {
    try {
      const vRes = await fetch(`/api/vehicles/${encodeURIComponent(slug)}`, { cache: 'no-store' }).then((r) => r.json());
      if (vRes.success && vRes.data) setVehicle(vRes.data);
      const vehicleId = vRes.success && vRes.data ? vRes.data.id : initialVehicle.id;
      const revRes = await fetch(`/api/reviews?vehicle_id=${encodeURIComponent(vehicleId)}`, { cache: 'no-store' }).then((r) => r.json());
      if (revRes.success && Array.isArray(revRes.data)) setReviews(revRes.data);
    } catch (err) {
      console.warn('Rafraîchissement de la fiche impossible :', err);
    }
  }, [slug, initialVehicle.id]);

  // Avis chargés après l'affichage (la fiche elle-même est déjà rendue par le serveur)
  useEffect(() => {
    void load();
  }, [load]);

  // Rafraîchissement automatique en direct (Supabase Realtime + Multi-onglets + Focus)
  useRealtimeRefresh({
    tables: ['vehicles', 'bookings', 'reviews', 'vehicle_unavailability'],
    onRefresh: () => load(),
    pollingIntervalMs: 20_000,
  });

  const alternatives = findSameModelAlternatives({
    currentVehicle: vehicle,
    allVehicles: alternativesPool.length > 0 ? alternativesPool : [vehicle],
    allBookings: [],
  }).slice(0, 6);

  // Véhicules similaires vérifiés pour la période affichée : seuls ceux qui sont libres sont proposés.
  // Tant que la vérification n'a pas abouti (ou si elle échoue), ils restent affichés sans promesse de dates.
  const alternativeIds = alternatives.map((alt) => alt.id).join(',');
  const alternativesKey = period && alternativeIds ? `${period.startDate}|${period.endDate}|${alternativeIds}` : '';
  const [freeAlternatives, setFreeAlternatives] = useState<{ key: string; ids: ReadonlySet<string> } | null>(null);
  useEffect(() => {
    if (!alternativesKey) return;
    const [startDate, endDate, ids] = alternativesKey.split('|');
    const query = new URLSearchParams({ startDate, endDate });
    let active = true;
    Promise.all(
      ids.split(',').map(async (id) => {
        const response = await fetch(`/api/vehicles/${encodeURIComponent(id)}/availability?${query}`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error('availability');
        return body.data?.status === 'AVAILABLE' ? id : null;
      })
    )
      .then((results) => {
        if (active) setFreeAlternatives({ key: alternativesKey, ids: new Set(results.filter((id): id is string => id !== null)) });
      })
      .catch(() => {
        /* vérification impossible : alternatives affichées sans promesse de dates */
      });
    return () => {
      active = false;
    };
  }, [alternativesKey]);
  const checkedFree = freeAlternatives && freeAlternatives.key === alternativesKey ? freeAlternatives.ids : null;
  const shownAlternatives = checkedFree ? alternatives.filter((alt) => checkedFree.has(alt.id)) : alternatives;
  const periodDays = period ? calculateRentalDays(period.startDate, period.endDate) : undefined;
  const searchContext = searchContextQuery(period, requestedLocation);

  const title = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const isMoto = isMotorcycle(vehicle);
  const engineCc = formatEngineCc(vehicle.engine_cc);
  const licenseLabel = licenseText(t, vehicle.license_required);
  const category = isMoto ? fmt(t.vehicle.card.motoCategory, { category: categoryLabel(t, vehicle.category) }) : categoryLabel(t, vehicle.category);
  const isFleetListed = vehicle.status === 'AVAILABLE';
  // Un véhicule en flotte n'est « disponible » que si les dates choisies le sont aussi.
  const isAvailableForDates = isFleetListed && dateAvailability !== 'unavailable';
  const vehicleStatusLabel = !isFleetListed
    ? vehicle.status === 'MAINTENANCE'
      ? c.status.maintenance
      : c.status.notAvailable
    : dateAvailability === 'checking'
      ? c.status.checking
      : dateAvailability === 'unavailable'
        ? c.status.unavailableDates
        : c.status.available;

  // Note : uniquement à partir des avis réels du véhicule
  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : null;

  const agency = vehicle.agency;
  // Numéro de l'agence (WhatsApp, sinon téléphone) ; à défaut, l'assistance ClickDrive, jamais un numéro inventé
  const agencyPhone = (agency?.whatsapp || agency?.phone || '').replace(/[^0-9]/g, '') || CLICKDRIVE_WHATSAPP_NUMBER;
  const whatsappLink = `https://wa.me/${agencyPhone}?text=${encodeURIComponent(
    fmt(isMoto ? c.whatsappMoto : c.whatsappCar, {
      agency: agency?.name || 'ClickDrive',
      vehicle: `${vehicle.brand} ${vehicle.model}`,
      price: num(vehicle.daily_price),
    })
  )}`;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} — ClickDrive`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2500);
    } catch {
      // Partage annulé par l'utilisateur : rien à faire
    }
  };

  // Caractéristiques : seules les données présentes sont affichées
  const specs: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: isMoto ? Motorbike : Car, label: c.spec.brandModel, value: `${vehicle.brand} ${vehicle.model}` },
    { icon: CalendarDays, label: c.spec.year, value: String(vehicle.year) },
    { icon: Tag, label: c.spec.category, value: category },
    { icon: Gauge, label: isMoto ? c.spec.gearbox : c.spec.transmission, value: transmissionLabel(t, vehicle.transmission) },
    { icon: Fuel, label: c.spec.fuel, value: fuelLabel(t, vehicle.fuel) },
  ];
  if (isMoto && engineCc) specs.push({ icon: Motorbike, label: c.spec.engine, value: engineCc });
  if (isMoto && licenseLabel) specs.push({ icon: IdCard, label: c.spec.license, value: licenseLabel });
  if (vehicle.seats > 0) specs.push({ icon: Users, label: c.spec.seats, value: plural(vehicle.seats, t.vehicle.seats) });
  if (!isMoto && vehicle.doors > 0) specs.push({ icon: DoorOpen, label: c.spec.doors, value: plural(vehicle.doors, c.spec.doorsValue) });
  if (!isMoto && typeof vehicle.air_conditioning === 'boolean') {
    specs.push({ icon: Snowflake, label: c.spec.ac, value: vehicle.air_conditioning ? c.spec.yes : c.spec.no });
  }
  if (vehicle.mileage > 0) specs.push({ icon: Odometer, label: c.spec.mileage, value: `${num(vehicle.mileage)} km` });

  // Conditions : uniquement celles fournies par les données du véhicule et du parcours de réservation
  const conditions: { icon: React.ElementType; label: string; value: string; note?: string }[] = [];
  if (isMoto) {
    conditions.push(
      licenseLabel
        ? { icon: IdCard, label: c.spec.license, value: licenseLabel, note: c.cond.licenseNote }
        : { icon: IdCard, label: c.spec.license, value: c.cond.toConfirm, note: c.cond.licenseTbcNote }
    );
  }
  if ((vehicle.deposit ?? 0) > 0) {
    conditions.push({ icon: ShieldCheck, label: c.cond.deposit, value: money(vehicle.deposit), note: c.cond.depositNote });
  }
  if (vehicle.min_rental_days > 0) {
    conditions.push({ icon: CalendarClock, label: c.cond.minDuration, value: plural(vehicle.min_rental_days, c.cond.days) });
  }
  if (typeof vehicle.min_driver_age === 'number' && vehicle.min_driver_age > 0) {
    conditions.push({ icon: UserRound, label: c.cond.minAge, value: plural(vehicle.min_driver_age, c.cond.years) });
  }
  if (typeof vehicle.unlimited_mileage === 'boolean') {
    conditions.push({
      icon: Odometer,
      label: c.cond.mileage,
      value: vehicle.unlimited_mileage ? c.cond.unlimited : c.cond.limited,
      note: vehicle.unlimited_mileage ? undefined : c.cond.limitedNote,
    });
  }
  if (vehicle.delivery_available === true) {
    conditions.push({ icon: Truck, label: c.cond.delivery, value: c.cond.possible, note: c.cond.deliveryNote });
  }
  // Assurance et frais annexes : renseignés par l'agence, affichés pour un prix sans surprise
  if (vehicle.insurance_coverage) {
    conditions.push({
      icon: ShieldCheck,
      label: c.cond.insurance,
      value: vehicle.insurance_coverage === 'COMPREHENSIVE' ? c.cond.comprehensive : c.cond.thirdParty,
      note:
        vehicle.insurance_excess != null
          ? Number(vehicle.insurance_excess) > 0
            ? fmt(c.cond.excess, { amount: num(Number(vehicle.insurance_excess)) })
            : c.cond.noExcess
          : c.cond.excessByAgency,
    });
  }
  const deliveryFee = (amount: number | null | undefined) =>
    amount == null ? null : Number(amount) === 0 ? c.cond.free : money(Number(amount));
  const airportFee = deliveryFee(agency?.delivery_fee_airport);
  const portFee = deliveryFee(agency?.delivery_fee_port);
  if (airportFee) {
    conditions.push({ icon: Truck, label: c.cond.airportDelivery, value: airportFee, note: c.cond.payExtra });
  }
  if (portFee) {
    conditions.push({ icon: Truck, label: c.cond.portDelivery, value: portFee, note: c.cond.payExtra });
  }
  if (agency?.cancellation_policy?.trim()) {
    conditions.push({ icon: CalendarClock, label: c.cond.cancellation, value: c.cond.byAgency, note: agency.cancellation_policy.trim() });
  }
  conditions.push({ icon: Wallet, label: c.cond.payment, value: c.cond.atAgency });

  return (
    <div className="min-h-screen bg-canvas pb-28 lg:pb-16">
      {/* ── Fil d'Ariane ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200/80 bg-white">
        <nav
          aria-label={c.breadcrumbAria}
          className="mx-auto flex h-11 max-w-[1360px] items-center gap-1.5 overflow-hidden px-4 text-xs font-medium text-ink-secondary sm:px-6 lg:px-8"
        >
          <Link href="/" className="inline-flex h-11 shrink-0 items-center transition-colors hover:text-ink">{c.home}</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 rtl:rotate-180" aria-hidden="true" />
          <Link
            href={isMoto ? '/motos' : '/search'}
            className="inline-flex h-11 shrink-0 items-center transition-colors hover:text-ink"
          >
            {isMoto ? c.motos : c.cars}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="truncate font-semibold text-ink">
            {vehicle.brand} {vehicle.model}
          </span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        {/* ── Grille unique. Mobile / tablette : photo d'abord, puis titre, infos clés, réservation et détails
            (l'ordre du DOM reste titre → photo pour les lecteurs d'écran). Desktop : titre sur toute la largeur,
            puis galerie + détails | réservation collante. ── */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── En-tête véhicule ───────────────────────────────────── */}
          <header className="order-2 flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between lg:order-none lg:col-span-2 lg:row-start-1 lg:mb-2">
            <div className="min-w-0">
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                  {isMoto && <Motorbike className="h-3.5 w-3.5" aria-hidden="true" />}
                  {category}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold',
                    isAvailableForDates ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-brand-line bg-brand-soft text-action-hover'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isAvailableForDates ? 'bg-emerald-500' : 'bg-brand')} aria-hidden="true" />
                  {vehicleStatusLabel}
                </span>
              </div>
  
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[42px]">
                {vehicle.brand} {vehicle.model}{' '}
                <span className="font-semibold text-ink-secondary">{vehicle.year}</span>
              </h1>
  
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {agency && (
                  <Link
                    href={`/agencies/${agency.slug}`}
                    className="group inline-flex min-h-11 items-center gap-2 font-bold text-ink transition-colors hover:text-accent-text"
                  >
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <AgencyLogo slug={agency.slug} name={agency.name} logoUrl={agency.logo_url} className="h-full w-full object-cover" size={28} />
                    </span>
                    {agency.name}
                  </Link>
                )}
                {agency?.verified && (
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {c.verifiedAgency}
                  </span>
                )}
                <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
                {averageRating !== null ? (
                  <a href="#avis" className="inline-flex min-h-9 items-center gap-1.5 font-bold text-ink hover:underline">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    {formatDecimal(averageRating, locale)}
                    <span className="font-medium text-ink-secondary">{plural(reviewCount, c.reviewsCount)}</span>
                  </a>
                ) : (
                  <span className="text-[13px] font-medium text-ink-secondary">{c.noReviewsYet}</span>
                )}
              </div>
            </div>
  
            <div className="flex items-center gap-2">
              {/* Pression en CSS (motion-press) : plus de Framer Motion sur ce bouton, donc plus de
                  transform JavaScript mêlé aux transitions CSS du même élément */}
              <button
                type="button"
                onClick={() => {
                  if (!favorite) setHeartPop((n) => n + 1);
                  toggleFavorite(vehicle.id);
                }}
                aria-pressed={favorite}
                aria-label={favorite ? c.removeFavorite : c.addFavorite}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl border bg-white transition-[color,border-color,scale] duration-instant motion-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  favorite ? 'border-brand-line text-accent-text' : 'border-slate-200 text-ink-secondary hover:border-slate-300 hover:text-ink'
                )}
              >
                <Heart
                  key={heartPop}
                  className={cn('h-5 w-5', favorite && 'fill-current', favorite && heartPop > 0 && 'animate-cd-heart-pop')}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                aria-label={
                  shareState === 'copied'
                    ? isMoto
                      ? c.linkCopiedMoto
                      : c.linkCopiedCar
                    : isMoto
                      ? c.shareMoto
                      : c.shareCar
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {shareState === 'copied' ? (
                  <Link2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                )}
                <span aria-live="polite">{shareState === 'copied' ? c.copied : c.share}</span>
              </button>
            </div>
          </header>

          {/* Galerie */}
          <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
            <VehicleGallery images={vehicle.images ?? []} title={title} isMoto={isMoto} />
          </div>

          {/* Infos clés */}
          <ul className="order-3 grid min-w-0 grid-cols-3 gap-2 sm:gap-3 lg:order-none lg:col-start-1 lg:row-start-3" aria-label={c.keyInfoAria}>
            {[
              { icon: Gauge, value: transmissionLabel(t, vehicle.transmission) },
              isMoto && engineCc
                ? { icon: Motorbike, value: engineCc }
                : { icon: Fuel, value: fuelLabel(t, vehicle.fuel) },
              isMoto && vehicle.license_required
                ? { icon: IdCard, value: fmt(t.vehicle.license, { license: vehicle.license_required }) }
                : { icon: Users, value: plural(vehicle.seats, t.vehicle.seats) },
            ].map(({ icon: Icon, value }) => (
              <li key={value} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2 py-3 text-center sm:flex-row sm:justify-center sm:gap-2.5">
                <Icon className="h-5 w-5 text-accent-text" aria-hidden="true" />
                <span className="text-[13px] font-bold text-ink sm:text-sm">{value}</span>
              </li>
            ))}
          </ul>

          {/* Réservation : après les infos clés en mobile, colonne collante sur desktop.
              La carte ne demande que les dates : elle tient dans un écran de 860 px de haut sans défiler.
              Filet de sécurité pour les écrans très bas : la colonne défile alors elle-même, et
              « Réserver » (placé haut dans la carte) reste visible et atteignable au focus (WCAG 2.4.11). */}
          <aside className="order-4 mt-2 min-w-0 lg:order-none lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:mt-0" aria-label={c.bookingAria}>
            <div className="space-y-3 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:[scrollbar-width:thin]">
              <BookingCard
                vehicle={vehicle}
                requestedPeriod={requestedPeriod}
                defaultLocation={requestedLocation}
                onAvailabilityChange={setDateAvailability}
                onPeriodChange={handlePeriodChange}
              />

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{isMoto ? c.questionMoto : c.questionCar}</p>
                  <p className="truncate text-xs text-ink-secondary">{fmt(c.writeTo, { agency: agency?.name ?? c.theAgency })}</p>
                </div>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-ink px-3.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  {c.write}
                </a>
              </div>
            </div>
          </aside>

          {/* Détails */}
          <div className="order-5 mt-2 min-w-0 space-y-6 lg:order-none lg:col-start-1 lg:row-start-4 lg:mt-4">
            {/* Caractéristiques */}
            <section aria-labelledby="specs-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle id="specs-title" eyebrow={c.specsEyebrow} title={c.specsTitle} />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map(({ icon: Icon, label, value }) => (
                  // dl > div > dt + dd : seule structure valide (l'icône, décorative, est placée dans le dt)
                  <div key={label} className="relative min-w-0 rounded-xl bg-canvas p-3.5 ps-[3.875rem]">
                    <dt className="text-xs font-medium text-ink-secondary">
                      <span
                        className="absolute start-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-accent-text shadow-[0_1px_2px_rgba(11,18,32,0.06)]"
                        aria-hidden="true"
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-ink break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Équipements & options */}
            <section aria-labelledby="features-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle id="features-title" eyebrow={c.featuresEyebrow} title={c.featuresTitle} />
              {vehicle.features.length > 0 ? (
                <>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-secondary">{c.included}</h3>
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {vehicle.features.map((feature, index) => (
                      <li key={`${feature}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3 text-sm text-slate-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        {featureLabel(t, feature)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-ink-secondary">{c.noFeatures}</p>
              )}

              <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.12em] text-ink-secondary">{c.onRequest}</h3>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[
                  { icon: Baby, label: c.childSeat },
                  { icon: UserPlus, label: c.extraDriver },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-sm text-slate-700">
                    <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink-tertiary">{c.agencyRate}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Conditions de location */}
            {vehicle.description?.trim() && (
              <section aria-labelledby="vehicle-description-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                <h2 id="vehicle-description-title" className="text-lg font-extrabold text-ink">
                  {c.agencyWord}
                </h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-700">{vehicle.description.trim()}</p>
                {locale !== 'fr' && <p className="mt-2 text-xs text-ink-secondary">{c.agencyTextNote}</p>}
              </section>
            )}

            <section aria-labelledby="conditions-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle
                id="conditions-title"
                eyebrow={c.conditionsEyebrow}
                title={c.conditionsTitle}
                subtitle={c.conditionsSubtitle}
              />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {conditions.map(({ icon: Icon, label, value, note }) => (
                  <div key={label} className="relative rounded-xl border border-slate-100 p-4 ps-12">
                    <dt className="text-xs font-medium text-ink-secondary">
                      <Icon className="absolute start-4 top-[1.125rem] h-5 w-5 text-accent-text" aria-hidden="true" />
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-bold text-ink">{value}</dd>
                    {note && <dd className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{note}</dd>}
                  </div>
                ))}
              </dl>

              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                <Disclosure icon={FileText} title={c.documentsTitle}>
                  <ul className="list-disc space-y-1 ps-5">
                    <li>{c.docId}</li>
                    <li>{c.docLicense}</li>
                  </ul>
                  <p className="mt-2">{c.docNote}</p>
                </Disclosure>
                <Disclosure icon={Info} title={c.insuranceTitle}>
                  <p>{c.insuranceText}</p>
                </Disclosure>
              </div>
            </section>

            {/* Avis clients */}
            <section id="avis" aria-labelledby="reviews-title" className="scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle id="reviews-title" eyebrow={c.reviewsEyebrow} title={c.reviewsTitle} />
              {reviewCount > 0 && averageRating !== null ? (
                <>
                  <div className="flex flex-col gap-5 rounded-xl bg-canvas p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="text-center sm:w-36 sm:shrink-0">
                      <p className="text-4xl font-extrabold text-ink tabular-nums">{formatDecimal(averageRating, locale)}</p>
                      <Stars rating={averageRating} className="mt-1 justify-center" />
                      <p className="mt-1 text-xs text-ink-secondary">{plural(reviewCount, c.reviewsShort)}</p>
                    </div>
                    <ul className="flex-1 space-y-1.5" aria-label={c.distributionAria}>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const n = reviews.filter((r) => Math.round(r.rating) === star).length;
                        return (
                          <li key={star} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="w-3 tabular-nums">{star}</span>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / reviewCount) * 100}%` }} />
                            </span>
                            <span className="w-6 text-end tabular-nums">{n}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {reviews.map((review) => (
                      <li key={review.id} className="py-5 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                            {review.author_name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink">{review.author_name}</p>
                            <div className="mt-0.5 flex items-center gap-2">
                              <Stars rating={review.rating} />
                              <time dateTime={review.created_at} className="text-xs text-ink-secondary">
                                {date(review.created_at, 'medium')}
                              </time>
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{review.comment}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-slate-400">
                    <Star className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-ink">{c.noReviews}</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink-secondary">
                    {c.noReviewsText}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ── Véhicules similaires (pleine largeur) ──────────────── */}
        {shownAlternatives.length > 0 && (
          <section aria-labelledby="similar-title" className="mt-12 lg:mt-16">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-text">
                  <span className="h-px w-7 bg-current" aria-hidden="true" />
                  {c.similarEyebrow}
                </p>
                <h2 id="similar-title" className="mt-2 text-2xl font-extrabold tracking-tight text-ink">
                  {c.similarTitle}
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">{checkedFree ? c.similarTextFree : c.similarText}</p>
              </div>
              <Link href={`${isMoto ? '/motos' : '/search'}${searchContext}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-ink hover:text-accent-text">
                {c.fullCatalog}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
            {/* Mobile : carrousel — tablette : 2 colonnes — desktop : 3 colonnes */}
            <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 xl:grid-cols-3">
              {shownAlternatives.map((alt) => (
                <li key={alt.id} className="w-[84%] shrink-0 snap-start sm:w-auto">
                  <VehicleCard
                    vehicle={alt}
                    period={period ?? undefined}
                    selectedDays={periodDays}
                    availabilityChecked={Boolean(checkedFree)}
                    location={requestedLocation}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/* PETITS COMPOSANTS                                                      */
/* ====================================================================== */

function SectionTitle({ id, eyebrow, title, subtitle }: { id: string; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-secondary">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{subtitle}</p>}
    </div>
  );
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  const { t, locale, fmt } = useTranslation();
  const rounded = Math.round(rating);
  return (
    <span className={cn('flex items-center gap-0.5', className)} role="img" aria-label={fmt(t.car.starsAria, { rating: formatDecimal(rating, locale) })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', i <= rounded ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} aria-hidden="true" />
      ))}
    </span>
  );
}

function Disclosure({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = React.useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-13 w-full items-center gap-3 px-4 text-start text-sm font-bold text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        <Icon className="h-4.5 w-4.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open} className="px-4 pb-4 ps-11 text-[13px] leading-relaxed text-slate-600">
        {children}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-canvas" role="status" aria-label={t.car.loadingVehicle}>
      <div className="h-11 border-b border-slate-200/80 bg-white" />
      <div className="mx-auto max-w-[1360px] animate-pulse px-4 pt-8 sm:px-6 lg:px-8 motion-reduce:animate-none">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-72 max-w-full rounded bg-slate-200" />
        <div className="mt-3 h-5 w-56 rounded bg-slate-200" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          <div className="aspect-[16/10] rounded-2xl bg-slate-200" />
          <div className="h-[520px] rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
