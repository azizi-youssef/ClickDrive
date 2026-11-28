// Module serveur : importe le contenu des pages SEO, jamais chargé par le navigateur (passer par les props)
import { getPublicCatalog } from '@/lib/services/public-catalog.service';
import { SEO_LANDING_PAGES } from '@/lib/seo/landingPages';
import { catalogFacets } from '@/lib/catalog/discovery';
import { ATTRIBUTE_CATEGORIES, CATALOG_PATHS, typeOfCategory, vehicleTypeOf } from '@/lib/vehicles/kind';
import type { Vehicle } from '@/types';

/** Lien « Véhicules » du pied de page : une catégorie qui contient au moins un véhicule publié */
export interface FooterCategoryLink {
  /** Valeur de la catégorie (énumération VehicleCategory) */
  value: string;
  count: number;
  /** Page SEO dédiée quand elle existe, sinon le catalogue filtré */
  href: string;
}

export interface FooterCatalog {
  categories: FooterCategoryLink[];
  /** Voitures en boîte automatique (lien « Boîte automatique » masqué à 0) */
  automaticCars: number;
  /** Motos et scooters (lien « Motos » masqué à 0) */
  motorcycles: number;
}

const ATTRIBUTE_SET = new Set<string>(ATTRIBUTE_CATEGORIES);

/** Page SEO d'une catégorie (« SUV » → /location-voiture-nador-suv), calculée côté serveur seulement */
function categoryHref(category: string): string {
  const landing = Object.values(SEO_LANDING_PAGES).find(
    (page) => page.filterCategory === category && !page.filterTransmission
  );
  if (landing) return `/${landing.slug}`;
  const type = typeOfCategory(category) ?? 'CAR';
  return `${CATALOG_PATHS[type]}?category=${encodeURIComponent(category)}`;
}

/** Résumé du catalogue pour le pied de page (fonction pure, testable) */
export function summarizeFooterCatalog(vehicles: Vehicle[]): FooterCatalog {
  const cars = vehicles.filter((vehicle) => vehicleTypeOf(vehicle) === 'CAR');
  const categories = catalogFacets(cars)
    .categories.filter((facet) => facet.count > 0 && !ATTRIBUTE_SET.has(facet.value))
    .map((facet) => ({ value: facet.value, count: facet.count, href: categoryHref(facet.value) }));
  return {
    categories,
    automaticCars: cars.filter((vehicle) => vehicle.transmission === 'AUTOMATIC').length,
    motorcycles: vehicles.length - cars.length,
  };
}

/**
 * Catégories affichées dans le pied de page : celles qui contiennent des véhicules (catalogue public,
 * mis en cache 60 s). null si le catalogue est indisponible : le pied de page n'affiche alors que des
 * liens toujours valides (toutes les voitures).
 */
export async function getFooterCategories(): Promise<FooterCatalog | null> {
  const catalog = await getPublicCatalog();
  return catalog ? summarizeFooterCatalog(catalog.vehicles) : null;
}
