import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ALL_LOCALES, LOCALE_HEADER, localeDirection, resolveLocale, type Locale } from './config';
import { getMessages, type Messages } from './messages';
import { alternateHrefs, localizeHref } from './routing';

/**
 * Langue de la requête, lue côté serveur : le proxy la déduit de l'adresse (/nl/…) et la transmet
 * par un en-tête. Sans préfixe, la page est en français. Le premier HTML a ainsi la bonne langue et
 * le bon sens d'écriture, et chaque adresse a toujours la même langue (indexation).
 */
export async function getServerLocale(): Promise<{ locale: Locale; dir: 'ltr' | 'rtl' }> {
  const store = await headers();
  const locale = resolveLocale(store.get(LOCALE_HEADER));
  return { locale, dir: localeDirection(locale) };
}

/** Langue et dictionnaire complet, pour les composants serveur et les métadonnées */
export async function getTranslations(): Promise<{ locale: Locale; dir: 'ltr' | 'rtl'; t: Messages }> {
  const { locale, dir } = await getServerLocale();
  return { locale, dir, t: getMessages(locale) };
}

/**
 * Balises canonical + hreflang d'une page traduite, à partir de son chemin français :
 * l'adresse canonique est celle de la langue de la requête, x-default pointe vers le français.
 */
export async function localizedAlternates(frPath: string): Promise<NonNullable<Metadata['alternates']>> {
  const { locale } = await getServerLocale();
  const hrefs = alternateHrefs(frPath);
  return {
    canonical: hrefs[locale],
    languages: { ...Object.fromEntries(ALL_LOCALES.map((code) => [code, hrefs[code]])), 'x-default': hrefs.fr },
  };
}

/** redirect() vers un chemin français, traduit pour la langue de la requête */
export async function redirectLocalized(frPath: string): Promise<never> {
  const { locale } = await getServerLocale();
  redirect(localizeHref(frPath, locale));
}

type MetaPage = keyof Messages['meta']['pages'];

/**
 * Métadonnées d'une page dans la langue de la requête : titre, description, Open Graph et, pour une
 * page indexable (chemin fourni), canonical + hreflang. `extra` complète ou remplace (robots…).
 */
export async function localizedPageMetadata(page: MetaPage, frPath: string | null, extra: Metadata = {}): Promise<Metadata> {
  const { locale, t } = await getTranslations();
  const copy = t.meta.pages[page] as { title: string; description: string; ogTitle?: string; ogDescription?: string };
  const metadata: Metadata = { title: copy.title, description: copy.description };
  if (frPath) {
    metadata.alternates = await localizedAlternates(frPath);
    metadata.openGraph = {
      title: copy.ogTitle ?? copy.title,
      description: copy.ogDescription ?? copy.description,
      url: `https://clickdrive.ma${localizeHref(frPath, locale) === '/' ? '' : localizeHref(frPath, locale)}`,
      locale: t.meta.ogLocale,
    };
  }
  return { ...metadata, ...extra };
}

/**
 * Textes juridiques : seul le texte français fait foi et est indexé. Les adresses traduites (avis
 * traduit + texte français) ne sont pas indexées et désignent la page française comme canonique ;
 * pas de hreflang, puisque le contenu n'existe qu'en français.
 */
export async function legalPageMetadata(page: MetaPage, frPath: string): Promise<Metadata> {
  const { locale } = await getServerLocale();
  return localizedPageMetadata(page, frPath, {
    alternates: { canonical: frPath },
    ...(locale === 'fr' ? {} : { robots: { index: false, follow: true } }),
  });
}
