import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Location de voiture à Nador : comparer les véhicules disponibles',
  description:
    'Comparez les prix et disponibilités des voitures de location à Nador, Aéroport Nador Al-Aroui et Port Beni Ansar. Demande de réservation en ligne.',
  alternates: { canonical: '/search' },
  openGraph: {
    title: 'Rechercher une voiture de location à Nador — ClickDrive',
    description:
      'Comparez instantanément les véhicules disponibles auprès des agences partenaires vérifiées à Nador.',
    url: 'https://clickdrive.ma/search',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
