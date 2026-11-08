import type { Metadata } from 'next';
import React from 'react';
import { FaqClient } from './FaqClient';
import { FAQ_ITEMS } from './faq-data';

export const metadata: Metadata = {
  title: 'Questions fréquentes sur la location de voitures à Nador',
  description:
    "Réponses aux questions les plus courantes : comment réserver, dépôt de garantie, assurance, kilométrage, annulation et agences vérifiées ClickDrive à Nador.",
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'FAQ — Location de voitures à Nador | ClickDrive',
    description: 'Toutes les réponses sur la réservation, les tarifs, les garanties et les agences partenaires ClickDrive à Nador.',
    url: 'https://clickdrive.ma/faq',
  },
};

// Données structurées FAQPage : mêmes questions/réponses que la page (éligibles aux résultats enrichis)
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <FaqClient />
    </>
  );
}
