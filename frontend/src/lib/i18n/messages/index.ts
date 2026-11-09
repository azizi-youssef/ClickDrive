import { translations, type Translations } from '../translations';
import type { Locale } from '../config';
import { meta } from './meta';
import { navbar } from './navbar';
import { vehicle } from './vehicle';
import { home } from './home';
import { catalog } from './catalog';
import { car } from './car';
import { booking } from './booking';
import { agencies } from './agencies';
import { contact } from './contact';
import { faq } from './faq';
import { tracking } from './tracking';
import { notFound } from './not-found';
import { seo } from './seo';
import { account } from './account';
import { login } from './login';
import { about } from './about';

/**
 * Dictionnaires de l'interface, par espace de noms. Ce module est réservé au serveur : le navigateur
 * ne reçoit que la langue de la page et les espaces de noms dont elle a besoin (LanguageProvider,
 * I18nScope), jamais les six langues.
 */
const NAMESPACES = { meta, navbar, vehicle, home, catalog, car, booking, agencies, contact, faq, tracking, notFound, seo, account, login, about } as const;

type NamespaceMessages = { [K in keyof typeof NAMESPACES]: (typeof NAMESPACES)[K] extends Record<Locale, infer M> ? M : never };

export type Messages = Translations & NamespaceMessages;
export type Namespace = keyof Messages;

export function getMessages(locale: Locale): Messages {
  const extra = Object.fromEntries(
    Object.entries(NAMESPACES).map(([name, byLocale]) => [name, (byLocale as Record<Locale, unknown>)[locale]])
  );
  return { ...translations[locale], ...extra } as Messages;
}

export function pickMessages(locale: Locale, namespaces: readonly Namespace[]): Partial<Messages> {
  const all = getMessages(locale);
  return Object.fromEntries(namespaces.map((name) => [name, all[name]])) as Partial<Messages>;
}

/** Espaces de noms utiles sur toutes les pages (en-tête, pied de page, bandeau cookies, libellés) */
export const CORE_NAMESPACES: Namespace[] = ['common', 'nav', 'navbar', 'footer', 'cookie', 'vehicle'];
