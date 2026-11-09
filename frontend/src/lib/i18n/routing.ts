import { ALL_LOCALES, DEFAULT_LOCALE, PREFIXED_LOCALES, type Locale } from './config';
import { LANDING_SLUGS, canonicalLandingSlug, landingSlugFor } from '@/lib/seo/landing-slugs';

/**
 * Adresses par langue. Le français est servi à la racine (/search) ; les autres langues sous un
 * préfixe (/nl/search). Seul le parcours public est traduit : les espaces agence et admin, l'API
 * et les fichiers techniques n'ont jamais de préfixe. Module partagé serveur / navigateur.
 */

/** Pages publiques traduites (chemins français canoniques) */
const LOCALIZED_EXACT = new Set([
  '/',
  '/search',
  '/motos',
  '/agencies',
  '/about',
  '/contact',
  '/faq',
  '/login',
  '/account',
  '/cgv',
  '/confidentialite',
  '/mentions-legales',
]);
const LOCALIZED_PREFIXES = ['/cars/', '/agencies/', '/suivi/', '/avis/', '/account/'];

/** Zones jamais traduites : un préfixe de langue devant elles est retiré par redirection */
const UNLOCALIZED_PREFIXES = ['/admin', '/agency', '/api', '/auth'];

const PREFIXES = new Set<string>(PREFIXED_LOCALES);

export function isLocalizedPath(path: string): boolean {
  if (LOCALIZED_EXACT.has(path)) return true;
  if (LOCALIZED_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length)) return true;
  const single = /^\/([a-z0-9-]+)$/.exec(path);
  return Boolean(single && LANDING_SLUGS[single[1]]);
}

export function isUnlocalizedArea(path: string): boolean {
  return UNLOCALIZED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** « /nl/search » → { locale: 'nl', path: '/search' } ; « /search » → { locale: null, path: '/search' } */
export function splitLocalePrefix(pathname: string): { locale: Locale | null; path: string } {
  const match = /^\/([a-z]{2})(?=\/|$)(.*)$/.exec(pathname);
  if (match && (PREFIXES.has(match[1]) || match[1] === DEFAULT_LOCALE)) {
    return { locale: match[1] as Locale, path: match[2] || '/' };
  }
  return { locale: null, path: pathname };
}

/**
 * Chemin sans préfixe, dans une langue → chemin français canonique (slugs SEO traduits ramenés au
 * slug français). `translated` indique si l'adresse employait déjà le slug propre à la langue.
 */
export function canonicalPath(path: string, locale: Locale): { path: string; usesLocaleSlug: boolean } {
  const single = /^\/([a-z0-9-]+)$/.exec(path);
  if (!single) return { path, usesLocaleSlug: true };
  const frSlug = canonicalLandingSlug(single[1], locale);
  if (!frSlug) return { path, usesLocaleSlug: true };
  return { path: `/${frSlug}`, usesLocaleSlug: landingSlugFor(frSlug, locale) === single[1] };
}

function splitHref(href: string): { pathname: string; rest: string } {
  const index = href.search(/[?#]/);
  return index === -1 ? { pathname: href, rest: '' } : { pathname: href.slice(0, index), rest: href.slice(index) };
}

/**
 * Chemin français canonique (avec ?requête et #ancre éventuels) → adresse dans la langue.
 * Liens externes, ancres seules, chemins déjà préfixés et zones non traduites : inchangés.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const { pathname, rest } = splitHref(href);
  if (splitLocalePrefix(pathname).locale) return href;
  if (!isLocalizedPath(pathname)) return href;
  const single = /^\/([a-z0-9-]+)$/.exec(pathname);
  const localizedPath = single && LANDING_SLUGS[single[1]] ? `/${landingSlugFor(single[1], locale)}` : pathname;
  if (locale === DEFAULT_LOCALE) return `${localizedPath}${rest}`;
  return `/${locale}${localizedPath === '/' ? '' : localizedPath}${rest}`;
}

/** Adresse d'une page dans chaque langue (pour hreflang, sitemap et sélecteur de langue) */
export function alternateHrefs(frPath: string): Record<Locale, string> {
  return Object.fromEntries(ALL_LOCALES.map((locale) => [locale, localizeHref(frPath, locale)])) as Record<
    Locale,
    string
  >;
}

/** Adresse affichée (préfixée, slug traduit) → chemin français canonique, requête conservée */
export function delocalizeHref(href: string): string {
  const { pathname, rest } = splitHref(href);
  const { locale, path } = splitLocalePrefix(pathname);
  if (!locale) return href;
  return `${canonicalPath(path, locale).path}${rest}`;
}
