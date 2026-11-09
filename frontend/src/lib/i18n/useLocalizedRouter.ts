'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import { localizeHref } from './routing';

/** useRouter dont push / replace / prefetch reçoivent un chemin français, traduit pour la langue courante */
export function useLocalizedRouter() {
  const router = useRouter();
  const { locale } = useLanguage();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizeHref(href, locale), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(localizeHref(href, locale), options),
      prefetch: (href: string) => router.prefetch(localizeHref(href, locale)),
    }),
    [router, locale]
  );
}
