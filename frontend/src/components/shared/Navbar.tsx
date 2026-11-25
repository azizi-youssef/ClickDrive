'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
} from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import { brandLogo } from '@/lib/brand/logo';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Menu,
  X,
  Building2,
  User,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Plane,
  Anchor,
  CarFront,
  Sparkles,
  ArrowRight,
  MapPin,
  ShieldCheck,
  LogOut,
  Loader2,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOGIN_PATH } from '@/lib/auth/login-portals';
import {
  fetchClientAuthProfile,
  signOutEverywhere,
  type ClientAuthProfile,
} from '@/lib/auth/client';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { delocalizeHref, localizeHref } from '@/lib/i18n/routing';
import type { NavbarMessages } from '@/lib/i18n/messages/navbar';
import { LanguageSelector } from '@/components/shared/LanguageSelector';
import { Magnet } from '@/components/ui/react-bits';
import { usePresence } from '@/lib/ui/use-presence';

/* ====================================================================== */
/* ACCOUNT HELPERS                                                        */
/* ====================================================================== */

function accountHref(profile: ClientAuthProfile): string {
  if (profile.canAccessAdmin) return '/admin';
  if (profile.canAccessAgency) return '/agency';
  if (profile.role !== 'CUSTOMER') return '/';
  return '/account';
}

function accountMenuItems(profile: ClientAuthProfile, strings: NavbarMessages): { label: string; href: string }[] {
  const menu = strings.menu;
  if (profile.canAccessAdmin) {
    return [
      { label: menu.dashboard, href: '/admin' },
      { label: menu.agencies, href: '/admin/agencies' },
      { label: menu.bookings, href: '/admin/bookings' },
      { label: menu.settings, href: '/admin/settings' },
    ];
  }
  if (profile.canAccessAgency) {
    return [
      { label: menu.dashboard, href: '/agency' },
      { label: menu.myFleet, href: '/agency?tab=fleet' },
      { label: menu.bookings, href: '/agency?tab=bookings' },
    ];
  }
  if (profile.role !== 'CUSTOMER') {
    return [{ label: menu.home, href: '/' }];
  }
  return [
    { label: menu.myAccount, href: '/account' },
    { label: menu.myBookings, href: '/account?tab=bookings' },
    { label: menu.myProfile, href: '/account?tab=profile' },
  ];
}

function accountIdentity(profile: ClientAuthProfile, strings: NavbarMessages): { name: string; badge: string } {
  if (profile.canAccessAdmin) {
    return { name: profile.displayName, badge: strings.adminBadge };
  }
  if (profile.canAccessAgency) {
    return { name: profile.agencyName || profile.displayName, badge: strings.agencyBadge };
  }
  if (profile.role !== 'CUSTOMER') {
    return { name: profile.displayName, badge: profile.roleLabel };
  }
  return { name: profile.displayName, badge: strings.customerBadge };
}

function AccountAvatar({
  profile,
  className = 'h-8 w-8',
}: {
  profile: ClientAuthProfile;
  className?: string;
}) {
  const identity = { name: profile.canAccessAgency ? profile.agencyName || profile.displayName : profile.displayName };
  const avatarUrl = profile.canAccessAgency
    ? profile.agencyLogoUrl?.trim() || profile.avatarUrl?.trim()
    : profile.avatarUrl?.trim();
  // Adresse en échec (et non un simple booléen) : une nouvelle photo enregistrée est de nouveau tentée
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (avatarUrl && avatarUrl !== failedUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={avatarUrl}
        alt={identity.name}
        // Sans référent : Google refuse parfois les photos de profil demandées depuis un autre site
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(avatarUrl)}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200/80', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ink to-slate-800 font-bold text-white shadow-xs',
        className
      )}
      aria-hidden="true"
    >
      {identity.name ? identity.name.slice(0, 1).toLocaleUpperCase('fr-FR') : 'U'}
    </span>
  );
}

/* ====================================================================== */
/* DESTINATIONS DATA                                                      */
/* ====================================================================== */

interface DestinationDef {
  id: string;
  key: keyof NavbarMessages['destinationItems'];
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: 'arrival' | 'category';
}

/** Textes : t.navbar.destinationItems[key] */
const DESTINATION_ITEMS: DestinationDef[] = [
  { id: 'airport', key: 'airport', href: '/location-voiture-nador-aeroport', icon: Plane, section: 'arrival' },
  { id: 'port', key: 'port', href: '/location-voiture-beni-ansar', icon: Anchor, section: 'arrival' },
  { id: 'nador-center', key: 'center', href: '/location-voiture-nador', icon: MapPin, section: 'arrival' },
  { id: 'suv', key: 'suv', href: '/location-voiture-nador-suv', icon: CarFront, section: 'category' },
  { id: 'auto', key: 'automatic', href: '/location-voiture-nador-automatique', icon: Sparkles, section: 'category' },
];


