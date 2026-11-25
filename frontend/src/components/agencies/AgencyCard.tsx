'use client';

import React from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { Agency } from '@/types';
import { MapPin, MessageCircle, Star, BadgeCheck, Car, ArrowRight, Sparkles } from 'lucide-react';
import { AgencyLogoMark, COVER_STYLE, useArtFit } from '@/components/agencies/AgencyLogoMark';
import { BANNER_SPEC, fitImageStyle } from '@/components/agencies/logo-fit';
import { AgencyBanner } from '@/components/agencies/AgencyBanner';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatDecimal } from '@/lib/i18n/format';

interface AgencyCardProps {
  agency: Agency;
  carCount?: number;
}

/*
 * Gabarit unique, partagé par la carte et son squelette : chaque bloc réserve sa hauteur, si bien que
 * toutes les cartes d'une rangée s'alignent ligne à ligne, quels que soient le nom, l'adresse,
 * la longueur de la description ou les proportions du logo.
 *
 *   bannière       format fixe 12:5, dessin entier à aire égale sur le fond du fichier (photo : plein cadre)
 *   logo           64 px (téléphone) / 72 px, à cheval sur la limite bannière / contenu, dessin à aire égale
 *   statuts        rangée haute d'une demi-hauteur de logo, à droite du logo
 *   nom            1 ligne          adresse   1 ligne          description   2 lignes réservées
 *   pastilles      1 rangée réservée          bouton          44 px, toujours en bas (mt-auto)
 */
const CARD =
  'group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card';
const BANNER = 'relative aspect-[12/5] w-full overflow-hidden border-b border-slate-200/80';
const LOGO_BOX =
  'absolute bottom-0 start-4 z-10 size-16 translate-y-1/2 rounded-2xl border border-slate-200 bg-white sm:start-5 sm:size-18';
const BODY = 'flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5';
/** Retrait = largeur du logo + 12 px ; hauteur minimale = moitié du logo (le nom ne passe jamais dessous) */
const STATUS_ROW = 'flex min-h-8 flex-wrap content-center items-center justify-end gap-1.5 ps-19 sm:min-h-9 sm:ps-21';
const BADGE = 'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold leading-none';
const PILL = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold leading-none';
const CTA_WRAP = 'mt-auto pt-5';

