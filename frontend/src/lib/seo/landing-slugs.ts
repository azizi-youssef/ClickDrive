import type { Locale } from '@/lib/i18n/config';

/**
 * Adresses traduites des pages d'atterrissage SEO : slug français (canonique, servi à la racine)
 * → slug par langue. Une langue absente garde le slug français (l'arabe, pour des adresses en
 * caractères latins faciles à partager). Module volontairement léger : il est chargé par le proxy
 * et par les liens côté navigateur, sans le contenu des pages.
 */
export const LANDING_SLUGS: Record<string, Partial<Record<Locale, string>>> = {
  'location-voiture-nador': {
    en: 'car-rental-nador',
    es: 'alquiler-coches-nador',
    de: 'mietwagen-nador',
    nl: 'auto-huren-nador',
  },
  'location-voiture-nador-aeroport': {
    en: 'car-rental-nador-airport',
    es: 'alquiler-coches-aeropuerto-nador',
    de: 'mietwagen-flughafen-nador',
    nl: 'auto-huren-luchthaven-nador',
  },
  'location-voiture-beni-ansar': {
    en: 'car-rental-beni-ansar',
    es: 'alquiler-coches-beni-ansar',
    de: 'mietwagen-beni-ansar',
    nl: 'auto-huren-beni-ansar',
  },
  'location-voiture-nador-suv': {
    en: 'suv-rental-nador',
    es: 'alquiler-suv-nador',
    de: 'suv-mieten-nador',
    nl: 'suv-huren-nador',
  },
  'location-voiture-nador-automatique': {
    en: 'automatic-car-rental-nador',
    es: 'alquiler-coche-automatico-nador',
    de: 'automatik-mietwagen-nador',
    nl: 'automaat-huren-nador',
  },
  'location-voiture-nador-pas-cher': {
    en: 'cheap-car-rental-nador',
    es: 'alquiler-coches-baratos-nador',
    de: 'guenstiger-mietwagen-nador',
    nl: 'goedkoop-auto-huren-nador',
  },
  'location-voiture-luxe-nador': {
    en: 'luxury-car-rental-nador',
    es: 'alquiler-coches-lujo-nador',
    de: 'luxus-mietwagen-nador',
    nl: 'luxe-auto-huren-nador',
  },
  'location-voiture-nador-longue-duree': {
    en: 'long-term-car-rental-nador',
    es: 'alquiler-coches-larga-duracion-nador',
    de: 'langzeitmiete-auto-nador',
    nl: 'auto-huren-lange-termijn-nador',
  },
  'location-voiture-nador-ete': {
    en: 'summer-car-rental-nador',
    es: 'alquiler-coches-verano-nador',
    de: 'mietwagen-sommer-nador',
    nl: 'auto-huren-zomer-nador',
  },
  'location-scooter-moto-nador': {
    en: 'scooter-motorbike-rental-nador',
    es: 'alquiler-motos-scooter-nador',
    de: 'roller-motorrad-mieten-nador',
    nl: 'scooter-motor-huren-nador',
  },
  'guide-caution-location-voiture-nador': {
    en: 'car-rental-deposit-guide-nador',
    es: 'guia-fianza-alquiler-coche-nador',
    de: 'kaution-mietwagen-ratgeber-nador',
    nl: 'borg-autohuur-gids-nador',
  },
  'guide-documents-location-voiture-maroc': {
    en: 'car-rental-documents-morocco',
    es: 'documentos-alquiler-coche-marruecos',
    de: 'dokumente-mietwagen-marokko',
    nl: 'documenten-autohuur-marokko',
  },
  'guide-arrivee-aeroport-port-nador': {
    en: 'nador-airport-port-arrival-guide',
    es: 'guia-llegada-aeropuerto-puerto-nador',
    de: 'ankunft-flughafen-hafen-nador',
    nl: 'aankomst-luchthaven-haven-nador',
  },
};

/** Slug affiché dans une langue (le slug français si la langue n'en a pas de propre) */
export function landingSlugFor(frSlug: string, locale: Locale): string {
  return LANDING_SLUGS[frSlug]?.[locale] ?? frSlug;
}

/** Slug d'URL dans une langue → slug français canonique (null si inconnu) */
export function canonicalLandingSlug(slug: string, locale: Locale): string | null {
  if (LANDING_SLUGS[slug]) return slug;
  for (const [frSlug, bySlug] of Object.entries(LANDING_SLUGS)) {
    if (bySlug[locale] === slug) return frSlug;
  }
  return null;
}
