import type { Metadata } from 'next';
import React from 'react';
import { FaqClient } from './FaqClient';
import { localizeFaq } from './faq-data';
import { getTranslations, localizedPageMetadata } from '@/lib/i18n/server';
import { I18nScope } from '@/components/i18n/I18nScope';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('faq', '/faq');
}

export default async function FaqPage() {
  // Données structurées FAQPage : mêmes questions/réponses que la page, dans sa langue
  const { t } = await getTranslations();
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: localizeFaq(t.faq).items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <I18nScope namespaces={['faq']}>
        <FaqClient />
      </I18nScope>
    </>
  );
}
