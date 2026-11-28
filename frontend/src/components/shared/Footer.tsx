'use client';

import React, { useId, useRef, useState } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { LanguageSelector } from '@/components/shared/LanguageSelector';
import {
  ShieldCheck,
  Receipt,
  Headphones,
  MapPin,
  Mail,
  MessageCircle,
  Building2,
  Plane,
  Anchor,
  Compass,
  Car,
  Gauge,
  Motorbike,
  ChevronDown,
  ArrowUpRight,
  Sparkles,
  Clock,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTACT_EMAIL, platformWhatsAppUrl, supportHoursLines, supportHoursSummary } from '@/lib/constants/contact';
import { featuredPickupLocations, pickupLocationHref, type LocationKind } from '@/data/locations';
import { categoryLabel, locationLabel } from '@/lib/i18n/labels';
import type { FooterCatalog } from '@/lib/catalog/footer-categories';
import type { SiteFooterMessages } from '@/lib/i18n/messages/site-footer';

/*
 * Pied de page premium ClickDrive : fond bleu nuit (--color-footer), accent rouge (--color-footer-accent).
 * Un seul élément signature : au survol ou au focus, un trait rouge se dessine sous le lien, comme un
 * marquage au sol ; un filet rouge dégradé souligne le haut du pied de page. Le reste reste sobre :
 * titres de colonnes en capitales précédés d'un trait rouge, filets fins, alignement à gauche.
 */

/** Icône d'un lieu de prise en charge selon son type */
const LOCATION_ICONS: Record<LocationKind, LucideIcon> = {
  AIRPORT: Plane,
  PORT: Anchor,
  RESORT: Compass,
  CITY: Building2,
  TRAIN: MapPin,
};

/** Libellés éditoriaux du pied de page pour les catégories courantes (sinon : libellé de la catégorie) */
const CATEGORY_FOOTER_LABELS: Partial<Record<string, keyof SiteFooterMessages>> = {
  SUV: 'suv',
  Économique: 'economy',
  Berline: 'sedan',
  Luxe: 'premium',
};

/**
 * Trait rouge sous le libellé d'un lien : largeur 0 au repos, pleine au survol ou au focus du lien
 * (parent .group). Il part du début de la ligne, à droite en arabe. Sans animation si l'utilisateur
 * a demandé moins de mouvement.
 */
const ROAD_LINE =
  'bg-linear-to-r from-footer-accent to-footer-accent bg-no-repeat bg-[position:0_100%] rtl:bg-[position:100%_100%] bg-[length:0%_1px] pb-0.5 transition-[background-size,color] duration-base ease-standard group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px] motion-reduce:transition-none';

/** Grille de la navigation : 2 colonnes en tablette, 4 en desktop (la première, plus longue, un peu plus large) */
const FOOTER_GRID = 'md:grid-cols-2 md:gap-x-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-x-12';

/** Anneau de focus clavier, visible sur le bleu nuit (rouge 5,1:1) */
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-footer-accent';

/* ====================================================================== */
/* LIENS ET COLONNES                                                      */
/* ====================================================================== */

function NavItem({
  href,
  children,
  highlight = false,
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  /** Lien de sortie de la colonne (« Toutes les voitures ») : trait rouge toujours visible */
  highlight?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          // Cible tactile ≥ 44 px en mobile, liste plus dense à partir de la tablette
          'group flex min-h-11 items-center gap-3 rounded-sm text-[15px] leading-snug transition-colors duration-base motion-reduce:transition-none md:min-h-0 md:py-1.5 md:text-sm',
          FOCUS_RING,
          highlight ? 'font-semibold text-white' : 'text-slate-300 hover:text-white'
        )}
      >
        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0 text-slate-500 transition-colors duration-base group-hover:text-footer-accent motion-reduce:transition-none"
            aria-hidden="true"
          />
        )}
        <span className={cn(ROAD_LINE, highlight && 'bg-[length:100%_1px]')}>{children}</span>
      </Link>
    </li>
  );
}

/**
 * Colonne de liens : titre simple à partir de la tablette, accordéon (fermé par défaut) en mobile.
 * Un seul titre dans le HTML : en mobile, un bouton transparent couvre la ligne du titre et en reprend
 * le nom (aria-labelledby). Les liens restent dans le HTML même repliés (référencement) ; une seule
 * colonne ouverte à la fois.
 */
