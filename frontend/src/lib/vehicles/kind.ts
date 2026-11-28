/**
 * Types de véhicules proposés à la location : voitures et motos.
 * Source unique pour le formulaire agence, la validation API, le catalogue et les documents.
 */

export const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Catégories voitures — identiques à la contrainte SQL `vehicles_category_check` */
export const CAR_CATEGORIES = [
  'Économique',
  'Citadine',
  'Compacte',
  'Berline',
  'SUV',
  'Luxe',
  '7 places',
  'Automatique',
] as const;

/** Catégories motos */
export const MOTORCYCLE_CATEGORIES = ['Scooter', 'Roadster', 'Trail', 'Sportive', 'Custom'] as const;

export type CarCategory = (typeof CAR_CATEGORIES)[number];
export type MotorcycleCategory = (typeof MOTORCYCLE_CATEGORIES)[number];

export const ALL_VEHICLE_CATEGORIES = [...CAR_CATEGORIES, ...MOTORCYCLE_CATEGORIES] as const;

/**
 * Catégorie de véhicule : énumération unique (valeurs de la contrainte SQL `vehicles_category_check`)
 * partagée par la recherche, les filtres, les cartes, le pied de page et la section « Bientôt ».
 */
export type VehicleCategory = (typeof ALL_VEHICLE_CATEGORIES)[number];

const ALL_CATEGORY_SET = new Set<string>(ALL_VEHICLE_CATEGORIES);

export function isVehicleCategory(value: unknown): value is VehicleCategory {
  return typeof value === 'string' && ALL_CATEGORY_SET.has(value);
}

/**
 * Catégories voitures qui sont des attributs plutôt que des gammes (« Automatique » = boîte,
 * « 7 places » = capacité) : jamais annoncées seules dans « Bientôt » ni dans le pied de page.
 */
export const ATTRIBUTE_CATEGORIES: readonly VehicleCategory[] = ['Automatique', '7 places'];

/** Permis exigé par l'agence pour une moto (choisi par l'agence, affiché tel quel au client) */
export const MOTORCYCLE_LICENSES = ['AM', 'A1', 'A2', 'A', 'B'] as const;
export type MotorcycleLicense = (typeof MOTORCYCLE_LICENSES)[number];

export const MOTORCYCLE_LICENSE_LABELS: Record<MotorcycleLicense, string> = {
  AM: 'Permis AM (cyclomoteur)',
  A1: 'Permis A1',
  A2: 'Permis A2',
  A: 'Permis A',
  B: 'Permis B (voiture)',
};

/** Cylindrée maximale d'une moto légère (permis A1) */
export const LIGHT_MOTORCYCLE_MAX_CC = 125;
/** Cylindrée maximale d'un cyclomoteur (permis AM) */
export const MOPED_MAX_CC = 50;

/**
 * Permis cohérents avec une cylindrée :
 * - jusqu'à 50 cm³ : AM, A1 ou B ;
 * - de 51 à 125 cm³ : A1 ;
 * - au-delà de 125 cm³ : A2 ou A.
 */
export function licensesForEngineCc(engineCc: number): readonly MotorcycleLicense[] {
  if (engineCc <= MOPED_MAX_CC) return ['AM', 'A1', 'B'];
  if (engineCc <= LIGHT_MOTORCYCLE_MAX_CC) return ['A1'];
  return ['A2', 'A'];
}

/** Permis proposé par défaut pour une cylindrée (pré-remplissage du formulaire agence) */
export function defaultLicenseForEngineCc(engineCc: number): MotorcycleLicense {
  if (engineCc <= MOPED_MAX_CC) return 'AM';
  return engineCc <= LIGHT_MOTORCYCLE_MAX_CC ? 'A1' : 'A';
}

