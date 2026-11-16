'use client';

import React, { memo, useState, useCallback, useRef } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import {
  Gauge,
  Users,
  Fuel,
  ShieldCheck,
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  BellRing,
  CalendarClock,
  CarFront,
  Motorbike,
  IdCard,
  BadgePercent,
} from 'lucide-react';
import type { Vehicle } from '@/types';
import { formatEngineCc, isMotorcycle } from '@/lib/vehicles/kind';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatDecimal, formatNumber } from '@/lib/i18n/format';
import { categoryLabel, fuelLabel, transmissionLabel } from '@/lib/i18n/labels';
import type { VehicleMessages } from '@/lib/i18n/messages/vehicle';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { isOptimizableImage } from '@/lib/utils/images';
import type { RentalPeriod } from '@/lib/utils/date-only';
import { searchContextQuery } from '@/lib/catalog/search-context';
import { calculateRentalPrice, durationDiscountsFor } from '@/lib/utils/pricing';
import { priceReduction } from '@/lib/utils/promotion';
import { toggleFavorite, useFavoriteIds } from '@/lib/ui/use-favorites';

interface VehicleCardProps {
  vehicle: Vehicle;
  priority?: boolean;
  availabilityChecked?: boolean;
  onFavorite?: (id: string) => void;
  isFavorite?: boolean;
  /** Nombre de jours sélectionnés dans la barre de dates (pour afficher le prix total) */
  selectedDays?: number;
  /** Dates de la recherche : transmises à la fiche, qui les reprend au lieu de repartir d'aujourd'hui */
  period?: RentalPeriod;
  /** Lieu de prise en charge de la recherche : transmis à la fiche, repris par la demande */
  location?: string;
  /** Abonnement « me prévenir » pour un véhicule indisponible (bouton masqué si absent) */
  onNotify?: (vehicleId: string) => void;
}

const MIN_REVIEWS_FOR_RATING = 5;

const STATUS_STYLES = {
  available: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  reserved: { text: 'text-amber-700', dot: 'bg-amber-500' },
  rented: { text: 'text-sky-700', dot: 'bg-sky-500' },
  maintenance: { text: 'text-slate-600', dot: 'bg-slate-400' },
  unknown: { text: 'text-slate-600', dot: 'bg-slate-400' },
} as const;

type StatusLabelKey = keyof Pick<
  VehicleMessages['card'],
  'freeOnDates' | 'availableToday' | 'reserved' | 'rented' | 'maintenance' | 'unavailable'
>;

function resolveStatus(
  rawStatus?: string,
  checked?: boolean
): { isBookable: boolean; style: (typeof STATUS_STYLES)[keyof typeof STATUS_STYLES]; labelKey: StatusLabelKey } {
  // Avec des dates, l'API ne renvoie que les véhicules libres sur toute la période
  if (checked) return { isBookable: true, style: STATUS_STYLES.available, labelKey: 'freeOnDates' };
  switch (rawStatus) {
    case 'AVAILABLE':
      return { isBookable: true, style: STATUS_STYLES.available, labelKey: 'availableToday' };
    case 'RESERVED':
      return { isBookable: false, style: STATUS_STYLES.reserved, labelKey: 'reserved' };
    case 'RENTED':
      return { isBookable: false, style: STATUS_STYLES.rented, labelKey: 'rented' };
    case 'MAINTENANCE':
      return { isBookable: false, style: STATUS_STYLES.maintenance, labelKey: 'maintenance' };
    default:
      return { isBookable: false, style: STATUS_STYLES.unknown, labelKey: 'unavailable' };
  }
}

/**
 * Squelette calqué sur la carte réelle (mêmes marges et hauteurs de lignes) : quand les résultats
 * arrivent, la grille garde sa hauteur et rien ne saute (CLS). Reflet animé, figé si l'utilisateur
 * réduit les animations (voir .skeleton dans globals.css).
 */
