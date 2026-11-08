'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
} from 'react';
import Link from 'next/link';
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
  Clock3,
  Star,
  LogIn,
  LogOut,
  Loader2,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOGIN_PATH } from '@/lib/auth/login-portals';
import { createClient } from '@/lib/supabase/client';
import {
  fetchClientAuthProfile,
  signOutEverywhere,
  type ClientAuthProfile,
} from '@/lib/auth/client';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { LanguageSelector } from '@/components/shared/LanguageSelector';
import { Magnet } from '@/components/ui/react-bits';

/* ====================================================================== */
/* LOCALIZATION DICTIONARY                                                */
/* ====================================================================== */

interface NavStrings {
  motos: string;
  verifiedAgencies: string;
  airport: string;
  port: string;
  becomePartner: string;
  account: string;
  sessionChecking: string;
  sessionError: string;
  retry: string;
  whatsapp: string;
  home: string;
  cars: string;
  agencies: string;
  destinations: string;
  howItWorks: string;
  faqHelp: string;
  findCar: string;
  search: string;
  login: string;
  signup: string;
  signOut: string;
  signingOut: string;
  destinationsTitle: string;
  destinationsSubtitle: string;
  arrivalHubs: string;
  arrivalHubsDesc: string;
  categoriesHubs: string;
  categoriesHubsDesc: string;
  viewAllCars: string;
  searchFleet: string;
  allAgenciesVerified: string;
  navigation: string;
  closeMenu: string;
  openMenu: string;
  myAccount: string;
  partnerFleetNotice: string;
  partnerFleetDesc: string;
  needAssistance: string;
  whatsappHelp: string;
  badgeVerified: string;
  badgePricing: string;
  badgeSupport: string;
  locationTag: string;
  adminBadge: string;
  agencyBadge: string;
  customerBadge: string;
}

