'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SearchBar } from '@/components/search/SearchBar';
import { SUPPORT_HOURS_SUMMARY } from '@/lib/constants/contact';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import type { Vehicle, Agency } from '@/types';
import { isMotorcycle } from '@/lib/vehicles/kind';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { GsapReveal } from '@/components/ui/react-bits';
import { StyleExplorer } from '@/components/home/StyleExplorer';

import {
  AlertCircle,
  ArrowRight,
  Motorbike,
  Car,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Plane,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';


export function HomeClient({
  initialVehicles,
  initialAgencies,
}: {
  /** Préchargés côté serveur (null si indisponibles : chargement côté navigateur) */
  initialVehicles: Vehicle[] | null;
  initialAgencies: Agency[] | null;
}) {
  const { t, isRTL } = useTranslation();
  const preloaded = initialVehicles !== null && initialAgencies !== null;
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles ?? []);
  const [agencies, setAgencies] = useState<Agency[]>(initialAgencies ?? []);
  const [dataLoaded, setDataLoaded] = useState(preloaded);
  const [hasError, setHasError] = useState(false);
  // Filtres rapides section véhicules
  const [vehicleFilter, setVehicleFilter] = useState<string>('Tous');
  // Budget max filtre (0 = pas de limite)
  const [budgetMax, setBudgetMax] = useState<number>(0);
  // Jours sélectionnés pour prix total estimé
  const [selectedDays, setSelectedDays] = useState<number>(0);

  const load = useCallback(async () => {
    setHasError(false);
    try {
      const [vRes, aRes] = await Promise.all([
        fetch('/api/vehicles', { next: { revalidate: 60 } } as RequestInit).then((r) => r.json()),
        fetch('/api/agencies', { next: { revalidate: 60 } } as RequestInit).then((r) => r.json()),
      ]);

      if (vRes?.success && Array.isArray(vRes.data)) {
        setVehicles(vRes.data);
      } else {
        setHasError(true);
      }

      if (aRes?.success && Array.isArray(aRes.data)) {
        setAgencies(aRes.data);
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.warn('Error loading home data:', err);
      setHasError(true);
    } finally {
      setDataLoaded(true);
    }
  }, []);

  // Données déjà rendues côté serveur : pas de second chargement ; le rafraîchissement en direct reste actif
  useEffect(() => {
    if (!preloaded) void load();
  }, [load, preloaded]);


  // Catégories réellement présentes, proposées dans la recherche du hero
  const heroCategories = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.category).filter(Boolean))] as string[],
    [vehicles]
  );

  useRealtimeRefresh({
    tables: ['vehicles', 'agencies', 'bookings'],
    onRefresh: load,
    pollingIntervalMs: 60_000,
  });

  // Voitures et motos présentées séparément
  const carVehicles = vehicles.filter((v) => !isMotorcycle(v));
  const motoVehicles = vehicles.filter((v) => isMotorcycle(v));

  // Tri : disponibles d'abord, puis prix croissant
  const byAvailabilityThenPrice = (a: Vehicle, b: Vehicle) => {
    const aAvail = a.status === 'AVAILABLE' ? 0 : 1;
    const bAvail = b.status === 'AVAILABLE' ? 0 : 1;
    if (aAvail !== bAvail) return aAvail - bAvail;
    return a.daily_price - b.daily_price;
  };
  const sortedVehicles = [...carVehicles].sort(byAvailabilityThenPrice);
  const featuredMotos = [...motoVehicles].sort(byAvailabilityThenPrice).slice(0, 3);

  // Filtre catégorie + budget (voitures)
  const featuredVehicles = sortedVehicles.filter((v) => {
    const categoryMatch =
      vehicleFilter === 'Tous'
        ? true
        : vehicleFilter === 'Automatique'
        ? v.transmission === 'AUTOMATIC'
        : vehicleFilter === '7 places'
        ? (v.seats ?? 0) >= 7
        : v.category === vehicleFilter;
    const budgetMatch = budgetMax === 0 || v.daily_price <= budgetMax;
    return categoryMatch && budgetMatch;
  });

  const totalAgencies = agencies.length;

  // Filtres pratiques (chips — cumulables avec catégorie)
  // N'apparaissent que si le catalogue contient au moins un véhicule correspondant
  const practicalFilters = [
    carVehicles.some((v) => v.transmission === 'AUTOMATIC') && { label: 'Automatique', key: 'automatic', active: vehicleFilter === 'Automatique' },
    carVehicles.some((v) => (v.seats ?? 0) >= 7) && { label: '7 places', key: '7places', active: vehicleFilter === '7 places' },
  ].filter(Boolean) as { label: string; key: string; active: boolean }[];

  // Puces de catégories : uniquement celles présentes, de la plus fournie à la moins fournie
  const categoryChips = [
    'Tous',
    ...[...new Set(carVehicles.map((v) => v.category).filter(Boolean) as string[])].sort(
      (a, b) => carVehicles.filter((v) => v.category === b).length - carVehicles.filter((v) => v.category === a).length
    ),
  ];

  const destinations = [
    { name: 'Aéroport Nador-Al Aroui', shortName: 'Aéroport', image: '/aeroport%20nador%20al%20aroui.jpeg', icon: Plane, tag: 'Populaire' },
    { name: 'Nador Centre', shortName: 'Nador', image: '/centre%20nadar.jpeg', icon: MapPin, tag: null },
    { name: 'Port Beni Ansar', shortName: 'Beni Ansar', image: '/frontera%20melilla.jpeg', icon: MapPin, tag: 'MRE' },
    { name: 'Marchica & alentours', shortName: 'Marchica', image: '/atalayoun%20nador.jpg', icon: MapPin, tag: null },
  ];

  // Bande de confiance unifiée, cohérente et lisible sur tous les écrans
  const unifiedTrustItems = [
    {
      icon: ShieldCheck,
      title: dataLoaded && totalAgencies > 0 ? `${totalAgencies} agences locales référencées` : 'Agences locales auditées',
      description: 'Registre de commerce, assurance RC et flotte inspectés avant validation sur la plateforme.',
    },
    {
      icon: FileText,
      title: 'Demande sans débit direct',
      description: 'Aucun paiement préalable en ligne. Vous réglez directement à l’agence lors de la remise des clés.',
    },
    {
      icon: MapPin,
      title: 'Prise en charge à Nador',
      description: 'Livraison au terminal de l’Aéroport Al-Aroui, au port de Beni Ansar, en ville ou à votre hébergement.',
    },
    {
      icon: Clock3,
      title: 'Support client local',
      description: `Une équipe locale joignable ${SUPPORT_HOURS_SUMMARY} pour répondre à vos questions.`,
    },
  ];

  return (
    <div className={`min-h-screen bg-[#F8FAFC] text-slate-900${isRTL ? ' is-rtl' : ''}`}>

      {/* ================================================================
          HERO — Contenu affiché dès le premier rendu (aucun fondu bloquant),
          recherche immédiatement utilisable
      ================================================================= */}
      <section className="relative isolate overflow-hidden bg-[#070B12] text-white">
        {/* Photo d'ambiance décorative : alt vide, chargée en priorité (élément LCP) */}
        <Image
          src="/hero-nador.webp"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="-z-20 object-cover object-[70%_center]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-[#05080D]/95 via-[#05080D]/70 to-[#05080D]/25 rtl:bg-linear-to-l" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-[#05080D] via-transparent to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 lg:pb-20 lg:pt-20">
          <h1 className="max-w-3xl text-[28px] font-black leading-[1.1] tracking-tight text-white text-crisp sm:text-5xl lg:text-[56px]">
            {t.hero.titleLead}{' '}
            <span className="text-accent-text">{t.hero.titleAccent}</span>
          </h1>

          {/* Masqué sur les petits téléphones (≤ 720 px de haut) pour garder « Rechercher » visible au chargement */}
          <p className="mt-3 max-w-2xl text-[15px] leading-6 max-sm:[@media(max-height:720px)]:hidden sm:mt-4 sm:leading-7 text-slate-300 sm:text-base">
            {t.hero.subtitle}
          </p>

          {/* Formulaire de recherche — visible et utilisable dès l'ouverture */}
          <div className="mt-5 max-w-5xl sm:mt-7">
            <SearchBar categories={heroCategories} />
          </div>

          {/* Réassurance factuelle + liens secondaires */}
          <div className="mt-5 flex max-w-5xl flex-col gap-4 text-[13px] text-slate-300 lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[t.hero.badgeNoOnlinePayment, t.hero.badgeVerified, t.hero.badgePickup].map((label) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                href="/about"
                className="inline-flex min-h-6 items-center gap-1 font-semibold text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {t.hero.howItWorks}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
              <Link
                href="/agency/join"
                className="inline-flex min-h-6 items-center gap-1 font-semibold text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {t.hero.ctaAgency}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          BANDE DE CONFIANCE UNIQUE — Fusionnée, lisible et factuelle
      ================================================================= */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <GsapReveal
            stagger={0.1}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-100"
          >
            {unifiedTrustItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`flex items-start gap-3.5 ${idx > 0 ? 'lg:pl-6' : ''}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white shadow-sm">
                    <Icon className="h-5 w-5 text-[#E63946]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </GsapReveal>
        </div>
      </section>

      {/* Catégories réellement proposées (voitures / motos) — composant dédié */}
      <StyleExplorer vehicles={vehicles} loading={!dataLoaded} />

      {/* ================================================================
          FEATURED VEHICLES — Distinction nette entre erreur et absence
      ================================================================= */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* En-tête section */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="section-header-eyebrow">
                <span className="h-3 w-3 rounded-full bg-[#E63946]" />
                Sélection ClickDrive
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Les voitures populaires
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Consultez les caractéristiques et envoyez votre demande pour vos dates.
              </p>
            </div>
            <Link
              href="/search"
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#E63946]/30 hover:text-accent-text hover:shadow-md sm:flex"
            >
              Tout explorer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* ── Barre de dates ──────────────────────────────────────────────── */}
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-xs p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label htmlFor="date-depart" className="text-xs font-semibold text-slate-600 shrink-0 w-16">
                  Départ
                </label>
                <input
                  id="date-depart"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const start = e.target.value;
                    const endInput = document.getElementById('date-retour') as HTMLInputElement | null;
                    const end = endInput?.value ?? '';
                    if (start && end && end > start) {
                      const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
                      setSelectedDays(diff > 0 ? diff : 0);
                    } else {
                      setSelectedDays(0);
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B1220] focus:border-transparent transition min-h-11"
                  aria-label="Date de départ"
                />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label htmlFor="date-retour" className="text-xs font-semibold text-slate-600 shrink-0 w-16">
                  Retour
                </label>
                <input
                  id="date-retour"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const end = e.target.value;
                    const startInput = document.getElementById('date-depart') as HTMLInputElement | null;
                    const start = startInput?.value ?? '';
                    if (start && end && end > start) {
                      const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
                      setSelectedDays(diff > 0 ? diff : 0);
                    } else {
                      setSelectedDays(0);
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B1220] focus:border-transparent transition min-h-11"
                  aria-label="Date de retour"
                />
              </div>
              {selectedDays > 0 && (
                <div className="shrink-0 rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-bold text-white flex items-center">
                  {selectedDays} jour{selectedDays > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* ── Chips filtres rapides ───────────────────────────────────────── */}
          <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par catégorie">
            {categoryChips.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setVehicleFilter(filter)}
                aria-pressed={vehicleFilter === filter}
                className={
                  vehicleFilter === filter
                    ? 'rounded-full px-4 py-2 text-xs font-bold bg-[#0B1220] text-white shadow-sm transition min-h-11'
                    : 'rounded-full px-4 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition min-h-11'
                }
              >
                {filter}
                {filter !== 'Tous' && (
                  <span className="ml-1.5 opacity-60">
                    ({carVehicles.filter((v) => v.category === filter).length})
                  </span>
                )}
              </button>
            ))}
            {/* Filtres pratiques (boîte, places) : ils filtrent cette liste, donc ils sont ici */}
            {practicalFilters.length > 0 && (
              <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
            )}
            {practicalFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setVehicleFilter(f.active ? 'Tous' : f.label)}
                aria-pressed={f.active}
                className={
                  f.active
                    ? 'rounded-full px-4 py-2 text-xs font-bold bg-[#0B1220] text-white shadow-sm transition min-h-11'
                    : 'rounded-full px-4 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition min-h-11'
                }
              >
                {f.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <label htmlFor="budget-max" className="text-xs font-semibold text-slate-600 shrink-0">
                Budget&nbsp;:
              </label>
              <select
                id="budget-max"
                value={budgetMax}
                onChange={(e) => setBudgetMax(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B1220] transition min-h-11 cursor-pointer"
                aria-label="Budget maximum par jour"
              >
                <option value={0}>Tous budgets</option>
                <option value={300}>≤ 300 DH/j</option>
                <option value={500}>≤ 500 DH/j</option>
                <option value={800}>≤ 800 DH/j</option>
                <option value={1200}>≤ 1 200 DH/j</option>
              </select>
            </div>
          </div>

          {/* État d'erreur technique explicite */}
          {hasError ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/60 p-8 text-center sm:p-12">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Impossible de charger les véhicules</h3>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
                Une interruption temporaire de connexion empêche d&apos;afficher les véhicules en direct.
              </p>
              <button
                type="button"
                onClick={() => { setDataLoaded(false); void load(); }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer
              </button>
            </div>
          ) : !dataLoaded ? (
            /* Chargement skeleton */
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-80 rounded-2xl" />
              ))}
            </div>
          ) : featuredVehicles.length === 0 ? (
            /* Absence réelle de données (plateforme en cours de déploiement) */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-[#F6F5F1] p-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                <Car className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Consultez la flotte par destination</h3>
              <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500">
                Les véhicules sont gérés en direct par les agences locales à Nador. Utilisez le formulaire de recherche ci-dessus pour afficher les disponibilités exactes pour vos dates.
              </p>
              <Link href="/search" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800">
                <Search className="h-3.5 w-3.5" />
                Lancer une recherche de véhicule
              </Link>
            </div>
          ) : (
            /* Grille de véhicules réelle */
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredVehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  priority={index < 3}
                  selectedDays={selectedDays > 0 ? selectedDays : undefined}
                />
              ))}
            </div>
          )}

          <div className="mt-8 flex justify-center sm:hidden">
            <Link href="/search" className="btn-primary px-5 py-3 text-sm">
              Voir toutes les voitures <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          MOTOS — Section distincte, affichée seulement si des motos sont publiées
      ================================================================= */}
      {dataLoaded && !hasError && featuredMotos.length > 0 && (
        <section aria-labelledby="home-motos-title" className="border-t border-slate-200 bg-[#F5F6F8] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="section-header-eyebrow">
                  <Motorbike className="h-3.5 w-3.5" aria-hidden="true" />
                  Deux-roues
                </p>
                <h2 id="home-motos-title" className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Motos et scooters
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {motoVehicles.length} moto{motoVehicles.length > 1 ? 's' : ''} proposée{motoVehicles.length > 1 ? 's' : ''} par les agences partenaires, avec cylindrée et permis exigé.
                </p>
              </div>
              <Link
                href="/motos"
                className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#E63946]/30 hover:text-accent-text hover:shadow-md sm:flex"
              >
                Toutes les motos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredMotos.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  selectedDays={selectedDays > 0 ? selectedDays : undefined}
                />
              ))}
            </div>
            <div className="mt-8 flex justify-center sm:hidden">
              <Link href="/motos" className="btn-primary px-5 py-3 text-sm">
                Voir toutes les motos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          DESTINATIONS
      ================================================================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10">
          <p className="section-header-eyebrow">
            <span className="h-3 w-3 rounded-full bg-[#E63946]" />
            Où récupérer votre voiture ?
          </p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Louez là où votre voyage commence
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Prise en charge directe aux principaux points d’arrivée à Nador.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <Link
                href={`/search?location=${encodeURIComponent(destination.shortName)}`}
                key={destination.name}
                className="group relative aspect-[1.15] overflow-hidden rounded-2xl bg-slate-900"
              >
                <Image
                  src={destination.image}
                  alt={destination.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="image-zoom-subtle object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-0 bg-[#E63946]/0 transition-all duration-500 group-hover:bg-[#E63946]/12" />

                {destination.tag && (
                  <div className="absolute right-3 top-3">
                    <span className="badge badge-accent text-[11px]">{destination.tag}</span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition group-hover:bg-[#E63946]">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white sm:text-base">{destination.name}</p>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-white/70 transition group-hover:text-white">
                    Explorer les voitures
                    <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      {/* Les carrousels des marques sont en bas des catalogues : voitures sur /search, motos sur /motos */}
    </div>
  );
}
