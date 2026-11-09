import { cache } from 'react';
import { agenciesService } from '@/lib/services/agencies.service';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { toPublicVehicles } from '@/lib/vehicles/public';
import type { Agency, Vehicle } from '@/types';

/**
 * Agence publique : active et non archivée (les autres ne sont ni indexées ni décrites).
 * Une erreur d'accès à la base est propagée (page d'erreur), jamais présentée comme « introuvable ».
 * Mise en cache pour la requête : métadonnées, layout et page ne lisent la base qu'une fois.
 */
export const loadPublicAgency = cache(async (slug: string): Promise<Agency | null> => {
  const agency = await agenciesService.getAgencyBySlug(decodeURIComponent(slug));
  if (!agency || agency.status !== 'ACTIVE' || ('archived_at' in agency && agency.archived_at)) return null;
  return agency;
});

/** Champs de l'agence affichés sur sa fiche publique (aucune coordonnée interne : téléphone, e-mail…) */
export type AgencyProfileData = Pick<
  Agency,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'address'
  | 'city'
  | 'latitude'
  | 'longitude'
  | 'logo_url'
  | 'banner_url'
  | 'verified'
  | 'rating'
  | 'review_count'
  | 'created_at'
  | 'opening_hours'
  | 'languages'
  | 'cancellation_policy'
  | 'delivery_fee_airport'
  | 'delivery_fee_port'
>;

export function toAgencyProfile(agency: Agency): AgencyProfileData {
  return {
    id: agency.id,
    slug: agency.slug,
    name: agency.name,
    description: agency.description ?? '',
    address: agency.address ?? '',
    city: agency.city ?? '',
    latitude: agency.latitude,
    longitude: agency.longitude,
    logo_url: agency.logo_url,
    banner_url: agency.banner_url,
    verified: Boolean(agency.verified),
    rating: Number(agency.rating) || 0,
    review_count: Number(agency.review_count) || 0,
    created_at: agency.created_at,
    opening_hours: agency.opening_hours?.trim() || null,
    languages: Array.isArray(agency.languages) ? agency.languages : [],
    cancellation_policy: agency.cancellation_policy?.trim() || null,
    delivery_fee_airport: agency.delivery_fee_airport == null ? null : Number(agency.delivery_fee_airport),
    delivery_fee_port: agency.delivery_fee_port == null ? null : Number(agency.delivery_fee_port),
  };
}

/**
 * Flotte publiée de l'agence, même service et même projection publique que GET /api/vehicles?agencyId=…
 * (ni plaque, ni n° interne, ni documents). Renvoie null en cas d'échec : la page charge alors côté navigateur.
 */
export async function loadAgencyVehicles(agencyId: string): Promise<Vehicle[] | null> {
  try {
    const vehicles = await vehiclesService.getVehicles({ agencyId });
    // Sérialisation explicite : seules des données JSON passent au composant client
    return JSON.parse(JSON.stringify(toPublicVehicles(vehicles))) as Vehicle[];
  } catch (error) {
    console.error('[AgencyPage] Flotte indisponible :', error instanceof Error ? error.message : error);
    return null;
  }
}
