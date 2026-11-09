import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, isLocale, localeFromAcceptLanguage, type Locale } from '@/lib/i18n/config';
import { canonicalPath, isLocalizedPath, isUnlocalizedArea, localizeHref, splitLocalePrefix } from '@/lib/i18n/routing';

/** Ancien nom de domaine (KlickDrive) : redirigé définitivement vers ClickDrive, chemin et paramètres conservés */
const LEGACY_HOSTS = new Set(['klickdrive.ma', 'www.klickdrive.ma']);
const CANONICAL_ORIGIN = 'https://clickdrive.ma';
/** Robots et aperçus de liens : jamais redirigés selon la langue (chaque adresse a sa langue) */
const BOT_USER_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;
const ONE_YEAR = 60 * 60 * 24 * 365;

function rememberLocale(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(LOCALE_COOKIE_KEY, locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  return response;
}

function redirectTo(request: NextRequest, href: string, status: 307 | 308): NextResponse {
  return NextResponse.redirect(new URL(href, request.url), status);
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (host && LEGACY_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${search}`, 308);
  }

  const { pathname, search } = request.nextUrl;
  const { locale: prefix, path } = splitLocalePrefix(pathname);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_KEY)?.value;

  // Le français n'a pas de préfixe ; les espaces agence, admin et l'API ne sont pas traduits
  if (prefix === DEFAULT_LOCALE || (prefix && isUnlocalizedArea(path))) {
    return redirectTo(request, `${path}${search}`, 308);
  }

  if (prefix) {
    // /nl/<slug français> → /nl/<slug néerlandais> : une seule adresse par page et par langue
    const canonical = canonicalPath(path, prefix);
    if (!canonical.usesLocaleSlug) {
      return redirectTo(request, `${localizeHref(canonical.path, prefix)}${search}`, 308);
    }
    const rewrite = request.nextUrl.clone();
    rewrite.pathname = canonical.path;
    const response = await updateSession(request, { path: canonical.path, locale: prefix, rewrite });
    return cookieLocale === prefix ? response : rememberLocale(response, prefix);
  }

  // Adresse française d'une page traduite : le visiteur qui a choisi une autre langue (ou dont le
  // navigateur la demande, à la première visite) est conduit vers l'adresse dans sa langue
  if (isLocalizedPath(pathname) && request.method === 'GET' && !BOT_USER_AGENT.test(request.headers.get('user-agent') ?? '')) {
    const preferred = isLocale(cookieLocale) ? cookieLocale : localeFromAcceptLanguage(request.headers.get('accept-language'));
    if (preferred !== DEFAULT_LOCALE) {
      const response = redirectTo(request, `${localizeHref(pathname, preferred)}${search}`, 307);
      return isLocale(cookieLocale) ? response : rememberLocale(response, preferred);
    }
  }

  return updateSession(request, { path: pathname, locale: DEFAULT_LOCALE });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
