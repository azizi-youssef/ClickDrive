import type { Metadata } from 'next';
import { I18nScope } from '@/components/i18n/I18nScope';
import { redirectLocalized } from '@/lib/i18n/server';
import { SearchClient } from '../search/SearchClient';
import { catalogQuery, loadCatalogPreload, single, type CatalogSearchParams } from '../search/preload';
import { CATALOG_PATHS, typeOfCategory } from '@/lib/vehicles/kind';
import { localizedPageMetadata } from '@/lib/i18n/server';

// Rendu à la requête : la disponibilité dépend des dates demandées et de l'état du jour
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('motos', '/motos');
}

/** Catalogue des motos (les voitures sont sur /search) */
export default async function MotorcyclesPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const params = await searchParams;
  if (typeOfCategory(single(params.category)) === 'CAR') {
    await redirectLocalized(`${CATALOG_PATHS.CAR}${catalogQuery(params, ['type'])}`);
  }

  const preload = await loadCatalogPreload(params, 'MotorcyclesPage');
  return (
    <I18nScope namespaces={['searchBar', 'brands', 'catalog']}>
      <SearchClient preload={preload} vehicleType="MOTORCYCLE" />
    </I18nScope>
  );
}
