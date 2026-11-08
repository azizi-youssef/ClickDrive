'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { brandLogo } from '@/lib/brand/logo';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Vehicle } from '@/types';
import { calculateBookingPrice, calculateRentalDays } from '@/lib/utils/pricing';
import { cn, formatNumber } from '@/lib/utils';
import { MEETING_POINTS, getMeetingPoint, type MeetingPoint } from '@/lib/constants/meetingPoints';
import { MeetingPointBadge } from './MeetingPointBadge';
import { addDateDays, formatLocalDate, isValidDateOnly } from '@/lib/utils/date-only';
import { notifyRealtimeChange } from '@/lib/supabase/realtime';
import { isMotorcycle, motorcycleLicenseLabel } from '@/lib/vehicles/kind';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import {
  AlertCircle,
  Anchor,
  ArrowLeft,
  ArrowRight,
  Baby,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageSquare,
  Pencil,
  Plane,
  Send,
  ShieldCheck,
  Sparkles,
  Train,
  UserPlus,
  X,
} from 'lucide-react';

interface BookingRequestModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultLocation?: string;
  /** Valeurs saisies dans la carte de réservation (facultatives) */
  defaultPickupTime?: string;
  defaultDropoffTime?: string;
  defaultDropoffLocation?: string;
}

type DeliveryType = 'AGENCY_PICKUP' | 'AIRPORT' | 'HOTEL' | 'ADDRESS';
type StepNumber = 1 | 2 | 3 | 4;
type FieldErrors = Partial<Record<
  | 'firstName' | 'lastName' | 'cin' | 'email' | 'phone' | 'birthDate' | 'licenseNumber' | 'licenseExpiry'
  | 'startDate' | 'endDate' | 'consent',
  string
>>;

const STEPS: { num: StepNumber; label: string; short: string }[] = [
  { num: 1, label: 'Vos coordonnées', short: 'Coordonnées' },
  { num: 2, label: 'Votre location', short: 'Location' },
  { num: 3, label: 'Options & notes', short: 'Options' },
  { num: 4, label: 'Vérification', short: 'Vérification' },
];

const COUNTRIES = ['Maroc', 'France', 'Espagne', 'Belgique', 'Pays-Bas', 'Allemagne', 'Autre'];

const DELIVERY_OPTIONS: { key: DeliveryType; label: string }[] = [
  { key: 'AIRPORT', label: 'Aéroport' },
  { key: 'AGENCY_PICKUP', label: 'En agence' },
  { key: 'HOTEL', label: 'Hôtel' },
  { key: 'ADDRESS', label: 'Adresse en ville' },
];

const FUEL_LABELS: Record<string, string> = { DIESEL: 'Diesel', GASOLINE: 'Essence', HYBRID: 'Hybride', ELECTRIC: 'Électrique' };

/** Aligne un lieu saisi ailleurs (ex. « Aeroport … ») sur le point de rendez-vous officiel correspondant. */
function toMeetingPointName(location?: string): string | undefined {
  if (!location) return undefined;
  const point = getMeetingPoint(location);
  return point.id === 'custom-location' ? location : point.name;
}

function deliveryTypeFor(location: string): DeliveryType {
  const type = getMeetingPoint(location).type;
  return type === 'AIRPORT' ? 'AIRPORT' : type === 'AGENCY' ? 'AGENCY_PICKUP' : 'ADDRESS';
}

function MeetingPointIcon({ point, className }: { point: MeetingPoint; className?: string }) {
  switch (point.type) {
    case 'AIRPORT':
      return <Plane className={className} aria-hidden="true" />;
    case 'PORT':
      return <Anchor className={className} aria-hidden="true" />;
    case 'AGENCY':
      return <Building2 className={className} aria-hidden="true" />;
    case 'RESORT':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'TRAIN':
      return <Train className={className} aria-hidden="true" />;
    default:
      return <MapPin className={className} aria-hidden="true" />;
  }
}

function formatMad(value: number): string {
  return `${formatNumber(value)} MAD`;
}