function FooterColumn({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const uid = useId();
  const headingId = `${uid}-title`;
  const listId = `${uid}-links`;
  const listRef = useRef<HTMLUListElement>(null);

  const toggle = () => {
    onToggle();
    if (open) return;
    // Colonne ouverte en bas d'écran : ramenée dans la vue, au-dessus de la navigation inférieure (scroll-margin)
    window.requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      listRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
  };

  return (
    <div className="border-b border-white/8 md:border-b-0">
      <div className="relative flex min-h-15 items-center justify-between gap-3 md:mb-4 md:min-h-0">
        {/* Titre : trait rouge + capitales grasses, à toutes les tailles (texte blanc, jamais rouge) */}
        <h3 id={headingId} className="flex items-center gap-3 text-[13px] font-bold uppercase tracking-wider text-white">
          <span className="h-1 w-5 shrink-0 rounded-full bg-footer-accent" aria-hidden="true" />
          {title}
        </h3>
        {/* Mobile : toute la ligne du titre ouvre ou ferme la liste */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={headingId}
          className="group absolute inset-0 flex items-center justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-footer-accent md:hidden"
        >
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full ring-1 transition-colors duration-base motion-reduce:transition-none',
              open ? 'bg-white/8 ring-white/20' : 'ring-white/10 group-hover:ring-white/20'
            )}
            aria-hidden="true"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-300 transition-transform duration-base motion-reduce:transition-none',
                open && 'rotate-180 text-white'
              )}
            />
          </span>
        </button>
      </div>
      <ul
        ref={listRef}
        id={listId}
        aria-labelledby={headingId}
        className={cn(
          'scroll-mb-[calc(var(--cd-bottom-nav,0px)+var(--cd-cookie-banner,0px)+1rem)] pb-4 ps-8 md:space-y-1 md:pb-0 md:ps-0',
          open ? 'block motion-safe:animate-[cd-fade-in_200ms_ease-out] md:animate-none' : 'hidden md:block'
        )}
      >
        {children}
      </ul>
    </div>
  );
}

/* ====================================================================== */
/* PIED DE PAGE                                                           */
/* ====================================================================== */

