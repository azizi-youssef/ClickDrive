import { PICKUP_LOCATION_VALUES } from '@/data/locations';
/**
 * ClickDrive Catalog Constants
 * Static configuration data for the Nador region rental platform.
 * These are geographic/categorical constants, not business data.
 */

/** Lieux de prise en charge proposés par la recherche (valeurs stables) : voir src/data/locations.ts */
export const LOCATIONS_NADOR: readonly string[] = PICKUP_LOCATION_VALUES;

/** Vehicle category filter options */
/** Liste de repli (avant chargement du catalogue) : les pages passent sinon les catégories réellement présentes.
 *  « 7 places » et « Automatique » n'en font plus partie : ce ne sont pas des catégories (boîte = filtre dédié). */
export const CATEGORIES: string[] = [
  'Tous les types',
  'Économique',
  'SUV',
  'Berline',
  'Luxe',
];

/** Popular brand filter options */
export const POPULAR_BRANDS: string[] = [
  'Toutes les marques',
  'Dacia',
  'Renault',
  'Volkswagen',
  'Hyundai',
  'Kia',
  'Mercedes-Benz',
  'Land Rover',
  'Toyota',
  'Peugeot',
  'Citroen',
];