/** Vrai quand le permis exigé est compatible avec la cylindrée (ou qu'une des deux valeurs manque) */
export function isLicenseConsistentWithEngineCc(
  engineCc: number | null | undefined,
  license: string | null | undefined
): boolean {
  if (engineCc == null || !Number.isFinite(engineCc) || engineCc <= 0 || !license) return true;
  return (licensesForEngineCc(engineCc) as readonly string[]).includes(license);
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, { singular: string; plural: string; article: string }> = {
  CAR: { singular: 'Voiture', plural: 'Voitures', article: 'cette voiture' },
  MOTORCYCLE: { singular: 'Moto', plural: 'Motos', article: 'cette moto' },
};

/** Équipements proposés dans le formulaire agence, selon le type */
export const COMMON_FEATURES_BY_TYPE: Record<VehicleType, string[]> = {
  CAR: [
    'GPS / Navigation',
    'Bluetooth & USB',
    'Caméra de recul',
    'Régulateur de vitesse',
    'Apple CarPlay / Android Auto',
    'Radars de stationnement',
    'Sièges chauffants',
    'Toit ouvrant / Panoramique',
    'Démarrage sans clé',
    'Phares LED',
    'Fixation Isofix',
  ],
  MOTORCYCLE: [
    'Casque fourni',
    'Deuxième casque (passager)',
    'Top case',
    'Sacoches',
    'Antivol',
    'Support smartphone',
    'Prise USB',
    'ABS',
    'Gants fournis',
  ],
};

const MOTORCYCLE_CATEGORY_SET = new Set<string>(MOTORCYCLE_CATEGORIES);
const CAR_CATEGORY_SET = new Set<string>(CAR_CATEGORIES);

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === 'string' && (VEHICLE_TYPES as readonly string[]).includes(value);
}

/**
 * Type d'un véhicule. La colonne `vehicle_type` fait foi ; à défaut (base pas encore migrée,
 * anciennes données), la catégorie permet de le déduire.
 */
export function vehicleTypeOf(vehicle: { vehicle_type?: string | null; category?: string | null } | null | undefined): VehicleType {
  if (!vehicle) return 'CAR';
  const declared = typeof vehicle.vehicle_type === 'string' ? vehicle.vehicle_type.toUpperCase() : '';
  if (isVehicleType(declared)) return declared;
  return vehicle.category && MOTORCYCLE_CATEGORY_SET.has(vehicle.category) ? 'MOTORCYCLE' : 'CAR';
}

export function isMotorcycle(vehicle: { vehicle_type?: string | null; category?: string | null } | null | undefined): boolean {
  return vehicleTypeOf(vehicle) === 'MOTORCYCLE';
}

export function categoriesForType(type: VehicleType): readonly string[] {
  return type === 'MOTORCYCLE' ? MOTORCYCLE_CATEGORIES : CAR_CATEGORIES;
}

export function categoryMatchesType(category: string, type: VehicleType): boolean {
  return type === 'MOTORCYCLE' ? MOTORCYCLE_CATEGORY_SET.has(category) : CAR_CATEGORY_SET.has(category);
}

export function motorcycleLicenseLabel(value: string | null | undefined): string {
  return value && value in MOTORCYCLE_LICENSE_LABELS ? MOTORCYCLE_LICENSE_LABELS[value as MotorcycleLicense] : '';
}

/** « 125 cm³ » ; vide si non renseigné */
export function formatEngineCc(value: number | string | null | undefined): string {
  const cc = Number(value);
  return Number.isFinite(cc) && cc > 0 ? `${Math.round(cc)} cm³` : '';
}

/** Catalogues publics séparés : voitures sur /search, motos sur /motos */
export const CATALOG_PATHS: Record<VehicleType, string> = {
  CAR: '/search',
  MOTORCYCLE: '/motos',
};

/** Catégorie appartenant à un type (ou null si inconnue / « Tous les types ») */
export function typeOfCategory(category: string | null | undefined): VehicleType | null {
  if (!category) return null;
  if (MOTORCYCLE_CATEGORY_SET.has(category)) return 'MOTORCYCLE';
  if (CAR_CATEGORY_SET.has(category)) return 'CAR';
  return null;
}

/** Paramètre d'URL `type` du catalogue → type de véhicule (ou null = tous) */
export function parseVehicleTypeParam(value: string | null | undefined): VehicleType | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'MOTO' || upper === 'MOTOS' || upper === 'MOTORCYCLE') return 'MOTORCYCLE';
  if (upper === 'CAR' || upper === 'VOITURE' || upper === 'VOITURES') return 'CAR';
  return null;
}