const STRINGS: Record<string, NavStrings> = {
  fr: {
    verifiedAgencies: 'Agences partenaires vérifiées',
    airport: 'Aéroport Nador-Al Aroui',
    port: 'Port Beni Ansar',
    becomePartner: 'Devenir partenaire',
    account: 'Compte',
    sessionChecking: 'Vérification…',
    sessionError: 'Session à vérifier',
    retry: 'Réessayer',
    whatsapp: 'WhatsApp',
    home: 'Accueil',
    cars: 'Voitures',
    motos: 'Motos',
    agencies: 'Agences',
    destinations: 'Destinations',
    howItWorks: 'Fonctionnement',
    faqHelp: 'Aide',
    findCar: 'Trouver un véhicule',
    search: 'Rechercher',
    login: 'Se connecter',
    signup: 'Créer un compte',
    signOut: 'Déconnexion',
    signingOut: 'Déconnexion…',
    destinationsTitle: 'Destinations & Prise en charge',
    destinationsSubtitle: "Trouvez un véhicule selon votre point d'arrivée à Nador",
    arrivalHubs: 'Lieux de prise en charge',
    arrivalHubsDesc: 'Aéroport, port & Marchica',
    categoriesHubs: 'Par type de véhicule',
    categoriesHubsDesc: 'Flotte disponible immédiatement',
    viewAllCars: 'Voir tous les véhicules',
    searchFleet: 'Explorer la flotte',
    allAgenciesVerified: 'Agences locales vérifiées par ClickDrive avant leur mise en ligne',
    navigation: 'Navigation principale',
    closeMenu: 'Fermer le menu',
    openMenu: 'Ouvrir le menu de navigation',
    myAccount: 'Mon espace',
    partnerFleetNotice: 'Pas encore fixé ?',
    partnerFleetDesc: 'Comparez la flotte de toutes les agences partenaires de Nador.',
    needAssistance: 'Assistance client directe',
    whatsappHelp: 'Assistance WhatsApp ClickDrive',
    badgeVerified: 'Partenaires vérifiés',
    badgePricing: 'Prix transparents',
    badgeSupport: 'Support local',
    locationTag: "Nador · Région de l'Oriental · Maroc",
    adminBadge: 'Administrateur',
    agencyBadge: 'Agence',
    customerBadge: 'Client',
  },
  ar: {
    verifiedAgencies: 'وكالات شريكة معتمدة',
    airport: 'مطار الناظور العروي',
    port: 'ميناء بني انصار',
    becomePartner: 'انضم كشريك',
    account: 'الحساب',
    sessionChecking: 'جاري التحقق…',
    sessionError: 'تحقق من الجلسة',
    retry: 'إعادة المحاولة',
    whatsapp: 'واتساب',
    home: 'الرئيسية',
    cars: 'السيارات',
    motos: 'الدراجات النارية',
    agencies: 'الوكالات',
    destinations: 'الوجهات',
    howItWorks: 'كيف يعمل',
    faqHelp: 'المساعدة',
    findCar: 'ابحث عن سيارة',
    search: 'بحث',
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    signOut: 'تسجيل الخروج',
    signingOut: 'جاري الخروج…',
    destinationsTitle: 'الوجهات ونقاط الاستلام',
    destinationsSubtitle: 'ابحث عن سيارة متوفرة حسب نقطة وصولك إلى الناظور',
    arrivalHubs: 'أماكن الاستلام',
    arrivalHubsDesc: 'المطار، الميناء ووسط المدينة',
    categoriesHubs: 'حسب نوع السيارة',
    categoriesHubsDesc: 'أسطول جاهز للاستلام الفوري',
    viewAllCars: 'عرض جميع السيارات',
    searchFleet: 'تصفح الأسطول',
    allAgenciesVerified: 'وكالات محلية تتحقق منها ClickDrive قبل نشرها',
    navigation: 'القائمة الرئيسية',
    closeMenu: 'إغلاق القائمة',
    openMenu: 'فتح قائمة التنقل',
    myAccount: 'حسابي',
    partnerFleetNotice: 'لم تحدد بعد؟',
    partnerFleetDesc: 'قارن أساطيل جميع الوكالات الشريكة في الناظور.',
    needAssistance: 'مساعدة فورية',
    whatsappHelp: 'مساعدة واتساب كاردرايف',
    badgeVerified: 'وكالات معتمدة',
    badgePricing: 'أسعار واضحة',
    badgeSupport: 'دعم محلي',
    locationTag: 'الناظور · الجهة الشرقية · المغرب',
    adminBadge: 'مدير النظام',
    agencyBadge: 'وكالة',
    customerBadge: 'زبون',
  },
  en: {
    verifiedAgencies: 'Verified Partner Agencies',
    airport: 'Nador Al-Aroui Airport',
    port: 'Beni Ansar Port',
    becomePartner: 'Partner with us',
    account: 'Account',
    sessionChecking: 'Checking…',
    sessionError: 'Session status',
    retry: 'Retry',
    whatsapp: 'WhatsApp',
    home: 'Home',
    cars: 'Cars',
    motos: 'Motorbikes',
    agencies: 'Agencies',
    destinations: 'Destinations',
    howItWorks: 'How it works',
    faqHelp: 'Help',
    findCar: 'Find a vehicle',
    search: 'Search',
    login: 'Sign in',
    signup: 'Create account',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    destinationsTitle: 'Destinations & Pickup Points',
    destinationsSubtitle: 'Find an available vehicle based on your arrival point in Nador',
    arrivalHubs: 'Pickup locations',
    arrivalHubsDesc: 'Airport, Port & Marchica',
    categoriesHubs: 'By vehicle type',
    categoriesHubsDesc: 'Immediately available vehicles',
    viewAllCars: 'See all vehicles',
    searchFleet: 'Browse Fleet',
    allAgenciesVerified: 'Local agencies checked by ClickDrive before going live',
    navigation: 'Main navigation',
    closeMenu: 'Close menu',
    openMenu: 'Open navigation menu',
    myAccount: 'My space',
    partnerFleetNotice: 'Not sure yet?',
    partnerFleetDesc: 'Compare the fleets of every partner agency in Nador.',
    needAssistance: 'Direct customer support',
    whatsappHelp: 'ClickDrive WhatsApp Support',
    badgeVerified: 'Verified Partners',
    badgePricing: 'Transparent Pricing',
    badgeSupport: 'Local support',
    locationTag: 'Nador · Oriental Region · Morocco',
    adminBadge: 'Administrator',
    agencyBadge: 'Agency',
    customerBadge: 'Customer',
  },
};

