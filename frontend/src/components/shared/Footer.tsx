'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import { brandLogo } from '@/lib/brand/logo';
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
  ChevronRight,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';

/* Valeurs exactes reconnues par la recherche (LOCATIONS_NADOR) */
const MARCHICA_SEARCH = `/search?location=${encodeURIComponent('Corniche Marchica (Nador)')}`;
const SELOUANE_SEARCH = `/search?location=${encodeURIComponent('Selouane Centre')}`;

/* ====================================================================== */
/* LINK & COLUMN COMPONENTS                                               */
/* ====================================================================== */

function NavItem({
  href,
  children,
  highlight = false,
  isRTL = false,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
  isRTL?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          // Cible tactile ≥ 44 px en mobile, liste plus dense sur desktop
          'group flex min-h-11 items-center justify-between rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#E63946] md:min-h-0 md:py-1.5 md:text-[13px]',
          highlight ? 'font-semibold text-[#FF6B76] hover:text-white' : 'text-slate-300 hover:text-white'
        )}
      >
        <span className="flex items-center gap-2.5">
          {icon && (
            <span
              className={cn(
                'text-slate-400 transition-colors',
                highlight ? 'text-[#FF6B76]' : 'group-hover:text-[#FF6B76]'
              )}
            >
              {icon}
            </span>
          )}
          <span>{children}</span>
        </span>

        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-slate-500 transition-all duration-200 md:opacity-0 md:group-hover:opacity-100',
            highlight && 'text-[#FF6B76] md:opacity-100',
            isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'
          )}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** Colonne de liens : titre simple sur tablette/desktop, accordéon (fermé par défaut) en mobile. */
