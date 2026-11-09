import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { LOCALE_COOKIE_KEY, LOCALE_HEADER } from './config';
import {
  alternateHrefs,
  canonicalPath,
  delocalizeHref,
  isLocalizedPath,
  isUnlocalizedArea,
  localizeHref,
  splitLocalePrefix,
} from './routing';

describe('Adresses par langue', () => {
  it('français à la racine, autres langues préfixées', () => {
    expect(localizeHref('/search?type=SUV', 'fr')).toBe('/search?type=SUV');
    expect(localizeHref('/search?type=SUV', 'nl')).toBe('/nl/search?type=SUV');
    expect(localizeHref('/', 'ar')).toBe('/ar');
    expect(localizeHref('/cars/dacia-logan', 'es')).toBe('/es/cars/dacia-logan');
  });

  it('pages SEO : slug traduit (sauf l’arabe, qui garde le slug français)', () => {
    expect(localizeHref('/location-voiture-nador', 'nl')).toBe('/nl/auto-huren-nador');
    expect(localizeHref('/location-voiture-nador-aeroport', 'en')).toBe('/en/car-rental-nador-airport');
    expect(localizeHref('/location-voiture-nador', 'ar')).toBe('/ar/location-voiture-nador');
  });

  it('espaces agence, admin, API et liens externes : jamais préfixés', () => {
    for (const href of ['/agency', '/admin/finance', '/api/bookings', '/auth/callback?next=/account', 'https://wa.me/212600000000', '#main']) {
      expect(localizeHref(href, 'de')).toBe(href);
    }
    expect(isUnlocalizedArea('/agency/join')).toBe(true);
    expect(isLocalizedPath('/agencies/marchica-car')).toBe(true);
  });

  it('aller-retour : adresse affichée → chemin français', () => {
    expect(delocalizeHref('/nl/auto-huren-nador?x=1')).toBe('/location-voiture-nador?x=1');
    expect(delocalizeHref('/de/account/bookings/CD-1')).toBe('/account/bookings/CD-1');
    expect(delocalizeHref('/search')).toBe('/search');
    expect(splitLocalePrefix('/nlx/page')).toEqual({ locale: null, path: '/nlx/page' });
    expect(canonicalPath('/auto-huren-nador', 'nl')).toEqual({ path: '/location-voiture-nador', usesLocaleSlug: true });
    expect(canonicalPath('/location-voiture-nador', 'nl').usesLocaleSlug).toBe(false);
  });

  it('hreflang : une adresse par langue', () => {
    expect(alternateHrefs('/faq')).toEqual({
      fr: '/faq',
      ar: '/ar/faq',
      en: '/en/faq',
      de: '/de/faq',
      es: '/es/faq',
      nl: '/nl/faq',
    });
  });
});

describe('Proxy : langue de la requête', () => {
  beforeEach(() => {
    // Sans Supabase : la session n'est pas lue, seules les règles de langue s'appliquent
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  const request = (path: string, headers: Record<string, string> = {}) =>
    new NextRequest(`https://clickdrive.ma${path}`, { headers: { 'user-agent': 'Mozilla/5.0', ...headers } });

  it('adresse préfixée : servie par la page française, langue transmise au rendu', async () => {
    const response = await proxy(request('/nl/search?type=SUV'));
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://clickdrive.ma/search?type=SUV');
    expect(response.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe('nl');
    expect(response.cookies.get(LOCALE_COOKIE_KEY)?.value).toBe('nl');
  });

  it('slug traduit réécrit vers la page française ; slug français sous un préfixe → 308', async () => {
    const rewritten = await proxy(request('/nl/auto-huren-nador'));
    expect(rewritten.headers.get('x-middleware-rewrite')).toBe('https://clickdrive.ma/location-voiture-nador');
    const redirected = await proxy(request('/nl/location-voiture-nador'));
    expect(redirected.status).toBe(308);
    expect(redirected.headers.get('location')).toBe('https://clickdrive.ma/nl/auto-huren-nador');
  });

  it('/fr/… et espaces non traduits sous un préfixe → adresse sans préfixe (308)', async () => {
    const french = await proxy(request('/fr/search'));
    expect(french.status).toBe(308);
    expect(french.headers.get('location')).toBe('https://clickdrive.ma/search');
    const admin = await proxy(request('/nl/admin'));
    expect(admin.headers.get('location')).toBe('https://clickdrive.ma/admin');
  });

  it('langue choisie (cookie) ou demandée par le navigateur → adresse de cette langue (307)', async () => {
    const byCookie = await proxy(request('/search', { cookie: `${LOCALE_COOKIE_KEY}=de` }));
    expect(byCookie.status).toBe(307);
    expect(byCookie.headers.get('location')).toBe('https://clickdrive.ma/de/search');
    const byBrowser = await proxy(request('/', { 'accept-language': 'ar-MA,ar;q=0.9' }));
    expect(byBrowser.headers.get('location')).toBe('https://clickdrive.ma/ar');
  });

  it('robots jamais redirigés ; français par défaut', async () => {
    const bot = await proxy(request('/search', { 'user-agent': 'Googlebot/2.1', 'accept-language': 'nl' }));
    expect(bot.headers.get('location')).toBeNull();
    expect(bot.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe('fr');
    const visitor = await proxy(request('/faq', { 'accept-language': 'fr-FR' }));
    expect(visitor.headers.get('location')).toBeNull();
  });
});
