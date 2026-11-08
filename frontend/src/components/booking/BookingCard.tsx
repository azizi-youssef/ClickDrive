'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Vehicle } from '@/types';
import { formatNumber } from '@/lib/utils';
import { LOCATIONS_NADOR } from '@/lib/constants/catalog';
import { addDateDays, formatLocalDate, isValidDateOnly } from '@/lib/utils/date-only';
import { calculateBookingPrice, calculateRentalDays } from '@/lib/utils/pricing';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BookingRequestModal } from './BookingRequestModal';
import { isMotorcycle } from '@/lib/vehicles/kind';

export type BookingAvailability = 'checking' | 'available' | 'unavailable' | 'error';

interface BookingCardProps {
  vehicle: Vehicle;
  /** Remonte la disponibilité réelle pour les dates choisies (badges de la fiche). */
  onAvailabilityChange?: (availability: BookingAvailability) => void;
}

const DEFAULT_LOCATION = LOCATIONS_NADOR[0] ?? 'Aeroport Nador Al-Aroui (NDR)';
const SAME_LOCATION = '';

function getInitialDates() {
  // Dates locales (et non UTC) pour éviter un décalage d'un jour autour de minuit
  const today = formatLocalDate(new Date());
  return { today, inThreeDays: addDateDays(today, 3) };
}

function formatMad(value: number): string {
  return `${formatNumber(value)} MAD`;
}

const fieldClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-[#F5F6F8] px-3 text-[15px] font-semibold text-[#0B1220] transition focus:border-[#0B1220] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1220]/10 aria-[invalid=true]:border-[#E63946] aria-[invalid=true]:bg-[#FFF6F7] sm:text-sm';

const labelClass = 'mb-1.5 block text-xs font-bold text-slate-600';

export function BookingCard({ vehicle, onAvailabilityChange }: BookingCardProps) {
  const uid = useId();
  const mobileBarRef = useRef<HTMLDivElement>(null);

  // Barre de réservation fixe (mobile / tablette) : sa hauteur est publiée dans --cd-bottom-bar
  // pour que la page lui laisse la place et que la bannière cookies se pose au-dessus, sans la masquer.
  useEffect(() => {
    const bar = mobileBarRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--cd-bottom-bar', `${Math.round(bar.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cd-bottom-bar');
    };
  }, []);
  const [initialDates] = useState(getInitialDates);
  const today = initialDates.today;

  const [startDate, setStartDate] = useState(initialDates.today);
  const [endDate, setEndDate] = useState(initialDates.inThreeDays);
  const [pickupTime, setPickupTime] = useState('10:00');
  const [dropoffTime, setDropoffTime] = useState('10:00');
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [dropoffLocation, setDropoffLocation] = useState(SAME_LOCATION);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availability, setAvailability] = useState<BookingAvailability>('checking');
  // Relance manuelle de la vérification après un échec
  const [checkNonce, setCheckNonce] = useState(0);

  // Période valide : départ dès aujourd'hui, retour au moins le lendemain
  const datesError = !isValidDateOnly(startDate) || startDate < today
    ? 'Choisissez une date de départ à partir d’aujourd’hui.'
    : !isValidDateOnly(endDate) || endDate <= startDate
      ? 'La date de retour doit être postérieure à la date de départ.'
      : null;

  useEffect(() => {
    onAvailabilityChange?.(availability);
  }, [availability, onAvailabilityChange]);

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
  const pricing = calculateBookingPrice(vehicle.daily_price, totalDays);

  // Une demande n'est possible que sur une disponibilité vérifiée
  const canBook = !datesError && availability === 'available';
  const retryCheck = () => setCheckNonce((value) => value + 1);
  const resolvedDropoff = dropoffLocation || location;

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
        Vérification…
      </span>
    ) : availability === 'unavailable' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF1F2] px-2.5 py-1 text-xs font-bold text-[#B4232F]">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Indisponible pour ces dates
      </span>
    ) : availability === 'error' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Disponibilité non vérifiée
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Disponible pour ces dates
      </span>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-34px_rgba(11,18,32,0.35)]">
      {/* ── Prix ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="leading-none">
            <span className="text-[32px] font-extrabold tracking-tight text-[#0B1220] tabular-nums">
              {formatNumber(vehicle.daily_price)}
            </span>
            <span className="ms-1.5 text-sm font-bold text-[#0B1220]">MAD</span>
            <span className="ms-1 text-sm font-medium text-slate-500">/ jour</span>
          </p>
          <div aria-live="polite">{statusPill}</div>
        </div>
        {(vehicle.deposit ?? 0) > 0 && (
          <p className="mt-2 text-[13px] text-slate-500">
            Caution remboursable : <strong className="font-bold text-slate-700">{formatMad(vehicle.deposit)}</strong>
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
        className="space-y-4 p-5 sm:p-6"
      >
        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#0B1220]">
            <CalendarDays className="h-4 w-4 text-accent-text" aria-hidden="true" />
            Période de location
          </legend>
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
            <div>
              <label htmlFor="booking-start-date" className={labelClass}>
                Départ
              </label>
              <input
                id="booking-start-date"
                type="date"
                required
                min={today}
                value={startDate}
                aria-invalid={Boolean(datesError && datesError.includes('départ'))}
                aria-describedby={datesError ? `${uid}-dates-error` : undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (isValidDateOnly(e.target.value) && e.target.value >= endDate) {
                    setEndDate(addDateDays(e.target.value, 1));
                  }
                }}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-pickup-time`} className={labelClass}>
                Heure
              </label>
              <input
                id={`${uid}-pickup-time`}
                type="time"
                step={1800}
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value || '10:00')}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-end-date`} className={labelClass}>
                Retour
              </label>
              <input
                id={`${uid}-end-date`}
                type="date"
                required
                min={isValidDateOnly(startDate) ? addDateDays(startDate, 1) : today}
                value={endDate}
                aria-invalid={Boolean(datesError && datesError.includes('retour'))}
                aria-describedby={datesError ? `${uid}-dates-error` : undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-dropoff-time`} className={labelClass}>
                Heure
              </label>
              <input
                id={`${uid}-dropoff-time`}
                type="time"
                step={1800}
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value || '10:00')}
                className={fieldClass}
              />
            </div>
          </div>
          {datesError ? (
            <p id={`${uid}-dates-error`} role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold text-[#B4232F]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {datesError}
            </p>
          ) : availability === 'unavailable' ? (
            <p className="mt-2 text-[13px] text-[#B4232F]">
              Ce véhicule est déjà réservé sur cette période. Essayez d’autres dates.
            </p>
          ) : availability === 'error' ? (
            <div role="alert" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
              <p>
                La disponibilité ne peut pas être vérifiée pour le moment. Aucune demande ne peut être envoyée tant que la
                vérification n’a pas abouti.
              </p>
              <button
                type="button"
                onClick={retryCheck}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-xs font-bold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
              >
                Réessayer la vérification
              </button>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#0B1220]">
            <MapPin className="h-4 w-4 text-accent-text" aria-hidden="true" />
            Lieux
          </legend>
          <div>
            <label htmlFor={`${uid}-pickup`} className={labelClass}>
              Prise en charge
            </label>
            <select id={`${uid}-pickup`} value={location} onChange={(e) => setLocation(e.target.value)} className={fieldClass}>
              {LOCATIONS_NADOR.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-dropoff`} className={labelClass}>
              Restitution
            </label>
            <select
              id={`${uid}-dropoff`}
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              className={fieldClass}
            >
              <option value={SAME_LOCATION}>Même lieu que la prise en charge</option>
              {LOCATIONS_NADOR.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        {/* ── Récapitulatif tarifaire ─────────────────────────────── */}
        <div className="rounded-xl bg-[#F5F6F8] p-4 text-sm" aria-live="polite">
          <dl className="space-y-2">
            <div className="flex justify-between gap-3 text-slate-600">
              <dt>
                {formatMad(vehicle.daily_price)} × {pricing.number_of_days} jour{pricing.number_of_days > 1 ? 's' : ''}
              </dt>
              <dd className="font-semibold text-[#0B1220] tabular-nums">{formatMad(pricing.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-slate-600">
              <dt>Frais de service ClickDrive</dt>
              <dd className="font-semibold text-emerald-700">Offerts</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base font-extrabold text-[#0B1220]">
              <dt>Total estimé</dt>
              <dd className="tabular-nums">{datesError ? '—' : formatMad(pricing.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {isMotorcycle(vehicle)
              ? 'Options éventuelles (conducteur additionnel, équipements) et caution confirmées par l’agence.'
              : 'Options éventuelles (siège enfant, conducteur additionnel) et caution confirmées par l’agence.'}
          </p>
        </div>

        <button
          type="submit"
          disabled={availability === 'checking' && !datesError}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-action px-5 text-[15px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(230,57,70,0.8)] transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1220] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none aria-disabled:bg-slate-300 aria-disabled:shadow-none"
          aria-disabled={!canBook || undefined}
        >
          {availability === 'checking' && !datesError ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Vérification de la disponibilité…
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {canBook ? 'Réserver ce véhicule' : availability === 'error' && !datesError ? 'Réessayer la vérification' : 'Choisir d’autres dates'}
            </>
          )}
        </button>

        <ul className="space-y-2 text-[13px] text-slate-600">
          <li className="flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            Aucun paiement en ligne — règlement à l’agence
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            Contrat établi directement par l’agence
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            L’agence confirme la disponibilité de votre demande
          </li>
        </ul>

        <a
          href={`https://wa.me/212661987654?text=${encodeURIComponent(`Bonjour ClickDrive, j'ai une question sur le véhicule ${vehicle.brand} ${vehicle.model} (${vehicle.year}) avant d'envoyer ma demande.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-slate-600 transition-colors hover:text-[#0B1220]"
        >
          <MessageSquare className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Une question ? Conciergerie ClickDrive
        </a>
      </form>

      {/* Monté à l'ouverture pour reprendre les dates, heures et lieux saisis ci-dessus */}
      {isModalOpen && (
        <BookingRequestModal
          vehicle={vehicle}
          isOpen
          onClose={() => setIsModalOpen(false)}
          defaultStartDate={startDate}
          defaultEndDate={endDate}
          defaultLocation={location}
          defaultPickupTime={pickupTime}
          defaultDropoffTime={dropoffTime}
          defaultDropoffLocation={resolvedDropoff}
        />
      )}

      {/* ── Barre de réservation mobile / tablette (< 1024 px) ────── */}
      <div ref={mobileBarRef} className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(11,18,32,0.1)] backdrop-blur-xl lg:hidden">
        <div className="min-w-0">
          <p className="leading-none">
            <span className="text-lg font-extrabold text-[#0B1220] tabular-nums">{formatNumber(vehicle.daily_price)}</span>
            <span className="ms-1 text-xs font-bold text-[#0B1220]">MAD</span>
            <span className="ms-1 text-xs text-slate-500">/ jour</span>
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {datesError
              ? 'Dates à corriger'
              : availability === 'unavailable'
                ? 'Indisponible pour ces dates'
                : availability === 'error'
                  ? 'Disponibilité non vérifiée'
                  : `Total ${formatMad(pricing.total)} · ${pricing.number_of_days} j`}
          </p>
        </div>
        <button
          type="button"
          onClick={openBooking}
          disabled={availability === 'checking' && !datesError}
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition-colors active:scale-[0.99] disabled:bg-slate-300 sm:max-w-xs ${
            canBook ? 'bg-[#E63946] hover:bg-[#C92F3B]' : 'bg-[#0B1220] hover:bg-slate-800'
          }`}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {availability === 'checking' && !datesError
            ? 'Vérification…'
            : canBook
              ? 'Réserver'
              : availability === 'error' && !datesError
                ? 'Réessayer'
                : 'Changer les dates'}
        </button>
      </div>
    </div>
  );
}
