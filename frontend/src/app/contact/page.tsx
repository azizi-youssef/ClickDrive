import type { Metadata } from 'next';
import { ContactClient } from './ContactClient';
import { localizedPageMetadata } from '@/lib/i18n/server';
import { I18nScope } from '@/components/i18n/I18nScope';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('contact', '/contact');
}

export default function ContactPage() {
  return (
    <I18nScope namespaces={['contact']}>
      <ContactClient />
    </I18nScope>
  );
}
