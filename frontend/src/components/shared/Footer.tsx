'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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

/* ====================================================================== */
/* LOCALIZATION DICTIONARY                                                */
/* ====================================================================== */

interface FooterStrings {
  agencyTitle: string;
  agencyBadge: string;
  agencyDesc: string;
  agencyCta: string;
  brandDesc: string;
  trust1Title: string;
  trust1Desc: string;
  trust2Title: string;
  trust2Desc: string;
  trust3Title: string;
  trust3Desc: string;
  whatsappSupport: string;
  emailUs: string;
  colExplorer: string;
  airport: string;
  port: string;
  marchica: string;
  downtown: string;
  selouane: string;
  colVehicles: string;
  suv: string;
  economy: string;
  sedan: string;
  premium: string;
  automatic: string;
  allVehicles: string;
  motorbikes: string;
  colServices: string;
  agencies: string;
  agencyPortal: string;
  faq: string;
  contact: string;
  howItWorks: string;
  legalCgv: string;
  legalPrivacy: string;
  legalMentions: string;
  allRightsReserved: string;
  bottomTagline: string;
}

const STRINGS: Record<string, FooterStrings> = {
  fr: {
    agencyTitle: 'Vous êtes une agence de location de voitures à Nador ?',
    agencyBadge: 'Portail Partenaire',
    agencyDesc:
      'Rejoignez le premier réseau de loueurs professionnels de l’Oriental pour digitaliser votre flotte et recevoir des demandes de réservation qualifiées.',
    agencyCta: 'Devenir agence partenaire',
    brandDesc:
      'ClickDrive est la marketplace automobile de référence à Nador. Comparez les disponibilités en temps réel et réservez auprès d’agences locales partenaires rigoureusement sélectionnées.',
    trust1Title: 'Agences partenaires vérifiées',
    trust1Desc: 'Des loueurs professionnels immatriculés et rigoureusement sélectionnés.',
    trust2Title: 'Tarifs clairs & sans frais cachés',
    trust2Desc: 'Des conditions transparentes et des prix fixés en direct par les agences.',
    trust3Title: 'Prise en charge & support local',
    trust3Desc: 'Aéroport, port et centre-ville. Assistance WhatsApp du lundi au vendredi (9h–18h) et le samedi matin.',
    whatsappSupport: 'Assistance WhatsApp ClickDrive',
    emailUs: 'contact@clickdrive.ma',
    colExplorer: 'Explorer Nador',
    airport: 'Aéroport Nador-Al Aroui (NDR)',
    port: 'Port de Beni Ansar (Ferry)',
    marchica: 'Marchica & Lagune',
    downtown: 'Nador Centre-Ville',
    selouane: 'Selouane & Environs',
    colVehicles: 'Véhicules & Flotte',
    suv: 'SUV & 4x4',
    economy: 'Citadines & Économiques',
    sedan: 'Berlines Confort',
    premium: 'Luxe & Prestige',
    automatic: 'Boîte Automatique',
    allVehicles: 'Toutes les voitures',
    motorbikes: 'Motos & scooters',
    colServices: 'Services & Partenaires',
    agencies: 'Agences partenaires',
    agencyPortal: 'Espace agence',
    faq: 'Centre d’aide & FAQ',
    contact: 'Contact & Support',
    howItWorks: 'Comment ça marche',
    legalCgv: 'Conditions Générales (CGV)',
    legalPrivacy: 'Confidentialité',
    legalMentions: 'Mentions Légales',
    allRightsReserved: 'Tous droits réservés.',
    bottomTagline: 'ClickDrive · Marketplace de location de véhicules à Nador & dans l’Oriental',
  },
  ar: {
    agencyTitle: 'هل تمتلك وكالة كراء سيارات بالناظور؟',
    agencyBadge: 'بوابة الشركاء',
    agencyDesc:
      'انضم لشبكة كاردرايف الرائدة في الجهة الشرقية لرقمنة أسطولك واستقبال طلبات حجز موثوقة ومباشرة من الزبائن.',
    agencyCta: 'انضم كوكالة شريكة',
    brandDesc:
      'كاردرايف هي المنصة المرجعية لمقارنة وحجز سيارات الكراء بالناظور والجهة الشرقية، لدى وكالات محلية معتمدة وموثوقة.',
    trust1Title: 'وكالات شريكة معتمدة',
    trust1Desc: 'مهنيون محليون مرخصون ومختارون بعناية فائقة.',
    trust2Title: 'أسعار واضحة بدون مصاريف خفية',
    trust2Desc: 'شروط شفافة وأسعار مباشرة ومحددة من قبل الوكالات بدون وسيط.',
    trust3Title: 'الاستلام والدعم المحلي',
    trust3Desc: 'المطار والميناء ووسط المدينة. دعم عبر واتساب من الاثنين إلى الجمعة (9:00–18:00) وصباح السبت.',
    whatsappSupport: 'دعم واتساب كاردرايف',
    emailUs: 'contact@clickdrive.ma',
    colExplorer: 'الوجهات ونقاط الاستلام',
    airport: 'مطار الناظور العروي (NDR)',
    port: 'ميناء بني انصار (البواخر)',
    marchica: 'مارتشيكا والبحيرة',
    downtown: 'وسط مدينة الناظور',
    selouane: 'سلوان ونواحيها',
    colVehicles: 'الأسطول والسيارات',
    suv: 'سيارات الدفع الرباعي و SUV',
    economy: 'سيارات اقتصادية وصغيرة',
    sedan: 'سيارات عائلية وسيدان',
    premium: 'سيارات برستيج وفاخرة',
    automatic: 'ناقل حركة أوتوماتيكي',
    allVehicles: 'عرض جميع السيارات',
    motorbikes: 'الدراجات النارية والسكوتر',
    colServices: 'الخدمات والشركاء',
    agencies: 'الوكالات الشريكة',
    agencyPortal: 'بوابة الوكالة',
    faq: 'الأسئلة الشائعة والمساعدة',
    contact: 'الاتصال والدعم',
    howItWorks: 'كيف يعمل الموقع',
    legalCgv: 'الشروط العامة للاستخدام',
    legalPrivacy: 'سياسة الخصوصية',
    legalMentions: 'البيانات القانونية',
    allRightsReserved: 'جميع الحقوق محفوظة.',
    bottomTagline: 'كاردرايف · منصة كراء السيارات بالناظور والجهة الشرقية للمملكة',
  },
  en: {
    agencyTitle: 'Do you manage a car rental agency in Nador?',
    agencyBadge: 'Partner Portal',
    agencyDesc:
      'Join the premier rental marketplace in the Oriental region to digitize your fleet and receive verified booking inquiries.',
    agencyCta: 'Become a partner agency',
    brandDesc:
      'ClickDrive is the leading automotive marketplace in Nador, helping travelers compare live availability and book directly from verified local partner agencies.',
    trust1Title: 'Verified Partner Agencies',
    trust1Desc: 'Licensed, trustworthy local car rental businesses in Nador.',
    trust2Title: 'Transparent Pricing',
    trust2Desc: 'Direct pricing without hidden fees or unexpected commissions.',
    trust3Title: 'Pickup & local support',
    trust3Desc: 'Airport, port and city centre. WhatsApp support Monday to Friday (9am–6pm) and Saturday morning.',
    whatsappSupport: 'ClickDrive WhatsApp Support',
    emailUs: 'contact@clickdrive.ma',
    colExplorer: 'Explore Nador',
    airport: 'Nador Al-Aroui Airport (NDR)',
    port: 'Beni Ansar Port (Ferry)',
    marchica: 'Marchica & Lagoon',
    downtown: 'Nador City Center',
    selouane: 'Selouane & Surroundings',
    colVehicles: 'Fleet & Categories',
    suv: 'SUV & 4x4',
    economy: 'Compact & Economy',
    sedan: 'Comfort Sedans',
    premium: 'Luxury & Prestige',
    automatic: 'Automatic Transmission',
    allVehicles: 'All Available Cars',
    motorbikes: 'Motorbikes & scooters',
    colServices: 'Services & Partners',
    agencies: 'Partner Agencies',
    agencyPortal: 'Agency Portal',
    faq: 'FAQ & Help Center',
    contact: 'Contact & Support',
    howItWorks: 'How it Works',
    legalCgv: 'Terms of Service',
    legalPrivacy: 'Privacy Policy',
    legalMentions: 'Legal Notice',
    allRightsReserved: 'All rights reserved.',
    bottomTagline: 'ClickDrive · Car Rental Marketplace in Nador & Eastern Morocco',
  },
  de: {
    agencyTitle: 'Sie betreiben eine Autovermietung in Nador?',
    agencyBadge: 'Partnerportal',
    agencyDesc:
      'Treten Sie dem führenden Netzwerk professioneller Vermieter im Oriental bei, digitalisieren Sie Ihre Flotte und erhalten Sie qualifizierte Buchungsanfragen.',
    agencyCta: 'Partneragentur werden',
    brandDesc:
      'ClickDrive ist der führende Automarktplatz in Nador. Vergleichen Sie die Verfügbarkeit in Echtzeit und buchen Sie bei sorgfältig ausgewählten lokalen Partneragenturen.',
    trust1Title: 'Geprüfte Partneragenturen',
    trust1Desc: 'Registrierte, sorgfältig ausgewählte professionelle Vermieter.',
    trust2Title: 'Klare Preise ohne versteckte Kosten',
    trust2Desc: 'Transparente Bedingungen und Preise direkt von den Agenturen.',
    trust3Title: 'Übergabe & lokaler Support',
    trust3Desc: 'Flughafen, Hafen und Zentrum. WhatsApp-Support Mo–Fr (9–18 Uhr) und Samstagvormittag.',
    whatsappSupport: 'ClickDrive WhatsApp-Support',
    emailUs: 'contact@clickdrive.ma',
    colExplorer: 'Nador entdecken',
    airport: 'Flughafen Nador-Al Aroui (NDR)',
    port: 'Hafen Beni Ansar (Fähre)',
    marchica: 'Marchica & Lagune',
    downtown: 'Nador Zentrum',
    selouane: 'Selouane & Umgebung',
    colVehicles: 'Fahrzeuge & Flotte',
    suv: 'SUV & 4x4',
    economy: 'Klein- & Sparwagen',
    sedan: 'Komfort-Limousinen',
    premium: 'Luxus & Prestige',
    automatic: 'Automatikgetriebe',
    allVehicles: 'Alle Autos',
    motorbikes: 'Motorräder & Roller',
    colServices: 'Service & Partner',
    agencies: 'Partneragenturen',
    agencyPortal: 'Agenturbereich',
    faq: 'Hilfe & FAQ',
    contact: 'Kontakt & Support',
    howItWorks: 'So funktioniert’s',
    legalCgv: 'AGB',
    legalPrivacy: 'Datenschutz',
    legalMentions: 'Impressum',
    allRightsReserved: 'Alle Rechte vorbehalten.',
    bottomTagline: 'ClickDrive · Mietwagen-Marktplatz in Nador & im Oriental',
  },
  es: {
    agencyTitle: '¿Tiene una agencia de alquiler de coches en Nador?',
    agencyBadge: 'Portal de socios',
    agencyDesc:
      'Únase a la red líder de alquiladores profesionales del Oriental para digitalizar su flota y recibir solicitudes de reserva cualificadas.',
    agencyCta: 'Ser agencia asociada',
    brandDesc:
      'ClickDrive es el marketplace de referencia en Nador. Compare la disponibilidad en tiempo real y reserve con agencias locales asociadas seleccionadas con rigor.',
    trust1Title: 'Agencias asociadas verificadas',
    trust1Desc: 'Alquiladores profesionales registrados y seleccionados con rigor.',
    trust2Title: 'Precios claros sin costes ocultos',
    trust2Desc: 'Condiciones transparentes y precios fijados directamente por las agencias.',
    trust3Title: 'Entrega y soporte local',
    trust3Desc: 'Aeropuerto, puerto y centro. Soporte por WhatsApp de lunes a viernes (9–18 h) y sábado por la mañana.',
    whatsappSupport: 'Asistencia WhatsApp ClickDrive',
    emailUs: 'contact@clickdrive.ma',
    colExplorer: 'Explorar Nador',
    airport: 'Aeropuerto Nador-Al Aroui (NDR)',
    port: 'Puerto de Beni Ansar (Ferry)',
    marchica: 'Marchica y Laguna',
    downtown: 'Centro de Nador',
    selouane: 'Selouane y alrededores',
    colVehicles: 'Vehículos y flota',
    suv: 'SUV y 4x4',
    economy: 'Urbanos y económicos',
    sedan: 'Berlinas confort',
    premium: 'Lujo y prestigio',
    automatic: 'Cambio automático',
    allVehicles: 'Todos los coches',
    motorbikes: 'Motos y scooters',
    colServices: 'Servicios y socios',
    agencies: 'Agencias asociadas',
    agencyPortal: 'Espacio agencia',
    faq: 'Ayuda y FAQ',
    contact: 'Contacto y soporte',
    howItWorks: 'Cómo funciona',
    legalCgv: 'Condiciones generales',
    legalPrivacy: 'Privacidad',
    legalMentions: 'Aviso legal',
    allRightsReserved: 'Todos los derechos reservados.',
    bottomTagline: 'ClickDrive · Marketplace de alquiler de vehículos en Nador y el Oriental',
  },
  nl: {
    agencyTitle: 'Heeft u een autoverhuurbedrijf in Nador?',
    agencyBadge: 'Partnerportaal',
    agencyDesc:
      'Sluit u aan bij het toonaangevende netwerk van professionele verhuurders in de Oriental, digitaliseer uw vloot en ontvang gekwalificeerde boekingsaanvragen.',
    agencyCta: 'Partnerbureau worden',
    brandDesc:
      'ClickDrive is dé automarktplaats van Nador. Vergelijk de beschikbaarheid in realtime en boek bij zorgvuldig geselecteerde lokale partnerbureaus.',
    trust1Title: 'Geverifieerde partnerbureaus',
    trust1Desc: 'Geregistreerde, zorgvuldig geselecteerde professionele verhuurders.',
    trust2Title: 'Duidelijke prijzen zonder verborgen kosten',
    trust2Desc: 'Transparante voorwaarden en prijzen rechtstreeks van de bureaus.',
    trust3Title: 'Overdracht & lokale support',
    trust3Desc: 'Luchthaven, haven en centrum. WhatsApp-support ma–vr (9–18 u) en zaterdagochtend.',
    whatsappSupport: 'ClickDrive WhatsApp-support',
    emailUs: 'contact@clickdrive.ma',
    colExplorer: 'Ontdek Nador',
    airport: 'Luchthaven Nador-Al Aroui (NDR)',
    port: 'Haven Beni Ansar (Ferry)',
    marchica: 'Marchica & Lagune',
    downtown: 'Nador Centrum',
    selouane: 'Selouane & omgeving',
    colVehicles: 'Voertuigen & vloot',
    suv: 'SUV & 4x4',
    economy: 'Stads- & budgetauto’s',
    sedan: 'Comfortabele sedans',
    premium: 'Luxe & prestige',
    automatic: 'Automaat',
    allVehicles: 'Alle auto’s',
    motorbikes: 'Motoren & scooters',
    colServices: 'Diensten & partners',
    agencies: 'Partnerbureaus',
    agencyPortal: 'Bureauportaal',
    faq: 'Hulp & FAQ',
    contact: 'Contact & support',
    howItWorks: 'Hoe het werkt',
    legalCgv: 'Algemene voorwaarden',
    legalPrivacy: 'Privacy',
    legalMentions: 'Juridische informatie',
    allRightsReserved: 'Alle rechten voorbehouden.',
    bottomTagline: 'ClickDrive · Autoverhuurmarktplaats in Nador & de Oriental',
  },
};

