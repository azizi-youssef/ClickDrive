import { LOCATIONS_NADOR } from '@/lib/constants/catalog';
import { findPickupLocation } from '@/data/locations';
import { MEETING_POINTS } from '@/lib/constants/meetingPoints';
import { parseRentalPeriod, type RentalPeriod } from '@/lib/utils/date-only';

/**
 * Contexte d'une recherche (dates et lieu de prise en charge) transmis du catalogue à la fiche, de la
 * fiche aux véhicules similaires et au catalogue, puis à la demande : le client ne ressaisit rien.
 */

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const KNOWN_LOCATIONS = [...LOCATIONS_NADOR, ...MEETING_POINTS.map((point) => point.name)];

/** Lieu lu dans une adresse (?location=…) : seulement un lieu connu, dans son orthographe de référence */
export function parseSearchLocation(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 120) return undefined;
  // Lieu de la liste officielle, quelle que soit l'orthographe reçue (libellé, alias, ancienne valeur)
  const known = findPickupLocation(value);
  if (known) return known.value;
  const folded = fold(value);
  return KNOWN_LOCATIONS.find((location) => fold(location) === folded);
}

/** Paramètres d'adresse « ?startDate=…&endDate=…&location=… » (chaîne vide sans contexte valide) */
export function searchContextQuery(period?: RentalPeriod | null, location?: string | null): string {
  const query = new URLSearchParams();
  const valid = period ? parseRentalPeriod(period.startDate, period.endDate) : undefined;
  if (valid) {
    query.set('startDate', valid.startDate);
    query.set('endDate', valid.endDate);
  }
  const place = parseSearchLocation(location);
  if (place) query.set('location', place);
  const text = query.toString();
  return text ? `?${text}` : '';
}
