export type Locale = 'fr' | 'ar' | 'en' | 'de' | 'es' | 'nl';

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
}

export const SUPPORTED_LOCALES: LanguageOption[] = [
  {
    code: 'fr',
    label: 'Français',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
  },
  {
    code: 'ar',
    label: 'Arabe',
    nativeName: 'العربية',
    flag: '🇲🇦',
    direction: 'rtl',
  },
  {
    code: 'en',
    label: 'Anglais',
    nativeName: 'English',
    flag: '🇬🇧',
    direction: 'ltr',
  },
  {
    code: 'de',
    label: 'Allemand',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
  },
  {
    code: 'es',
    label: 'Espagnol',
    nativeName: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
  },
  {
    code: 'nl',
    label: 'Néerlandais',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    direction: 'ltr',
  },
];

export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_COOKIE_KEY = 'clickdrive_locale';
export const LOCALE_STORAGE_KEY = 'clickdrive_locale';
/** En-tête posé par le proxy : langue de la requête, lue par le rendu serveur */
export const LOCALE_HEADER = 'x-clickdrive-locale';
/** Toutes les langues sauf le français (servi à la racine) ont un préfixe d'URL : /nl/search */
export const PREFIXED_LOCALES: Locale[] = ['ar', 'en', 'de', 'es', 'nl'];
export const ALL_LOCALES: Locale[] = ['fr', ...PREFIXED_LOCALES];

/** Étiquette BCP 47 pour Intl (dates, nombres) et hreflang */
const INTL_TAGS: Record<Locale, string> = {
  fr: 'fr-FR',
  ar: 'ar-MA',
  en: 'en-GB',
  de: 'de-DE',
  es: 'es-ES',
  nl: 'nl-NL',
};

export function intlTag(locale: Locale): string {
  return INTL_TAGS[locale];
}

const LOCALE_CODES = new Set<string>(SUPPORTED_LOCALES.map((option) => option.code));

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALE_CODES.has(value);
}

/** Valeur de cookie → langue prise en charge (sinon la langue par défaut) */
export function resolveLocale(value: string | null | undefined): Locale {
  const code = (value ?? '').trim().toLowerCase();
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return SUPPORTED_LOCALES.find((option) => option.code === locale)?.direction ?? 'ltr';
}

/**
 * En-tête Accept-Language → première langue prise en charge, par ordre de préférence (q).
 * Ex. « ar-MA,ar;q=0.9,fr;q=0.8 » → « ar ». Sans correspondance : langue par défaut.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return { code: tag.trim().slice(0, 2).toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked.find((entry) => isLocale(entry.code))?.code as Locale | undefined ?? DEFAULT_LOCALE;
}
