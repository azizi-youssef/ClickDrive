import type { Metadata } from 'next';
import { NotFoundView } from '@/components/not-found/NotFoundView';
import { localizedPageMetadata } from '@/lib/i18n/server';
import { I18nScope } from '@/components/i18n/I18nScope';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('notFound', null, { robots: { index: false, follow: true } });
}

/**
 * 404 du site public (URL inconnue, annonce ou agence retirée).
 * Le message s'adapte à l'adresse demandée ; voir NotFoundView.
 */
export default function NotFound() {
  return (
    <I18nScope namespaces={['notFound']}>
      <NotFoundView />
    </I18nScope>
  );
}
