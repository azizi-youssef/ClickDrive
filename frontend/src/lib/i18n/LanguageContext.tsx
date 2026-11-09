'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  type Locale,
  type LanguageOption,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  localeDirection,
} from './config';
import type { Messages } from './messages';
import { delocalizeHref, localizeHref } from './routing';
import { formatDate, formatMoney, interpolate, plural, type DateStyle, type PluralForms } from './format';

interface LanguageContextType {
  locale: Locale;
  /** Change de langue : la page est rechargée à son adresse dans la nouvelle langue */
  setLocale: (locale: Locale) => void;
  /** Dictionnaire de la page (seuls les espaces de noms chargés pour elle sont présents) */
  t: Messages;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  currentLanguage: LanguageOption;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function switchLocale(next: Locale) {
  if (!SUPPORTED_LOCALES.some((option) => option.code === next)) return;
  try {
    document.cookie = `${LOCALE_COOKIE_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Cookies bloqués : l'adresse suffit à fixer la langue
  }
  const { pathname, search, hash } = window.location;
  const target = localizeHref(delocalizeHref(`${pathname}${search}`), next);
  // Rechargement complet voulu (pas router.push) : le serveur renvoie la page, ses métadonnées, le
  // dictionnaire et le sens d'écriture de la langue, que la navigation client ne recharge pas
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${target}${hash}`);
}

/**
 * La langue et le dictionnaire viennent du serveur (adresse de la page) : le premier rendu client
 * est identique au HTML serveur, sans bascule de langue ni de sens d'écriture après coup.
 */
export function LanguageProvider({
  children,
  locale = DEFAULT_LOCALE,
  messages,
}: {
  children: React.ReactNode;
  locale?: Locale;
  messages: Partial<Messages>;
}) {
  const value = useMemo<LanguageContextType>(() => {
    const dir = localeDirection(locale);
    return {
      locale,
      setLocale: switchLocale,
      t: messages as Messages,
      dir,
      isRTL: dir === 'rtl',
      currentLanguage: SUPPORTED_LOCALES.find((option) => option.code === locale) ?? SUPPORTED_LOCALES[0],
      supportedLanguages: SUPPORTED_LOCALES,
    };
  }, [locale, messages]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Ajoute au dictionnaire courant les espaces de noms d'une page (voir I18nScope) */
export function MessagesScope({ children, messages }: { children: React.ReactNode; messages: Partial<Messages> }) {
  const parent = useContext(LanguageContext);
  const value = useMemo<LanguageContextType | null>(
    () => (parent ? { ...parent, t: { ...parent.t, ...messages } as Messages } : null),
    [parent, messages]
  );
  if (!value) throw new Error('MessagesScope doit être placé dans un LanguageProvider.');
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage / useTranslation doivent être appelés dans un LanguageProvider.');
  return context;
}

export function useTranslation() {
  const { t, locale, setLocale, isRTL, dir } = useLanguage();
  // Aides liées à la langue courante
  const href = useCallback((path: string) => localizeHref(path, locale), [locale]);
  const fmt = useCallback((template: string, values?: Record<string, string | number>) => interpolate(template, values), []);
  const plural_ = useCallback(
    (count: number, forms: PluralForms, values?: Record<string, string | number>) => plural(locale, count, forms, values),
    [locale]
  );
  const date = useCallback((value: Date | string, style?: DateStyle) => formatDate(value, locale, style), [locale]);
  const money = useCallback((value: number) => formatMoney(value, locale, t.common?.currency ?? 'DH'), [locale, t]);
  return { t, locale, setLocale, isRTL, dir, href, fmt, plural: plural_, date, money };
}
