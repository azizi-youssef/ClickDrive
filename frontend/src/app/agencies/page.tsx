import type { Metadata } from 'next';
import { AgenciesClient } from './AgenciesClient';
import { localizedPageMetadata } from '@/lib/i18n/server';
import { I18nScope } from '@/components/i18n/I18nScope';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('agencies', '/agencies');
}

export default function AgenciesPage() {
  return (
    <I18nScope namespaces={['agencies']}>
      <AgenciesClient />
    </I18nScope>
  );
}
