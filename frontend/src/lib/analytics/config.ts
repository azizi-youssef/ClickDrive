/**
 * Mesure d'audience Plausible : sans cookie ni donnée personnelle (statistiques agrégées),
 * donc sans bandeau de consentement. Inactive tant que NEXT_PUBLIC_PLAUSIBLE_DOMAIN est vide.
 *
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN  domaine déclaré dans Plausible, ex. « clickdrive.ma »
 *   NEXT_PUBLIC_PLAUSIBLE_SRC     script (défaut : https://plausible.io/js/script.js ; instance auto-hébergée possible)
 *
 * Entonnoir à créer dans Plausible : /search → /cars/* → « Demande envoyée » → « Demande acceptée ».
 */
export const DEFAULT_PLAUSIBLE_SRC = 'https://plausible.io/js/script.js';

export type AnalyticsConfig = { domain: string; src: string; origin: string };

export function analyticsConfig(env: Record<string, string | undefined> = process.env): AnalyticsConfig | null {
  const domain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null;
  const src = env.NEXT_PUBLIC_PLAUSIBLE_SRC?.trim() || DEFAULT_PLAUSIBLE_SRC;
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:') return null;
    return { domain, src: url.toString(), origin: url.origin };
  } catch {
    return null;
  }
}

/** Événements de l'entonnoir (noms affichés tels quels dans Plausible) */
export type AnalyticsEvent = 'Recherche' | 'Demande envoyée' | 'Demande acceptée' | 'Contact envoyé' | 'Avis publié';
