'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Vehicle } from '@/types';
import { CLICKDRIVE_WHATSAPP_NUMBER } from '@/lib/constants/contact';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatNumber } from '@/lib/i18n/format';
import { addDateDays, formatLocalDate, getEffectiveRentalDates, isValidDateOnly, type RentalPeriod } from '@/lib/utils/date-only';
import { calculateRentalDays, calculateRentalPrice, durationDiscountsFor } from '@/lib/utils/pricing';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BookingRequestModal } from './BookingRequestModal';
import { DurationDiscountTiers } from './DurationDiscountTiers';
import { priceReduction } from '@/lib/utils/promotion';
import { isMotorcycle } from '@/lib/vehicles/kind';

export type BookingAvailability = 'checking' | 'available' | 'unavailable' | 'error';

interface BookingCardProps {
  vehicle: Vehicle;
  /** Dates choisies dans la recherche : reprises si elles sont encore possibles (sinon aujourd'hui + 3 jours) */
  requestedPeriod?: RentalPeriod;
  /** Remonte la disponibilité réelle pour les dates choisies (badges de la fiche). */
  onAvailabilityChange?: (availability: BookingAvailability) => void;
  /** Lieu de prise en charge choisi dans la recherche, repris par la demande */
  defaultLocation?: string;
  /**
   * Remonte la période affichée (null tant qu'elle est invalide) ; `chosen` : dates modifiées ici par
   * le visiteur, et non reprises de l'adresse ou proposées par défaut.
   */
  onPeriodChange?: (period: RentalPeriod | null, chosen: boolean) => void;
}

function getInitialDates(requested?: RentalPeriod) {
  // Dates locales (et non UTC) pour éviter un décalage d'un jour autour de minuit
  const today = formatLocalDate(new Date());
  // Même règle que la barre de recherche : départ passé → aujourd'hui, retour invalide → départ + 3 jours
  const period = getEffectiveRentalDates(requested?.startDate ?? '', requested?.endDate ?? '', today);
  return { today, ...period };
}

const fieldClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-canvas px-3 text-[15px] font-semibold text-ink transition focus:border-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/10 aria-[invalid=true]:border-brand aria-[invalid=true]:bg-brand-soft sm:text-sm';

const labelClass = 'mb-1.5 block text-xs font-bold text-slate-600';