function getStrings(locale: string): NavStrings {
  return STRINGS[locale] || STRINGS.fr;
}

/* ====================================================================== */
/* ACCOUNT HELPERS                                                        */
/* ====================================================================== */

function accountHref(profile: ClientAuthProfile): string {
  if (profile.canAccessAdmin) return '/admin';
  if (profile.canAccessAgency) return '/agency';
  if (profile.role !== 'CUSTOMER') return '/';
  return '/account';
}

function accountMenuItems(
  profile: ClientAuthProfile,
  locale: string
): { label: string; href: string }[] {
  const isAr = locale === 'ar';
  const isEn = locale === 'en';

  if (profile.canAccessAdmin) {
    return [
      { label: isAr ? 'لوحة التحكم' : isEn ? 'Dashboard' : 'Tableau de bord', href: '/admin' },
      { label: isAr ? 'الوكالات' : isEn ? 'Agencies' : 'Agences', href: '/admin/agencies' },
      { label: isAr ? 'الحجوزات' : isEn ? 'Bookings' : 'Réservations', href: '/admin/bookings' },
      { label: isAr ? 'الإعدادات' : isEn ? 'Settings' : 'Paramètres', href: '/admin/settings' },
    ];
  }
  if (profile.canAccessAgency) {
    return [
      { label: isAr ? 'لوحة التحكم' : isEn ? 'Dashboard' : 'Tableau de bord', href: '/agency' },
      { label: isAr ? 'أسطول سياراتي' : isEn ? 'My Fleet' : 'Mes véhicules', href: '/agency?tab=fleet' },
      { label: isAr ? 'الحجوزات' : isEn ? 'Bookings' : 'Réservations', href: '/agency?tab=bookings' },
    ];
  }
  if (profile.role !== 'CUSTOMER') {
    return [{ label: isAr ? 'الرئيسية' : isEn ? 'Home' : 'Accueil', href: '/' }];
  }
  return [
    { label: isAr ? 'حسابي' : isEn ? 'My Account' : 'Mon espace', href: '/account' },
    { label: isAr ? 'حجوزاتي' : isEn ? 'My Bookings' : 'Mes réservations', href: '/account?tab=bookings' },
    { label: isAr ? 'ملفي الشخصي' : isEn ? 'My Profile' : 'Mon profil', href: '/account?tab=profile' },
  ];
}

function accountIdentity(
  profile: ClientAuthProfile,
  locale: string
): { name: string; badge: string } {
  const strings = getStrings(locale);
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
  const identity = accountIdentity(profile, 'fr');
  const avatarUrl = profile.canAccessAgency
    ? profile.agencyLogoUrl?.trim() || profile.avatarUrl?.trim()
    : profile.avatarUrl?.trim();
  const [imageError, setImageError] = useState(false);

  if (avatarUrl && !imageError) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={avatarUrl}
        alt={identity.name}
        onError={() => setImageError(true)}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200/80', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#0B1220] to-[#1E293B] font-bold text-white shadow-xs',
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
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: 'arrival' | 'category';
  title: Record<string, string>;
  shortTitle: Record<string, string>;
  desc: Record<string, string>;
  tag?: Record<string, string>;
}

