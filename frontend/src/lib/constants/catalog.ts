/**
 * ClickDrive Catalog Constants
 * Static configuration data for the Nador region rental platform.
 * These are geographic/categorical constants, not business data.
 */

/** Pickup/dropoff locations in the Nador region */
export const LOCATIONS_NADOR: string[] = [
  'Aeroport Nador Al-Aroui (NDR)',
  'Centre-Ville Nador (Boulevard Mohammed V)',
  'Corniche Marchica (Nador)',
  'Port de Beni Ansar (Gare Maritime)',
  'Gare ONCF Nador Ville',
  'Selouane Centre',
  'Al-Aroui Ville',
];

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