function formatLongDate(value: string): string {
  if (!isValidDateOnly(value)) return value;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Masque un numéro d'identité dans le récapitulatif (ex. S1•••56). */
function maskId(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return v;
  return `${v.slice(0, 2)}${'•'.repeat(Math.max(3, v.length - 4))}${v.slice(-2)}`;
}

function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = onDate.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

const inputClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] font-medium text-ink placeholder:text-slate-400 transition focus:border-ink focus:outline-none focus:ring-4 focus:ring-[#0B1220]/8 aria-[invalid=true]:border-brand aria-[invalid=true]:bg-[#FFF6F7] disabled:opacity-60 sm:text-sm';

function Field({
  id,
  label,
  required,
  optional,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-bold text-ink">
        {label}
        {required && (
          <span className="text-accent-text" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="text-xs font-medium text-slate-400">(facultatif)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1 text-[13px] font-semibold text-action-hover">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function BookingRequestModal({
  vehicle,
  isOpen,
  onClose,
  defaultStartDate,
  defaultEndDate,
  defaultLocation,
  defaultPickupTime,
  defaultDropoffTime,
  defaultDropoffLocation,
}: BookingRequestModalProps) {
  const uid = useId();
  const reduceMotion = useReducedMotion();
  const today = formatLocalDate(new Date());
  const requestedStartDate =
    defaultStartDate && isValidDateOnly(defaultStartDate) && defaultStartDate >= today
      ? defaultStartDate
      : today;
  const requestedEndDate =
    defaultEndDate && isValidDateOnly(defaultEndDate) && defaultEndDate > requestedStartDate
      ? defaultEndDate
      : addDateDays(requestedStartDate, 3);
  const initialPickup = toMeetingPointName(defaultLocation) ?? MEETING_POINTS[0].name;
  const initialDropoff = toMeetingPointName(defaultDropoffLocation) ?? initialPickup;

  // Étapes : 1 (Infos), 2 (Location), 3 (Options), 4 (Récapitulatif), 5 (Confirmé)
  const [currentStep, setCurrentStep] = useState<StepNumber | 5>(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmedBookingRef, setConfirmedBookingRef] = useState<string | null>(null);
  const [confirmedPdfUrl, setConfirmedPdfUrl] = useState<string | null>(null);
  const [agencyWhatsAppUrl, setAgencyWhatsAppUrl] = useState<string | null>(null);
  const idempotencyRequestRef = useRef<{ body: string; key: string } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [consent, setConsent] = useState(false);

  // Étape 1 : Coordonnées & Permis (aucune date pré-remplie)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cin, setCin] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Maroc');
  const [birthDate, setBirthDate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');

  // Étape 2 : Location
  const [startDate, setStartDate] = useState(requestedStartDate);
  const [endDate, setEndDate] = useState(requestedEndDate);
  const [pickupTime, setPickupTime] = useState(defaultPickupTime || '10:00');
  const [dropoffTime, setDropoffTime] = useState(defaultDropoffTime || '10:00');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(() => deliveryTypeFor(initialPickup));
  const [pickupLocation, setPickupLocation] = useState(initialPickup);
  const [dropoffLocation, setDropoffLocation] = useState(initialDropoff);

  // Étape 3 : Options & Notes
  const [flightNumber, setFlightNumber] = useState('');
  const [flightArrivalTime, setFlightArrivalTime] = useState('');
  const [childSeat, setChildSeat] = useState(false);
  const [additionalDriver, setAdditionalDriver] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');

  // Calculs financiers (moteur existant)
  const totalDays = calculateRentalDays(startDate, endDate);
  const pricing = calculateBookingPrice(vehicle.daily_price, totalDays, 15.00);

  // Dialogue modal : focus initial (premier champ), piège Tab, Échap (sauf pendant l'envoi),
  // page en arrière-plan inerte, défilement bloqué, focus rendu au bouton d'ouverture
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, { onClose, closeDisabled: isSubmitting });
  const bodyRef = useRef<HTMLDivElement>(null);
  const renderedStep = useRef(currentStep);

  // Changement d'étape : retour en haut du contenu et focus sur le titre de l'étape.
  // À l'ouverture, le focus va au premier champ : on ne réagit qu'à un vrai changement d'étape
  // (robuste au double appel des effets du mode strict de React en développement).
  useEffect(() => {
    if (renderedStep.current === currentStep) return;
    renderedStep.current = currentStep;
    bodyRef.current?.scrollTo({ top: 0 });
    const heading = dialogRef.current?.querySelector<HTMLElement>('[data-step-heading]');
    heading?.focus({ preventScroll: true });
  }, [currentStep]);

  // Rendu uniquement côté client (la modale est montée à l'ouverture)
  if (!isOpen || typeof document === 'undefined') return null;

  const requestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const clearError = (key: keyof FieldErrors) =>
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  const focusFirstError = (next: FieldErrors) => {
    const firstKey = Object.keys(next).find((k) => next[k as keyof FieldErrors]);
    if (!firstKey) return;
    window.requestAnimationFrame(() => document.getElementById(`${uid}-${firstKey}`)?.focus());
  };

  // Validation Étape 1 — mêmes règles que le schéma serveur (bookingRequestSchema)
  const validateStep1 = (): boolean => {
    const next: FieldErrors = {};
    if (firstName.trim().length < 2) next.firstName = 'Saisissez votre prénom (2 caractères minimum).';
    if (lastName.trim().length < 2) next.lastName = 'Saisissez votre nom (2 caractères minimum).';
    if (cin.trim().length < 3) next.cin = 'Saisissez le numéro de votre CIN ou passeport.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Adresse e-mail invalide.';
    if (phone.replace(/[^\d]/g, '').length < 8) next.phone = 'Saisissez un numéro valide (8 chiffres minimum).';
    if (!isValidDateOnly(birthDate) || birthDate >= today) {
      next.birthDate = 'Saisissez votre date de naissance.';
    } else if (typeof vehicle.min_driver_age === 'number' && vehicle.min_driver_age > 0 && ageOn(birthDate, startDate) < vehicle.min_driver_age) {
      // Seule règle d'âge appliquée : celle renseignée par l'agence pour ce véhicule
      next.birthDate = `L’agence demande un âge minimum de ${vehicle.min_driver_age} ans pour ce véhicule.`;
    }
    if (licenseNumber.trim().length < 3) next.licenseNumber = 'Saisissez le numéro de votre permis de conduire.';
    if (!isValidDateOnly(licenseExpiry)) {
      next.licenseExpiry = 'Saisissez la date d’expiration de votre permis.';
    } else if (licenseExpiry < today) {
      next.licenseExpiry = 'Votre permis de conduire est expiré.';
    }
    setErrors(next);
    focusFirstError(next);
    return Object.keys(next).length === 0;
  };

  // Validation Étape 2 — période valide et permis valable jusqu'au retour (règle serveur)
  const validateStep2 = (): boolean => {
    const next: FieldErrors = {};
    if (!isValidDateOnly(startDate) || startDate < today) next.startDate = 'La date de départ ne peut pas être passée.';
    if (!isValidDateOnly(endDate) || endDate <= startDate) next.endDate = 'La date de retour doit être postérieure au départ.';
    else if (isValidDateOnly(licenseExpiry) && licenseExpiry < endDate) {
      next.endDate = 'Votre permis doit être valide jusqu’à la date de retour (voir étape 1).';
    }
    setErrors(next);
    focusFirstError(next);
    return Object.keys(next).length === 0;
  };

  const goToStep = (step: StepNumber) => {
    setDirection(step > currentStep ? 1 : -1);
    setErrors({});
    setSubmissionError(null);
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep < 4) goToStep((currentStep + 1) as StepNumber);
  };

  // Soumission finale vers l'API (logique existante inchangée)
  const handleSubmitBookingRequest = async () => {
    if (isSubmitting) return;
    if (!consent) {
      setErrors({ consent: 'Acceptez les conditions pour envoyer votre demande.' });
      focusFirstError({ consent: 'x' });
      return;
    }
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const payload = {
        vehicleId: vehicle.id,
        agencyId: vehicle.agency_id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        cin: cin.trim().toUpperCase(),
        email: email.trim() || `${phone.replace(/[^0-9]/g, '')}@clickdrive.ma`,
        phone: phone.trim(),
        country,
        birthDate,
        licenseNumber: licenseNumber.trim(),
        licenseExpiry,
        startDate,
        endDate,
        pickupTime,
        dropoffTime,
        deliveryType,
        pickupLocation,
        dropoffLocation,
        flightNumber: flightNumber.trim() || undefined,
        flightArrivalTime: flightArrivalTime.trim() || undefined,
        childSeat: isMotorcycle(vehicle) ? false : childSeat,
        additionalDriver,
        customerNotes: customerNotes.trim() || undefined,
      };
      const body = JSON.stringify(payload);
      if (!idempotencyRequestRef.current || idempotencyRequestRef.current.body !== body) {
        idempotencyRequestRef.current = { body, key: crypto.randomUUID() };
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyRequestRef.current.key,
        },
        body,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la transmission de la demande');
      }

      setConfirmedBookingRef(data.reference);
      setConfirmedPdfUrl(typeof data.pdfUrl === 'string' ? data.pdfUrl : null);
      if (data.agencyWhatsAppUrl) {
        setAgencyWhatsAppUrl(data.agencyWhatsAppUrl);
      }
      // Notifier immédiatement toutes les pages/onglets ouverts pour rafraîchir les disponibilités
      notifyRealtimeChange(['bookings', 'vehicles', 'vehicle_unavailability']);
      setDirection(1);
      setCurrentStep(5); // Écran de confirmation
    } catch (err: unknown) {
      setSubmissionError(err instanceof Error && err.message ? err.message : 'Une erreur est survenue lors de l’envoi de votre demande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const vehicleTitle = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const isMoto = isMotorcycle(vehicle);
  const motoLicenseLabel = motorcycleLicenseLabel(vehicle.license_required);
  const stepMeta = currentStep <= 4 ? STEPS[currentStep - 1] : null;
  const progress = currentStep <= 4 ? (currentStep / 4) * 100 : 100;
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: direction * 28 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -28 },
        transition: { duration: 0.22, ease: [0.33, 1, 0.68, 1] as const },
      };

  const invalid = (key: keyof FieldErrors) => ({
    'aria-invalid': Boolean(errors[key]) || undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-error` : undefined,
  });

  const errorCount = Object.values(errors).filter(Boolean).length;

  return createPortal(
    <div className="fixed inset-0 z-90 flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        aria-hidden="true"
        data-modal-backdrop
        className="absolute inset-0 bg-ink/65 backdrop-blur-[3px]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={requestClose}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl outline-none sm:h-auto sm:max-h-[min(92dvh,880px)] sm:max-w-190 sm:rounded-3xl"
      >
        {/* ── En-tête ───────────────────────────────────────────── */}
        <header className="shrink-0 bg-ink px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:px-6 sm:pt-5">
          <div className="flex items-start gap-3">
            <div className="relative hidden h-10 w-28 shrink-0 rounded-xl bg-white sm:block">
              <Image src={brandLogo} alt="ClickDrive" fill sizes="112px" className="object-contain px-2.5 py-2" priority />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Marketplace · <span className="text-accent-on-dark">Demande de réservation</span>
              </p>
              <h2 id={`${uid}-title`} className="mt-1 truncate text-lg font-extrabold sm:text-xl">
                {vehicleTitle}
              </h2>
              {vehicle.agency?.name && (
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-slate-400">
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {vehicle.agency.name}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
              aria-label="Fermer la demande de réservation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* ── Indicateur d'étapes ───────────────────────────────── */}
        {stepMeta && (
          <nav aria-label="Étapes de la demande" className="shrink-0 border-b border-slate-200 bg-canvas px-4 py-3 sm:px-6 sm:py-4">
            {/* Mobile : étape courante + progression */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-extrabold text-ink">
                  Étape {currentStep} sur 4 · {stepMeta.label}
                </span>
                <span className="font-semibold text-slate-500 tabular-nums">{Math.round(progress)} %</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.3 }}
                />
              </div>
            </div>
            {/* Tablette/desktop : stepper horizontal */}
            <ol className="hidden items-center sm:flex">
              {STEPS.map((step, i) => {
                const done = currentStep > step.num;
                const current = currentStep === step.num;
                return (
                  <li key={step.num} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
                    <button
                      type="button"
                      onClick={() => done && goToStep(step.num)}
                      disabled={!done}
                      aria-current={current ? 'step' : undefined}
                      className={cn(
                        'flex shrink-0 items-center gap-2 rounded-full py-1 pe-2 text-[13px] font-bold transition-colors disabled:cursor-default',
                        current ? 'text-ink' : done ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-400'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors',
                          current ? 'bg-ink text-white' : done ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-400'
                        )}
                      >
                        {done ? <Check className="h-4 w-4" aria-hidden="true" /> : step.num}
                      </span>
                      <span className="whitespace-nowrap">
                        {step.label}
                        {done && <span className="sr-only"> (terminée, modifier)</span>}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <span className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                        <motion.span
                          className="block h-full bg-emerald-500"
                          initial={false}
                          animate={{ width: done ? '100%' : '0%' }}
                          transition={{ duration: reduceMotion ? 0 : 0.35 }}
                        />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {/* Annonce des changements d'étape aux lecteurs d'écran */}
        <p className="sr-only" aria-live="polite">
          {stepMeta ? `Étape ${currentStep} sur 4 : ${stepMeta.label}` : 'Demande envoyée'}
        </p>

        {/* ── Contenu ───────────────────────────────────────────── */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
          {submissionError && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#F8C9CD] bg-[#FFF4F5] p-3.5 text-sm text-[#9B1C26]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">La demande n’a pas pu être envoyée</p>
                <p className="mt-0.5">{submissionError}</p>
              </div>
            </div>
          )}
          {errorCount > 0 && !errors.consent && (
            <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl bg-[#FFF4F5] px-3.5 py-2.5 text-[13px] font-semibold text-[#9B1C26]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorCount === 1 ? '1 champ à corriger.' : `${errorCount} champs à corriger.`}
            </p>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={currentStep} {...motionProps}>
              {/* ================= ÉTAPE 1 : COORDONNÉES ================= */}
              {currentStep === 1 && (
                <section aria-labelledby={`${uid}-step1`} className="space-y-5">
                  <StepHeading id={`${uid}-step1`} title="Vos coordonnées et votre permis">
                    Ces informations permettent à l’agence de préparer votre dossier. Les champs marqués{' '}
                    <span className="text-accent-text">*</span> sont obligatoires.
                  </StepHeading>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field id={`${uid}-firstName`} label="Prénom" required error={errors.firstName}>
                      <input id={`${uid}-firstName`} data-autofocus type="text" autoComplete="given-name" value={firstName}
                        onChange={(e) => { setFirstName(e.target.value); clearError('firstName'); }}
                        placeholder="Youssef" className={inputClass} {...invalid('firstName')} />
                    </Field>
                    <Field id={`${uid}-lastName`} label="Nom" required error={errors.lastName}>
                      <input id={`${uid}-lastName`} type="text" autoComplete="family-name" value={lastName}
                        onChange={(e) => { setLastName(e.target.value); clearError('lastName'); }}
                        placeholder="Azizi" className={inputClass} {...invalid('lastName')} />
                    </Field>
                    <Field id={`${uid}-phone`} label="Téléphone / WhatsApp" required error={errors.phone} hint="Format international conseillé, ex. +212 6 12 34 56 78">
                      <input id={`${uid}-phone`} type="tel" inputMode="tel" autoComplete="tel" value={phone}
                        onChange={(e) => { setPhone(e.target.value); clearError('phone'); }}
                        placeholder="+212 6 12 34 56 78" className={inputClass}
                        aria-invalid={Boolean(errors.phone) || undefined}
                        aria-describedby={errors.phone ? `${uid}-phone-error` : `${uid}-phone-hint`} />
                    </Field>
                    <Field id={`${uid}-email`} label="E-mail" optional error={errors.email} hint="Pour recevoir le suivi de votre demande.">
                      <input id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" value={email}
                        onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                        placeholder="vous@exemple.com" className={inputClass}
                        aria-invalid={Boolean(errors.email) || undefined}
                        aria-describedby={errors.email ? `${uid}-email-error` : `${uid}-email-hint`} />
                    </Field>
                    <Field id={`${uid}-country`} label="Pays de résidence" required>
                      <select id={`${uid}-country`} autoComplete="country-name" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field id={`${uid}-birthDate`} label="Date de naissance" required error={errors.birthDate}>
                      <input id={`${uid}-birthDate`} type="date" autoComplete="bday" max={today} value={birthDate}
                        onChange={(e) => { setBirthDate(e.target.value); clearError('birthDate'); }}
                        className={inputClass} {...invalid('birthDate')} />
                    </Field>
                  </div>

                  <fieldset className="rounded-2xl border border-slate-200 p-4">
                    <legend className="px-1.5 text-[13px] font-extrabold text-ink">Pièce d’identité et permis</legend>
                    {isMoto && (
                      <p className="mb-3 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-5 text-slate-700">
                        {motoLicenseLabel
                          ? <>Pour cette moto, l’agence exige le <strong>{motoLicenseLabel}</strong>. Indiquez le numéro de ce permis et présentez-le en original à la remise.</>
                          : <>Pour une moto, indiquez le permis que vous présenterez à la remise ; l’agence confirmera s’il convient.</>}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field id={`${uid}-cin`} label="N° CIN ou passeport" required error={errors.cin} className="sm:col-span-2">
                        <input id={`${uid}-cin`} type="text" autoComplete="off" spellCheck={false} value={cin}
                          onChange={(e) => { setCin(e.target.value.toUpperCase()); clearError('cin'); }}
                          placeholder="Ex. S123456" className={cn(inputClass, 'uppercase tracking-wide')} {...invalid('cin')} />
                      </Field>
                      <Field id={`${uid}-licenseNumber`} label="N° de permis de conduire" required error={errors.licenseNumber}>
                        <input id={`${uid}-licenseNumber`} type="text" autoComplete="off" spellCheck={false} value={licenseNumber}
                          onChange={(e) => { setLicenseNumber(e.target.value); clearError('licenseNumber'); }}
                          placeholder="Ex. 04/123456" className={inputClass} {...invalid('licenseNumber')} />
                      </Field>
                      <Field id={`${uid}-licenseExpiry`} label="Expiration du permis" required error={errors.licenseExpiry}>
                        <input id={`${uid}-licenseExpiry`} type="date" min={today} value={licenseExpiry}
                          onChange={(e) => { setLicenseExpiry(e.target.value); clearError('licenseExpiry'); }}
                          className={inputClass} {...invalid('licenseExpiry')} />
                      </Field>
                    </div>
                  </fieldset>

                  <aside className="rounded-2xl bg-canvas p-4 text-[13px] leading-relaxed text-slate-600">
                    <p className="flex items-center gap-2 font-extrabold text-ink">
                      <LockKeyhole className="h-4 w-4 text-accent-text" aria-hidden="true" />
                      Vos données personnelles
                    </p>
                    <ul className="mt-2 list-disc space-y-1 ps-5">
                      <li><strong>Pourquoi :</strong> préparer le contrat et vérifier votre éligibilité à la location.</li>
                      <li><strong>Avec qui :</strong> uniquement l’agence {vehicle.agency?.name ?? 'partenaire'} qui propose ce véhicule.</li>
                      <li><strong>Protection :</strong> envoi chiffré (HTTPS) ; seule l’agence concernée accède à votre dossier.</li>
                      <li><strong>Documents :</strong> aucune photo demandée ici — l’agence vérifie vos pièces originales à la remise des clés.</li>
                    </ul>
                    <Link href="/confidentialite" target="_blank" className="mt-2 inline-flex min-h-9 items-center font-bold text-accent-text hover:underline">
                      Lire la politique de confidentialité
                    </Link>
                  </aside>
                </section>
              )}

              {/* ================= ÉTAPE 2 : LOCATION ================= */}
              {currentStep === 2 && (
                <section aria-labelledby={`${uid}-step2`} className="space-y-5">
                  <StepHeading id={`${uid}-step2`} title="Votre location">
                    Quand et où souhaitez-vous récupérer puis rendre le véhicule ?
                  </StepHeading>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Prise en charge */}
                    <fieldset className="rounded-2xl border border-slate-200 p-4">
                      <legend className="flex items-center gap-2 px-1.5 text-[13px] font-extrabold text-ink">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                        Prise en charge
                      </legend>
                      <div className="grid grid-cols-[minmax(0,1fr)_108px] gap-2">
                        <Field id={`${uid}-startDate`} label="Date" required error={errors.startDate}>
                          <input id={`${uid}-startDate`} type="date" min={today} value={startDate}
                            onChange={(e) => {
                              const nextStart = e.target.value;
                              setStartDate(nextStart);
                              clearError('startDate');
                              if (isValidDateOnly(nextStart) && endDate <= nextStart) setEndDate(addDateDays(nextStart, 1));
                            }}
                            className={inputClass} {...invalid('startDate')} />
                        </Field>
                        <Field id={`${uid}-pickupTime`} label="Heure">
                          <input id={`${uid}-pickupTime`} type="time" step={1800} value={pickupTime}
                            onChange={(e) => setPickupTime(e.target.value || '10:00')} className={inputClass} />
                        </Field>
                      </div>
                    </fieldset>

                    {/* Restitution */}
                    <fieldset className="rounded-2xl border border-slate-200 p-4">
                      <legend className="flex items-center gap-2 px-1.5 text-[13px] font-extrabold text-ink">
                        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                        Restitution
                      </legend>
                      <div className="grid grid-cols-[minmax(0,1fr)_108px] gap-2">
                        <Field id={`${uid}-endDate`} label="Date" required error={errors.endDate}>
                          <input id={`${uid}-endDate`} type="date" min={isValidDateOnly(startDate) ? addDateDays(startDate, 1) : today} value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); clearError('endDate'); }}
                            className={inputClass} {...invalid('endDate')} />
                        </Field>
                        <Field id={`${uid}-dropoffTime`} label="Heure">
                          <input id={`${uid}-dropoffTime`} type="time" step={1800} value={dropoffTime}
                            onChange={(e) => setDropoffTime(e.target.value || '10:00')} className={inputClass} />
                        </Field>
                      </div>
                    </fieldset>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ink px-4 py-3 text-sm text-white" aria-live="polite">
                    <CalendarDays className="h-4 w-4 text-accent-on-dark" aria-hidden="true" />
                    <strong>{pricing.number_of_days} jour{pricing.number_of_days > 1 ? 's' : ''}</strong>
                    <span className="text-slate-300">
                      {formatLongDate(startDate)} {pickupTime} → {formatLongDate(endDate)} {dropoffTime}
                    </span>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-[13px] font-extrabold text-ink">Point de prise en charge</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {MEETING_POINTS.map((mp) => {
                        const selected = pickupLocation === mp.name;
                        return (
                          <label
                            key={mp.id}
                            className={cn(
                              'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-brand',
                              selected ? 'border-ink bg-canvas' : 'border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <input
                              type="radio"
                              name={`${uid}-pickup`}
                              value={mp.name}
                              checked={selected}
                              onChange={() => {
                                const wasSame = dropoffLocation === pickupLocation;
                                setPickupLocation(mp.name);
                                if (wasSame) setDropoffLocation(mp.name);
                                setDeliveryType(deliveryTypeFor(mp.name));
                              }}
                              className="sr-only"
                            />
                            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white bg-linear-to-br', mp.gradientBg)}>
                              <MeetingPointIcon point={mp} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-ink">{mp.shortName}</span>
                              <span className="block truncate text-xs text-slate-500">{mp.badgeLabel}</span>
                            </span>
                            <span
                              className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-brand bg-action text-white' : 'border-slate-300')}
                              aria-hidden="true"
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field id={`${uid}-dropoff`} label="Lieu de restitution" required>
                      <select id={`${uid}-dropoff`} value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} className={inputClass}>
                        {!MEETING_POINTS.some((mp) => mp.name === dropoffLocation) && <option value={dropoffLocation}>{dropoffLocation}</option>}
                        {MEETING_POINTS.map((mp) => (
                          <option key={mp.id} value={mp.name}>
                            {mp.name === pickupLocation ? `${mp.shortName} (même lieu)` : mp.shortName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id={`${uid}-delivery`} label="Mode de remise" required>
                      <select id={`${uid}-delivery`} value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)} className={inputClass}>
                        {DELIVERY_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Consignes d’accueil</p>
                    <MeetingPointBadge location={pickupLocation} showInstructions />
                  </div>
                </section>
              )}

              {/* ================= ÉTAPE 3 : OPTIONS ================= */}
              {currentStep === 3 && (
                <section aria-labelledby={`${uid}-step3`} className="space-y-5">
                  <StepHeading id={`${uid}-step3`} title="Options et précisions">
                    Facultatif — ces informations aident l’agence à préparer votre accueil.
                  </StepHeading>

                  {deliveryType === 'AIRPORT' && (
                    <fieldset className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                      <legend className="flex items-center gap-2 px-1.5 text-[13px] font-extrabold text-ink">
                        <Plane className="h-4 w-4 text-sky-700" aria-hidden="true" />
                        Accueil à l’aéroport Nador Al-Aroui
                      </legend>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field id={`${uid}-flight`} label="N° de vol" optional>
                          <input id={`${uid}-flight`} type="text" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)}
                            placeholder="Ex. AT 1234" className={inputClass} />
                        </Field>
                        <Field id={`${uid}-arrival`} label="Heure d’atterrissage" optional>
                          <input id={`${uid}-arrival`} type="time" value={flightArrivalTime} onChange={(e) => setFlightArrivalTime(e.target.value)}
                            className={inputClass} />
                        </Field>
                      </div>
                    </fieldset>
                  )}

                  <fieldset>
                    <legend className="mb-2 text-[13px] font-extrabold text-ink">Options sur demande</legend>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {[
                        ...(isMoto
                          ? []
                          : [{ checked: childSeat, set: setChildSeat, icon: Baby, title: 'Siège enfant ou rehausseur', desc: 'Selon disponibilité de l’agence' }]),
                        { checked: additionalDriver, set: setAdditionalDriver, icon: UserPlus, title: 'Conducteur additionnel', desc: 'Second permis présenté à la signature' },
                      ].map(({ checked, set, icon: Icon, title, desc }) => (
                        <label
                          key={title}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-brand',
                            checked ? 'border-ink bg-canvas' : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="sr-only" />
                          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', checked ? 'bg-ink text-white' : 'bg-canvas text-slate-500')}>
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-ink">{title}</span>
                            <span className="block text-xs text-slate-500">{desc}</span>
                            <span className="mt-1.5 inline-block rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                              Tarif fixé par l’agence
                            </span>
                          </span>
                          <span
                            className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', checked ? 'border-brand bg-action text-white' : 'border-slate-300')}
                            aria-hidden="true"
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Ces options ne sont pas incluses dans le total estimé : l’agence vous indiquera leur prix éventuel.
                    </p>
                  </fieldset>

                  <Field id={`${uid}-notes`} label="Message pour l’agence" optional hint={`${customerNotes.length}/500 caractères`}>
                    <textarea id={`${uid}-notes`} rows={4} maxLength={500} value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="Horaires, bagages volumineux, adresse de l’hôtel…"
                      aria-describedby={`${uid}-notes-hint`}
                      className={cn(inputClass, 'h-auto min-h-28 py-3 leading-relaxed')} />
                  </Field>
                </section>
              )}

              {/* ================= ÉTAPE 4 : VÉRIFICATION ================= */}
              {currentStep === 4 && (
                <section aria-labelledby={`${uid}-step4`} className="space-y-4">
                  <StepHeading id={`${uid}-step4`} title="Vérifiez votre demande">
                    Relisez les informations avant l’envoi. Vous pouvez modifier chaque section.
                  </StepHeading>

                  <SummaryBlock title="Véhicule">
                    <p className="font-bold text-ink">{vehicleTitle}</p>
                    <p className="text-slate-500">
                      {vehicle.transmission === 'AUTOMATIC' ? 'Automatique' : 'Manuelle'} · {FUEL_LABELS[vehicle.fuel] ?? vehicle.fuel} · {vehicle.category}
                    </p>
                    {vehicle.agency?.name && <p className="mt-1 text-slate-600">Agence : <strong>{vehicle.agency.name}</strong></p>}
                  </SummaryBlock>

                  <SummaryBlock title="Location" onEdit={() => goToStep(2)}>
                    <p className="font-bold text-ink">
                      {formatLongDate(startDate)} {pickupTime} → {formatLongDate(endDate)} {dropoffTime}
                      <span className="ms-2 font-semibold text-slate-500">({pricing.number_of_days} j)</span>
                    </p>
                    <p className="text-slate-600">Prise en charge : {getMeetingPoint(pickupLocation).shortName}</p>
                    <p className="text-slate-600">
                      Restitution : {dropoffLocation === pickupLocation ? 'même lieu' : getMeetingPoint(dropoffLocation).shortName}
                    </p>
                    <p className="text-slate-600">Mode de remise : {DELIVERY_OPTIONS.find((o) => o.key === deliveryType)?.label}</p>
                  </SummaryBlock>

                  <SummaryBlock title="Vos coordonnées" onEdit={() => goToStep(1)}>
                    <p className="font-bold text-ink">{firstName} {lastName}</p>
                    <p className="text-slate-600">{phone}{email ? ` · ${email}` : ''}</p>
                    <p className="text-slate-600">Pièce d’identité : {maskId(cin)} · Permis : {maskId(licenseNumber)}</p>
                  </SummaryBlock>

                  <SummaryBlock title="Options" onEdit={() => goToStep(3)}>
                    {childSeat || additionalDriver || flightNumber || customerNotes ? (
                      <ul className="space-y-0.5 text-slate-600">
                        {childSeat && !isMoto && <li>Siège enfant ou rehausseur</li>}
                        {additionalDriver && <li>Conducteur additionnel</li>}
                        {flightNumber && <li>Vol {flightNumber}{flightArrivalTime ? ` · arrivée ${flightArrivalTime}` : ''}</li>}
                        {customerNotes && <li className="line-clamp-2">« {customerNotes} »</li>}
                      </ul>
                    ) : (
                      <p className="text-slate-500">Aucune option</p>
                    )}
                  </SummaryBlock>

                  <div className="rounded-2xl bg-ink p-4 text-sm text-white sm:p-5">
                    <dl className="space-y-2">
                      <div className="flex justify-between gap-3 text-slate-300">
                        <dt>{formatMad(pricing.daily_price)} × {pricing.number_of_days} jour{pricing.number_of_days > 1 ? 's' : ''}</dt>
                        <dd className="font-semibold text-white tabular-nums">{formatMad(pricing.subtotal)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-white/10 pt-3 text-base font-extrabold">
                        <dt>Total estimé</dt>
                        <dd className="tabular-nums">{formatMad(pricing.total)}</dd>
                      </div>
                      {(vehicle.deposit ?? 0) > 0 && (
                        <div className="flex justify-between gap-3 text-[13px] text-slate-300">
                          <dt>Caution remboursable (à l’agence)</dt>
                          <dd className="tabular-nums">{formatMad(vehicle.deposit)}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-3 text-xs leading-relaxed text-slate-400">
                      Aucun paiement en ligne : le règlement se fait à l’agence à la remise des clés. Options éventuelles en sus.
                    </p>
                  </div>

                  <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                    <p>
                      <strong>Ceci est une demande, pas une réservation confirmée.</strong> Le véhicule vous est réservé
                      lorsque l’agence {vehicle.agency?.name ?? 'partenaire'} accepte votre demande ; elle établit ensuite le
                      contrat à la remise des clés.
                    </p>
                  </div>

                  <div>
                    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors', errors.consent ? 'border-brand bg-[#FFF6F7]' : 'border-slate-200')}>
                      <input
                        id={`${uid}-consent`}
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => { setConsent(e.target.checked); clearError('consent'); }}
                        aria-invalid={Boolean(errors.consent) || undefined}
                        aria-describedby={errors.consent ? `${uid}-consent-error` : undefined}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                      />
                      <span className="text-[13px] leading-relaxed text-slate-700">
                        J’accepte les{' '}
                        <Link href="/cgv" target="_blank" className="font-bold text-ink underline underline-offset-2">conditions générales</Link>{' '}
                        et la{' '}
                        <Link href="/confidentialite" target="_blank" className="font-bold text-ink underline underline-offset-2">politique de confidentialité</Link>,
                        et j’autorise la transmission de ma demande à l’agence.
                      </span>
                    </label>
                    {errors.consent && (
                      <p id={`${uid}-consent-error`} role="alert" className="mt-1.5 text-[13px] font-semibold text-action-hover">
                        {errors.consent}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* ================= ÉTAPE 5 : DEMANDE ENVOYÉE ================= */}
              {currentStep === 5 && (
                <section aria-labelledby={`${uid}-done`} className="mx-auto max-w-md py-2 text-center">
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                  >
                    <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
                  </motion.span>
                  <h3 id={`${uid}-done`} tabIndex={-1} data-step-heading className="mt-4 text-xl font-extrabold text-ink outline-none">
                    Votre demande a bien été envoyée
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    L’agence <strong>{vehicle.agency?.name ?? 'partenaire'}</strong> va vérifier la disponibilité et revenir vers vous.
                  </p>

                  {confirmedBookingRef && (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-canvas p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Référence de votre demande</p>
                      <p className="mt-1 font-mono text-xl font-black tracking-wider text-ink">{confirmedBookingRef}</p>
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        En attente de validation par l’agence
                      </span>
                    </div>
                  )}

                  <ol className="mt-5 space-y-2.5 text-start text-sm text-slate-600">
                    {[
                      'Votre demande apparaît dans l’espace de l’agence sur ClickDrive.',
                      'L’agence confirme la disponibilité et vous recontacte.',
                      'Vous signez le contrat et réglez à l’agence lors de la remise des clés.',
                    ].map((item, i) => (
                      <li key={item} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                        {item}
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {confirmedBookingRef && (
                      <a
                        href={confirmedPdfUrl || `/api/bookings/${encodeURIComponent(confirmedBookingRef)}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-slate-400"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Télécharger le PDF
                      </a>
                    )}
                    {confirmedBookingRef && (
                      <Link
                        href={`/account/bookings/${encodeURIComponent(confirmedBookingRef)}`}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                      >
                        <Clock className="h-4 w-4 text-accent-on-dark" aria-hidden="true" />
                        Suivre ma demande
                      </Link>
                    )}
                  </div>
                  {agencyWhatsAppUrl && (
                    <a
                      href={agencyWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      Prévenir l’agence sur WhatsApp
                    </a>
                  )}
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Pied : navigation ─────────────────────────────────── */}
        <footer className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          {currentStep === 5 ? (
            <button
              type="button"
              onClick={onClose}
              className="ms-auto flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-6 text-sm font-bold text-white transition-colors hover:bg-slate-800 sm:w-auto"
            >
              Fermer
            </button>
          ) : (
            <>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep((currentStep - 1) as StepNumber)}
                  disabled={isSubmitting}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:px-5"
                >
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  <span className="hidden sm:inline">Précédent</span>
                  <span className="sr-only sm:hidden">Étape précédente</span>
                </button>
              ) : (
                <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  Aucun paiement à cette étape
                </p>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="ms-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-none"
                >
                  Continuer
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  onClick={() => void handleSubmitBookingRequest()}
                  className="ms-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-action px-5 text-sm font-bold text-white shadow-[0_14px_28px_-14px_rgba(230,57,70,0.8)] transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-70 sm:flex-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      Envoi en cours…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Envoyer ma demande de réservation
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </footer>
      </motion.div>
    </div>,
    document.body
  );
}

/* ====================================================================== */
/* PETITS COMPOSANTS                                                      */
/* ====================================================================== */

function StepHeading({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      {/* Reçoit le focus à chaque changement d'étape (navigation clavier / lecteur d'écran) */}
      <h3 id={id} tabIndex={-1} data-step-heading className="text-lg font-extrabold text-ink outline-none sm:text-xl">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{children}</p>
    </div>
  );
}

function SummaryBlock({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{title}</h4>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-accent-text hover:bg-[#FFF4F5]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Modifier
            <span className="sr-only"> : {title}</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
