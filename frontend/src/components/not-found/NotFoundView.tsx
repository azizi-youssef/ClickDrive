'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Car, CircleHelp, Home, Motorbike, Search } from 'lucide-react';
import type { Vehicle } from '@/types';
import { VehicleCard } from '@/components/cars/VehicleCard';
import carHeroImage from '../../../public/voiture.jpg';
import { notFoundVariant, pickSuggestions } from './variants';

const DESTINATIONS = [
  { href: '/search', title: 'Voitures', text: 'Comparez les voitures des agences de Nador.', icon: Car },
  { href: '/motos', title: 'Motos et scooters', text: 'Scooters, trails et roadsters à la journée.', icon: Motorbike },
  { href: '/agencies', title: 'Agences partenaires', text: 'Les agences de location vérifiées.', icon: Building2 },
  { href: '/faq', title: 'Aide', text: 'Réservation, caution, permis : nos réponses.', icon: CircleHelp },
] as const;

type Suggestions = { vehicles: Vehicle[]; brand: string | null };

const noopSubscribe = () => () => {};

/** Retour possible seulement si l'on vient d'une page du site (sinon « Précédent » quitterait ClickDrive) */
function readCanGoBack(): boolean {
  try {
    return window.history.length > 1 && document.referrer !== '' && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

function CarSilhouette() {
  return (
    <svg viewBox="0 0 120 40" aria-hidden="true" className="h-9 w-27 sm:h-11 sm:w-33" fill="none">
      <path
        d="M5 29c0-4 1-7 5-9l9-3 14-1 9-9c2-2 4-3 7-3h22c4 0 7 1 10 4l8 8 13 2c5 1 8 4 8 9v2c0 2-1 3-3 3H8c-2 0-3-1-3-3Z"
        fill="#E9EBEF"
      />
      <path d="M44 16l7-7c1-1 2-1 4-1h10v8H44Zm28-8h6c2 0 4 1 5 2l6 6H72V8Z" fill="#0B1220" opacity="0.85" />
      <circle cx="28" cy="31" r="7" fill="#0B1220" stroke="#E9EBEF" strokeWidth="2" />
      <circle cx="94" cy="31" r="7" fill="#0B1220" stroke="#E9EBEF" strokeWidth="2" />
      <circle cx="28" cy="31" r="2" fill="#E9EBEF" />
      <circle cx="94" cy="31" r="2" fill="#E9EBEF" />
      <rect x="110" y="21" width="6" height="3" rx="1.5" fill="#E63946" />
    </svg>
  );
}

/** Plaque « 404 » : repère visuel immédiat, décoratif (le titre porte le message) */
function Plate() {
  return (
    <div
      aria-hidden="true"
      className="relative inline-flex items-stretch overflow-hidden rounded-2xl bg-white text-[#0B1220] shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
    >
      <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-slate-300" />
      <span className="m-1 ml-4 flex items-center rounded-xl border-[3px] border-[#0B1220] px-5 py-1.5 text-6xl font-extrabold leading-none tracking-tighter sm:px-7 sm:text-7xl">
        404
      </span>
      <span className="flex items-center bg-action px-3 text-xs font-semibold text-white sm:px-4 sm:text-sm">Introuvable</span>
    </div>
  );
}

function VehicleSuggestions({ suggestions }: { suggestions: Suggestions | null }) {
  // Aucune proposition à faire (ou catalogue injoignable) : la section n'apparaît pas
  if (suggestions && suggestions.vehicles.length === 0) return null;
  return (
    <section aria-labelledby="nf-suggestions" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="nf-suggestions" className="text-xl font-extrabold tracking-tight text-[#0B1220] sm:text-2xl">
            Disponibles à Nador
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {suggestions?.brand
              ? `Les ${suggestions.brand} encore en ligne sont proposées en premier.`
              : 'Des véhicules libres aujourd’hui chez nos agences partenaires.'}
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-bold text-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
        >
          Tout le catalogue
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
      {suggestions === null ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Chargement des véhicules disponibles">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`h-80 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none${index > 0 ? ' max-sm:hidden' : ''}${index > 1 ? ' max-lg:hidden' : ''}`}
            />
          ))}
        </div>
      ) : (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.vehicles.map((vehicle) => (
            <li key={vehicle.id}>
              <VehicleCard vehicle={vehicle} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NotFoundView() {
  const pathname = usePathname();
  const router = useRouter();
  const variant = useMemo(() => notFoundVariant(pathname), [pathname]);
  const canGoBack = useSyncExternalStore(noopSubscribe, readCanGoBack, () => false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  // Lien d'annonce mort : propositions issues du catalogue réel, chargées par le navigateur
  // (les robots qui explorent des URL inexistantes ne déclenchent aucune requête au catalogue)
  useEffect(() => {
    if (variant.kind !== 'vehicle' || !pathname) return;
    const controller = new AbortController();
    fetch('/api/vehicles?limit=200', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { success?: boolean; data?: Vehicle[] } | null) => {
        const vehicles = json?.success && Array.isArray(json.data) ? json.data : [];
        setSuggestions(pickSuggestions(vehicles, pathname));
      })
      .catch(() => {
        if (!controller.signal.aborted) setSuggestions({ vehicles: [], brand: null });
      });
    return () => controller.abort();
  }, [variant.kind, pathname]);

  const showPath = Boolean(pathname && pathname !== '/');

  return (
    <div className="bg-[#F5F6F8] pb-14 sm:pb-16">
      <style>{`@keyframes clickdrive-drive{from{transform:translateX(-25vw)}to{transform:translateX(125vw)}}`}</style>

      {/* ── En-tête : ce qui s'est passé et comment repartir ── */}
      <section aria-labelledby="nf-title" className="relative isolate overflow-hidden bg-[#0B1220] text-white">
        <Image
          src={carHeroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[70%_45%]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#0B1220]/85" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-[#0B1220] via-transparent to-[#0B1220]/40" />

        <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 text-center sm:px-6 sm:pb-28 sm:pt-16">
          <Plate />
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[#FF8A93]">Erreur 404</p>
          <h1 id="nf-title" className="mt-2 text-[28px] font-black leading-tight tracking-tight text-white sm:text-5xl">
            {variant.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-slate-300 sm:text-base">{variant.text}</p>

          {showPath && (
            <p className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/15">
              <span className="shrink-0">Adresse demandée</span>
              <code className="truncate font-mono text-white">{pathname}</code>
            </p>
          )}

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={variant.primary.href}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-action px-6 text-[15px] font-bold text-white transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220]"
            >
              {variant.primary.label}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
            {canGoBack ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                Page précédente
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Retour à l’accueil
              </Link>
            )}
          </div>

          {/* Recherche par marque ou modèle : appliquée au catalogue des voitures (?q=) */}
          <form
            action="/search"
            method="get"
            role="search"
            aria-label="Rechercher une voiture"
            className="mx-auto mt-8 flex w-full max-w-lg gap-2 rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]"
          >
            <label htmlFor="nf-q" className="sr-only">
              Marque ou modèle
            </label>
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="nf-q"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Marque ou modèle"
                className="h-11 w-full rounded-xl bg-transparent pl-9 pr-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-[#E63946]/40"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] px-4 text-sm font-bold text-white transition-colors hover:bg-[#1B2433] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] sm:px-5"
            >
              Rechercher
            </button>
          </form>
        </div>

        {/* Route et voiture : décor, animé seulement si le mouvement est autorisé */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-8 h-0.5"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.28) 0 36px, transparent 36px 68px)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[34px] left-0 hidden motion-safe:block motion-safe:animate-[clickdrive-drive_16s_linear_infinite]"
        >
          <CarSilhouette />
        </div>
      </section>

      {variant.kind === 'vehicle' && <VehicleSuggestions suggestions={suggestions} />}

      {/* ── Rubriques principales ── */}
      <section aria-labelledby="nf-destinations" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8">
        <h2 id="nf-destinations" className="text-xl font-extrabold tracking-tight text-[#0B1220] sm:text-2xl">
          Où voulez-vous aller ?
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.map(({ href, title, text, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-[0_14px_30px_-20px_rgba(11,18,32,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
              >
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white transition-colors group-hover:bg-action">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[#0B1220]">{title}</span>
                  <span className="mt-0.5 block text-sm leading-5 text-slate-600">{text}</span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-slate-600 rtl:rotate-180"
                />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-sm text-slate-600">
          Un lien de notre site vous a mené ici ?{' '}
          <Link href="/contact" className="font-semibold text-[#0B1220] underline underline-offset-4 hover:text-accent-text">
            Signalez-le-nous
          </Link>
        </p>
      </section>
    </div>
  );
}