export function VehicleCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="skeleton aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col p-4">
        {/* Marque (11 px) puis modèle (17 px) */}
        <div className="flex h-4 items-center">
          <div className="skeleton h-2.5 w-16 rounded-full" />
        </div>
        <div className="mt-0.5 flex h-6 items-center">
          <div className="skeleton h-4 w-40 rounded-md" />
        </div>
        {/* Caractéristiques */}
        <div className="mt-3 flex h-5 items-center gap-3.5">
          <div className="skeleton h-3.5 w-20 rounded-full" />
          <div className="skeleton h-3.5 w-14 rounded-full" />
          <div className="skeleton h-3.5 w-16 rounded-full" />
        </div>
        {/* Agence */}
        <div className="mt-3.5 flex h-10 items-center gap-2 rounded-xl bg-[#F5F6F8] px-2.5">
          <div className="skeleton h-6 w-6 rounded-md" />
          <div className="skeleton h-3 w-28 rounded-full" />
        </div>
        {/* Prix + action */}
        <div className="mt-auto pt-4">
          <div className="flex h-[22px] items-end">
            <div className="skeleton h-5 w-28 rounded-md" />
          </div>
          <div className="skeleton mt-3 h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Écran tactile : flèches de 44 px (zone tactile minimale), 36 px à la souris
const ARROW_BASE =
  'absolute top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-full bg-white/95 shadow-md backdrop-blur-sm transition-[opacity,transform,background-color] duration-150 hover:bg-white hover:scale-105 active:scale-95 ' +
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1220]';

