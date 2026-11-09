'use client';

import NextLink from 'next/link';
import { forwardRef, type ComponentProps } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { localizeHref } from '@/lib/i18n/routing';

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * Remplace next/link sur le parcours public : un chemin français (« /search ») devient l'adresse de
 * la langue courante (« /nl/search »). Liens externes, ancres et zones non traduites : inchangés.
 */
const LocalizedLink = forwardRef<HTMLAnchorElement, LinkProps>(function LocalizedLink({ href, ...props }, ref) {
  const { locale } = useLanguage();
  const localized = typeof href === 'string' ? localizeHref(href, locale) : href;
  return <NextLink ref={ref} href={localized} {...props} />;
});

export default LocalizedLink;
