import type { SearchPreload } from './SearchClient';
import { agenciesService } from '@/lib/services/agencies.service';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { toPublicAgencies } from '@/lib/agencies/public';
import { toPublicVehicles } from '@/lib/vehicles/public';
import { formatLocalDate, getEffectiveRentalDates, isValidDateOnly } from '@/lib/utils/date-only';

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

/**
 * Préchargement serveur du catalogue (voitures et motos), avec les mêmes règles que GET /api/vehicles :
 * période validée, disponibilité calculée en base. En cas d'échec, le client charge lui-même.
 */
export async function loadCatalogPreload(params: CatalogSearchParams, logLabel: string): Promise<SearchPreload | null> {
  const startDate = single(params.startDate);
  const endDate = single(params.endDate);
  try {
    const period =
      startDate && endDate ? getEffectiveRentalDates(startDate, endDate, formatLocalDate(new Date())) : { startDate: '', endDate: '' };
    const hasPeriod =
      isValidDateOnly(period.startDate) && isValidDateOnly(period.endDate) && period.startDate < period.endDate;

    const [vehicles, agencies] = await Promise.all([
      vehiclesService.getVehicles(hasPeriod ? { startDate: period.startDate, endDate: period.endDate } : undefined),
      agenciesService.getAgencies(true),
    ]);
    return JSON.parse(
      JSON.stringify({ vehicles: toPublicVehicles(vehicles), agencies: toPublicAgencies(agencies), period: hasPeriod ? period : { startDate: '', endDate: '' } })
    );
  } catch (error) {
    console.error(`[${logLabel}] Préchargement impossible :`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Conserve les paramètres de recherche (dates, lieu, catégorie…) lors d'une redirection entre catalogues */
export function catalogQuery(params: CatalogSearchParams, omit: string[] = []): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (omit.includes(key) || typeof value !== 'string' || !value) continue;
    query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}
