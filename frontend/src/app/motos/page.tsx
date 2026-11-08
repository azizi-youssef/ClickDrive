import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SearchClient } from '../search/SearchClient';
import { catalogQuery, loadCatalogPreload, single, type CatalogSearchParams } from '../search/preload';
import { CATALOG_PATHS, typeOfCategory } from '@/lib/vehicles/kind';

// Rendu à la requête : la disponibilité dépend des dates demandées et de l'état du jour
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Location de moto et scooter à Nador',
  description:
    'Comparez les motos et scooters proposés par les agences partenaires vérifiées à Nador : tarifs, cylindrée, permis exigé. Demande de réservation sans paiement en ligne.',
  alternates: { canonical: '/motos' },
  openGraph: {
    title: 'Louer une moto ou un scooter à Nador — ClickDrive',
    description: 'Motos et scooters des agences partenaires vérifiées à Nador, avec cylindrée et permis exigé.',
    url: 'https://clickdrive.ma/motos',
  },
};

/** Catalogue des motos (les voitures sont sur /search) */
export default async function MotorcyclesPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const params = await searchParams;
  if (typeOfCategory(single(params.category)) === 'CAR') {
    redirect(`${CATALOG_PATHS.CAR}${catalogQuery(params, ['type'])}`);
  }

  const preload = await loadCatalogPreload(params, 'MotorcyclesPage');
  return <SearchClient preload={preload} vehicleType="MOTORCYCLE" />;
}
