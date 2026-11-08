import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CarFront,
  Check,
  Compass,
  MapPin,
  MessageCircle,
  PhoneCall,
  Plane,
  Search,
  ShieldCheck,
  Ship,
  Shuffle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LOCATIONS_NADOR } from '@/lib/constants/catalog';

export const metadata: Metadata = {
  title: 'Comment ça marche',
  alternates: { canonical: '/about' },
  description:
    'ClickDrive rassemble les voitures des agences de location de Nador au même endroit : cherchez le modèle dont vous avez besoin, pas une agence.',
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] focus-visible:ring-offset-2';

const benefits = [
  {
    icon: Search,
    title: 'Trouvez votre véhicule',
    description:
      'Partez d’un modèle, d’un budget ou d’un besoin. Les véhicules des agences partenaires sont réunis au même endroit.',
  },
  {
    icon: ShieldCheck,
    title: 'Des agences partenaires identifiées',
    description:
      'Chaque agence et chaque véhicule sont présentés avec des informations claires, pour réserver en confiance.',
  },
  {
    icon: Shuffle,
    title: 'Une alternative si votre modèle est indisponible',
    description:
      'Quand la voiture voulue est prise, ClickDrive propose des véhicules équivalents chez d’autres partenaires.',
  },
  {
    icon: Compass,
    title: 'Pensé pour Nador et sa région',
    description:
      'Aéroport Al-Aroui, Beni Ansar, Nador Centre, Marchica : la plateforme suit les trajets réels du territoire.',
  },
];

const steps = [
  {
    icon: SlidersHorizontal,
    title: 'Décrivez votre besoin',
    description: 'Indiquez vos dates, votre point de prise en charge et le type de véhicule souhaité.',
  },
  {
    icon: CarFront,
    title: 'Comparez les véhicules',
    description: 'Parcourez les modèles disponibles chez les différentes agences partenaires, côte à côte.',
  },
  {
    icon: MessageCircle,
    title: 'Contactez directement l’agence',
    description: 'Consultez la fiche du véhicule, envoyez votre demande et échangez avec l’agence qui le propose.',
  },
];

const destinations = [
  {
    name: 'Aéroport Nador-Al Aroui',
    detail: 'Récupérez votre voiture dès l’atterrissage.',
    image: '/aeroport%20nador%20al%20aroui.jpeg',
    icon: Plane,
    href: '/location-voiture-nador-aeroport',
  },
  {
    name: 'Port de Beni Ansar',
    detail: 'Idéal pour les arrivées en ferry.',
    image: '/frontera%20melilla.jpeg',
    icon: Ship,
    href: '/location-voiture-beni-ansar',
  },
  {
    name: 'Nador Centre',
    detail: 'Au cœur de la ville, boulevard Mohammed V.',
    image: '/centre%20nadar.jpeg',
    icon: Building2,
    href: '/location-voiture-nador',
  },
  {
    name: 'Marchica',
    detail: 'La lagune et la corniche, à quelques minutes.',
    image: '/atalayoun%20nador.jpg',
    icon: MapPin,
    href: `/search?location=${encodeURIComponent('Corniche Marchica (Nador)')}`,
  },
];

/* Autres points de prise en charge proposés par la recherche (même liste que la barre de recherche) */
const otherLocations = LOCATIONS_NADOR.filter(
  (location) =>
    !/aeroport|beni ansar|centre-ville|marchica/i.test(
      location.normalize('NFD').replace(/[̀-ͯ]/g, '')
    )
);

function SectionEyebrow({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p
      className={`inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] ${
        tone === 'dark' ? 'text-[#FF6B76]' : 'text-accent-text'
      }`}
    >
      <span className="h-px w-7 bg-current" aria-hidden="true" />
      {children}
    </p>
  );
}

