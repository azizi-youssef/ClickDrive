'use client';

import { useId, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Car, Motorbike } from 'lucide-react';
import type { Vehicle } from '@/types';
import { cn } from '@/lib/utils';
import { isOptimizableImage } from '@/lib/utils/images';
import {
  CAR_CATEGORIES,
  CATALOG_PATHS,
  MOTORCYCLE_CATEGORIES,
  vehicleTypeOf,
  type VehicleType,
} from '@/lib/vehicles/kind';

/**
 * Visuels et accroches par catégorie (taxonomie officielle de `lib/vehicles/kind`).
 * Photos locales homogènes ; sans photo dédiée, la carte reprend la photo d'un véhicule réel de la catégorie.
 */
const CATEGORY_VISUALS: Record<string, { image?: string; pitch: string }> = {
  'Économique': { image: '/economique.jpeg', pitch: 'Sobre et pratique au quotidien' },
  Citadine: { image: '/peugeot-208.jpg', pitch: 'Facile à garer en ville' },
  Compacte: { image: '/opel%20Astra.jpeg', pitch: 'Polyvalente sur tous les trajets' },
  Berline: { image: '/Mercedes%20Class%20C%20220%20D.jpeg', pitch: 'Confort sur longue distance' },
  SUV: { image: '/suv.jpeg', pitch: 'Espace et position de conduite haute' },
  Luxe: { image: '/luxe.jpeg', pitch: 'Prestige pour vos grandes occasions' },
  '7 places': { image: '/voiture%207%20places.jpeg', pitch: 'Famille et groupes, sans compromis' },
  Automatique: { image: '/peugeot-e-208.jpg', pitch: 'Conduite détendue, sans embrayage' },
  Scooter: { pitch: 'Agile et économique en ville' },
  Roadster: { image: '/yamaha-mt-09-yamt.png', pitch: 'Puissance et plaisir de conduite' },
  Trail: { image: '/suzuki.jpeg', pitch: 'Routes de l’Oriental et pistes' },
  Sportive: { pitch: 'Sensations sur route' },
  Custom: { pitch: 'Balades au long cours' },
};

const KIND_COPY: Record<VehicleType, { label: string; noun: [string, string]; empty: string }> = {
  CAR: { label: 'Voitures', noun: ['voiture', 'voitures'], empty: 'Aucune voiture publiée pour le moment.' },
  MOTORCYCLE: { label: 'Motos', noun: ['moto', 'motos'], empty: 'Aucune moto publiée pour le moment.' },
};

interface CategorySummary {
  name: string;
  count: number;
  minPrice: number;
  image: string | null;
  pitch: string;
}

/** Résumé réel par catégorie : nombre de véhicules publiés, prix de départ, visuel. */
export function summarizeCategories(vehicles: readonly Vehicle[], kind: VehicleType) {
  const taxonomy: readonly string[] = kind === 'MOTORCYCLE' ? MOTORCYCLE_CATEGORIES : CAR_CATEGORIES;
  const scoped = vehicles.filter((vehicle) => vehicleTypeOf(vehicle) === kind);

  const available: CategorySummary[] = [];
  const upcoming: string[] = [];
  for (const name of taxonomy) {
    const inCategory = scoped.filter((vehicle) => vehicle.category === name);
    if (inCategory.length === 0) {
      upcoming.push(name);
      continue;
    }
    const visual = CATEGORY_VISUALS[name];
    const fallback = inCategory.find((vehicle) => vehicle.images?.[0])?.images?.[0] ?? null;
    available.push({
      name,
      count: inCategory.length,
      minPrice: Math.min(...inCategory.map((vehicle) => vehicle.daily_price)),
      image: visual?.image ?? fallback,
      pitch: visual?.pitch ?? '',
    });
  }
  // Les catégories les plus fournies d'abord
  available.sort((a, b) => b.count - a.count);
  return { available, upcoming, total: scoped.length };
}