function getStrings(locale: string): FooterStrings {
  return STRINGS[locale] || STRINGS.fr;
}

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
  const { locale, isRTL } = useTranslation();
  const strings = getStrings(locale);

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
        {/* 1. APPEL AUX AGENCES                                         */}
        {/* ============================================================ */}
        <section aria-label={strings.agencyTitle} className="pt-10 sm:pt-12">
          <div className="rounded-2xl border border-white/10 bg-linear-to-br from-white/6 via-white/2 to-transparent p-5 sm:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
              <div className="flex items-start gap-4">
                <div
                  className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E63946]/25 bg-[#E63946]/10 text-[#FF6B76] sm:flex"
                  aria-hidden="true"
                >
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <span className="hidden rounded-full border border-[#E63946]/30 bg-[#E63946]/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#FF6B76] sm:inline-block">
                    {strings.agencyBadge}
                  </span>
                  <h2 className="text-base font-bold text-white sm:mt-2 sm:text-lg">{strings.agencyTitle}</h2>
                  {/* Description masquée en mobile pour raccourcir le footer */}
                  <p className="mt-1.5 hidden max-w-2xl text-sm leading-relaxed text-slate-300 sm:block">
                    {strings.agencyDesc}
                  </p>
                </div>
              </div>

              <Link
                href="/agency/join"
                className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-action px-6 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition-colors duration-200 hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-white"
              >
                <span>{strings.agencyCta}</span>
                <ArrowUpRight
                  className={cn(
                    'h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
                    isRTL && '-scale-x-100 group-hover:-translate-x-0.5'
                  )}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. ENGAGEMENTS                                               */}
        {/* ============================================================ */}
        <section aria-label="Engagements ClickDrive" className="my-8 border-y border-white/8 py-6 sm:py-8">
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
        {/* 3. MARQUE + COLONNES DE LIENS                                */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 pb-8 md:grid-cols-2 md:gap-y-10 lg:grid-cols-12">
          <div className="space-y-4 pb-6 md:pb-0 lg:col-span-4">
            {/* Logo sur pastille claire : le « Drive » gris foncé est illisible sur le fond graphite */}
            <Link
              href="/"
              aria-label="ClickDrive — Accueil"
              className="inline-flex items-center rounded-xl bg-white px-3.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]"
            >
              <Image src={brandLogo} alt="ClickDrive" sizes="160px" className="h-9 w-auto" />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-slate-300">{strings.brandDesc}</p>

            <div className="grid max-w-sm gap-2 pt-1">
              <a
                href="https://wa.me/212767137136?text=Bonjour%20ClickDrive%2C%20je%20souhaite%20louer%20un%20v%C3%A9hicule%20%C3%A0%20Nador"
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
                {strings.emailUs}
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
                Nador, Maroc
              </span>
              <LanguageSelector variant="footer" />
            </div>

            <nav aria-label="Liens légaux">
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
