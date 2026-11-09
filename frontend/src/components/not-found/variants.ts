import type { Vehicle } from '@/types';
import { vehicleTypeOf } from '@/lib/vehicles/kind';
import { delocalizeHref } from '@/lib/i18n/routing';

export type NotFoundKind = 'vehicle' | 'agency' | 'page';

/** Textes traduits : t.notFound[kind] (titre, texte, bouton principal) */
export type NotFoundVariant = {
  kind: NotFoundKind;
  primaryHref: string;
};

/**
 * Message adapté à l'adresse demandée : un lien d'annonce ou d'agence mort n'appelle pas
 * la même réponse qu'une URL mal saisie (mêmes cas que les notFound() des routes).
 */
export function notFoundVariant(pathname: string | null | undefined): NotFoundVariant {
  // Adresse dans une langue (/nl/cars/…) : même cas que l'adresse française
  const path = delocalizeHref(pathname ?? '');
  if (/^\/cars\/[^/]+/.test(path)) return { kind: 'vehicle', primaryHref: '/search' };
  if (/^\/agencies\/[^/]+/.test(path)) return { kind: 'agency', primaryHref: '/agencies' };
  return { kind: 'page', primaryHref: '/search' };
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function requestedSlug(pathname: string): string | null {
  const raw = pathname.match(/^\/cars\/([^/?#]+)/)?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * Véhicules à proposer après un lien d'annonce mort : uniquement des véhicules disponibles,
 * ceux de la même marque d'abord (la marque est le début du slug : « renault-clio-… »),
 * puis les véhicules mis en avant et les moins chers.
 */
export function pickSuggestions(
  vehicles: readonly Vehicle[],
  pathname: string,
  max = 3
): { vehicles: Vehicle[]; brand: string | null } {
  const slug = requestedSlug(pathname);
  const available = vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE' && vehicle.slug !== slug);
  const sameBrand = slug
    ? available.filter((vehicle) => {
        const brand = slugPart(vehicle.brand ?? '');
        return brand !== '' && slug.startsWith(`${brand}-`);
      })
    : [];
  // Même type que l'annonce quand la marque la révèle (moto ↔ moto), sinon des voitures d'abord
  const preferredType = sameBrand[0] ? vehicleTypeOf(sameBrand[0]) : 'CAR';
  const byRelevance = (a: Vehicle, b: Vehicle) =>
    Number(vehicleTypeOf(b) === preferredType) - Number(vehicleTypeOf(a) === preferredType) ||
    Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
    a.daily_price - b.daily_price;
  const others = available.filter((vehicle) => !sameBrand.includes(vehicle)).sort(byRelevance);
  return {
    vehicles: [...[...sameBrand].sort(byRelevance), ...others].slice(0, max),
    brand: sameBrand[0]?.brand ?? null,
  };
}