function CategoryCard({ category, kind, priority }: { category: CategorySummary; kind: VehicleType; priority: boolean }) {
  const [one, many] = KIND_COPY[kind].noun;
  const href = `${CATALOG_PATHS[kind]}?category=${encodeURIComponent(category.name)}`;
  const Icon = kind === 'MOTORCYCLE' ? Motorbike : Car;
  const countLabel = `${category.count} ${category.count > 1 ? many : one}`;
  const price = `${category.minPrice.toLocaleString('fr-FR')} DH`;

  return (
    <Link
      href={href}
      // Nom lu par les lecteurs d'écran : catégorie d'abord, puis faits réels (reprend le texte visible)
      aria-label={`${category.name} — ${countLabel}, dès ${price} par jour`}
      className="group relative flex h-full min-h-72 flex-col justify-end overflow-hidden rounded-3xl bg-[#0B1220] text-white outline-none ring-offset-2 transition-shadow duration-300 hover:shadow-[0_24px_48px_-24px_rgba(11,18,32,0.55)] focus-visible:ring-2 focus-visible:ring-[#E63946] sm:min-h-80"
    >
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 45vw, 30vw"
          unoptimized={!isOptimizableImage(category.image)}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-slate-800 to-[#0B1220]" aria-hidden="true">
          <Icon className="h-16 w-16 text-white/15" />
        </span>
      )}

      {/* Lisibilité du texte sur toutes les photos (contraste AA garanti par le dégradé) */}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#0B1220]/95 via-[#0B1220]/45 to-transparent" aria-hidden="true" />

      {/* Nombre réel de véhicules */}
      <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#0B1220] shadow-sm">
        <Icon className="h-3.5 w-3.5 text-[#C92F3B]" aria-hidden="true" />
        {countLabel}
      </span>

      <span className="relative flex items-end justify-between gap-3 p-5">
        <span className="min-w-0">
          <span className="block text-xl font-black leading-tight tracking-tight sm:text-2xl">{category.name}</span>
          {category.pitch && <span className="mt-1 block text-sm font-medium text-white/80">{category.pitch}</span>}
          <span className="mt-3 block text-sm text-white/75">
            dès <span className="text-base font-extrabold text-white tabular-nums">{price}</span> / jour
          </span>
        </span>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors duration-200 group-hover:bg-[#E63946] group-focus-visible:bg-[#E63946] motion-reduce:transition-none"
          aria-hidden="true"
        >
          <ArrowUpRight className="h-5 w-5 rtl:-scale-x-100" />
        </span>
      </span>

      {/* Accent de marque au survol */}
      <span
        className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-[#E63946] transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none rtl:origin-right"
        aria-hidden="true"
      />
    </Link>
  );
}

function SkeletonCard() {
  return <div className="min-h-72 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none sm:min-h-80" aria-hidden="true" />;
}

/**
 * « Trouvez votre style » : catégories réellement proposées, voitures ou motos.
 * - données réelles uniquement (nombre de véhicules publiés, prix de départ) ;
 * - catégories vides regroupées en une ligne « Bientôt » au lieu de cartes grisées ;
 * - bascule Voitures / Motos (boutons à état, annonce polie du résultat) ;
 * - mobile : défilement horizontal aimanté ; tablette : 2 colonnes ; ordinateur : 3 colonnes
 *   (une catégorie seule garde une largeur de carte, sans photo étirée sur toute la page).
 */
export function StyleExplorer({ vehicles, loading }: { vehicles: readonly Vehicle[]; loading: boolean }) {
  const [kind, setKind] = useState<VehicleType>('CAR');
  const headingId = useId();
  const summaries = useMemo(
    () => ({ CAR: summarizeCategories(vehicles, 'CAR'), MOTORCYCLE: summarizeCategories(vehicles, 'MOTORCYCLE') }),
    [vehicles]
  );
  const current = summaries[kind];
  const copy = KIND_COPY[kind];

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="section-header-eyebrow">
            <span className="h-3 w-3 rounded-full bg-[#E63946]" aria-hidden="true" />
            Explorer
          </p>
          <h2 id={headingId} className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Trouvez votre style
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Citadine pour la ville, SUV pour la famille, scooter pour la corniche : choisissez le type qui correspond à votre
            séjour à Nador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bascule voitures / motos */}
          <div role="group" aria-label="Type de véhicule" className="inline-flex rounded-2xl bg-slate-100 p-1">
            {(['CAR', 'MOTORCYCLE'] as const).map((type) => {
              const active = type === kind;
              const Icon = type === 'MOTORCYCLE' ? Motorbike : Car;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(type)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E63946]',
                    active ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-600 hover:text-[#0B1220]'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {KIND_COPY[type].label}
                  {!loading && (
                    <span className={cn('tabular-nums', active ? 'text-slate-500' : 'text-slate-400')}>
                      {summaries[type].total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Link
            href={CATALOG_PATHS[kind]}
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm outline-none transition hover:border-[#E63946]/30 hover:text-accent-text focus-visible:ring-2 focus-visible:ring-[#E63946] sm:inline-flex"
          >
            Toutes les {copy.noun[1]}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Annonce du changement de type pour les lecteurs d'écran */}
      <p className="sr-only" aria-live="polite">
        {loading
          ? ''
          : `${copy.label} : ${current.available.length} catégorie${current.available.length > 1 ? 's' : ''} disponible${current.available.length > 1 ? 's' : ''}`}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : current.available.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">{copy.empty}</p>
          <Link href={CATALOG_PATHS[kind]} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent-text">
            Voir le catalogue <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {current.available.map((category, index) => (
            <li key={category.name} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
              <CategoryCard category={category} kind={kind} priority={index === 0} />
            </li>
          ))}
        </ul>
      )}

      {!loading && current.upcoming.length > 0 && (
        <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Bientôt :</span>
          {current.upcoming.map((name) => (
            <span key={name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {name}
            </span>
          ))}
        </p>
      )}

      <div className="mt-6 flex justify-center sm:hidden">
        <Link
          href={CATALOG_PATHS[kind]}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm"
        >
          Toutes les {copy.noun[1]} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