export function Footer({ catalog = null }: { catalog?: FooterCatalog | null }) {
  const currentYear = new Date().getFullYear();
  const { t, locale, fmt } = useTranslation();
  // Textes dans la langue de la page seulement (espace de noms chargé sur toutes les pages)
  const strings = t.siteFooter;
  // Horaires lus dans config/site.ts, mis en forme dans la langue de la page (une seule ligne)
  const hours = supportHoursSummary(locale);

  // Accordéons mobiles : tous fermés au départ, un seul ouvert à la fois pour garder un pied de page court
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const column = (id: string) => ({
    open: openColumn === id,
    onToggle: () => setOpenColumn((prev) => (prev === id ? null : id)),
  });

  const trustItems = [
    { icon: ShieldCheck, title: strings.trust1Title, desc: strings.trust1Desc },
    { icon: Receipt, title: strings.trust2Title, desc: strings.trust2Desc },
    { icon: Headphones, title: strings.trust3Title, desc: fmt(strings.trust3Desc, { hours }) },
  ];

  // Véhicules : seulement les catégories qui contiennent des véhicules (aucun lien vers une page vide)
  const categoryLinks = catalog?.categories ?? [];
  const showAutomatic = (catalog?.automaticCars ?? 0) > 0;
  // Catalogue indisponible : le lien Motos reste (la page gère elle-même l'absence de véhicule)
  const showMotorbikes = catalog === null || catalog.motorcycles > 0;

  return (
    <footer className="relative bg-footer text-slate-300" role="contentinfo">
      {/* Filet rouge dégradé : seule touche de couleur au repos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-footer-accent/70 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ============================================================ */}
        {/* 1. ENGAGEMENTS                                               */}
        {/* ============================================================ */}
        {/* Mobile et tablette : trois engagements côte à côte (icône + titre) ; détail et icône à côté du texte à partir de 1024 px */}
        <section aria-label={strings.trustAria} className="border-b border-white/8 py-6 lg:py-8">
          <ul className="grid grid-cols-3 gap-4 sm:gap-0">
            {trustItems.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 sm:border-s sm:border-white/8 sm:px-5 sm:first:border-s-0 sm:first:ps-0 lg:items-start lg:gap-4 lg:px-8"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-footer-accent ring-1 ring-white/12"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold leading-snug text-balance text-white sm:text-sm lg:text-[15px]">{title}</h3>
                  <p className="mt-1 hidden text-[13.5px] leading-relaxed text-slate-400 lg:block">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ============================================================ */}
        {/* 2. NAVIGATION : EXPLORER / VÉHICULES / PARTENAIRES / AIDE (+ contact) */}
        {/* ============================================================ */}
        {/* Mobile : accordéons ; tablette : 2 × 2 ; desktop : 4 colonnes (la première, plus longue, un peu plus large) */}
        <nav
          aria-label={strings.navAria}
          className={cn('grid grid-cols-1 py-2 md:gap-y-8 md:py-9', FOOTER_GRID)}
        >
          <FooterColumn title={strings.colExplorer} {...column('explorer')}>
            {featuredPickupLocations().map((location) => (
              <NavItem key={location.id} href={pickupLocationHref(location)} icon={LOCATION_ICONS[location.kind]}>
                {locationLabel(t, location.value)}
              </NavItem>
            ))}
          </FooterColumn>

          <FooterColumn title={strings.colVehicles} {...column('vehicles')}>
            {categoryLinks.map((category) => {
              const key = CATEGORY_FOOTER_LABELS[category.value];
              return (
                <NavItem key={category.value} href={category.href} icon={category.value === 'Luxe' ? Sparkles : Car}>
                  {key ? strings[key] : categoryLabel(t, category.value)}
                </NavItem>
              );
            })}
            {showAutomatic && (
              <NavItem href="/location-voiture-nador-automatique" icon={Gauge}>
                {strings.automatic}
              </NavItem>
            )}
            {showMotorbikes && (
              <NavItem href="/motos" icon={Motorbike}>
                {strings.motorbikes}
              </NavItem>
            )}
            <NavItem href="/search" highlight>
              {strings.allVehicles}
            </NavItem>
          </FooterColumn>

          <FooterColumn title={strings.colServices} {...column('partners')}>
            <NavItem href="/agencies">{strings.agencies}</NavItem>
            <NavItem href="/agency/join">{strings.agencyCta}</NavItem>
            <NavItem href="/agency">{strings.agencyPortal}</NavItem>
            <NavItem href="/about">{strings.howItWorks}</NavItem>
          </FooterColumn>

          {/* Pages légales (CGV, confidentialité, mentions) retirées du pied de page à la demande du propriétaire ;
              elles restent en ligne et liées depuis le bandeau cookies et la demande de location */}
          <FooterColumn title={strings.colHelp} {...column('help')}>
            <NavItem href="/faq">{strings.faq}</NavItem>
            <NavItem href="/contact">{strings.contact}</NavItem>

            {/* Coordonnées du support (config/site.ts), regroupées dans la colonne Aide */}
            <li className="pt-3 md:pt-2">
              <a
                href={platformWhatsAppUrl(strings.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  // Vert WhatsApp, reconnaissable d'un coup d'œil ; texte et icône bleu nuit pour le contraste.
                  // Numéro non affiché : le lien ouvre directement la conversation.
                  'group inline-flex h-11 w-fit items-center gap-2.5 rounded-full bg-whatsapp ps-4 pe-3.5 text-sm font-semibold text-footer transition-colors duration-base hover:bg-whatsapp-hover motion-reduce:transition-none md:h-10',
                  FOCUS_RING
                )}
              >
                <MessageCircle className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                {t.common.whatsappSupport}
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 transition-transform duration-base group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
            </li>
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={cn(
                  'group flex min-h-11 max-w-full items-center gap-3 rounded-sm text-[15px] text-slate-300 transition-colors duration-base hover:text-white motion-reduce:transition-none md:min-h-0 md:py-1.5 md:text-sm',
                  FOCUS_RING
                )}
              >
                <Mail className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-footer-accent" aria-hidden="true" />
                <span className={cn(ROAD_LINE, 'truncate')}>{CONTACT_EMAIL}</span>
              </a>
            </li>
            <li className="flex min-h-11 items-start gap-3 py-1.5 text-sm md:min-h-0">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-white">{strings.hoursLabel}</span>
                {/* Un créneau par ligne : jamais coupé au milieu d'un horaire */}
                {supportHoursLines(locale).map((line) => (
                  <span key={line} className="block whitespace-nowrap tabular-nums text-slate-400">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          </FooterColumn>
        </nav>

        {/* ============================================================ */}
        {/* 3. BAS DE PAGE                                               */}
        {/* ============================================================ */}
        {/* Mobile : langue d'abord (absente de l'en-tête mobile), puis informations. Desktop : informations à gauche, langue à droite. */}
        <div className="flex flex-col gap-5 border-t border-white/8 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <LanguageSelector variant="footer" className="self-start lg:order-last lg:self-auto" />

          <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-slate-400 md:flex-row md:flex-wrap md:items-center md:gap-x-8">
            <p>
              © {currentYear} ClickDrive. {strings.allRightsReserved}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              {strings.location}
            </p>
            {/* Seule information de paiement vérifiable : aucun paiement en ligne, règlement à l'agence */}
            <p className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              {strings.paymentNote}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