export function BookingCard({ vehicle, requestedPeriod, onAvailabilityChange, defaultLocation, onPeriodChange }: BookingCardProps) {
  const uid = useId();
  const mobileBarRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const { t, locale, fmt, plural, money } = useTranslation();
  const c = t.booking.card;
  // Devise de la langue (« DH », « درهم ») : même libellé que le reste du site
  const formatMad = money;
  const currency = t.common.currency;

  // Bouton « Réserver » de la carte visible à l'écran : la barre fixe mobile, qui ferait doublon, s'efface.
  const [submitInView, setSubmitInView] = useState(false);
  useEffect(() => {
    const submit = submitRef.current;
    if (!submit) return;
    const observer = new IntersectionObserver(([entry]) => setSubmitInView(Boolean(entry?.isIntersecting)));
    observer.observe(submit);
    return () => observer.disconnect();
  }, []);

  // Barre de réservation fixe (mobile / tablette) : sa hauteur est publiée dans --cd-bottom-bar
  // pour que la page lui laisse la place et que la bannière cookies se pose au-dessus, sans la masquer.
  // Barre effacée : 0, la bannière cookies redescend en bas de l'écran.
  useEffect(() => {
    const bar = mobileBarRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty('--cd-bottom-bar', submitInView ? '0px' : `${Math.round(bar.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cd-bottom-bar');
    };
  }, [submitInView]);
  const [initialDates] = useState(() => getInitialDates(requestedPeriod));
  const today = initialDates.today;

  // Seules les dates (prix et disponibilité) sont demandées ici : heures, point de rencontre
  // et restitution sont choisis à l'étape « Location » de la demande, qui les détaille.
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [datesChosen, setDatesChosen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availability, setAvailability] = useState<BookingAvailability>('checking');
  // Relance manuelle de la vérification après un échec
  const [checkNonce, setCheckNonce] = useState(0);

  // Période valide : départ dès aujourd'hui, retour au moins le lendemain
  const datesErrorKind: 'start' | 'end' | null =
    !isValidDateOnly(startDate) || startDate < today ? 'start' : !isValidDateOnly(endDate) || endDate <= startDate ? 'end' : null;
  const datesError = datesErrorKind === 'start' ? c.datesStartError : datesErrorKind === 'end' ? c.datesEndError : null;

  useEffect(() => {
    onAvailabilityChange?.(availability);
  }, [availability, onAvailabilityChange]);

  useEffect(() => {
    onPeriodChange?.(datesError ? null : { startDate, endDate }, datesChosen);
  }, [startDate, endDate, datesError, datesChosen, onPeriodChange]);

  const focusDates = () => {
    const input = document.getElementById('booking-start-date');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (datesError) return;
    let active = true;
    // `background` : rafraîchissement (retour sur l'onglet, minuterie). L'état connu reste affiché
    // pendant la vérification, pour ne pas désactiver « Réserver » au moment où l'utilisateur clique.
    const check = async (background = false) => {
      if (!background) setAvailability('checking');
      try {
        const query = new URLSearchParams({ startDate, endDate });
        const response = await fetch(
          `/api/vehicles/${encodeURIComponent(vehicle.id)}/availability?${query}`,
          { cache: 'no-store' }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Échec de la vérification.');
        }
        if (active) setAvailability(result.data.status === 'AVAILABLE' ? 'available' : 'unavailable');
      } catch {
        // Vérification impossible : état « non vérifié », jamais « disponible » (fail-closed)
        if (active) setAvailability('error');
      }
    };

    void check();
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void check(true);
    };
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void check(true);
    }, 30_000);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [endDate, startDate, vehicle.id, datesError, checkNonce]);

  // Même moteur de calcul que le serveur (durée et montant)
  const totalDays = calculateRentalDays(startDate, endDate);
  // Tarif semaine ou mois de l'agence appliqué dès 7 ou 30 jours (même calcul que le serveur)
  // Tarifs semaine / mois du véhicule et remises longue durée de l'agence : même calcul que le serveur
  const pricing = calculateRentalPrice(vehicle, totalDays);
  const durationTiers = durationDiscountsFor(vehicle.agency, vehicle);
  // Remise longue durée réellement appliquée (meilleur prix) et économie réalisée sur le prix plein
  const durationShown = pricing.applied_rate === 'duration' && pricing.duration_discount !== null && !datesError;
  const durationSaving = Math.max(0, pricing.full_price - pricing.subtotal);
  // Réduction obtenue sur la période (remise ou tarif semaine / mois) : même règle que le catalogue
  const reduction = datesError ? null : priceReduction(pricing);

  // Une demande n'est possible que sur une disponibilité vérifiée
  const canBook = !datesError && availability === 'available';
  const retryCheck = () => setCheckNonce((value) => value + 1);

  const openBooking = () => {
    if (availability === 'error' && !datesError) {
      retryCheck();
      return;
    }
    if (!canBook) {
      focusDates();
      return;
    }
    setIsModalOpen(true);
  };

  const statusPill =
    datesError ? null : availability === 'checking' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {c.checking}
      </span>
    ) : availability === 'unavailable' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-action-hover">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {c.unavailableDates}
      </span>
    ) : availability === 'error' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {c.notVerified}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {c.availableDates}
      </span>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-34px_rgba(11,18,32,0.35)]">
      {/* ── Prix ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="leading-none">
            <span className="text-[32px] font-extrabold tracking-tight text-ink tabular-nums">
              {formatNumber(vehicle.daily_price, locale)}
            </span>
            <span className="ms-1.5 text-sm font-bold text-ink">{currency}</span>
            <span className="ms-1 text-sm font-medium text-ink-secondary">{c.perDay}</span>
          </p>
          <div aria-live="polite">{statusPill}</div>
        </div>
        {/* Tarifs longue durée de l'agence (appliqués automatiquement dès 7 ou 30 jours) */}
        {(Number(vehicle.weekly_price) > 0 || Number(vehicle.monthly_price) > 0) && (
          <p className="mt-2 text-[13px] font-semibold text-emerald-700">
            {[
              Number(vehicle.weekly_price) > 0 ? fmt(c.perWeek, { amount: formatNumber(Number(vehicle.weekly_price), locale) }) : null,
              Number(vehicle.monthly_price) > 0 ? fmt(c.perMonth, { amount: formatNumber(Number(vehicle.monthly_price), locale) }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {/* Remises longue durée de l'agence pour ce type de véhicule (voiture ou moto), appliquées automatiquement au total */}
        <DurationDiscountTiers
          tiers={durationTiers}
          applied={durationShown ? pricing.duration_discount : null}
          days={totalDays}
          showNext={!datesError}
          reduction={reduction}
        />
        {(vehicle.deposit ?? 0) > 0 && (
          <p className="mt-2 text-[13px] text-ink-secondary">
            {c.deposit} <strong className="font-bold text-slate-700">{formatMad(vehicle.deposit)}</strong>
          </p>
        )}
      </div>

      {/* ── Formulaire ───────────────────────────────────────────── */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          openBooking();
        }}
        className="space-y-4 p-5"
      >
        <fieldset>
          <legend className="sr-only">{c.period}</legend>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="booking-start-date" className={labelClass}>
                {c.departure}
              </label>
              <input
                id="booking-start-date"
                type="date"
                required
                min={today}
                value={startDate}
                aria-invalid={datesErrorKind === 'start'}
                aria-describedby={datesError ? `${uid}-dates-error` : undefined}
                onChange={(e) => {
                  setDatesChosen(true);
                  setStartDate(e.target.value);
                  if (isValidDateOnly(e.target.value) && e.target.value >= endDate) {
                    setEndDate(addDateDays(e.target.value, 1));
                  }
                }}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-end-date`} className={labelClass}>
                {c.return}
              </label>
              <input
                id={`${uid}-end-date`}
                type="date"
                required
                min={isValidDateOnly(startDate) ? addDateDays(startDate, 1) : today}
                value={endDate}
                aria-invalid={datesErrorKind === 'end'}
                aria-describedby={datesError ? `${uid}-dates-error` : undefined}
                onChange={(e) => {
                  setDatesChosen(true);
                  setEndDate(e.target.value);
                }}
                className={fieldClass}
              />
            </div>
          </div>
          {datesError ? (
            <p id={`${uid}-dates-error`} role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold text-action-hover">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {datesError}
            </p>
          ) : availability === 'unavailable' ? (
            <p className="mt-2 text-[13px] text-action-hover">
              {c.alreadyBooked}
            </p>
          ) : availability === 'error' ? (
            <div role="alert" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
              <p>{c.checkFailed}</p>
              <button
                type="button"
                onClick={retryCheck}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-xs font-bold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
              >
                {c.retryCheck}
              </button>
            </div>
          ) : null}
        </fieldset>

        {/* Bouton juste après les dates : visible dès le chargement, même sur un écran de portable peu haut.
            Le détail du prix suit (le total figure aussi dans la barre mobile). */}
        <button
          ref={submitRef}
          type="submit"
          disabled={availability === 'checking' && !datesError}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-action px-5 text-[15px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(230,57,70,0.8)] transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none aria-disabled:bg-ink aria-disabled:shadow-none aria-disabled:hover:bg-slate-800"
          // Pendant la vérification, le bouton est réellement désactivé (gris lisible) : pas d'aria-disabled,
          // dont le style sombre s'ajoutait au gris et rendait « Vérification… » illisible (2,5:1)
          aria-disabled={(!canBook && !(availability === 'checking' && !datesError)) || undefined}
        >
          {availability === 'checking' && !datesError ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {c.checkingAvailability}
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {canBook ? c.bookVehicle : availability === 'error' && !datesError ? c.retryCheck : c.otherDates}
            </>
          )}
        </button>

        {/* ── Récapitulatif tarifaire ─────────────────────────────── */}
        <div className="rounded-xl bg-canvas p-4 text-sm" aria-live="polite">
          <dl className="space-y-2">
            {durationShown ? (
              <>
                {/* Prix plein, remise en clair, puis total : le client voit d'où vient le montant */}
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>
                    {formatMad(Number(vehicle.daily_price))} × {plural(pricing.number_of_days, c.days)}
                  </dt>
                  <dd className="font-semibold text-ink tabular-nums">{formatMad(pricing.full_price)}</dd>
                </div>
                <div className="flex justify-between gap-3 font-semibold text-emerald-800">
                  <dt>{fmt(c.durationLine, { percent: formatNumber(pricing.duration_discount?.percent ?? 0, locale) })}</dt>
                  <dd className="tabular-nums">−{formatMad(durationSaving)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-3 text-slate-600">
                <dt>
                  {formatMad(pricing.daily_price)} × {plural(pricing.number_of_days, c.days)}
                  {(pricing.applied_rate === 'weekly' || pricing.applied_rate === 'monthly') && (
                    <span className="block text-xs font-semibold text-emerald-700">
                      {pricing.applied_rate === 'monthly' ? c.monthlyApplied : c.weeklyApplied}
                      {reduction && ` · ${fmt(c.durationSaved, { amount: formatMad(reduction.saving) })}`}
                    </span>
                  )}
                </dt>
                <dd className="font-semibold text-ink tabular-nums">{formatMad(pricing.subtotal)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-slate-600">
              <dt>{c.serviceFee}</dt>
              <dd className="font-semibold text-emerald-700">{c.free}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base font-extrabold text-ink">
              <dt>{c.estimatedTotal}</dt>
              <dd className="tabular-nums">{datesError ? '—' : formatMad(pricing.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            {isMotorcycle(vehicle) ? c.optionsMoto : c.optionsCar}
          </p>
        </div>

        <ul className="space-y-2 text-[13px] text-slate-600">
          <li className="flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {c.payAtAgency}
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {c.contractByAgency}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {c.agencyConfirms}
          </li>
        </ul>

        <a
          href={`https://wa.me/${CLICKDRIVE_WHATSAPP_NUMBER}?text=${encodeURIComponent(fmt(c.whatsappQuestion, { vehicle: `${vehicle.brand} ${vehicle.model} (${vehicle.year})` }))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-slate-600 transition-colors hover:text-ink"
        >
          <MessageSquare className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          {c.question}
        </a>
      </form>

      {/* Monté à l'ouverture pour reprendre les dates saisies ci-dessus */}
      {isModalOpen && (
        <BookingRequestModal
          vehicle={vehicle}
          isOpen
          onClose={() => setIsModalOpen(false)}
          defaultStartDate={startDate}
          defaultEndDate={endDate}
          defaultLocation={defaultLocation}
        />
      )}

      {/* ── Barre de réservation mobile / tablette (< 1024 px) ──────
          Effacée (et retirée du clavier) quand le bouton de la carte est à l'écran. */}
      <div
        ref={mobileBarRef}
        inert={submitInView}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(11,18,32,0.1)] backdrop-blur-xl transition-transform duration-fast motion-reduce:transition-none lg:hidden',
          submitInView && 'translate-y-full shadow-none'
        )}
      >
        <div className="min-w-0">
          <p className="leading-none">
            <span className="text-lg font-extrabold text-ink tabular-nums">{formatNumber(vehicle.daily_price, locale)}</span>
            <span className="ms-1 text-xs font-bold text-ink">{currency}</span>
            <span className="ms-1 text-xs text-ink-secondary">{c.perDay}</span>
          </p>
          <p className="mt-1 truncate text-xs text-ink-secondary">
            {datesError
              ? c.fixDates
              : availability === 'unavailable'
                ? c.unavailableDates
                : availability === 'error'
                  ? c.notVerified
                  : fmt(c.totalShort, { amount: formatMad(pricing.total), days: plural(pricing.number_of_days, c.days) })}
          </p>
        </div>
        <button
          type="button"
          onClick={openBooking}
          disabled={availability === 'checking' && !datesError}
          className={cn(
            'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition-colors motion-press disabled:bg-slate-200 disabled:text-slate-600 sm:max-w-xs',
            canBook ? 'bg-action hover:bg-action-hover' : 'bg-ink hover:bg-slate-800'
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {availability === 'checking' && !datesError
            ? c.checking
            : canBook
              ? c.book
              : availability === 'error' && !datesError
                ? c.retry
                : c.changeDates}
        </button>
      </div>
    </div>
  );
}
