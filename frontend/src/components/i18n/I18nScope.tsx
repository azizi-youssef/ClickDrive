import type { ReactNode } from 'react';
import { MessagesScope } from '@/lib/i18n/LanguageContext';
import { pickMessages, type Namespace } from '@/lib/i18n/messages';
import { getServerLocale } from '@/lib/i18n/server';

/**
 * Composant serveur : rend disponibles, pour les composants clients qu'il enveloppe, les espaces de
 * noms d'une page, dans la langue de la requête seulement.
 */
export async function I18nScope({ namespaces, children }: { namespaces: readonly Namespace[]; children: ReactNode }) {
  const { locale } = await getServerLocale();
  return <MessagesScope messages={pickMessages(locale, namespaces)}>{children}</MessagesScope>;
}
