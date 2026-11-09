/**
 * Orthographe canonique des marques saisies par les agences : « SUZUKI », « suzuki » ou
 * « Mercedes » deviennent « Suzuki » et « Mercedes-Benz », pour que les filtres et la barre
 * des marques regroupent bien les véhicules. Les noms suivent ceux des logos du site.
 */
export const CANONICAL_BRANDS = [
  // Voitures
  'Alfa Romeo', 'Audi', 'BMW', 'BYD', 'Chery', 'Citroen', 'Cupra', 'Dacia', 'DS', 'Fiat', 'Ford', 'Geely',
  'Haval', 'Honda', 'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG',
  'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche', 'Range Rover', 'Renault', 'Seat', 'Skoda',
  'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
  // Motos et scooters
  'Aprilia', 'Ducati', 'Harley-Davidson', 'Kawasaki', 'KTM', 'Kymco', 'Piaggio', 'SYM', 'Triumph', 'Vespa',
  'Yamaha',
] as const;

/** Écritures courantes qui désignent une marque canonique */
const ALIASES: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  benz: 'Mercedes-Benz',
  vw: 'Volkswagen',
  'volks wagen': 'Volkswagen',
  'land-rover': 'Land Rover',
  landrover: 'Land Rover',
  rangerover: 'Range Rover',
  'harley davidson': 'Harley-Davidson',
  harley: 'Harley-Davidson',
};

function key(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, ' ')
    .trim();
}

const BY_KEY = new Map<string, string>([
  ...CANONICAL_BRANDS.map((brand) => [key(brand), brand] as [string, string]),
  ...CANONICAL_BRANDS.map((brand) => [key(brand).replace(/-/g, ' '), brand] as [string, string]),
  ...Object.entries(ALIASES).map(([alias, brand]) => [key(alias), brand] as [string, string]),
]);

export function normalizeBrand(input: string): string {
  const trimmed = input.replace(/\s+/g, ' ').trim();
  if (!trimmed) return trimmed;
  const known = BY_KEY.get(key(trimmed)) ?? BY_KEY.get(key(trimmed).replace(/-/g, ' '));
  if (known) return known;
  // Marque inconnue écrite tout en capitales (« GREATWALL ») : première lettre seule en capitale par mot
  if (trimmed.length > 4 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
