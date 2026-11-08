import type { Metadata } from 'next';
import { AgenciesClient } from './AgenciesClient';

export const metadata: Metadata = {
  title: 'Agences de location de voitures à Nador',
  description:
    'Découvrez les agences partenaires vérifiées sur ClickDrive à Nador, l’aéroport Nador-Al Aroui et Beni Ansar. Consultez leurs parcs, conditions et tarifs.',
  alternates: { canonical: '/agencies' },
  openGraph: {
    title: 'Agences partenaires vérifiées à Nador — ClickDrive',
    description:
      'Comparez les agences locales de location à Nador. Véhicules contrôlés, tarifs transparents et support dédié.',
    url: 'https://clickdrive.ma/agencies',
  },
};

export default function AgenciesPage() {
  return <AgenciesClient />;
}