const DESTINATION_ITEMS: DestinationDef[] = [
  {
    id: 'airport',
    href: '/location-voiture-nador-aeroport',
    icon: Plane,
    section: 'arrival',
    title: {
      fr: 'Aéroport Nador-Al Aroui',
      ar: 'مطار الناظور العروي',
      en: 'Nador Al-Aroui Airport',
    },
    shortTitle: {
      fr: 'Aéroport Nador',
      ar: 'مطار الناظور',
      en: 'Nador Airport',
    },
    desc: {
      fr: 'Prise en charge directe dès la descente de votre vol',
      ar: 'استلام مباشر فور نزولك من الطائرة',
      en: 'Direct pickup upon flight arrival',
    },
    tag: {
      fr: 'Populaire',
      ar: 'الأكثر طلباً',
      en: 'Popular',
    },
  },
  {
    id: 'port',
    href: '/location-voiture-beni-ansar',
    icon: Anchor,
    section: 'arrival',
    title: {
      fr: 'Port de Beni Ansar',
      ar: 'ميناء بني انصار',
      en: 'Beni Ansar Port',
    },
    shortTitle: {
      fr: 'Port Beni Ansar',
      ar: 'ميناء بني انصار',
      en: 'Beni Ansar Port',
    },
    desc: {
      fr: 'Solutions pour arrivées en ferry et voyageurs MRE',
      ar: 'مثالي لوصول البواخر ومغاربة العالم',
      en: 'Ideal for ferry arrivals and travelers',
    },
  },
  {
    id: 'nador-center',
    href: '/location-voiture-nador',
    icon: MapPin,
    section: 'arrival',
    title: {
      fr: 'Nador Centre & Marchica',
      ar: 'وسط الناظور ومارشيكا',
      en: 'Nador Downtown & Marchica',
    },
    shortTitle: {
      fr: 'Nador Centre',
      ar: 'وسط الناظور',
      en: 'Nador Centre',
    },
    desc: {
      fr: 'Véhicules disponibles au cœur de la ville',
      ar: 'سيارات متوفرة في قلب المدينة والمحلات',
      en: 'Vehicles available in the city center',
    },
  },
  {
    id: 'suv',
    href: '/location-voiture-nador-suv',
    icon: CarFront,
    section: 'category',
    title: {
      fr: 'SUV & 4x4 à Nador',
      ar: 'سيارات SUV و 4x4',
      en: 'SUV & 4x4 in Nador',
    },
    shortTitle: {
      fr: 'SUV & 4x4',
      ar: 'SUV و 4x4',
      en: 'SUV & 4x4',
    },
    desc: {
      fr: 'Duster, Tucson et véhicules tout-terrain',
      ar: 'داستر، توسان وسيارات للطرق الوعرة',
      en: 'Duster, Tucson & crossover vehicles',
    },
  },
  {
    id: 'auto',
    href: '/location-voiture-nador-automatique',
    icon: Sparkles,
    section: 'category',
    title: {
      fr: 'Boîte automatique',
      ar: 'ناقل حركة أوتوماتيكي',
      en: 'Automatic Gearbox',
    },
    shortTitle: {
      fr: 'Automatique',
      ar: 'أوتوماتيك',
      en: 'Automatic',
    },
    desc: {
      fr: 'Conduite souple et confort optimal',
      ar: 'سياقة سلسة وراحة تامة في السياقة',
      en: 'Smooth driving and effortless comfort',
    },
  },
];

function getLocalized(record: Record<string, string>, locale: string): string {
  return record[locale] || record.fr || record.en || '';
}