function VehicleGallery({
  images,
  brand,
  model,
  agencyCity,
  priority,
  unavailable,
  isMoto = false,
}: {
  images: string[];
  brand: string;
  model: string;
  agencyCity?: string;
  priority: boolean;
  unavailable: boolean;
  isMoto?: boolean;
}) {
  const { t, fmt, isRTL } = useTranslation();
  const card = t.vehicle.card;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(() => new Set([0, 1]));
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(() => new Set());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  const imagesKey = images.join('|');
  const [prevImagesKey, setPrevImagesKey] = useState(imagesKey);
  if (prevImagesKey !== imagesKey) {
    setPrevImagesKey(imagesKey);
    setCurrentIndex(0);
    setLoadedIndexes(new Set([0, 1]));
    setFailedIndexes(new Set());
  }

  const goTo = useCallback(
    (dir: 1 | -1, e?: React.MouseEvent | React.SyntheticEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setCurrentIndex((prev) => {
        const next = (prev + dir + images.length) % images.length;
        setLoadedIndexes((current) => {
          const nextSet = new Set(current);
          nextSet.add(next);
          nextSet.add((next + 1) % images.length);
          nextSet.add((next - 1 + images.length) % images.length);
          return nextSet;
        });
        return next;
      });
    },
    [images.length]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (images.length <= 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || images.length <= 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      swipedRef.current = true;
      const step = deltaX > 0 ? (isRTL ? 1 : -1) : (isRTL ? -1 : 1);
      goTo(step as 1 | -1);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
    }
  };

  const handleMouseEnter = () => {
    if (images.length > 1) {
      setLoadedIndexes((current) => {
        if (current.has(1)) return current;
        const nextSet = new Set(current);
        nextSet.add(1);
        return nextSet;
      });
    }
  };

  if (images.length === 0) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-linear-to-b from-[#EEF0F3] to-[#F5F6F8]">
        <div
          role="img"
          aria-label={fmt(card.photoUnavailable, { name: `${brand} ${model}` })}
          className="flex h-full w-full items-center justify-center text-slate-300"
        >
          {isMoto ? (
            <Motorbike className="h-14 w-14" strokeWidth={1.25} aria-hidden="true" />
          ) : (
            <CarFront className="h-14 w-14" strokeWidth={1.25} aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden bg-linear-to-b from-[#EEF0F3] to-[#F5F6F8]"
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
    >
      <div
        className={cn(
          'absolute inset-0 transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.03]',
          unavailable && 'opacity-60 saturate-[0.35]'
        )}
      >
        <div
          dir="ltr"
          className="flex h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {images.map((img, i) => {
            const isFailed = failedIndexes.has(i);
            const shouldRender = loadedIndexes.has(i) || i === 0;

            return (
              <div key={i} className="relative h-full w-full shrink-0 basis-full">
                {isFailed ? (
                  <div
                    role="img"
                    aria-label={fmt(card.photoUnavailable, { name: `${brand} ${model}` })}
                    className="flex h-full w-full items-center justify-center text-slate-300"
                  >
                    {isMoto ? (
                      <Motorbike className="h-14 w-14" strokeWidth={1.25} aria-hidden="true" />
                    ) : (
                      <CarFront className="h-14 w-14" strokeWidth={1.25} aria-hidden="true" />
                    )}
                  </div>
                ) : shouldRender ? (
                  <Image
                    src={img}
                    alt={`${fmt(agencyCity ? card.photoAltCity : card.photoAlt, {
                      name: `${brand} ${model}`,
                      city: agencyCity ?? '',
                    })}${
                      images.length > 1
                        ? fmt(card.photoIndex, { index: i + 1, total: images.length })
                        : ''
                    }`}
                    fill
                    priority={priority && i === 0}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px"
                    className="object-cover"
                    unoptimized={!isOptimizableImage(img)}
                    onError={() => setFailedIndexes((prev) => new Set(prev).add(i))}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-100" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/35 to-transparent" />

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => goTo(-1, e)}
            className={cn(ARROW_BASE, 'start-2')}
            aria-label={card.previousImage}
          >
            <ChevronLeft className="h-4 w-4 text-slate-700 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => goTo(1, e)}
            className={cn(ARROW_BASE, 'end-2')}
            aria-label={card.nextImage}
          >
            <ChevronRight className="h-4 w-4 text-slate-700 rtl:rotate-180" aria-hidden="true" />
          </button>

          {/* Indicateur de position, non cliquable : à 6 px, les points étaient des cibles trop petites
              (WCAG 2.5.8). La navigation passe par les flèches (36 px) et le glissement au doigt. */}
          <div
            className="pointer-events-none absolute bottom-3 end-3 z-20 flex items-center gap-1.5"
            aria-hidden="true"
          >
            {images.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none',
                  i === currentIndex ? 'w-4 bg-white shadow-xs' : 'w-1.5 bg-white/60'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VehicleCardComponent({
  vehicle,
  priority = false,
  availabilityChecked = false,
  onFavorite,
  isFavorite: externalFavorite,
  selectedDays,
  period,
  location,
  onNotify,
}: VehicleCardProps) {
  const { t, locale, fmt, plural, date, money } = useTranslation();
  const card = t.vehicle.card;
  // Devise de la langue (« DH », « درهم ») : même libellé que le reste du site
  const mad = money;
  // Favoris mémorisés dans le navigateur (partagés avec la fiche et le filtre du catalogue)
  const favoriteIds = useFavoriteIds();
  const isFavorite = externalFavorite ?? favoriteIds.includes(vehicle.id);

  const images = vehicle.images ?? [];
  const { isBookable, style: status, labelKey } = resolveStatus(vehicle.status, availabilityChecked);
  const agency = vehicle.agency;
  const reviewCount = agency?.review_count ?? 0;
  const agencyRating = typeof agency?.rating === 'number' ? agency.rating : null;
  const showRating = agencyRating !== null && reviewCount >= MIN_REVIEWS_FOR_RATING;
  const vehicleName = `${vehicle.brand} ${vehicle.model}`;
  const detailsHref = `/cars/${encodeURIComponent(vehicle.slug)}${searchContextQuery(period, location)}`;
  // Total de la période : tarifs semaine / mois et remises longue durée inclus (même calcul que la réservation)
  const rental = selectedDays && selectedDays > 0 ? calculateRentalPrice(vehicle, selectedDays) : null;
  const totalPrice = rental ? rental.total : null;
  // Remise longue durée de l'agence : appliquée à la période choisie, sinon palier d'entrée annoncé
  // (les paliers des motos sont distincts de ceux des voitures)
  const entryDiscount = durationDiscountsFor(vehicle.agency, vehicle)[0] ?? null;
  // Réduction obtenue sur la période choisie (remise, tarif semaine ou mois) : prix barré et économie
  const reduction = rental ? priceReduction(rental) : null;
  const promoLabel = reduction
    ? reduction.kind === 'duration'
      ? fmt(card.discountApplied, { percent: formatNumber(reduction.percent, locale) })
      : reduction.kind === 'monthly'
        ? card.monthlyRateApplied
        : card.weeklyRateApplied
    : entryDiscount
      ? fmt(card.discountFrom, { percent: formatNumber(entryDiscount.percent, locale), days: formatNumber(entryDiscount.min_days, locale) })
      : null;
  const isMoto = isMotorcycle(vehicle);
  const engineCc = formatEngineCc(vehicle.engine_cc);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onFavorite) onFavorite(vehicle.id);
      else toggleFavorite(vehicle.id);
    },
    [onFavorite, vehicle.id]
  );

  const handleNotify = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onNotify?.(vehicle.id);
    },
    [onNotify, vehicle.id]
  );

  return (
    <article
      className={cn(
        // Apparition en CSS (framer-motion retiré des pages de liste)
        'animate-cd-fade-in motion-reduce:animate-none group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white transition-[box-shadow,border-color,transform] duration-300 motion-reduce:transition-none',
        'border-slate-200/80 shadow-[0_1px_2px_rgba(11,18,32,0.05)]',
        'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_-18px_rgba(11,18,32,0.28)] focus-within:border-[#0B1220] motion-reduce:hover:translate-y-0'
      )}
    >
      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <div className="relative shrink-0">
        <VehicleGallery
          images={images}
          brand={vehicle.brand}
          model={vehicle.model}
          agencyCity={agency?.city}
          priority={priority}
          unavailable={!isBookable}
          isMoto={isMoto}
        />

        {/* Statut — pastille + texte (jamais la couleur seule) */}
        <span
          className={cn(
            'absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur-sm',
            status.text
          )}
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status.dot)} aria-hidden="true" />
          {card[labelKey]}
        </span>

        {/* Promotion : pleine quand elle s'applique aux dates choisies, claire quand elle est annoncée */}
        {promoLabel && (
          <span
            className={cn(
              'pointer-events-none absolute start-3 top-12 z-10 inline-flex max-w-[calc(100%-4.5rem)] items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm',
              reduction ? 'bg-emerald-700 text-white' : 'bg-white/95 text-emerald-800 backdrop-blur-sm'
            )}
          >
            <BadgePercent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{promoLabel}</span>
          </span>
        )}

        <button
          type="button"
          onClick={handleFavorite}
          aria-pressed={isFavorite}
          aria-label={fmt(isFavorite ? card.removeFavorite : card.addFavorite, { name: vehicleName })}
          className={cn(
            'absolute end-2.5 top-2.5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-sm transition-[color,scale] duration-200 active:scale-110 motion-reduce:active:scale-100',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]',
            isFavorite ? 'text-accent-text' : 'text-slate-500 hover:text-accent-text'
          )}
        >
          <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} aria-hidden="true" />
        </button>

        <span className="pointer-events-none absolute bottom-3 start-3 z-10 inline-flex items-center gap-1 rounded-md bg-[#0B1220]/75 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
          {isMoto && <Motorbike className="h-3.5 w-3.5" aria-hidden="true" />}
          {isMoto
            ? fmt(card.motoCategory, { category: categoryLabel(t, vehicle.category) })
            : categoryLabel(t, vehicle.category)}
        </span>
      </div>

      {/* ── Contenu ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {vehicle.brand}
        </p>
        <h3 className="mt-0.5 truncate text-[17px] font-extrabold leading-snug text-[#0B1220]">
          {vehicle.model}{' '}
          <span className="font-semibold text-slate-500">{vehicle.year}</span>
        </h3>

        <ul
          className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] font-medium text-slate-600"
          aria-label={isMoto ? card.specsMoto : card.specsCar}
        >
          <li className="inline-flex items-center gap-1.5">
            <Gauge className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            {transmissionLabel(t, vehicle.transmission)}
          </li>
          {isMoto && engineCc ? (
            <li className="inline-flex items-center gap-1.5">
              <Motorbike className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {engineCc}
            </li>
          ) : (
            <li className="inline-flex items-center gap-1.5">
              <Fuel className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {fuelLabel(t, vehicle.fuel)}
            </li>
          )}
          {isMoto && vehicle.license_required ? (
            <li className="inline-flex items-center gap-1.5">
              <IdCard className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {fmt(t.vehicle.license, { license: vehicle.license_required })}
            </li>
          ) : (
            <li className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {plural(vehicle.seats, t.vehicle.seats)}
            </li>
          )}
        </ul>

        {agency && (
          <div className="mt-3.5 flex min-w-0 items-center gap-2 rounded-xl bg-[#F5F6F8] px-2.5 py-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
              <AgencyLogo
                slug={agency.slug}
                name={agency.name}
                logoUrl={agency.logo_url}
                className="h-full w-full object-cover"
                size={24}
              />
            </div>
            <span className="min-w-0 truncate text-xs font-bold text-slate-700">{agency.name}</span>
            {agency.verified && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {card.verified}
              </span>
            )}
            <span className="ms-auto shrink-0 text-xs font-semibold text-ink-tertiary">
              {showRating ? (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={fmt(card.ratingAria, { rating: formatDecimal(agencyRating!, locale), count: reviewCount })}
                >
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {formatDecimal(agencyRating!, locale)}
                </span>
              ) : (
                card.newAgency
              )}
            </span>
          </div>
        )}

        {/* Prix + action */}
        <div className="mt-auto pt-4">
          {/* flex-wrap : sur une carte étroite, le total passe sous le prix au lieu de se couper (« 7 / j ») */}
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
            <p className="whitespace-nowrap leading-none">
              <span className="text-[22px] font-extrabold tabular-nums tracking-tight text-[#0B1220]">
                {formatNumber(vehicle.daily_price, locale)}
              </span>
              <span className="ms-1 text-xs font-bold text-[#0B1220]">{t.common.currency}</span>
              <span className="ms-1 text-xs font-medium text-slate-500">{card.perDay}</span>
            </p>
            {totalPrice !== null && !reduction ? (
              <p className="whitespace-nowrap text-end text-xs font-semibold text-slate-600">
                {mad(totalPrice)} · {plural(selectedDays ?? 0, t.vehicle.daysShort)}
              </p>
            ) : totalPrice === null && (vehicle.deposit ?? 0) > 0 ? (
              <p className="whitespace-nowrap text-end text-xs font-medium text-slate-500">
                {fmt(card.deposit, { amount: mad(vehicle.deposit) })}
              </p>
            ) : null}
          </div>

          {reduction && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-lg bg-emerald-50 px-2.5 py-1.5">
              <p className="whitespace-nowrap text-sm">
                <span className="font-extrabold tabular-nums text-ink">{mad(reduction.total)}</span>{' '}
                <span className="text-xs font-medium text-slate-600">
                  {fmt(card.totalFor, { days: plural(selectedDays ?? 0, t.vehicle.daysShort) })}
                </span>
              </p>
              <p className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                <span className="sr-only">{card.fullPriceLabel}</span>
                <s className="tabular-nums text-slate-500">{mad(reduction.full)}</s>
                <span className="font-bold text-emerald-800">{fmt(card.saving, { amount: mad(reduction.saving) })}</span>
              </p>
            </div>
          )}

          {!isBookable && vehicle.status === 'RENTED' && vehicle.available_from && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {fmt(card.availableFrom, { date: date(vehicle.available_from, 'dayMonth') })}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {/* Lien étiré : toute la carte mène à la fiche du véhicule */}
            <Link
              href={detailsHref}
              className={cn(
                'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-colors duration-200',
                'outline-none after:absolute after:inset-0 after:z-10 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[#E63946]',
                isBookable
                  ? 'bg-[#0B1220] text-white group-hover:bg-action'
                  : 'border border-slate-200 bg-white text-[#0B1220] group-hover:border-slate-300'
              )}
            >
              {card.viewDetails}
              <span className="sr-only">
                {fmt(card.viewDetailsSr, { name: vehicleName, year: vehicle.year, price: mad(vehicle.daily_price) })}
              </span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            {!isBookable && onNotify && (
              <button
                type="button"
                onClick={handleNotify}
                className="relative z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1220]"
                aria-label={fmt(card.notifyMe, { name: vehicleName })}
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export const VehicleCard = memo(VehicleCardComponent);
