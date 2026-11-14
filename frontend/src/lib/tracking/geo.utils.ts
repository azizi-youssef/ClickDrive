import type { GeoPoint } from './types';

/**
 * Utilitaires géographiques purs. Les règles de validité reproduisent celles de la fonction SQL
 * tracking_ingest_event (la base reste la référence : ces fonctions servent à l'interface, aux contrôles
 * en amont et aux tests de parité).
 */

export const EARTH_RADIUS_KM = 6371.0088;

/** Règles de qualité des positions (mêmes valeurs que dans la migration 20261119000200) */
export const GPS_RULES = {
  /** Vitesse déduite au-delà de laquelle un déplacement est considéré comme un saut GPS */
  maxPlausibleKmh: 250,
  /** Distance minimale pour qualifier un saut (évite de rejeter le bruit sur de très courts intervalles) */
  jumpMinKm: 0.2,
  /** Segment minimal cumulé dans une distance de trajet */
  minSegmentKm: 0.005,
  /** Précision au-delà de laquelle un fix est écarté (mètres) */
  maxAccuracyM: 100,
  /** Nombre minimal de satellites */
  minSatellites: 3,
  /** Trajet inférieur à cette distance : bruit, supprimé à la clôture */
  minTripKm: 0.1,
} as const;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Coordonnées exploitables : finies, dans les bornes, et différentes du couple (0, 0) des boîtiers sans fix */
export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type TimedPoint = GeoPoint & { t: number };

/** Vitesse déduite (km/h) entre deux points datés ; null si l'intervalle n'est pas strictement positif */
export function impliedSpeedKmh(from: TimedPoint, to: TimedPoint): number | null {
  const seconds = (to.t - from.t) / 1000;
  if (!(seconds > 0)) return null;
  return (haversineKm(from, to) / seconds) * 3600;
}

/**
 * Distance parcourue le long d'une suite de points, sans jamais cumuler de donnée douteuse :
 * point invalide, ordre chronologique inversé, intervalle nul, segment sous 5 m (bruit) ou vitesse
 * déduite supérieure à 250 km/h (saut). Les segments écartés ne rompent pas la suite : la référence
 * reste le dernier point accepté.
 */
export function tripDistanceKm(points: readonly TimedPoint[]): number {
  let total = 0;
  let previous: TimedPoint | null = null;
  for (const point of points) {
    if (!isValidCoordinate(point.latitude, point.longitude) || !Number.isFinite(point.t)) continue;
    if (previous === null) {
      previous = point;
      continue;
    }
    if (point.t <= previous.t) continue;
    const distance = haversineKm(previous, point);
    const speed = impliedSpeedKmh(previous, point);
    if (distance >= GPS_RULES.minSegmentKm && speed !== null && speed <= GPS_RULES.maxPlausibleKmh) {
      total += distance;
      previous = point;
    } else if (distance < GPS_RULES.minSegmentKm) {
      // Bruit : on conserve la référence pour ne pas cumuler la dérive
      continue;
    }
    // Saut : le point est ignoré, la référence ne change pas
  }
  return total;
}

export function isInsideCircle(point: GeoPoint, center: GeoPoint, radiusM: number): boolean {
  return haversineKm(point, center) * 1000 <= radiusM;
}

/** Polygone approchant un cercle (rendu de zone sur la carte) ; calculé une fois par zone, jamais à chaque rendu */
export function circlePolygon(center: GeoPoint, radiusM: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const angularDistance = radiusM / 1000 / EARTH_RADIUS_KM;
  const lat1 = toRadians(center.latitude);
  const lon1 = toRadians(center.longitude);
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
      );
    ring.push([((((lon2 * 180) / Math.PI + 540) % 360) - 180), (lat2 * 180) / Math.PI]);
  }
  return ring;
}

/** Emprise [[ouest, sud], [est, nord]] d'un ensemble de points valides ; null s'il n'y en a aucun */
export function boundsOf(points: readonly GeoPoint[]): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    if (!isValidCoordinate(point.latitude, point.longitude)) continue;
    west = Math.min(west, point.longitude);
    east = Math.max(east, point.longitude);
    south = Math.min(south, point.latitude);
    north = Math.max(north, point.latitude);
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

/** Direction cardinale (français) d'un cap en degrés ; null si le cap est inconnu */
export function compassLabel(degrees: number | null | undefined): string | null {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) return null;
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 45) % 8] ?? null;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function formatSpeed(kmh: number | null | undefined): string {
  return kmh === null || kmh === undefined || !Number.isFinite(kmh) ? '—' : `${Math.round(kmh)} km/h`;
}

/** « il y a 3 min » ; `now` est injectable pour les tests */
export function formatAge(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'jamais';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '—';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 10) return 'à l’instant';
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function formatCoordinates(point: GeoPoint, digits = 5): string {
  return `${point.latitude.toFixed(digits)}, ${point.longitude.toFixed(digits)}`;
}
