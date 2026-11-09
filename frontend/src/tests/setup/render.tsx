/**
 * `render` de Testing Library, enveloppé dans le fournisseur de traductions (français par défaut,
 * tous les espaces de noms) : les composants traduits se rendent comme sur le site.
 * Usage : `import { render, screen } from '@/tests/setup/render'`, ou `render(ui, { locale: 'nl' })`.
 */
import type { ReactElement, ReactNode } from 'react';
import { render as baseRender, type RenderOptions } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { getMessages } from '@/lib/i18n/messages';
import type { Locale } from '@/lib/i18n/config';

export * from '@testing-library/react';

export function render(ui: ReactElement, options: Omit<RenderOptions, 'wrapper'> & { locale?: Locale } = {}) {
  const { locale = 'fr', ...rest } = options;
  const messages = getMessages(locale);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <LanguageProvider locale={locale} messages={messages}>
      {children}
    </LanguageProvider>
  );
  return baseRender(ui, { wrapper: Wrapper, ...rest });
}
