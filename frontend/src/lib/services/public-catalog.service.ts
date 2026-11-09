import { unstable_cache } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { agenciesService } from '@/lib/services/agencies.service';
import { vehiclesService } from '@/lib/services/vehicles.service';
import type { Agency, Vehicle } from '@/types';
import { toPublicVehicles } from '@/lib/vehicles/public';
import { toPublicAgencies } from '@/lib/agencies/public';

export type PublicCatalog = { vehicles: Vehicle[]; agencies: Agency[] };

/** Délai de mise en cache du catalogue public (accueil, pages SEO) */
export const PUBLIC_CATALOG_REVALIDATE_SECONDS = 60;

async function loadPublicCatalog(withoutSession: boolean): Promise<PublicCatalog> {
  const [agencies, vehicles] = await Promise.all([
    withoutSession ? agenciesService.getActiveAgenciesWithoutSession() : agenciesService.getAgencies(true),
    vehiclesService.getVehicles(),
  ]);
  const withCounts = agencies.map((agency) => ({
    ...agency,
    vehicle_count: agency.vehicle_count ?? vehicles.filter((vehicle) => vehicle.agency_id === agency.id).length,
  }));
  // Sérialisation explicite : seules des données JSON passent au composant client (et au cache)
  return JSON.parse(JSON.stringify({ vehicles: toPublicVehicles(vehicles), agencies: toPublicAgencies(withCounts) }));
}

/**
 * Mis en cache 60 s : une page très visitée ne relit plus la base à chaque visite. Le client admin
 * (sans cookies) est requis dans une fonction mise en cache ; sans lui, lecture directe.
 * Une erreur n'est jamais mise en cache (elle est levée, puis rattrapée ci-dessous).
 */
const cachedPublicCatalog = unstable_cache(() => loadPublicCatalog(true), ['public-catalog-v1'], {
  revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
  tags: ['public-catalog'],
});

/**
 * Données publiques du catalogue pour le rendu serveur : mêmes services et même forme
 * que GET /api/vehicles et GET /api/agencies (agences actives, nombre de véhicules).
 * Renvoie null en cas d'échec : la page retombe alors sur le chargement côté navigateur.
 */
export async function getPublicCatalog(): Promise<PublicCatalog | null> {
  try {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ? await cachedPublicCatalog() : await loadPublicCatalog(false);
  } catch (error) {
    unstable_rethrow(error); // signaux internes de Next (rendu dynamique) : jamais avalés
    console.error('[PublicCatalog] Préchargement impossible :', error instanceof Error ? error.message : error);
    return null;
  }
}