function FooterColumn({
  id,
  title,
  open,
  onToggle,
  className,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const listId = `footer-col-${id}`;
  return (
    <div className={className}>
      <h3 className="mb-4 hidden items-center gap-2 text-xs font-bold uppercase tracking-wider text-white md:flex">
        <span className="h-1 w-3.5 rounded-full bg-[#E63946]" aria-hidden="true" />
        {title}
      </h3>
      <h3 className="md:hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-h-13 w-full items-center justify-between border-b border-white/8 text-[13px] font-bold uppercase tracking-wider text-white"
        >
          <span className="flex items-center gap-2">
            <span className="h-1 w-3.5 rounded-full bg-[#E63946]" aria-hidden="true" />
            {title}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      <ul id={listId} className={cn('pt-1 md:space-y-1 md:pt-0', open ? 'block' : 'hidden md:block')}>
        {children}
      </ul>
    </div>
  );
}

/* ====================================================================== */
/* MAIN FOOTER COMPONENT                                                  */
/* ====================================================================== */

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { t, isRTL } = useTranslation();
  // Textes dans la langue de la page seulement (espace de noms chargé sur toutes les pages)
  const strings = t.siteFooter;

  // Accordéons mobiles : tous fermés pour garder un footer court
  const [openColumns, setOpenColumns] = useState<Record<string, boolean>>({});
  const toggleColumn = (id: string) => setOpenColumns((prev) => ({ ...prev, [id]: !prev[id] }));

  const trustItems = [
    { icon: ShieldCheck, title: strings.trust1Title, desc: strings.trust1Desc },
    { icon: Receipt, title: strings.trust2Title, desc: strings.trust2Desc },
    { icon: Headphones, title: strings.trust3Title, desc: strings.trust3Desc },
  ];

  const legalLinkClass =
    'inline-flex min-h-11 items-center transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#E63946] sm:min-h-6';

  return (
    <footer className="relative overflow-hidden border-t border-white/6 bg-[#0B1220] text-slate-300" role="contentinfo">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-1/4 h-80 w-80 rounded-full bg-[#E63946]/6 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ============================================================ */}
        {/* 1. ENGAGEMENTS                                               */}
        {/* ============================================================ */}
        <section aria-label={strings.trustAria} className="my-8 border-y border-white/8 py-6 sm:py-8">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            {trustItems.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-center gap-3.5 sm:items-start">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E63946]/20 bg-[#E63946]/10 text-[#FF6B76]"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <p className="mt-1 hidden text-[13px] leading-relaxed text-slate-300 sm:block">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ============================================================ */}
        {/* 2. MARQUE + COLONNES DE LIENS                                */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 pb-8 md:grid-cols-2 md:gap-y-10 lg:grid-cols-12">
          <div className="space-y-4 pb-6 md:pb-0 lg:col-span-4">
            {/* Logo sur pastille claire : le « Drive » gris foncé est illisible sur le fond graphite */}
            <Link
              href="/"
              aria-label={strings.homeAria}
              className="inline-flex items-center rounded-xl bg-white px-3.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]"
            >
              <Image src={brandLogo} alt="ClickDrive" sizes="160px" className="h-9 w-auto" />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-slate-300">{strings.brandDesc}</p>

            <div className="grid max-w-sm gap-2 pt-1">
              <a
                href={clickdriveWhatsAppUrl(strings.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-11 items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-3.5 text-sm font-semibold text-emerald-300 transition-colors hover:border-emerald-400/45 hover:bg-emerald-400/12"
              >
                <span className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {strings.whatsappSupport}
                </span>
                <ArrowUpRight
                  className={cn(
                    'h-4 w-4 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
                    isRTL && '-scale-x-100 group-hover:-translate-x-0.5'
                  )}
                  aria-hidden="true"
                />
              </a>
              <a
                href="mailto:contact@clickdrive.ma"
                className="flex min-h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-white/3 px-3.5 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
                contact@clickdrive.ma
              </a>
            </div>
          </div>

          <FooterColumn
            id="explorer"
            title={strings.colExplorer}
            open={Boolean(openColumns.explorer)}
            onToggle={() => toggleColumn('explorer')}
            className="lg:col-span-3"
          >
            <NavItem href="/location-voiture-nador-aeroport" isRTL={isRTL} icon={<Plane className="h-4 w-4" aria-hidden="true" />}>
              {strings.airport}
            </NavItem>
            <NavItem href="/location-voiture-beni-ansar" isRTL={isRTL} icon={<Anchor className="h-4 w-4" aria-hidden="true" />}>
              {strings.port}
            </NavItem>
            <NavItem href={MARCHICA_SEARCH} isRTL={isRTL} icon={<Compass className="h-4 w-4" aria-hidden="true" />}>
              {strings.marchica}
            </NavItem>
            <NavItem href="/location-voiture-nador" isRTL={isRTL} icon={<Building2 className="h-4 w-4" aria-hidden="true" />}>
              {strings.downtown}
            </NavItem>
            <NavItem href={SELOUANE_SEARCH} isRTL={isRTL} icon={<MapPin className="h-4 w-4" aria-hidden="true" />}>
              {strings.selouane}
            </NavItem>
          </FooterColumn>

          <FooterColumn
            id="vehicles"
            title={strings.colVehicles}
            open={Boolean(openColumns.vehicles)}
            onToggle={() => toggleColumn('vehicles')}
            className="lg:col-span-2"
          >
            <NavItem href="/location-voiture-nador-suv" isRTL={isRTL} icon={<Car className="h-4 w-4" aria-hidden="true" />}>
              {strings.suv}
            </NavItem>
            <NavItem href="/search?category=%C3%89conomique" isRTL={isRTL} icon={<Car className="h-4 w-4" aria-hidden="true" />}>
              {strings.economy}
            </NavItem>
            <NavItem href="/search?category=Berline" isRTL={isRTL} icon={<Car className="h-4 w-4" aria-hidden="true" />}>
              {strings.sedan}
            </NavItem>
            <NavItem href="/search?category=Luxe" isRTL={isRTL} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>
              {strings.premium}
            </NavItem>
            <NavItem href="/location-voiture-nador-automatique" isRTL={isRTL} icon={<Gauge className="h-4 w-4" aria-hidden="true" />}>
              {strings.automatic}
            </NavItem>
            <NavItem href="/motos" isRTL={isRTL} icon={<Motorbike className="h-4 w-4" aria-hidden="true" />}>
              {strings.motorbikes}
            </NavItem>
            <NavItem href="/search" isRTL={isRTL} highlight>
              {strings.allVehicles}
            </NavItem>
          </FooterColumn>

          <FooterColumn
            id="services"
            title={strings.colServices}
            open={Boolean(openColumns.services)}
            onToggle={() => toggleColumn('services')}
            className="lg:col-span-3"
          >
            {/* « Devenir partenaire » n'est plus répété ici : l'appel en tête de footer suffit */}
            <NavItem href="/agencies" isRTL={isRTL}>
              {strings.agencies}
            </NavItem>
            <NavItem href="/agency" isRTL={isRTL}>
              {strings.agencyPortal}
            </NavItem>
            <NavItem href="/about" isRTL={isRTL}>
              {strings.howItWorks}
            </NavItem>
            <NavItem href="/faq" isRTL={isRTL}>
              {strings.faq}
            </NavItem>
            <NavItem href="/contact" isRTL={isRTL}>
              {strings.contact}
            </NavItem>
          </FooterColumn>
        </div>

        {/* ============================================================ */}
        {/* 4. COPYRIGHT & LIENS LÉGAUX                                  */}
        {/* ============================================================ */}
        <div className="border-t border-white/8 py-6">
          <div className="flex flex-col gap-4 text-[13px] text-slate-400 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>
                © {currentYear} ClickDrive. {strings.allRightsReserved}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                •
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {strings.location}
              </span>
              <LanguageSelector variant="footer" />
            </div>

            <nav aria-label={strings.legalAria}>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-0 sm:gap-y-2">
                <li>
                  <Link href="/cgv" className={legalLinkClass}>
                    {strings.legalCgv}
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className={legalLinkClass}>
                    {strings.legalPrivacy}
                  </Link>
                </li>
                <li>
                  <Link href="/mentions-legales" className={legalLinkClass}>
                    {strings.legalMentions}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <p className="mt-4 border-t border-white/5 pt-4 text-center text-[11px] uppercase tracking-widest text-slate-400">
            {strings.bottomTagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
