import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { LOCALE_COOKIE_KEY, isLocale, localeFromAcceptLanguage } from '@/lib/i18n/config';

/** Ancien nom de domaine (KlickDrive) : redirigé définitivement vers ClickDrive, chemin et paramètres conservés */
const LEGACY_HOSTS = new Set(['klickdrive.ma', 'www.klickdrive.ma']);
const CANONICAL_ORIGIN = 'https://clickdrive.ma';

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (host && LEGACY_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${search}`, 308);
  }

  // Première visite : langue du navigateur (Accept-Language), transmise au rendu serveur de CETTE requête
  const current = request.cookies.get(LOCALE_COOKIE_KEY)?.value;
  const detected = isLocale(current) ? null : localeFromAcceptLanguage(request.headers.get('accept-language'));
  if (detected) request.cookies.set(LOCALE_COOKIE_KEY, detected);

  const response = await updateSession(request);
  if (detected) {
    response.cookies.set(LOCALE_COOKIE_KEY, detected, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return response;
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