/* ====================================================================== */
/* MAIN NAVBAR COMPONENT                                                  */
/* ====================================================================== */

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, isRTL } = useTranslation();
  const strings = getStrings(locale);

  // Accessible IDs
  const destinationsMenuId = useId();
  const accountMenuId = useId();

  // Navigation state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [destAccordionOpen, setDestAccordionOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

    const supabase = createClient();
    // INITIAL_SESSION est émis dès l'abonnement : le profil vient d'être chargé ci-dessus (évite un 2e /api/auth/me)
    const authSubscription = supabase?.auth.onAuthStateChange((event: string) => {
      if (event === 'INITIAL_SESSION') return;
      void refreshAuthProfile();
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshAuthProfile();
      }
    };

    window.addEventListener('focus', refreshAuthProfile);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      authRequest.current += 1;
      authSubscription?.data.subscription.unsubscribe();
      window.removeEventListener('focus', refreshAuthProfile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshAuthProfile, strings.sessionError]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setAuthError(null);
    try {
      await signOutEverywhere(createClient());
      setAuthProfile(null);
      setAccountMenuOpen(false);
      setMobileMenuOpen(false);
      router.replace('/');
      router.refresh();
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'La déconnexion a échoué.');
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
      <div className="hidden border-b border-white/6 bg-[#0B1220] text-[11px] font-medium text-slate-400 sm:block">
        <div className="mx-auto flex h-8.5 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 [&_a]:min-h-6 [&_button]:min-h-6">
          {/* Left: Verified Fleet Status & Quick Transits */}
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
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

            <span className="hidden h-3 w-px bg-slate-800 lg:block" aria-hidden="true" />

            {/* Quick Auth Shortcut */}
            {authLoading ? (
              <span
                className="inline-flex items-center gap-1.5 text-slate-400"
                role="status"
                aria-label={strings.sessionChecking}
              >
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" aria-hidden="true" />
                <span>{strings.account}</span>
              </span>
            ) : authProfile ? (
              <Link
                href={accountHref(authProfile)}
                aria-label={`${accountIdentity(authProfile, locale).badge} : ${accountIdentity(authProfile, locale).name}`}
                title={accountIdentity(authProfile, locale).name}
                className="flex min-w-0 max-w-52 items-center gap-1.5 font-medium text-slate-300 transition-colors hover:text-white"
              >
                <AccountAvatar profile={authProfile} className="h-4.5 w-4.5 text-[9px]" />
                <span className="truncate">{accountIdentity(authProfile, locale).name}</span>
              </Link>
            ) : authError ? (
              <button
                type="button"
                onClick={() => void refreshAuthProfile()}
                className="font-medium text-amber-400 transition-colors hover:text-white"
              >
                {strings.sessionError}
              </button>
            ) : (
              <Link
                href={LOGIN_PATH}
                className="flex items-center gap-1.5 font-medium text-slate-400 transition-colors hover:text-white"
              >
                <LogIn className="h-3 w-3 text-accent-text" aria-hidden="true" />
                <span>{strings.login}</span>
              </Link>
            )}

            <span className="h-3 w-px bg-slate-800" aria-hidden="true" />

            <a
              href="https://wa.me/212661987654?text=Bonjour%2C%20je%20souhaite%20louer%20un%20v%C3%A9hicule%20%C3%A0%20Nador"
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
          'w-full border-b transition-all duration-300',
          scrolled
            ? 'border-slate-200/80 bg-white/98 shadow-[0_4px_24px_rgba(11,18,32,0.06)] backdrop-blur-xl'
            : 'border-slate-200/60 bg-white/94 backdrop-blur-lg'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-center gap-2 lg:gap-6 xl:gap-8 transition-all duration-300',
              scrolled ? 'h-14 lg:h-16' : 'h-16 lg:h-20'
            )}
          >
            {/* -------------------------------------------------------- */}
            {/* BRAND LOGO                                               */}
            {/* -------------------------------------------------------- */}
            <Link
              href="/"
              aria-label="ClickDrive — Accueil"
              className="group flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-[#E63946]"
            >
              {/* Mobile Compact Emblem (under 640px) */}
              <div
                className={cn(
                  'relative sm:hidden transition-all duration-300',
                  scrolled ? 'h-8 w-[120px]' : 'h-9 w-[134px]'
                )}
              >
                <Image
                  src={brandLogo}
                  alt="ClickDrive"
                  fill
                  sizes="128px"
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>

              {/* Tablet & Desktop Full Wordmark (640px and above) */}
              <div
                className={cn(
                  'relative hidden sm:block transition-all duration-300',
                  // Proportions calées sur le logo (1036×241, ≈ 4,3:1) pour qu'il occupe toute la hauteur
                  scrolled
                    ? 'h-9 w-[155px] lg:h-10 lg:w-[172px]'
                    : 'h-10 w-[172px] lg:h-12 lg:w-[206px]'
                )}
              >
                <Image
                  src={brandLogo}
                  alt="ClickDrive — Location de voitures à Nador"
                  fill
                  sizes="(max-width: 1024px) 208px, 224px"
                  className={cn(
                    'object-contain transition-transform duration-300 group-hover:scale-[1.01]',
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
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#E63946] xl:px-3',
                  isNavActive('/')
                    ? 'font-bold text-[#0B1220]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-[#0B1220]'
                )}
              >
                {strings.home}
                {isNavActive('/') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#E63946]" />
                )}
              </Link>

              {/* 2. Véhicules */}
              <Link
                href="/search"
                aria-current={isNavActive('/search') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#E63946] xl:px-3',
                  isNavActive('/search')
                    ? 'font-bold text-[#0B1220]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-[#0B1220]'
                )}
              >
                {strings.cars}
                {isNavActive('/search') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#E63946]" />
                )}
              </Link>

              {/* 2 bis. Motos (catalogue séparé) */}
              <Link
                href="/motos"
                aria-current={isNavActive('/motos') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#E63946] xl:px-3',
                  isNavActive('/motos')
                    ? 'font-bold text-[#0B1220]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-[#0B1220]'
                )}
              >
                {strings.motos}
                {isNavActive('/motos') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#E63946]" />
                )}
              </Link>

              {/* 3. Agences */}
              <Link
                href="/agencies"
                aria-current={isNavActive('/agencies') ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#E63946] xl:px-3',
                  isNavActive('/agencies')
                    ? 'font-bold text-[#0B1220]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-[#0B1220]'
                )}
              >
                {strings.agencies}
                {isNavActive('/agencies') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#E63946]" />
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
                    'relative flex whitespace-nowrap items-center gap-1.5 rounded-xl px-2.5 xl:px-3 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#E63946]',
                    destinationsOpen || isDestinationsActive
                      ? 'bg-slate-100/80 font-bold text-[#0B1220]'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-[#0B1220]'
                  )}
                >
                  <span>{strings.destinations}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                      destinationsOpen && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                  {isDestinationsActive && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#E63946]" />
                  )}
                </button>

                {/* Dropdown Panel */}
                {destinationsOpen && (
                  <div
                    id={destinationsMenuId}
                    role="menu"
                    aria-labelledby="destinations-menu-button"
                    onKeyDown={handleDestinationsMenuKeyDown}
                    className={cn(
                      'absolute top-full z-50 mt-3 w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_32px_80px_-24px_rgba(11,18,32,0.35),0_4px_16px_rgba(11,18,32,0.06)] animate-cd-dropdown',
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
                            const tag = item.tag ? getLocalized(item.tag, locale) : null;
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
                                  'group flex items-start gap-3 rounded-2xl p-2.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#E63946]',
                                  active ? 'bg-[#F5F6F8]' : 'hover:bg-[#F5F6F8]'
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
                                    active
                                      ? 'bg-action text-white'
                                      : 'bg-[#F5F6F8] text-[#0B1220] group-hover:bg-[#0B1220] group-hover:text-white'
                                  )}
                                >
                                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1 pt-0.5">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-[13px] font-bold leading-snug text-[#0B1220]">
                                      {getLocalized(item.title, locale)}
                                    </span>
                                    {tag && (
                                      <span className="rounded-full bg-[#E63946]/10 px-2 py-0.5 text-[11px] font-bold text-[#C92F3B]">
                                        {tag}
                                      </span>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                                    {getLocalized(item.desc, locale)}
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
                                  'group flex items-center gap-3 rounded-2xl p-2.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#E63946]',
                                  active ? 'bg-white shadow-sm' : 'hover:bg-white hover:shadow-sm'
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200',
                                    active
                                      ? 'border-[#E63946] bg-action text-white'
                                      : 'border-slate-200 bg-white text-[#0B1220] group-hover:border-[#0B1220] group-hover:bg-[#0B1220] group-hover:text-white'
                                  )}
                                >
                                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-bold leading-snug text-[#0B1220]">
                                    {getLocalized(item.title, locale)}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                                    {getLocalized(item.desc, locale)}
                                  </span>
                                </span>
                                <ArrowRight
                                  className="h-4 w-4 shrink-0 text-slate-300 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-accent-text rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
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
                          className="group relative mt-auto block overflow-hidden rounded-2xl bg-[#0B1220] p-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] focus-visible:ring-offset-2"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full bg-[#E63946]/25 blur-2xl"
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
                  'relative hidden xl:block whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#E63946]',
                  isNavActive('/faq')
                    ? 'font-bold text-[#0B1220]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-[#0B1220]'
                )}
              >
                {strings.faqHelp}
                {isNavActive('/faq') && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#E63946]" />
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
                    aria-label={`${accountIdentity(authProfile, locale).badge} : ${accountIdentity(authProfile, locale).name}`}
                    className="inline-flex max-w-52 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E63946] xl:px-2.5"
                  >
                    <AccountAvatar profile={authProfile} className="h-7 w-7 text-xs" />
                    {/* Nom et rôle affichés à partir de 1280 px ; avatar seul en dessous */}
                    <span className="hidden min-w-0 xl:block">
                      <span className="block max-w-28 truncate text-xs font-bold text-slate-900">
                        {accountIdentity(authProfile, locale).name}
                      </span>
                      <span className="block text-[11px] font-medium text-slate-500">
                        {accountIdentity(authProfile, locale).badge}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
                        accountMenuOpen && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {accountMenuOpen && (
                    <div
                      id={accountMenuId}
                      role="menu"
                      aria-labelledby="account-menu-button"
                      className={cn(
                        'absolute top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(11,18,32,0.12)] animate-cd-dropdown',
                        isRTL ? 'left-0' : 'right-0'
                      )}
                    >
                      <div className="border-b border-slate-100 px-3 py-2">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {accountIdentity(authProfile, locale).name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{authProfile.email}</p>
                        {authProfile.canAccessAgency && authProfile.agencyName && (
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#0B1220]">
                            {authProfile.agencyName}
                          </p>
                        )}
                      </div>

                      <div className="py-1">
                        {accountMenuItems(authProfile, locale).map((item) => (
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
                  className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-[#0B1220] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#E63946] xl:px-3"
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
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-action px-4 py-2.5 text-xs font-bold text-white shadow-xs shadow-red-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-action-hover hover:shadow-[0_6px_22px_rgba(230,57,70,0.35)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#0B1220]"
                >
                  <span
                    className="absolute inset-0 bg-linear-to-br from-white/15 to-transparent pointer-events-none"
                    aria-hidden="true"
                  />
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{strings.search}</span>
                  <ArrowRight
                    className={cn(
                      'h-3 w-3 opacity-90 transition-transform duration-200',
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
            <div className="hidden sm:flex lg:hidden items-center gap-2 justify-end">
              {/* Quick Search Button */}
              <Link
                href="/search"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E63946]/10 px-3 py-2 text-xs font-bold text-accent-text transition-colors hover:bg-[#E63946]/15 focus-visible:outline-2 focus-visible:outline-[#E63946]"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{strings.search}</span>
              </Link>

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
                  aria-label={`${accountIdentity(authProfile, locale).badge} : ${accountIdentity(authProfile, locale).name}`}
                  title={accountIdentity(authProfile, locale).name}
                  className="flex h-9 max-w-36 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-2 text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E63946]"
                >
                  <AccountAvatar profile={authProfile} className="h-6 w-6 text-[10px]" />
                  <span className="truncate text-xs font-bold">
                    {accountIdentity(authProfile, locale).name}
                  </span>
                </Link>
              ) : (
                <Link
                  href={LOGIN_PATH}
                  aria-label={strings.login}
                  className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E63946]"
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
                className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E63946]"
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
            <div className="flex sm:hidden items-center gap-1.5">
              {/* Account Icon Shortcut */}
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
                  aria-label={`${accountIdentity(authProfile, locale).badge} : ${accountIdentity(authProfile, locale).name}`}
                  className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs"
                >
                  <AccountAvatar profile={authProfile} className="h-7 w-7 text-[10px]" />
                </Link>
              ) : (
                <Link
                  href={LOGIN_PATH}
                  aria-label={strings.login}
                  className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}

              {/* Search Shortcut */}
              <Link
                href="/search"
                aria-label={strings.findCar}
                className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl bg-[#E63946]/10 text-accent-text transition-colors hover:bg-[#E63946]/15"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Link>

              {/* Language Selector on Mobile Header */}
              <LanguageSelector variant="navbar" className="shrink-0" />

              {/* Hamburger Button */}
              <button
                type="button"
                aria-label={mobileMenuOpen ? strings.closeMenu : strings.openMenu}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E63946]"
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
      {mobileMenuOpen && (
        <div className="lg:hidden">
          {/* Accessible Backdrop Overlay */}
          <div
            className="fixed inset-0 z-50 bg-[#0B1220]/65 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            data-modal-backdrop
          />

          {/* Full-Height Drawer Panel */}
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={strings.navigation}
            tabIndex={-1}
            className={cn(
              'fixed inset-y-0 z-50 flex w-full max-w-sm sm:max-w-md flex-col bg-white shadow-2xl outline-none transition-transform duration-300 ease-out',
              isRTL ? 'left-0 border-r border-slate-200' : 'right-0 border-l border-slate-200'
            )}
          >
            {/* Drawer Top Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center"
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
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#E63946]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Primary Search CTA Banner */}
              <Link
                href="/search"
                onClick={() => setMobileMenuOpen(false)}
                className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-linear-to-r from-[#E63946] to-[#C92F3B] p-4 text-white shadow-lg shadow-red-900/20 active:scale-[0.99]"
              >
                <span
                  className="absolute inset-0 bg-linear-to-br from-white/15 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold">{strings.findCar}</span>
                    <span className="block text-[11px] text-white/80">
                      {strings.destinationsSubtitle}
                    </span>
                  </div>
                </div>

                <ArrowRight
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1',
                    isRTL && 'rotate-180 group-hover:-translate-x-1'
                  )}
                  aria-hidden="true"
                />
              </Link>

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
                            ? 'bg-slate-100 font-bold text-[#0B1220] border-s-4 border-[#E63946]'
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
                          ? 'bg-slate-100 font-bold text-[#0B1220]'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Compass className="h-4 w-4 text-accent-text" aria-hidden="true" />
                        <span>{strings.destinations}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-slate-400 transition-transform duration-200',
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
                          const title = getLocalized(item.title, locale);
                          const tag = item.tag ? getLocalized(item.tag, locale) : null;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center justify-between rounded-xl p-2.5 transition-colors',
                                active
                                  ? 'bg-slate-100 font-bold text-[#0B1220]'
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
                          {accountIdentity(authProfile, locale).name}
                        </p>
                        <p className="text-[11px] font-semibold text-[#0B1220]">
                          {accountIdentity(authProfile, locale).badge}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{authProfile.email}</p>
                      </div>
                    </div>

                    <nav aria-label="Menu du compte mobile" className="space-y-1">
                      {accountMenuItems(authProfile, locale).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
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
                      className="mt-3 flex w-full items-center gap-2 border-t border-slate-200/80 px-2 pt-3 text-xs font-bold text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
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
                      className="mt-2 font-bold underline"
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
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E63946]/10 text-accent-text">
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
                href="https://wa.me/212661987654?text=Bonjour%2C%20je%20veux%20louer%20une%20voiture%20%C3%A0%20Nador"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>{strings.whatsappHelp}</span>
              </a>

              {/* Trust Indicators */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" aria-hidden="true" />
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">
                    {strings.badgeVerified}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <Star className="mx-auto h-4 w-4 text-amber-500" aria-hidden="true" />
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">
                    {strings.badgePricing}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <Clock3 className="mx-auto h-4 w-4 text-blue-500" aria-hidden="true" />
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">
                    {strings.badgeSupport}
                  </p>
                </div>
              </div>

              {/* Region Label */}
              <div className="flex items-center justify-center gap-1.5 pb-4 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span>{strings.locationTag}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