/* ====================================================================== */
/* MAIN NAVBAR COMPONENT                                                  */
/* ====================================================================== */

export function Navbar() {
  // Chemin français canonique : /nl/search est actif comme /search
  const rawPathname = usePathname();
  const pathname = delocalizeHref(rawPathname ?? '/');
  const router = useRouter();
  const { t, locale, isRTL } = useTranslation();
  const strings = t.navbar;

  // Accessible IDs
  const destinationsMenuId = useId();
  const accountMenuId = useId();

  // Navigation state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [destAccordionOpen, setDestAccordionOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sorties animées : chaque surface reste montée (et inerte) le temps de sa sortie
  const destinationsMenu = usePresence(destinationsOpen);
  const accountMenu = usePresence(accountMenuOpen);
  const mobileDrawer = usePresence(mobileMenuOpen);

  // Authentication state
  const [authProfile, setAuthProfile] = useState<ClientAuthProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Refs
  const destinationsWrapperRef = useRef<HTMLDivElement>(null);
  const destinationsTriggerRef = useRef<HTMLButtonElement>(null);
  const destinationLinkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  // Menu mobile = dialogue modal : focus placé dans le menu, Tab piégé, Échap, page inerte, focus rendu au bouton
  const mobileDrawerRef = useModalDialog<HTMLDivElement>(mobileMenuOpen, { onClose: () => setMobileMenuOpen(false) });
  const authRequest = useRef(0);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* -------------------------------------------------------------------- */
  /* Authentication Lifecycle                                             */
  /* -------------------------------------------------------------------- */

  const refreshAuthProfile = useCallback(async () => {
    const requestId = ++authRequest.current;
    try {
      const profile = await fetchClientAuthProfile();
      if (requestId !== authRequest.current) return;
      setAuthProfile(profile);
      setAuthError(null);
    } catch (error: unknown) {
      if (requestId !== authRequest.current) return;
      setAuthProfile(null);
      setAuthError(error instanceof Error ? error.message : strings.sessionError);
    } finally {
      if (requestId === authRequest.current) {
        setAuthLoading(false);
      }
    }
  }, [strings.sessionError]);

  useEffect(() => {
    // Initial fetch handled asynchronously without tripping linter
    let active = true;
    (async () => {
      try {
        const profile = await fetchClientAuthProfile();
        if (active) {
          setAuthProfile(profile);
          setAuthError(null);
        }
      } catch (err: unknown) {
        if (active) {
          setAuthProfile(null);
          setAuthError(err instanceof Error ? err.message : strings.sessionError);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    })();

    // supabase-js chargé à la demande (hors du bundle initial de chaque page).
    // INITIAL_SESSION est émis dès l'abonnement : le profil vient d'être chargé ci-dessus (évite un 2e /api/auth/me)
    let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null | undefined = null;
    void import('@/lib/supabase/client').then(({ createClient }) => {
      if (!active) return;
      authSubscription = createClient()?.auth.onAuthStateChange((event: string) => {
        if (event === 'INITIAL_SESSION') return;
        void refreshAuthProfile();
      });
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshAuthProfile();
      }
    };

    window.addEventListener('focus', refreshAuthProfile);
    // Photo ou nom enregistrés dans « Mon profil » : le menu se met à jour aussitôt
    window.addEventListener('clickdrive:profile-updated', refreshAuthProfile);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      authRequest.current += 1;
      authSubscription?.data.subscription.unsubscribe();
      window.removeEventListener('focus', refreshAuthProfile);
      window.removeEventListener('clickdrive:profile-updated', refreshAuthProfile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshAuthProfile, strings.sessionError]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setAuthError(null);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      await signOutEverywhere(createClient());
      setAuthProfile(null);
      setAccountMenuOpen(false);
      setMobileMenuOpen(false);
      router.replace(localizeHref('/', locale));
      router.refresh();
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : strings.signOutError);
    } finally {
      setSigningOut(false);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Scroll State Detection                                               */
  /* -------------------------------------------------------------------- */

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Accueil : tant que le formulaire de recherche du hero est à l'écran, le bouton « Rechercher » de
  // l'en-tête passe en style neutre (un seul bouton rouge par écran) ; il redevient rouge une fois le
  // formulaire dépassé. Il reste à sa place : aucun décalage de l'en-tête collant.
  const [heroSearchInView, setHeroSearchInView] = useState(true);
  useEffect(() => {
    if (pathname !== '/') return;
    const target = document.getElementById('hero-search');
    if (!target) return;
    // Marge haute ≈ hauteur de l'en-tête collant : un formulaire passé dessous ne compte plus comme visible
    const observer = new IntersectionObserver(([entry]) => setHeroSearchInView(entry.isIntersecting), {
      rootMargin: '-110px 0px 0px 0px',
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
      setHeroSearchInView(true);
    };
  }, [pathname]);
  const searchCtaQuiet = pathname === '/' && heroSearchInView;

  /* -------------------------------------------------------------------- */
  /* Click Outside & Escape Key Handlers                                  */
  /* -------------------------------------------------------------------- */

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        destinationsWrapperRef.current &&
        !destinationsWrapperRef.current.contains(target)
      ) {
        setDestinationsOpen(false);
      }
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(target)
      ) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (destinationsOpen) {
          setDestinationsOpen(false);
          destinationsTriggerRef.current?.focus();
        }
        if (accountMenuOpen) {
          setAccountMenuOpen(false);
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          hamburgerButtonRef.current?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [destinationsOpen, accountMenuOpen, mobileMenuOpen]);

  /* -------------------------------------------------------------------- */
  /* Route Change Auto-Close                                              */
  /* -------------------------------------------------------------------- */

  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setMobileMenuOpen(false);
      setDestinationsOpen(false);
      setAccountMenuOpen(false);
    }
  }, [pathname]);

  /* -------------------------------------------------------------------- */
  /* Body Scroll Lock for Mobile Drawer                                   */
  /* -------------------------------------------------------------------- */

  // Défilement de la page bloqué par useModalDialog tant que le menu mobile est ouvert

  /* -------------------------------------------------------------------- */
  /* Hover Delays for Destinations Dropdown                               */
  /* -------------------------------------------------------------------- */

  const handleDestinationsMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setDestinationsOpen(true);
  };

  const handleDestinationsMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setDestinationsOpen(false);
    }, 180);
  };

  /* -------------------------------------------------------------------- */
  /* Destinations Keyboard Navigation                                     */
  /* -------------------------------------------------------------------- */

  const handleDestinationsTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDestinationsOpen(true);
      setTimeout(() => {
        destinationLinkRefs.current[0]?.focus();
      }, 50);
    }
  };

  const handleDestinationsMenuKeyDown = (e: React.KeyboardEvent) => {
    // + la carte « toute la flotte », dernier élément focalisable du menu
    const total = DESTINATION_ITEMS.length + 1;
    const currentIndex = destinationLinkRefs.current.findIndex(
      (el) => el === document.activeElement
    );

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % total;
      destinationLinkRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex <= 0 ? total - 1 : currentIndex - 1;
      destinationLinkRefs.current[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      destinationLinkRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      destinationLinkRefs.current[total - 1]?.focus();
    } else if (e.key === 'Tab') {
      setDestinationsOpen(false);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Active Route Helper                                                  */
  /* -------------------------------------------------------------------- */

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/search') return pathname === '/search' || pathname.startsWith('/search/');
    if (href === '/agencies') return pathname === '/agencies' || pathname.startsWith('/agencies/');
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isDestinationsActive = DESTINATION_ITEMS.some((item) => pathname === item.href);

  /* -------------------------------------------------------------------- */
  /* Navigation Links Definition                                          */
  /* -------------------------------------------------------------------- */

  const navLinks = [
    { href: '/', label: strings.home },
    { href: '/search', label: strings.cars },
    { href: '/motos', label: strings.motos },
    { href: '/agencies', label: strings.agencies },
    { href: '/about', label: strings.howItWorks },
    { href: '/faq', label: strings.faqHelp },
  ];

  return (
    <header className="sticky top-0 z-50 w-full" role="banner">
      {/* ============================================================== */}
      {/* 1. TOP UTILITY BAR (Industrial Deep Navy #0B1220)              */}
      {/* ============================================================== */}
      <div className="hidden border-b border-white/6 bg-ink text-[11px] font-medium text-slate-400 sm:block">
        <div className="mx-auto flex h-8.5 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 [&_a]:min-h-6 [&_button]:min-h-6">
          {/* Left: Verified Fleet Status & Quick Transits */}
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                {/* Trois pulsations puis arrêt : une animation infinie distrait sur chaque page (WCAG 2.2.2) */}
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 [animation-iteration-count:3]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span>{strings.verifiedAgencies}</span>
            </div>

            <span className="hidden h-3 w-px bg-slate-800 md:block" aria-hidden="true" />

            <div className="hidden items-center gap-3 text-slate-400 md:flex">
              <Link
                href="/location-voiture-nador-aeroport"
                className="flex items-center gap-1.5 transition-colors hover:text-white"
              >
                <Plane className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{strings.airport}</span>
              </Link>

              <span className="text-slate-700" aria-hidden="true">·</span>

              <Link
                href="/location-voiture-beni-ansar"
                className="flex items-center gap-1.5 transition-colors hover:text-white"
              >
                <Anchor className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{strings.port}</span>
              </Link>
            </div>
          </div>

          {/* Right: Partner Link, Auth Status, WhatsApp Support */}
          <div className="flex shrink-0 items-center gap-3.5">
            <Link
              href="/about"
              aria-current={isNavActive('/about') ? 'page' : undefined}
              className={cn(
                'hidden items-center gap-1.5 transition-colors hover:text-white xl:flex',
                isNavActive('/about') ? 'text-white' : 'text-slate-400'
              )}
            >
              <span>{strings.howItWorks}</span>
            </Link>

            <span className="hidden h-3 w-px bg-slate-800 xl:block" aria-hidden="true" />

            <Link
              href="/agency/join"
              className="hidden items-center gap-1.5 text-slate-400 transition-colors hover:text-white lg:flex"
            >
              <Building2 className="h-3 w-3 text-slate-400" aria-hidden="true" />
              <span>{strings.becomePartner}</span>
            </Link>

            {/* Compte : uniquement dans la barre principale (bouton ou menu à toutes les tailles d'écran),
                plus de second « Se connecter » / nom de compte ici */}
            <span className="hidden h-3 w-px bg-slate-800 lg:block" aria-hidden="true" />

            <a
              href="https://wa.me/212634536286?text=Bonjour%2C%20je%20souhaite%20louer%20un%20v%C3%A9hicule%20%C3%A0%20Nador"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
              aria-label={strings.whatsapp}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{strings.whatsapp}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN HEADER BAR                                             */}
      {/* ============================================================== */}
      <div
        className={cn(
          // Seules les couleurs et l'ombre changent au défilement (ni hauteur ni flou animés : pas de décalage)
          'w-full border-b transition-[background-color,border-color,box-shadow] duration-base',
          scrolled
            ? 'border-slate-200/80 bg-white/98 shadow-[0_4px_24px_rgba(11,18,32,0.06)] backdrop-blur-xl'
            : 'border-slate-200/60 bg-white/94 backdrop-blur-lg'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Hauteur constante : un en-tête collant qui rétrécit au défilement décale toute la page (CLS).
              Le défilement ne change que l'ombre et l'opacité du fond. */}
          <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 sm:h-16 lg:h-18 lg:gap-6 xl:gap-8">
            {/* -------------------------------------------------------- */}
            {/* BRAND LOGO                                               */}
            {/* -------------------------------------------------------- */}
            <Link
              href="/"
              aria-label={strings.homeAria}
              className="group flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-brand"
            >
              {/* Mobile Compact Emblem (under 640px) */}
              <div className="relative h-8 w-[128px] sm:hidden">
                <Image
                  src={brandLogo}
                  alt="ClickDrive"
                  fill
                  sizes="128px"
                  className="object-contain"
                  priority
                />
              </div>

              {/* Tablet & Desktop Full Wordmark (640px and above) */}
              {/* Proportions calées sur le logo (1036×241, ≈ 4,3:1) pour qu'il occupe toute la hauteur */}
              <div className="relative hidden h-10 w-[172px] sm:block lg:h-11 lg:w-[189px]">
                <Image
                  src={brandLogo}
                  alt="ClickDrive — Location de voitures à Nador"
                  fill
                  sizes="(max-width: 1024px) 208px, 224px"
                  className={cn(
                    'object-contain',
                    isRTL ? 'object-right' : 'object-left'
                  )}
                  priority
                />
              </div>
            </Link>

            {/* -------------------------------------------------------- */}
            {/* DESKTOP NAVIGATION (1024px+ lg / xl / 2xl)               */}
            {/* -------------------------------------------------------- */}
            <nav
              aria-label={strings.navigation}
              className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1 min-w-0"
            >
              {/* 1. Accueil */}
              <Link
                href="/"
                aria-current={isNavActive('/') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-brand xl:px-3',
                  isNavActive('/')
                    ? 'font-bold text-ink'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink'
                )}
              >
                {strings.home}
                {isNavActive('/') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </Link>

              {/* 2. Véhicules */}
              <Link
                href="/search"
                aria-current={isNavActive('/search') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-brand xl:px-3',
                  isNavActive('/search')
                    ? 'font-bold text-ink'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink'
                )}
              >
                {strings.cars}
                {isNavActive('/search') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </Link>

              {/* 2 bis. Motos (catalogue séparé) */}
              <Link
                href="/motos"
                aria-current={isNavActive('/motos') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-brand xl:px-3',
                  isNavActive('/motos')
                    ? 'font-bold text-ink'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink'
                )}
              >
                {strings.motos}
                {isNavActive('/motos') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </Link>

              {/* 3. Agences */}
              <Link
                href="/agencies"
                aria-current={isNavActive('/agencies') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-brand xl:px-3',
                  isNavActive('/agencies')
                    ? 'font-bold text-ink'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink'
                )}
              >
                {strings.agencies}
                {isNavActive('/agencies') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </Link>

              {/* 4. DESTINATIONS MEGA-DROPDOWN */}
              <div
                ref={destinationsWrapperRef}
                className="relative"
                onMouseEnter={handleDestinationsMouseEnter}
                onMouseLeave={handleDestinationsMouseLeave}
              >
                <button
                  ref={destinationsTriggerRef}
                  type="button"
                  id="destinations-menu-button"
                  aria-haspopup="menu"
                  aria-expanded={destinationsOpen}
                  aria-controls={destinationsMenuId}
                  onClick={() => setDestinationsOpen((prev) => !prev)}
                  onKeyDown={handleDestinationsTriggerKeyDown}
                  className={cn(
                    'relative flex whitespace-nowrap items-center gap-1.5 rounded-xl px-2.5 xl:px-3 py-2 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-brand',
                    destinationsOpen || isDestinationsActive
                      ? 'bg-slate-100/80 font-bold text-ink'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink'
                  )}
                >
                  <span>{strings.destinations}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-slate-400 transition-transform duration-fast',
                      destinationsOpen && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                  {isDestinationsActive && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                  )}
                </button>

                {/* Dropdown Panel */}
                {destinationsMenu.mounted && (
                  <div
                    id={destinationsMenuId}
                    role="menu"
                    aria-labelledby="destinations-menu-button"
                    onKeyDown={handleDestinationsMenuKeyDown}
                    inert={destinationsMenu.closing || undefined}
                    onAnimationEnd={destinationsMenu.onAnimationEnd}
                    className={cn(
                      'absolute top-full z-50 mt-3 w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-overlay',
                      destinationsMenu.closing ? 'animate-cd-dropdown-out' : 'animate-cd-dropdown',
                      isRTL ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    )}
                  >
                    <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                      {/* Colonne 1 : lieux de prise en charge */}
                      <div className="p-5">
                        <p className="flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          <MapPin className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
                          {strings.arrivalHubs}
                        </p>
                        <div className="mt-2 space-y-0.5">
                          {DESTINATION_ITEMS.filter((item) => item.section === 'arrival').map((item, index) => {
                            const Icon = item.icon;
                            const active = pathname === item.href;
                            const tag = strings.destinationItems[item.key].tag || null;
                            return (
                              <Link
                                key={item.href}
                                ref={(el) => {
                                  destinationLinkRefs.current[index] = el;
                                }}
                                href={item.href}
                                role="menuitem"
                                aria-current={active ? 'page' : undefined}
                                onClick={() => setDestinationsOpen(false)}
                                className={cn(
                                  'group flex items-start gap-3 rounded-2xl p-2.5 outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-brand',
                                  active ? 'bg-canvas' : 'hover:bg-canvas'
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-fast',
                                    active
                                      ? 'bg-action text-white'
                                      : 'bg-canvas text-ink group-hover:bg-ink group-hover:text-white'
                                  )}
                                >
                                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1 pt-0.5">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-[13px] font-bold leading-snug text-ink">
                                      {strings.destinationItems[item.key].title}
                                    </span>
                                    {tag && (
                                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-accent-text">
                                        {tag}
                                      </span>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                                    {strings.destinationItems[item.key].desc}
                                  </span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>

                      {/* Colonne 2 : types de véhicule + accès à toute la flotte */}
                      <div className="flex flex-col border-s border-slate-100 bg-[#FAFAFB] p-5">
                        <p className="flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          <CarFront className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
                          {strings.categoriesHubs}
                        </p>
                        <div className="mt-2 space-y-0.5">
                          {DESTINATION_ITEMS.filter((item) => item.section === 'category').map((item, index) => {
                            const Icon = item.icon;
                            const active = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                ref={(el) => {
                                  destinationLinkRefs.current[3 + index] = el;
                                }}
                                href={item.href}
                                role="menuitem"
                                aria-current={active ? 'page' : undefined}
                                onClick={() => setDestinationsOpen(false)}
                                className={cn(
                                  'group flex items-center gap-3 rounded-2xl p-2.5 outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-brand',
                                  active ? 'bg-white shadow-sm' : 'hover:bg-white hover:shadow-sm'
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-fast',
                                    active
                                      ? 'border-brand bg-action text-white'
                                      : 'border-slate-200 bg-white text-ink group-hover:border-ink group-hover:bg-ink group-hover:text-white'
                                  )}
                                >
                                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-bold leading-snug text-ink">
                                    {strings.destinationItems[item.key].title}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                                    {strings.destinationItems[item.key].desc}
                                  </span>
                                </span>
                                <ArrowRight
                                  className="h-4 w-4 shrink-0 text-slate-300 transition-[color,transform] duration-fast group-hover:translate-x-0.5 group-hover:text-accent-text rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
                                  aria-hidden="true"
                                />
                              </Link>
                            );
                          })}
                        </div>

                        {/* Carte « toute la flotte » */}
                        <Link
                          href="/search"
                          role="menuitem"
                          ref={(el) => {
                            destinationLinkRefs.current[5] = el;
                          }}
                          onClick={() => setDestinationsOpen(false)}
                          className="group relative mt-auto block overflow-hidden rounded-2xl bg-ink p-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full bg-brand/25 blur-2xl"
                          />
                          <span className="relative block text-[13px] font-bold">{strings.partnerFleetNotice}</span>
                          <span className="relative mt-1 block text-xs leading-relaxed text-slate-400">
                            {strings.partnerFleetDesc}
                          </span>
                          <span className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white">
                            {strings.viewAllCars}
                            <ArrowRight
                              className="h-3.5 w-3.5 text-accent-text transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
                              aria-hidden="true"
                            />
                          </span>
                        </Link>
                      </div>
                    </div>

                    {/* Pied : réassurance factuelle */}
                    <div className="flex items-center gap-2 border-t border-slate-100 px-7 py-3 text-xs text-slate-500">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      {strings.allAgenciesVerified}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Aide (≥ 1280 px ; « Comment ça marche » est dans la barre supérieure) */}
              <Link
                href="/faq"
                aria-current={isNavActive('/faq') ? 'page' : undefined}
                className={cn(
                  'relative hidden xl:block whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-brand',
                  isNavActive('/faq')
                    ? 'font-bold text-ink'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink'
                )}
              >
                {strings.faqHelp}
                {isNavActive('/faq') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </Link>
            </nav>

            {/* -------------------------------------------------------- */}
            {/* DESKTOP ACTIONS (1024px+)                                */}
            {/* -------------------------------------------------------- */}
            <div className="hidden shrink-0 items-center justify-end gap-2 lg:flex xl:gap-2.5">
              {/* Account Dropdown / Auth Buttons */}
              {authLoading ? (
                <span
                  className="h-10 w-28 animate-pulse rounded-xl bg-slate-100"
                  role="status"
                  aria-label={strings.sessionChecking}
                />
              ) : authProfile ? (
                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    id="account-menu-button"
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                    aria-controls={accountMenuId}
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    aria-label={`${accountIdentity(authProfile, strings).badge} : ${accountIdentity(authProfile, strings).name}`}
                    className="inline-flex max-w-52 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand xl:px-2.5"
                  >
                    <AccountAvatar profile={authProfile} className="h-7 w-7 text-xs" />
                    {/* Nom et rôle affichés à partir de 1280 px ; avatar seul en dessous */}
                    <span className="hidden min-w-0 xl:block">
                      <span className="block max-w-28 truncate text-xs font-bold text-slate-900">
                        {accountIdentity(authProfile, strings).name}
                      </span>
                      <span className="block text-[11px] font-medium text-slate-500">
                        {accountIdentity(authProfile, strings).badge}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-fast',
                        accountMenuOpen && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {accountMenu.mounted && (
                    <div
                      id={accountMenuId}
                      role="menu"
                      aria-labelledby="account-menu-button"
                      inert={accountMenu.closing || undefined}
                      onAnimationEnd={accountMenu.onAnimationEnd}
                      className={cn(
                        'absolute top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(11,18,32,0.12)]',
                        accountMenu.closing ? 'animate-cd-dropdown-out' : 'animate-cd-dropdown',
                        isRTL ? 'left-0' : 'right-0'
                      )}
                    >
                      <div className="border-b border-slate-100 px-3 py-2">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {accountIdentity(authProfile, strings).name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{authProfile.email}</p>
                        {authProfile.canAccessAgency && authProfile.agencyName && (
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-ink">
                            {authProfile.agencyName}
                          </p>
                        )}
                      </div>

                      <div className="py-1">
                        {accountMenuItems(authProfile, strings).map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            onClick={() => setAccountMenuOpen(false)}
                            className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          disabled={signingOut}
                          onClick={() => void handleSignOut()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          {signingOut ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>{signingOut ? strings.signingOut : strings.signOut}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : authError ? (
                <button
                  type="button"
                  onClick={() => void refreshAuthProfile()}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
                >
                  {strings.retry}
                </button>
              ) : (
                <Link
                  href={LOGIN_PATH}
                  aria-label={strings.login}
                  title={strings.login}
                  className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-[background-color,border-color,color,scale] duration-fast hover:border-slate-300 hover:bg-slate-50 hover:text-ink motion-press focus-visible:outline-2 focus-visible:outline-brand xl:px-3"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  {/* Texte à partir de 1280 px ; icône seule en dessous */}
                  <span className="hidden xl:inline">{strings.login}</span>
                </Link>
              )}

              {/* Language Selector */}
              <LanguageSelector variant="navbar" />

              {/* Primary Search CTA */}
              <Magnet strength={0.25}>
                <Link
                  href="/search"
                  className={cn(
                    'group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border px-4 py-2.5 text-xs font-bold shadow-xs transition-[background-color,border-color,color,box-shadow,scale] duration-base motion-press focus-visible:outline-2 focus-visible:outline-ink motion-reduce:transition-none',
                    searchCtaQuiet
                      ? 'border-slate-200/90 bg-white text-ink hover:border-slate-300 hover:bg-slate-50'
                      : 'border-transparent bg-action text-white shadow-red-900/20 hover:bg-action-hover hover:shadow-[0_6px_22px_rgba(230,57,70,0.35)]'
                  )}
                >
                  {!searchCtaQuiet && (
                    <span
                      className="absolute inset-0 bg-linear-to-br from-white/15 to-transparent pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{strings.search}</span>
                  <ArrowRight
                    className={cn(
                      'h-3 w-3 opacity-90 transition-transform duration-fast',
                      isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'
                    )}
                    aria-hidden="true"
                  />
                </Link>
              </Magnet>
            </div>

            {/* -------------------------------------------------------- */}
            {/* TABLET CONTROLS (640px to 1023px: sm / md)               */}
            {/* NO HIDDEN-NAVIGATION BREAKPOINT GAPS!                    */}
            {/* -------------------------------------------------------- */}
            {/* La recherche (Voitures / Motos) est dans la navigation inférieure */}
            <div className="hidden sm:flex lg:hidden items-center gap-2 justify-end">
              {/* Tablet Language Selector */}
              <LanguageSelector variant="navbar" />

              {/* Tablet Account shortcut */}
              {authLoading ? (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100"
                  role="status"
                  aria-label={strings.sessionChecking}
                >
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                </span>
              ) : authProfile ? (
                <Link
                  href={accountHref(authProfile)}
                  aria-label={`${accountIdentity(authProfile, strings).badge} : ${accountIdentity(authProfile, strings).name}`}
                  title={accountIdentity(authProfile, strings).name}
                  className="flex h-9 max-w-36 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-2 text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <AccountAvatar profile={authProfile} className="h-6 w-6 text-[10px]" />
                  <span className="truncate text-xs font-bold">
                    {accountIdentity(authProfile, strings).name}
                  </span>
                </Link>
              ) : (
                <Link
                  href={LOGIN_PATH}
                  aria-label={strings.login}
                  className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}

              {/* Hamburger Button for Tablet */}
              <button
                ref={hamburgerButtonRef}
                type="button"
                aria-label={mobileMenuOpen ? strings.closeMenu : strings.openMenu}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* -------------------------------------------------------- */}
            {/* MOBILE CONTROLS (< 640px: 375px / 430px)                 */}
            {/* -------------------------------------------------------- */}
            {/* En-tête compact : logo, profil, menu. Recherche → navigation inférieure ; langue → menu. */}
            <div className="flex sm:hidden items-center justify-end gap-2">
              {/* Account Icon Shortcut — même taille dans les trois états : rien ne bouge à la fin du chargement */}
              {authLoading ? (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"
                  role="status"
                  aria-label={strings.sessionChecking}
                >
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                </span>
              ) : authProfile ? (
                <Link
                  href={accountHref(authProfile)}
                  aria-label={`${accountIdentity(authProfile, strings).badge} : ${accountIdentity(authProfile, strings).name}`}
                  className="tap-44 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <AccountAvatar profile={authProfile} className="h-7 w-7 text-[10px]" />
                </Link>
              ) : (
                <Link
                  href={LOGIN_PATH}
                  aria-label={strings.login}
                  className="tap-44 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <User className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>
              )}

              {/* Hamburger Button */}
              <button
                type="button"
                aria-label={mobileMenuOpen ? strings.closeMenu : strings.openMenu}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="tap-44 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MOBILE & TABLET NAVIGATION DRAWER                           */}
      {/* ============================================================== */}
      {mobileDrawer.mounted && (
        <div className="lg:hidden" inert={mobileDrawer.closing || undefined}>
          {/* Accessible Backdrop Overlay */}
          <div
            className={cn(
              'fixed inset-0 z-50 bg-ink/55 backdrop-blur-[2px]',
              mobileDrawer.closing ? 'motion-safe:animate-cd-fade-out' : 'motion-safe:animate-cd-fade-in'
            )}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            data-modal-backdrop
          />

          {/* Tiroir latéral : une bande de la page reste visible (contexte + fermeture d'un geste) */}
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={strings.navigation}
            tabIndex={-1}
            onAnimationEnd={mobileDrawer.onAnimationEnd}
            className={cn(
              'fixed inset-y-0 z-50 flex w-[min(22rem,calc(100vw-3.5rem))] flex-col bg-white shadow-2xl outline-none',
              mobileDrawer.closing ? 'motion-safe:animate-cd-drawer-out' : 'motion-safe:animate-cd-drawer-in',
              isRTL ? 'left-0 border-r border-slate-200' : 'right-0 border-l border-slate-200'
            )}
          >
            {/* Drawer Top Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 ps-5 pe-3 pt-[env(safe-area-inset-top)] box-content">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-11 items-center"
              >
                <Image
                  src={brandLogo}
                  alt="ClickDrive"
                  sizes="140px"
                  className="h-8 w-auto object-contain"
                />
              </Link>

              <button
                type="button"
                aria-label={strings.closeMenu}
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            {/* Contenu resserré : la recherche est déjà dans la navigation inférieure */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {/* Language Switcher in Drawer */}
              <div>
                <LanguageSelector variant="mobile" />
              </div>

              {/* Main Navigation Links */}
              <div>
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {strings.navigation}
                </p>

                <nav className="space-y-1">
                  {navLinks.map((link) => {
                    const active = isNavActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors',
                          active
                            ? 'bg-slate-100 font-bold text-ink border-s-4 border-brand'
                            : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <span>{link.label}</span>
                        <ChevronRight
                          className={cn('h-4 w-4 text-slate-400', isRTL && 'rotate-180')}
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}

                  {/* Destinations Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      aria-expanded={destAccordionOpen}
                      onClick={() => setDestAccordionOpen((prev) => !prev)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors',
                        destAccordionOpen || isDestinationsActive
                          ? 'bg-slate-100 font-bold text-ink'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Compass className="h-4 w-4 text-accent-text" aria-hidden="true" />
                        <span>{strings.destinations}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-slate-400 transition-transform duration-fast',
                          destAccordionOpen && 'rotate-180'
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {destAccordionOpen && (
                      <div className="mt-2 space-y-1 ps-3 pe-1">
                        {DESTINATION_ITEMS.map((item) => {
                          const Icon = item.icon;
                          const active = pathname === item.href;
                          const title = strings.destinationItems[item.key].title;
                          const tag = strings.destinationItems[item.key].tag || null;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center justify-between rounded-xl p-2.5 transition-colors',
                                active
                                  ? 'bg-slate-100 font-bold text-ink'
                                  : 'hover:bg-slate-50 text-slate-700'
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <span className="block truncate text-xs font-semibold">
                                    {title}
                                  </span>
                                  {tag && (
                                    <span className="text-[11px] font-bold text-accent-text">
                                      {tag}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <ChevronRight
                                className={cn('h-3.5 w-3.5 shrink-0 text-slate-300', isRTL && 'rotate-180')}
                                aria-hidden="true"
                              />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </nav>
              </div>

              {/* Account Section in Drawer */}
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {strings.account}
                </p>

                {authLoading ? (
                  <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                    <span>{strings.sessionChecking}</span>
                  </p>
                ) : authProfile ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="mb-3 flex items-center gap-3">
                      <AccountAvatar profile={authProfile} className="h-10 w-10 text-sm" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {accountIdentity(authProfile, strings).name}
                        </p>
                        <p className="text-[11px] font-semibold text-ink">
                          {accountIdentity(authProfile, strings).badge}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{authProfile.email}</p>
                      </div>
                    </div>

                    <nav aria-label={strings.accountMenuMobile} className="space-y-1">
                      {accountMenuItems(authProfile, strings).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex min-h-11 items-center justify-between rounded-lg px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-white"
                        >
                          <span>{item.label}</span>
                          <ChevronRight
                            className={cn('h-3.5 w-3.5 text-slate-400', isRTL && 'rotate-180')}
                            aria-hidden="true"
                          />
                        </Link>
                      ))}
                    </nav>

                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={() => void handleSignOut()}
                      className="mt-2 flex min-h-11 w-full items-center gap-2 border-t border-slate-200/80 px-3 pt-1 text-[13px] font-bold text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
                    >
                      {signingOut ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{signingOut ? strings.signingOut : strings.signOut}</span>
                    </button>
                  </div>
                ) : authError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p>{authError}</p>
                    <button
                      type="button"
                      onClick={() => void refreshAuthProfile()}
                      className="mt-1 min-h-11 font-bold underline"
                    >
                      {strings.retry}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Link
                      href={LOGIN_PATH}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-accent-text">
                          <User className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>{strings.login}</span>
                      </span>
                      <ChevronRight
                        className={cn('h-4 w-4 text-slate-400', isRTL && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                )}
              </div>

              {/* Direct WhatsApp Support */}
              <a
                href="https://wa.me/212634536286?text=Bonjour%2C%20je%20veux%20louer%20une%20voiture%20%C3%A0%20Nador"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>{strings.whatsappHelp}</span>
              </a>

              {/* Région, en une ligne (les badges de réassurance sont sur les pages, pas dans le menu) */}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span>{strings.locationTag}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
