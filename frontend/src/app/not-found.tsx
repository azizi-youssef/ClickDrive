import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description:
    "Cette page n'existe pas ou a été déplacée. Retrouvez nos véhicules en location à Nador.",
  robots: { index: false, follow: true },
};

const CATEGORIES = [
  { label: 'Économique', value: 'economique' },
  { label: 'SUV', value: 'suv' },
  { label: 'Berline', value: 'berline' },
  { label: 'Luxe', value: 'luxe' },
] as const;

function CarSilhouette() {
  return (
    <svg
      viewBox="0 0 120 40"
      aria-hidden="true"
      className="h-10 w-30 sm:h-12 sm:w-36"
      fill="none"
    >
      <path
        d="M5 29c0-4 1-7 5-9l9-3 14-1 9-9c2-2 4-3 7-3h22c4 0 7 1 10 4l8 8 13 2c5 1 8 4 8 9v2c0 2-1 3-3 3H8c-2 0-3-1-3-3Z"
        fill="#0B0E13"
      />
      <path
        d="M44 16l7-7c1-1 2-1 4-1h10v8H44Zm28-8h6c2 0 4 1 5 2l6 6H72V8Z"
        fill="#F3F5F7"
        opacity="0.9"
      />
      <circle cx="28" cy="31" r="7" fill="#0B0E13" stroke="#F3F5F7" strokeWidth="2" />
      <circle cx="94" cy="31" r="7" fill="#0B0E13" stroke="#F3F5F7" strokeWidth="2" />
      <circle cx="28" cy="31" r="2" fill="#F3F5F7" />
      <circle cx="94" cy="31" r="2" fill="#F3F5F7" />
      <rect x="110" y="21" width="6" height="3" rx="1.5" fill="#E63946" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div
      className={`relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-[#F3F5F7] px-5 py-16 font-sans text-slate-900`}
    >
      <style>{`@keyframes clickdrive-drive{from{transform:translateX(-25vw)}to{transform:translateX(125vw)}}`}</style>

      {/* Route */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[14%] h-1"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #0B0E13 0 36px, transparent 36px 68px)',
          opacity: 0.12,
        }}
      />

      {/* Voiture : animée uniquement si le mouvement est autorisé */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[calc(14%+4px)] left-0 hidden motion-safe:block motion-safe:animate-[clickdrive-drive_16s_linear_infinite]"
      >
        <CarSilhouette />
      </div>

      <div className="relative z-10 w-full max-w-xl text-center">
        {/* Plaque */}
        <div
          role="img"
          aria-label="Erreur 404"
          className="relative inline-flex items-stretch overflow-hidden rounded-2xl bg-white text-[#0B0E13] shadow-[0_18px_50px_rgba(11,14,19,0.14)] ring-1 ring-black/15"
        >
          <span
            aria-hidden="true"
            className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-slate-300"
          />
          <span className="m-1 ml-4 flex items-center rounded-xl border-[3px] border-[#0B0E13] px-6 py-2 text-7xl font-extrabold leading-none tracking-tighter sm:px-8 sm:text-8xl">
            404
          </span>
          <span className="flex items-center bg-action px-3.5 text-xs font-semibold text-white sm:px-4 sm:text-sm">
            Introuvable
          </span>
        </div>

        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.04em] text-[#0B0E13] sm:text-5xl">
          Cette page n’existe pas
        </h1>

        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
          Le lien est peut-être erroné, ou la page a été déplacée. Cherchez un
          véhicule ou repartez de l’accueil.
        </p>

        {/* Recherche */}
        <form
          action="/search"
          method="get"
          role="search"
          className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="nf-q" className="sr-only">
            Rechercher un véhicule
          </label>
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <input
              id="nf-q"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Ex. Clio, SUV, Dacia…"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-500 focus-visible:border-[#E63946] focus-visible:ring-2 focus-visible:ring-[#E63946]/40"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-action px-6 text-[15px] font-semibold text-white outline-none transition-colors hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-[#E63946]/60 focus-visible:ring-offset-2 active:bg-action-hover"
          >
            Rechercher
          </button>
        </form>

        {/* Catégories */}
        <nav aria-label="Parcourir par type de véhicule" className="mt-6">
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((c) => (
              <li key={c.value}>
                <Link
                  href={`/search?category=${c.value}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#E63946]/50"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold text-slate-800 underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[#E63946]/50"
        >
          <Home aria-hidden="true" className="h-4 w-4" />
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}