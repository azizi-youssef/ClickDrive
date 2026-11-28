/**
 * Lieux de prise en charge ClickDrive à Nador : source unique des libellés, utilisée par le formulaire
 * de recherche, l'accueil (« Louez là où votre voyage commence »), le pied de page, les pages SEO
 * et les données structurées.
 *
 * - `label` : libellé de référence en français, unique et normalisé, affiché partout.
 * - `value` : valeur historique transmise dans `?location=` et enregistrée dans les demandes. Elle ne
 *   change jamais (anciens liens partagés, demandes déjà enregistrées) ; seul le libellé affiché évolue.
 * - Les traductions des libellés sont dans `vehicle.locations` (src/lib/i18n/messages/vehicle.ts),
 *   indexées par `value`.
 */

export const LOCATION_IDS = [
  'aeroport-nador',
  'nador-centre',
  'port-beni-ansar',
  'corniche-marchica',
  'al-aroui-ville',
  'gare-oncf-nador',
  'selouane-centre',
] as const;

export type LocationId = (typeof LOCATION_IDS)[number];

export type LocationKind = 'AIRPORT' | 'CITY' | 'PORT' | 'RESORT' | 'TRAIN';

export interface PickupLocation {
  id: LocationId;
  /** Libellé de référence (français) */
  label: string;
  /** Libellé court : cartes, bandeau d'en-tête */
  shortLabel: string;
  /** Valeur stable du paramètre ?location= et des demandes enregistrées */
  value: string;
  kind: LocationKind;
  /** Code IATA ou repère court */
  code?: string;
  /** Page SEO dédiée (chemin français), quand elle existe */
  seoPath?: string;
  /** Photo de la carte « Louez là où votre voyage commence » (lieux mis en avant) */
  image?: string;
  /** Lieu mis en avant sur l'accueil et dans le pied de page */
  featured: boolean;
  /** Autres orthographes reconnues dans les adresses et la saisie libre */
  aliases: readonly string[];
}

export const PICKUP_LOCATIONS: readonly PickupLocation[] = [
  {
    id: 'aeroport-nador',
    label: 'Aéroport Nador Al Aroui (NDR)',
    shortLabel: 'Aéroport Nador Al Aroui',
    value: 'Aeroport Nador Al-Aroui (NDR)',
    kind: 'AIRPORT',
    code: 'NDR',
    seoPath: '/location-voiture-nador-aeroport',
    image: '/aeroport%20nador%20al%20aroui.jpeg',
    featured: true,
    aliases: ['Aéroport Nador Al-Aroui (NDR)', 'Aéroport Nador-Al Aroui', 'Aéroport', 'aeroport', 'NDR'],
  },
  {
    id: 'nador-centre',
    label: 'Nador Centre',
    shortLabel: 'Nador Centre',
    value: 'Centre-Ville Nador (Boulevard Mohammed V)',
    kind: 'CITY',
    seoPath: '/location-voiture-nador',
    image: '/centre%20nadar.jpeg',
    featured: true,
    aliases: ['Centre-ville de Nador (boulevard Mohammed V)', 'Centre-Ville Nador', 'Nador centre-ville', 'Nador'],
  },
  {
    id: 'port-beni-ansar',
    label: 'Port de Beni Ansar',
    shortLabel: 'Port de Beni Ansar',
    value: 'Port de Beni Ansar (Gare Maritime)',
    kind: 'PORT',
    seoPath: '/location-voiture-beni-ansar',
    image: '/frontera%20melilla.jpeg',
    featured: true,
    aliases: ['Port de Beni Ansar (gare maritime)', 'Port Beni Ansar', 'Beni Ansar'],
  },
  {
    id: 'corniche-marchica',
    label: 'Corniche de Marchica',
    shortLabel: 'Corniche de Marchica',
    value: 'Corniche Marchica (Nador)',
    kind: 'RESORT',
    image: '/atalayoun%20nador.jpg',
    featured: true,
    aliases: ['Corniche de Marchica (Nador)', 'Marchica', 'Lagune Marchica'],
  },
  {
    id: 'al-aroui-ville',
    label: 'Al Aroui Ville',
    shortLabel: 'Al Aroui Ville',
    value: 'Al-Aroui Ville',
    kind: 'CITY',
    featured: false,
    aliases: ['Al Aroui', 'Al-Aroui'],
  },
  {
    id: 'gare-oncf-nador',
    label: 'Gare ONCF Nador Ville',
    shortLabel: 'Gare ONCF Nador',
    value: 'Gare ONCF Nador Ville',
    kind: 'TRAIN',
    featured: false,
    aliases: ['Gare ONCF Nador', 'Gare de Nador'],
  },
  {
    id: 'selouane-centre',
    label: 'Selouane Centre',
    shortLabel: 'Selouane Centre',
    value: 'Selouane Centre',
    kind: 'CITY',
    featured: true,
    aliases: ['Selouane'],
  },
];

/** Lieu proposé par défaut dans la recherche : l'aéroport */
export const DEFAULT_PICKUP_LOCATION: PickupLocation = PICKUP_LOCATIONS[0] as PickupLocation;

/** Valeurs acceptées par la recherche, dans l'ordre d'affichage */
export const PICKUP_LOCATION_VALUES: readonly string[] = PICKUP_LOCATIONS.map((location) => location.value);

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

/**
 * Lieu correspondant à une valeur d'adresse, un identifiant, un libellé ou un alias (accents, tirets
 * et casse ignorés) ; undefined pour un lieu inconnu.
 */
export function findPickupLocation(input: string | null | undefined): PickupLocation | undefined {
  if (!input) return undefined;
  const folded = fold(input);
  if (!folded) return undefined;
  return PICKUP_LOCATIONS.find((location) =>
    [location.id, location.value, location.label, location.shortLabel, ...location.aliases].some(
      (candidate) => fold(candidate) === folded
    )
  );
}

/** Lieux mis en avant (accueil, pied de page) */
export function featuredPickupLocations(): PickupLocation[] {
  return PICKUP_LOCATIONS.filter((location) => location.featured);
}

/** Lien vers le catalogue pour un lieu (page SEO dédiée quand elle existe) */
export function pickupLocationHref(location: PickupLocation, basePath = '/search'): string {
  return location.seoPath ?? `${basePath}?location=${encodeURIComponent(location.value)}`;
}