/** Squelette calqué sur la carte (mêmes blocs, mêmes hauteurs) : aucun saut quand les agences arrivent */
export function AgencyCardSkeleton() {
  return (
    <div aria-hidden="true" className={CARD}>
      <div className="relative">
        <div className={`${BANNER} skeleton`} />
        <div className={`${LOGO_BOX} p-1.5`}>
          <div className="skeleton h-full w-full rounded-[10px]" />
        </div>
      </div>
      <div className={BODY}>
        <div className={STATUS_ROW}>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="mt-3 flex h-[1.35em] items-center text-title">
          <div className="skeleton h-4 w-1/2 rounded-md" />
        </div>
        <div className="mt-1 flex h-5 items-center">
          <div className="skeleton h-3 w-2/3 rounded-full" />
        </div>
        <div className="mt-3 flex min-h-[2lh] flex-col justify-center gap-2 text-[13px] leading-relaxed">
          <div className="skeleton h-3 w-full rounded-full" />
          <div className="skeleton h-3 w-4/5 rounded-full" />
        </div>
        <div className="mt-4 flex h-7 gap-2">
          <div className="skeleton h-7 w-24 rounded-full" />
          <div className="skeleton h-7 w-24 rounded-full" />
        </div>
        <div className={CTA_WRAP}>
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Bannière : même traitement que le logo, dans le cadre 12:5 — dessin entier (plus de « OROKA » sans Y
 * ni de blason coupé), même aire visuelle d'une agence à l'autre, fond du fichier prolongé.
 * Une vraie photo (fond non uniforme) reste en plein cadre (object-cover).
 */
function BannerArt({ agency }: { agency: Agency }) {
  const art = useArtFit(agency.banner_url?.trim() || `slug:${agency.slug}`, BANNER_SPEC);
  return (
    <div className="absolute inset-0 bg-ink transition-[background-color] duration-base" style={art.frameStyle}>
      <div className="absolute inset-0 motion-zoom">
        <AgencyBanner
          name={agency.name}
          bannerUrl={agency.banner_url}
          className="transition-opacity duration-fast"
          // Toujours un style (pas de `fill`) : plein cadre en attente / photo, cadrage calculé sinon
          style={art.fit ? fitImageStyle(art.fit) : art.fit === undefined ? { ...COVER_STYLE, opacity: 0 } : COVER_STYLE}
          onLoad={art.onLoad}
        />
      </div>
    </div>
  );
}

export function AgencyCard({ agency, carCount }: AgencyCardProps) {
  // N'ajoute la ville que si l'adresse ne la mentionne pas déjà
  const address = agency.address?.trim() ?? '';
  const city = agency.city?.trim() ?? '';
  const location =
    address && city && !address.toLocaleLowerCase('fr').includes(city.toLocaleLowerCase('fr'))
      ? `${address}, ${city}`
      : address || city;
  const hasReviews = (agency.review_count ?? 0) > 0 && agency.rating > 0;
  const { t, locale, fmt, plural } = useTranslation();
  const c = t.agencies.card;
  const hasWhatsApp = (agency.whatsapp ?? '').replace(/\D/g, '').length >= 8;

  return (
    // Même comportement que la carte véhicule : motion-lift (soulèvement, ombre, bordure) et motion-zoom (photo)
    <article className={`${CARD} motion-lift hover:border-slate-300 hover:shadow-card-hover`}>
      {/* ── En-tête : bannière rognée + logo à cheval ─────────────────────── */}
      <div className="relative">
        {/* Bannière d'origine, format fixe, jamais coupée ni déformée (BannerArt) ; filet bas pour détacher
            les bannières claires (fond blanc) du contenu. Aucun voile : rien n'y est posé. */}
        <div className={BANNER}>
          <BannerArt agency={agency} />
        </div>

        {/* Logo hors de la zone rognée de la bannière (sinon sa moitié basse était coupée), bordure
            continue, fond blanc, logo entier centré (object-contain) dans une marge intérieure */}
        <div className={`${LOGO_BOX} overflow-hidden p-1.5 shadow-[0_6px_16px_-8px_rgba(11,18,32,0.4)]`}>
          <AgencyLogoMark slug={agency.slug} name={agency.name} logoUrl={agency.logo_url} size={60} className="rounded-[10px]" />
        </div>
      </div>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <div className={BODY}>
        {/* Statuts : même hauteur, même typographie ; à droite du logo, jamais dessous */}
        <div className={STATUS_ROW}>
          {agency.verified && (
            <span className={`${BADGE} bg-emerald-50 text-emerald-700`}>
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {c.verified}
            </span>
          )}
          {hasReviews ? (
            <span
              className={`${BADGE} bg-amber-50 text-amber-700`}
              aria-label={fmt(c.ratingAria, { rating: formatDecimal(agency.rating, locale), count: agency.review_count })}
            >
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {formatDecimal(agency.rating, locale)}
              <span className="font-medium text-amber-700/70">({agency.review_count})</span>
            </span>
          ) : (
            // Accent rouge discret : fond teinté et icône, texte neutre (le rouge reste aux actions)
            <span className={`${BADGE} bg-brand-soft text-ink-tertiary`}>
              <Sparkles className="h-3 w-3 text-accent-text" aria-hidden="true" />
              {c.newAgency}
            </span>
          )}
        </div>

        {/* Nom sur une ligne (titres alignés d'une carte à l'autre), complet au survol */}
        <h3 className="mt-3 truncate text-title text-ink" title={agency.name}>
          {/* Lien étiré : toute la carte est cliquable (z-20 : au-dessus du logo, qui mène aussi à la fiche) */}
          <Link
            href={`/agencies/${agency.slug}`}
            className="outline-none after:absolute after:inset-0 after:z-20 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand"
          >
            {agency.name}
          </Link>
        </h3>

        {/* Adresse : rangée toujours présente (h-5), tronquée sur une ligne, complète au survol */}
        <p className="mt-1 flex h-5 min-w-0 items-center gap-1.5 text-[13px] text-ink-secondary">
          {location && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              {/* dir="auto" : adresse latine lue de gauche à droite même en arabe (« 1 Rue… », pas « …Nador 1 ») */}
              <span dir="auto" className="min-w-0 truncate" title={location}>
                {location}
              </span>
            </>
          )}
        </p>

        {/* Description : 2 lignes réservées (min-h-[2lh]) — une description courte ne remonte pas la suite */}
        <p className="mt-3 line-clamp-2 min-h-[2lh] text-[13px] leading-relaxed text-ink-tertiary">
          {agency.description?.trim() || c.defaultDescription}
        </p>

        {/* Flotte + WhatsApp : même gabarit de pastille, rangée réservée même vide */}
        <div className="mt-4 flex min-h-7 flex-wrap items-center gap-2">
          {carCount !== undefined && (
            <span className={`${PILL} bg-canvas text-ink`}>
              <Car className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {carCount === 0 ? c.fleetSoon : plural(carCount, c.vehicles)}
            </span>
          )}
          {hasWhatsApp && (
            <span className={`${PILL} bg-emerald-50 text-emerald-700`}>
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              WhatsApp
            </span>
          )}
        </div>

        {/* Bouton : pleine largeur, 44 px, toujours en bas. Secondaire au repos ; plein graphite au survol,
            au focus clavier de la carte (lien étiré) et à l'appui. Décoratif pour les lecteurs d'écran :
            le lien est le nom de l'agence. */}
        <div className={CTA_WRAP}>
          <span
            aria-hidden="true"
            className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-ink transition-[background-color,border-color,color] duration-fast group-hover:border-ink group-hover:bg-ink group-hover:text-white group-focus-within:border-ink group-focus-within:bg-ink group-focus-within:text-white group-active:bg-ink-hover motion-reduce:transition-none"
          >
            <span className="truncate">{c.seeFleet}</span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
