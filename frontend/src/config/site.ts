/**
 * Configuration de la marque ClickDrive : source unique du nom, du slogan, des coordonnées, du domaine,
 * de la zone desservie et des couleurs système. Aucun composant ne réécrit ces valeurs : il les importe.
 *
 * Changer de domaine (clickdrive.ma) : définir NEXT_PUBLIC_SITE_URL sur Vercel, puis redéployer. Les URL
 * canoniques, le sitemap, robots.txt, Open Graph et les données structurées suivent automatiquement.
 */

/** Domaine de la marque : adresse de repli quand ni NEXT_PUBLIC_SITE_URL ni Vercel ne fournissent d'URL */
const BRAND_DOMAIN = 'clickdrive.ma';
const FALLBACK_SITE_URL = `https://${BRAND_DOMAIN}`;

function isLocalhost(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);
}

/**
 * URL absolue du site, sans barre oblique finale. Ordre de priorité :
 * 1. NEXT_PUBLIC_SITE_URL (domaine définitif, ex. https://clickdrive.ma) ;
 * 2. domaine de production Vercel (variable système, renseignée automatiquement à chaque déploiement :
 *    l'adresse réellement en ligne tant que le domaine n'est pas branché) ;
 * 3. domaine de la marque.
 * Une adresse « localhost » copiée par erreur depuis .env.local est ignorée en production : elle
 * rendrait toutes les URL canoniques inaccessibles aux moteurs de recherche.
 */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  const isProduction = env.VERCEL_ENV === 'production' || env.NEXT_PUBLIC_VERCEL_ENV === 'production';
  const vercelHost =
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidates = [
    explicit && !(isProduction && isLocalhost(explicit)) ? explicit : undefined,
    vercelHost ? `https://${vercelHost}` : undefined,
    FALLBACK_SITE_URL,
  ];
  const url = candidates.find((value): value is string => Boolean(value)) ?? FALLBACK_SITE_URL;
  return url.replace(/\/+$/, '');
}

/** Jour de la semaine au format ISO : 1 = lundi … 7 = dimanche */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OpeningSlot {
  /** Jours consécutifs couverts par ce créneau */
  days: readonly IsoWeekday[];
  /** Heures locales (Africa/Casablanca), format HH:MM */
  opens: string;
  closes: string;
}

export const siteConfig = {
  name: 'ClickDrive',
  /** Slogan : le site transmet des demandes aux agences, il ne réserve pas directement */
  tagline: 'Comparez. Demandez. Roulez.',
  /** Accroche du titre par défaut (onglet, partage) */
  title: 'ClickDrive — Location de voitures à Nador',
  description:
    'Comparez les voitures et motos des agences de location vérifiées de Nador : aéroport Nador Al Aroui, port de Beni Ansar et centre-ville. Demande gratuite et sans engagement.',
  url: resolveSiteUrl(),
  /** Domaine de la marque (adresses e-mail, mentions légales) */
  domain: BRAND_DOMAIN,
  locale: 'fr-MA',

  /** Zone desservie : Nador et ses environs immédiats uniquement */
  area: {
    city: 'Nador',
    /** Région administrative (adresse postale des données structurées uniquement) */
    region: 'Oriental',
    country: 'MA',
    countryName: 'Maroc',
    geo: { latitude: 35.1681, longitude: -2.9283 },
  },

  contact: {
    /** Numéro WhatsApp unique de la plateforme : format international, sans « + » ni espaces */
    whatsapp: '212634536286',
    email: 'contact@clickdrive.ma',
    privacyEmail: 'privacy@clickdrive.ma',
    /** Horaires du support (heure du Maroc) */
    hours: [
      { days: [1, 2, 3, 4, 5], opens: '09:00', closes: '18:00' },
      { days: [6], opens: '09:00', closes: '13:00' },
    ] satisfies readonly OpeningSlot[],
  },

  /** Couleurs système (navigateur, manifeste, images générées) : mêmes valeurs que les jetons de globals.css */
  colors: {
    /** --color-brand-primary (graphite) : barre du navigateur mobile, fond du manifeste */
    primary: '#0B1220',
    /** --color-brand-bg : fond clair des pages */
    background: '#F5F6F8',
    /** --color-brand (rouge du logo) */
    accent: '#E63946',
  },

  /** Images de marque servies depuis /public (logo inchangé : public/logo_12.png via lib/brand/logo.ts) */
  assets: {
    /** Icône de l'application (favicon, manifeste, données structurées) */
    icon: '/icon_12.png',
    iconSize: { width: 313, height: 228 },
  },
} as const;

export type SiteConfig = typeof siteConfig;

/** URL absolue d'un chemin du site (« /search » → « https://…/search ») */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path === '/' || path === '' ? siteConfig.url : `${siteConfig.url}${path.startsWith('/') ? path : `/${path}`}`;
}