/* ── Illustration du principe : une recherche, plusieurs agences ───────── */
function MarketplaceIllustration() {
  const rows = [
    { tone: 'available', label: 'Disponible' },
    { tone: 'available', label: 'Disponible' },
    { tone: 'unavailable', label: 'Indisponible' },
  ] as const;

  return (
    <figure className="relative mx-auto w-full max-w-[460px]" aria-labelledby="hero-illustration-caption">
      {/* Halo + grille */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_70%_20%,rgba(230,57,70,0.35),transparent_55%)] blur-2xl"
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111A2B] p-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:28px_28px]"
        />

        {/* Recherche */}
        <div className="relative flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Votre recherche</p>
            <p className="truncate text-sm font-extrabold text-[#0B1220]">SUV · Aéroport Nador</p>
          </div>
          <span className="hidden items-center gap-1 rounded-full bg-[#F5F6F8] px-2.5 py-1 text-[11px] font-bold text-slate-600 sm:inline-flex">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Vos dates
          </span>
        </div>

        {/* Connecteurs */}
        <div aria-hidden="true" className="relative mx-auto my-2 flex h-6 w-3/4 items-start justify-between">
          <span className="absolute inset-x-0 top-0 h-3 rounded-b-xl border-x border-b border-dashed border-white/25" />
          <span className="absolute start-1/2 top-0 h-6 w-px border-s border-dashed border-white/25" />
        </div>

        {/* Agences partenaires */}
        <ul className="relative space-y-2.5">
          {rows.map((row, index) => (
            <li
              key={index}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                row.tone === 'available'
                  ? 'border-white/10 bg-white/[0.06]'
                  : 'border-white/5 bg-white/[0.02] opacity-70'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Building2 className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5" aria-hidden="true">
                <span className="block h-2 w-24 rounded-full bg-white/35" />
                <span className="flex items-center gap-1.5">
                  <CarFront className="h-3.5 w-3.5 text-white/50" />
                  <span className="block h-1.5 w-16 rounded-full bg-white/15" />
                </span>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  row.tone === 'available' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-slate-300'
                }`}
              >
                {row.tone === 'available' ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <X className="h-3 w-3" aria-hidden="true" />
                )}
                {row.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Alternative */}
        <div className="relative mt-3 flex items-center gap-3 rounded-2xl bg-action px-4 py-3 text-white">
          <Shuffle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-[13px] font-semibold leading-snug">
            Modèle pris ? <span className="font-extrabold">Un équivalent vous est proposé.</span>
          </p>
        </div>
      </div>

      <figcaption id="hero-illustration-caption" className="mt-3 text-center text-[11px] font-medium text-slate-400">
        Illustration du principe — une recherche, plusieurs agences partenaires
      </figcaption>
    </figure>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#0B1220] antialiased">
      {/* ═══ 1. HERO ═══════════════════════════════════════════════════════ */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-[#0B1220] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-40 bottom-0 h-80 w-80 rounded-full bg-[#E63946]/15 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="max-w-xl">
            <SectionEyebrow tone="dark">Comment ça marche</SectionEyebrow>

            <h1
              id="hero-title"
              className="mt-5 text-balance text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[68px]"
            >
              Cherchez la voiture, <span className="text-accent-text">pas l’agence.</span>
            </h1>

            <p className="mt-6 text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              ClickDrive rassemble les véhicules des agences de location de Nador. Voyageurs et résidents trouvent le
              modèle dont ils ont besoin, puis contactent directement l’agence qui le propose.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/search"
                className={`group inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-action px-7 text-[15px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(230,57,70,0.7)] transition-colors hover:bg-action-hover motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-[#0B1220]`}
              >
                Explorer les véhicules
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/agencies"
                className={`inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/20 px-7 text-[15px] font-bold text-white transition-colors hover:border-white/40 hover:bg-white/5 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-[#0B1220]`}
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Voir les agences
              </Link>
            </div>

            <ul className="mt-10 grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-3 sm:gap-4">
              {['Sans paiement en ligne', 'Agences partenaires vérifiées', 'Contact direct avec l’agence'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <MarketplaceIllustration />
        </div>
      </section>

      {/* ═══ 2. PROBLÈME / SOLUTION ════════════════════════════════════════ */}
      <section aria-labelledby="story-title" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <SectionEyebrow>Le constat</SectionEyebrow>
            <h2
              id="story-title"
              className="mt-4 text-balance text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[42px]"
            >
              Trouver une voiture ne devrait pas demander dix appels.
            </h2>
            <div className="mt-6 space-y-5 text-base leading-8 text-slate-600">
              <p>
                À Nador, un voyageur peut avoir besoin d’un véhicule dès son arrivée à l’aéroport Al-Aroui ou au port
                de Beni Ansar. Pour trouver un modèle précis, il faut aujourd’hui contacter plusieurs agences, une par
                une.
              </p>
              <p>
                ClickDrive inverse la démarche :{' '}
                <strong className="font-bold text-[#0B1220]">
                  on commence par la voiture recherchée, pas par le nom de l’agence.
                </strong>{' '}
                La plateforme réunit les véhicules, permet de comparer les options disponibles et met en relation avec
                le bon partenaire.
              </p>
            </div>
          </div>

          {/* Explication visuelle : avant / avec ClickDrive */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Sans ClickDrive</p>
              <p className="mt-2 text-lg font-extrabold">Une agence après l’autre</p>
              <ol className="mt-5 space-y-2.5" aria-label="Démarche sans ClickDrive">
                {['Appeler une première agence', 'Modèle indisponible, rappeler ailleurs', 'Comparer de mémoire', 'Recommencer…'].map(
                  (item, index) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                        <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className={index === 3 ? 'italic' : undefined}>{item}</span>
                    </li>
                  )
                )}
              </ol>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-[#0B1220] p-6 text-white">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-[#E63946]/30 blur-3xl"
              />
              <p className="relative text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF6B76]">Avec ClickDrive</p>
              <p className="relative mt-2 text-lg font-extrabold">Une seule recherche</p>
              <ol className="relative mt-5 space-y-2.5" aria-label="Démarche avec ClickDrive">
                {['Une recherche pour toutes les agences', 'Les véhicules comparés côte à côte', 'Une alternative si le modèle est pris', 'Le contact direct de l’agence'].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-slate-200">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action text-white">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  )
                )}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3. AVANTAGES ══════════════════════════════════════════════════ */}
      <section aria-labelledby="benefits-title" className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <SectionEyebrow>Pourquoi ClickDrive</SectionEyebrow>
              <h2
                id="benefits-title"
                className="mt-4 text-balance text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[42px]"
              >
                Une recherche plus courte, du besoin jusqu’au volant.
              </h2>
            </div>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <li
                  key={benefit.title}
                  className="group relative flex flex-col rounded-3xl border border-slate-200 bg-[#F5F6F8] p-6 transition-colors duration-300 hover:border-[#0B1220]/20 hover:bg-white motion-reduce:transition-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B1220] text-white transition-colors duration-300 group-hover:bg-action motion-reduce:transition-none">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold tabular-nums text-slate-300" aria-hidden="true">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-extrabold leading-snug">{benefit.title}</h3>
                  <p className="mt-2.5 text-sm leading-7 text-slate-600">{benefit.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ═══ 4. PARCOURS EN 3 ÉTAPES ═══════════════════════════════════════ */}
      <section aria-labelledby="steps-title" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <SectionEyebrow>Le parcours</SectionEyebrow>
          <h2
            id="steps-title"
            className="mt-4 text-balance text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[42px]"
          >
            Comment fonctionne ClickDrive ?
          </h2>
        </div>

        {/* Mobile/tablette : parcours vertical — desktop : frise horizontale */}
        <ol className="relative mt-12 grid gap-0 lg:grid-cols-3 lg:gap-6">
          <span
            aria-hidden="true"
            className="absolute start-[22px] top-2 bottom-2 w-px bg-linear-to-b from-[#E63946] via-slate-300 to-slate-200 lg:hidden"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-[16%] top-[22px] hidden h-px bg-linear-to-r from-[#E63946] via-slate-300 to-slate-200 lg:block rtl:bg-linear-to-l"
          />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0 lg:flex-col lg:items-center lg:pb-0 lg:text-center">
                <span
                  className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ring-8 ring-[#F5F6F8] ${
                    index === 0 ? 'bg-action text-white' : 'bg-[#0B1220] text-white'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-3xl border border-slate-200 bg-white p-6 lg:mt-6 lg:w-full">
                  <Icon className="h-5 w-5 text-[#E63946] lg:mx-auto" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-extrabold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 flex justify-center">
          <Link
            href="/search"
            className={`group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-7 text-sm font-bold text-white transition-colors hover:bg-action sm:w-auto motion-reduce:transition-none ${focusRing}`}
          >
            Commencer ma recherche
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      {/* ═══ 5. ANCRAGE LOCAL ══════════════════════════════════════════════ */}
      <section aria-labelledby="local-title" className="relative overflow-hidden bg-[#0B1220] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-32 top-0 h-96 w-96 rounded-full bg-[#E63946]/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <SectionEyebrow tone="dark">Nador &amp; sa région</SectionEyebrow>
              <h2
                id="local-title"
                className="mt-4 text-balance text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[42px]"
              >
                Conçu pour les déplacements autour de Nador.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                ClickDrive couvre les principaux points de mobilité de la région, pour récupérer une voiture là où le
                trajet commence.
              </p>
            </div>
          </div>

          {/* Mobile : carrousel horizontal — tablette : 2 colonnes — desktop : 4 colonnes */}
          <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {destinations.map((destination) => {
              const Icon = destination.icon;
              return (
                <li key={destination.name} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <Link
                    href={destination.href}
                    className={`group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-slate-800 sm:aspect-[4/3] lg:aspect-[3/4] ${focusRing} focus-visible:ring-offset-[#0B1220]`}
                  >
                    <Image
                      src={destination.image}
                      alt={destination.name}
                      fill
                      sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 300px"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-[#0B1220] via-[#0B1220]/40 to-transparent" />
                    <span className="absolute start-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-md">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <span className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0B1220] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none">
                      <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="text-lg font-extrabold leading-tight">{destination.name}</p>
                      <p className="mt-1 text-[13px] text-slate-300">{destination.detail}</p>
                      <p className="mt-3 text-xs font-bold text-[#FF6B76]">Voir les véhicules</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-sm font-bold text-slate-200">Autres points de prise en charge</p>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {otherLocations.map((location) => (
                <li key={location}>
                  <Link
                    href={`/search?location=${encodeURIComponent(location)}`}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-100 transition-colors hover:border-white/35 hover:bg-white/10 ${focusRing} focus-visible:ring-offset-[#0B1220]`}
                  >
                    <MapPin className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
                    {location}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL : voyageurs et agences ══════════════════════════════ */}
      <section aria-labelledby="cta-title" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <h2 id="cta-title" className="sr-only">
          Commencer avec ClickDrive
        </h2>

        <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl bg-action p-8 text-white sm:p-10">
            <div aria-hidden="true" className="absolute -end-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <p className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
                Votre prochaine voiture est peut-être déjà ici.
              </p>
              <p className="mt-3 max-w-md text-base leading-7 text-white/85">
                Parcourez les véhicules disponibles et trouvez celui qui convient à votre séjour à Nador.
              </p>
              <Link
                href="/search"
                className="group mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-[#0B1220] shadow-lg transition-colors hover:bg-slate-100 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#E63946]"
              >
                Rechercher une voiture
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 sm:p-10">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F6F8] text-[#0B1220]">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xl font-extrabold">Vous gérez une agence de location ?</p>
              <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">
                Présentez votre flotte aux voyageurs et aux résidents qui cherchent une voiture à Nador.
              </p>
            </div>
            <Link
              href="/contact"
              className={`mt-5 inline-flex min-h-11 items-center gap-2 self-start rounded text-sm font-bold text-accent-text hover:text-[#C92F3B] ${focusRing}`}
            >
              Devenir partenaire
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
