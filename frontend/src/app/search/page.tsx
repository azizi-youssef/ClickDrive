import { I18nScope } from '@/components/i18n/I18nScope';
import { redirectLocalized } from '@/lib/i18n/server';
import { SearchClient } from './SearchClient';
import { catalogQuery, loadCatalogPreload, single, type CatalogSearchParams } from './preload';
import { CATALOG_PATHS, parseVehicleTypeParam, typeOfCategory } from '@/lib/vehicles/kind';

// Rendu à la requête : la disponibilité dépend des dates demandées et de l'état du jour
export const dynamic = 'force-dynamic';

/**
 * Catalogue des voitures. Les motos ont leur propre catalogue (/motos) :
 * un lien vers une catégorie moto ou ?type=moto y est redirigé, paramètres conservés.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const params = await searchParams;
  if (parseVehicleTypeParam(single(params.type)) === 'MOTORCYCLE' || typeOfCategory(single(params.category)) === 'MOTORCYCLE') {
    await redirectLocalized(`${CATALOG_PATHS.MOTORCYCLE}${catalogQuery(params, ['type'])}`);
  }

  const preload = await loadCatalogPreload(params, 'SearchPage');
  return (
    <I18nScope namespaces={['searchBar', 'brands', 'catalog']}>
      <SearchClient preload={preload} vehicleType="CAR" />
    </I18nScope>
  );
}
