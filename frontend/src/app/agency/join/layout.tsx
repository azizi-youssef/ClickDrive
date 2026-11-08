import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Devenir agence partenaire à Nador',
  description:
    'Rejoignez le réseau des agences de location partenaires à Nador. Espace de gestion de flotte, visibilité locale et réception de demandes qualifiées.',
  alternates: { canonical: '/agency/join' },
  openGraph: {
    title: 'Rejoindre ClickDrive — Pour les agences de location à Nador',
    description:
      'Présentez votre flotte sur ClickDrive et recevez des demandes de réservation directes et sécurisées.',
    url: 'https://clickdrive.ma/agency/join',
  },
};

export default function AgencyJoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
