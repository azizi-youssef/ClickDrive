'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { findSameModelAlternatives } from '@/lib/availability/engine';
import { BookingCard, type BookingAvailability } from '@/components/booking/BookingCard';
import { VehicleGallery } from '@/components/cars/VehicleGallery';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { cn, formatNumber } from '@/lib/utils';
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
import { formatEngineCc, isMotorcycle, motorcycleLicenseLabel } from '@/lib/vehicles/kind';

interface CarDetailsClientProps {
  slug: string;
  /** Véhicule public chargé côté serveur (contenu présent dès le HTML) */
  initialVehicle: Vehicle;
  /** Véhicules du même modèle chez d'autres agences (alternatives), chargés côté serveur */
  alternativesPool: Vehicle[];
}

const FUEL_LABELS: Record<string, string> = {
  DIESEL: 'Diesel',
  GASOLINE: 'Essence',
  HYBRID: 'Hybride',
  ELECTRIC: 'Électrique',
};

export function CarDetailsClient({ slug, initialVehicle, alternativesPool }: CarDetailsClientProps) {
  const reduceMotion = useReducedMotion();

  const [vehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [dateAvailability, setDateAvailability] = useState<BookingAvailability>('checking');

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

  const title = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const isMoto = isMotorcycle(vehicle);
  const engineCc = formatEngineCc(vehicle.engine_cc);
  const licenseLabel = motorcycleLicenseLabel(vehicle.license_required);
  const vehicleNoun = isMoto ? 'la moto' : 'le véhicule';
  const isFleetListed = vehicle.status === 'AVAILABLE';
  // Un véhicule en flotte n'est « disponible » que si les dates choisies le sont aussi.
  const isAvailableForDates = isFleetListed && dateAvailability !== 'unavailable';
  const vehicleStatusLabel = !isFleetListed
    ? vehicle.status === 'MAINTENANCE'
      ? 'Maintenance'
      : 'Non disponible'
    : dateAvailability === 'checking'
      ? 'Vérification…'
      : dateAvailability === 'unavailable'
        ? 'Indisponible pour ces dates'
        : 'Disponible';

  // Note : uniquement à partir des avis réels du véhicule
  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : null;

  const agency = vehicle.agency;
  const agencyPhone = agency?.phone?.replace(/[^0-9]/g, '') || '212661987654';
  const whatsappLink = `https://wa.me/${agencyPhone}?text=${encodeURIComponent(
    `Bonjour ${agency?.name || 'ClickDrive'}, j'ai une question sur ${vehicleNoun} ${vehicle.brand} ${vehicle.model} (${vehicle.daily_price} DH/j) avant d'envoyer ma demande.`
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
    { icon: isMoto ? Motorbike : Car, label: 'Marque & modèle', value: `${vehicle.brand} ${vehicle.model}` },
    { icon: CalendarDays, label: 'Année', value: String(vehicle.year) },
    { icon: Tag, label: 'Catégorie', value: isMoto ? `Moto · ${vehicle.category}` : vehicle.category },
    { icon: Gauge, label: isMoto ? 'Boîte' : 'Transmission', value: vehicle.transmission === 'AUTOMATIC' ? 'Automatique' : 'Manuelle' },
    { icon: Fuel, label: 'Carburant', value: FUEL_LABELS[vehicle.fuel] ?? vehicle.fuel },
  ];
  if (isMoto && engineCc) specs.push({ icon: Motorbike, label: 'Cylindrée', value: engineCc });
  if (isMoto && licenseLabel) specs.push({ icon: IdCard, label: 'Permis exigé', value: licenseLabel });
  if (vehicle.seats > 0) specs.push({ icon: Users, label: 'Places', value: `${vehicle.seats} place${vehicle.seats > 1 ? 's' : ''}` });
  if (!isMoto && vehicle.doors > 0) specs.push({ icon: DoorOpen, label: 'Portes', value: `${vehicle.doors} portes` });
  if (!isMoto && typeof vehicle.air_conditioning === 'boolean') {
    specs.push({ icon: Snowflake, label: 'Climatisation', value: vehicle.air_conditioning ? 'Oui' : 'Non' });
  }
  if (vehicle.mileage > 0) specs.push({ icon: Odometer, label: 'Kilométrage compteur', value: `${formatNumber(vehicle.mileage)} km` });

  // Conditions : uniquement celles fournies par les données du véhicule et du parcours de réservation
  const conditions: { icon: React.ElementType; label: string; value: string; note?: string }[] = [];
  if (isMoto) {
    conditions.push(
      licenseLabel
        ? { icon: IdCard, label: 'Permis exigé', value: licenseLabel, note: 'À présenter en original à la remise de la moto.' }
        : { icon: IdCard, label: 'Permis exigé', value: 'À confirmer', note: 'L’agence précise le permis nécessaire en réponse à votre demande.' }
    );
  }
  if ((vehicle.deposit ?? 0) > 0) {
    conditions.push({ icon: ShieldCheck, label: 'Caution', value: `${formatNumber(vehicle.deposit)} MAD`, note: 'Remboursable selon le contrat de l’agence.' });
  }
  if (vehicle.min_rental_days > 0) {
    conditions.push({ icon: CalendarClock, label: 'Durée minimale', value: `${vehicle.min_rental_days} jour${vehicle.min_rental_days > 1 ? 's' : ''}` });
  }
  if (typeof vehicle.min_driver_age === 'number' && vehicle.min_driver_age > 0) {
    conditions.push({ icon: UserRound, label: 'Âge minimum', value: `${vehicle.min_driver_age} ans` });
  }
  if (typeof vehicle.unlimited_mileage === 'boolean') {
    conditions.push({
      icon: Odometer,
      label: 'Kilométrage',
      value: vehicle.unlimited_mileage ? 'Illimité' : 'Limité',
      note: vehicle.unlimited_mileage ? undefined : 'Plafond précisé par l’agence.',
    });
  }
  if (vehicle.delivery_available === true) {
    conditions.push({ icon: Truck, label: 'Livraison', value: 'Possible', note: 'Hôtel ou adresse, selon l’agence.' });
  }
  conditions.push({ icon: Wallet, label: 'Paiement', value: 'À l’agence' });

  const fadeUp = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.35 } };

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-28 lg:pb-16">
      {/* ── Fil d'Ariane ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200/80 bg-white">
        <nav
          aria-label="Fil d’Ariane"
          className="mx-auto flex h-11 max-w-[1360px] items-center gap-1.5 overflow-hidden px-4 text-xs font-medium text-slate-500 sm:px-6 lg:px-8"
        >
          <Link href="/" className="inline-flex h-11 shrink-0 items-center transition-colors hover:text-[#0B1220]">Accueil</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 rtl:rotate-180" aria-hidden="true" />
          <Link
            href={isMoto ? '/motos' : '/search'}
            className="inline-flex h-11 shrink-0 items-center transition-colors hover:text-[#0B1220]"
          >
            {isMoto ? 'Motos' : 'Voitures'}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="truncate font-semibold text-[#0B1220]">
            {vehicle.brand} {vehicle.model}
          </span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {/* ── En-tête véhicule ───────────────────────────────────── */}
        <header className="mb-5 flex flex-col gap-4 sm:mb-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#0B1220] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                {isMoto && <Motorbike className="h-3.5 w-3.5" aria-hidden="true" />}
                {isMoto ? `Moto · ${vehicle.category}` : vehicle.category}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold',
                  isAvailableForDates ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#F8C9CD] bg-[#FFF4F5] text-[#B4232F]'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', isAvailableForDates ? 'bg-emerald-500' : 'bg-[#E63946]')} aria-hidden="true" />
                {vehicleStatusLabel}
              </span>
            </div>

            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[#0B1220] sm:text-4xl lg:text-[42px]">
              {vehicle.brand} {vehicle.model}
              <span className="ms-2.5 font-semibold text-slate-400">{vehicle.year}</span>
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {agency && (
                <Link
                  href={`/agencies/${agency.slug}`}
                  className="group inline-flex min-h-11 items-center gap-2 font-bold text-[#0B1220] transition-colors hover:text-accent-text"
                >
                  <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <AgencyLogo slug={agency.slug} name={agency.name} logoUrl={agency.logo_url} className="h-full w-full object-cover" />
                  </span>
                  {agency.name}
                </Link>
              )}
              {agency?.verified && (
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Agence vérifiée
                </span>
              )}
              <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
              {averageRating !== null ? (
                <a href="#avis" className="inline-flex min-h-9 items-center gap-1.5 font-bold text-[#0B1220] hover:underline">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {averageRating.toFixed(1).replace('.', ',')}
                  <span className="font-medium text-slate-500">({reviewCount} avis)</span>
                </a>
              ) : (
                <span className="text-[13px] font-medium text-slate-500">Pas encore d’avis</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              onClick={() => setFavorite((current) => !current)}
              aria-pressed={favorite}
              aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]',
                favorite ? 'border-[#F8C9CD] text-accent-text' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-[#0B1220]'
              )}
            >
              <Heart className={cn('h-5 w-5', favorite && 'fill-current')} aria-hidden="true" />
            </motion.button>
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label={
                shareState === 'copied'
                  ? `Lien de ${vehicleNoun} copié`
                  : isMoto
                    ? 'Partager cette moto'
                    : 'Partager ce véhicule'
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-[#0B1220] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]"
            >
              {shareState === 'copied' ? (
                <Link2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span aria-live="polite">{shareState === 'copied' ? 'Lien copié' : 'Partager'}</span>
            </button>
          </div>
        </header>

        {/* ── Grille : galerie + détails | réservation ───────────── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* Galerie + infos clés */}
          <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
            <VehicleGallery images={vehicle.images ?? []} title={title} />

            <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Informations essentielles">
              {[
                { icon: Gauge, value: vehicle.transmission === 'AUTOMATIC' ? 'Automatique' : 'Manuelle' },
                isMoto && engineCc
                  ? { icon: Motorbike, value: engineCc }
                  : { icon: Fuel, value: FUEL_LABELS[vehicle.fuel] ?? vehicle.fuel },
                isMoto && vehicle.license_required
                  ? { icon: IdCard, value: `Permis ${vehicle.license_required}` }
                  : { icon: Users, value: `${vehicle.seats} place${vehicle.seats > 1 ? 's' : ''}` },
              ].map(({ icon: Icon, value }) => (
                <li key={value} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2 py-3 text-center sm:flex-row sm:justify-center sm:gap-2.5">
                  <Icon className="h-5 w-5 text-accent-text" aria-hidden="true" />
                  <span className="text-[13px] font-bold text-[#0B1220] sm:text-sm">{value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Réservation : après la galerie en mobile, colonne collante sur desktop.
              Hauteur limitée à l'écran : sur un écran peu haut (ex. 1024×768), la colonne défile
              elle-même pour que « Réserver » reste atteignable et visible au focus (WCAG 2.4.11). */}
          <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Réservation">
            <div className="space-y-3 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:[scrollbar-width:thin]">
              <BookingCard vehicle={vehicle} onAvailabilityChange={setDateAvailability} />

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0B1220]">{isMoto ? 'Une question sur cette moto ?' : 'Une question sur ce véhicule ?'}</p>
                  <p className="truncate text-xs text-slate-500">Écrivez à {agency?.name ?? 'l’agence'} sur WhatsApp.</p>
                </div>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-[#0B1220] px-3.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  Écrire
                </a>
              </div>
            </div>
          </aside>

          {/* Détails */}
          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
            {/* Caractéristiques */}
            <motion.section {...fadeUp} aria-labelledby="specs-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle id="specs-title" eyebrow="Fiche technique" title="Caractéristiques" />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl bg-[#F5F6F8] p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-accent-text shadow-[0_1px_2px_rgba(11,18,32,0.06)]">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-slate-500">{label}</dt>
                      <dd className="mt-0.5 text-sm font-bold text-[#0B1220] break-words">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </motion.section>

            {/* Équipements & options */}
            <motion.section {...fadeUp} aria-labelledby="features-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle id="features-title" eyebrow="À bord" title="Équipements & options" />
              {vehicle.features.length > 0 ? (
                <>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Inclus avec le véhicule</h3>
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {vehicle.features.map((feature, index) => (
                      <li key={`${feature}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3 text-sm text-slate-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-slate-500">L’agence n’a pas encore détaillé les équipements de ce véhicule.</p>
              )}

              <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Options sur demande</h3>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[
                  { icon: Baby, label: 'Siège enfant' },
                  { icon: UserPlus, label: 'Conducteur additionnel' },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-sm text-slate-700">
                    <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <span className="rounded-full bg-[#F5F6F8] px-2 py-0.5 text-[11px] font-bold text-ink-tertiary">Tarif agence</span>
                  </li>
                ))}
              </ul>
            </motion.section>

            {/* Conditions de location */}
            <motion.section {...fadeUp} aria-labelledby="conditions-title" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle
                id="conditions-title"
                eyebrow="Avant de partir"
                title="Conditions de location"
                subtitle="Le contrat de l’agence fait foi ; les conditions ci-dessous sont celles renseignées pour ce véhicule."
              />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {conditions.map(({ icon: Icon, label, value, note }) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                    <div>
                      <dt className="text-xs font-medium text-slate-500">{label}</dt>
                      <dd className="mt-0.5 text-[15px] font-bold text-[#0B1220]">{value}</dd>
                      {note && <dd className="mt-1 text-[13px] leading-relaxed text-slate-500">{note}</dd>}
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                <Disclosure icon={FileText} title="Documents à présenter">
                  <ul className="list-disc space-y-1 ps-5">
                    <li>Pièce d’identité : CIN ou passeport</li>
                    <li>Permis de conduire en cours de validité</li>
                  </ul>
                  <p className="mt-2">Ces informations sont demandées lors de votre demande de réservation.</p>
                </Disclosure>
                <Disclosure icon={Info} title="Assurance, carburant et annulation">
                  <p>
                    Ces conditions sont définies par l’agence et précisées dans son contrat. Demandez-les avant de
                    confirmer votre réservation.
                  </p>
                </Disclosure>
              </div>
            </motion.section>

            {/* Avis clients */}
            <motion.section {...fadeUp} id="avis" aria-labelledby="reviews-title" className="scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <SectionTitle id="reviews-title" eyebrow="Expérience client" title="Avis clients" />
              {reviewCount > 0 && averageRating !== null ? (
                <>
                  <div className="flex flex-col gap-5 rounded-xl bg-[#F5F6F8] p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="text-center sm:w-36 sm:shrink-0">
                      <p className="text-4xl font-extrabold text-[#0B1220] tabular-nums">{averageRating.toFixed(1).replace('.', ',')}</p>
                      <Stars rating={averageRating} className="mt-1 justify-center" />
                      <p className="mt-1 text-xs text-slate-500">{reviewCount} avis</p>
                    </div>
                    <ul className="flex-1 space-y-1.5" aria-label="Répartition des notes">
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
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B1220] text-sm font-bold text-white">
                            {review.author_name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#0B1220]">{review.author_name}</p>
                            <div className="mt-0.5 flex items-center gap-2">
                              <Stars rating={review.rating} />
                              <time dateTime={review.created_at} className="text-xs text-slate-500">
                                {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F6F8] text-slate-400">
                    <Star className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-[#0B1220]">Aucun avis pour le moment</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
                    Les avis des clients ayant loué ce véhicule apparaîtront ici après leurs locations.
                  </p>
                </div>
              )}
            </motion.section>
          </div>
        </div>

        {/* ── Véhicules similaires (pleine largeur) ──────────────── */}
        {alternatives.length > 0 && (
          <section aria-labelledby="similar-title" className="mt-12 lg:mt-16">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-text">
                  <span className="h-px w-7 bg-current" aria-hidden="true" />
                  Alternatives
                </p>
                <h2 id="similar-title" className="mt-2 text-2xl font-extrabold tracking-tight text-[#0B1220]">
                  Véhicules similaires
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Même modèle ou même catégorie chez d’autres agences. Disponibilité à vérifier sur chaque fiche.
                </p>
              </div>
              <Link href="/search" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#0B1220] hover:text-accent-text">
                Tout le catalogue
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
            {/* Mobile : carrousel — tablette : 2 colonnes — desktop : 3 colonnes */}
            <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 xl:grid-cols-3">
              {alternatives.map((alt) => (
                <li key={alt.id} className="w-[84%] shrink-0 snap-start sm:w-auto">
                  <VehicleCard vehicle={alt} />
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
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-lg font-extrabold text-[#0B1220] sm:text-xl">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{subtitle}</p>}
    </div>
  );
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span className={cn('flex items-center gap-0.5', className)} role="img" aria-label={`${rating.toFixed(1)} sur 5`}>
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
        className="flex min-h-13 w-full items-center gap-3 px-4 text-start text-sm font-bold text-[#0B1220] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E63946]"
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
  return (
    <div className="min-h-screen bg-[#F5F6F8]" role="status" aria-label="Chargement du véhicule">
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
