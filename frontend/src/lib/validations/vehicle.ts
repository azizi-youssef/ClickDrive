import { z } from 'zod';
import { normalizeBrand } from '@/lib/vehicles/brands';
import {
  ALL_VEHICLE_CATEGORIES,
  MOTORCYCLE_LICENSES,
  VEHICLE_TYPES,
  categoryMatchesType,
  type VehicleType,
} from '@/lib/vehicles/kind';

/** Toutes les catégories (voitures puis motos) ; le formulaire filtre selon le type choisi */
export const VEHICLE_CATEGORIES = ALL_VEHICLE_CATEGORIES;

export const TRANSMISSION_TYPES = ['MANUAL', 'AUTOMATIC'] as const;
export const FUEL_TYPES = ['DIESEL', 'GASOLINE', 'HYBRID', 'ELECTRIC'] as const;
export const VEHICLE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED'] as const;

const vehicleBaseSchema = z.object({
  vehicle_type: z.enum(VEHICLE_TYPES).default('CAR'),
  // Orthographe canonique (« SUZUKI » → « Suzuki ») : filtres et barre des marques regroupent bien les véhicules
  brand: z.string().trim().min(2, 'La marque doit comporter au moins 2 caractères').transform(normalizeBrand),
  model: z.string().trim().min(1, 'Le modèle est requis'),
  year: z.coerce
    .number()
    .int()
    .min(2000, 'Année minimale: 2000')
    .max(new Date().getFullYear() + 1, 'Année invalide'),
  category: z.enum(VEHICLE_CATEGORIES),
  transmission: z.enum(TRANSMISSION_TYPES),
  fuel: z.enum(FUEL_TYPES),
  seats: z.coerce.number().int().min(1).max(9).default(5),
  doors: z.coerce.number().int().min(0).max(5).default(5),
  air_conditioning: z.coerce.boolean().default(true),
  /** Motos : cylindrée (cm³), facultative pour une moto électrique */
  engine_cc: z.coerce
    .number()
    .int('La cylindrée doit être un nombre entier')
    .min(49, 'Cylindrée minimale : 49 cm³')
    .max(2500, 'Cylindrée maximale : 2 500 cm³')
    .optional()
    .nullable(),
  /** Motos : permis exigé par l'agence */
  license_required: z.enum(MOTORCYCLE_LICENSES).optional().nullable(),
  mileage: z.coerce.number().int().min(0, 'Le kilométrage doit être positif').default(0),
  daily_price: z.coerce.number().positive('Le tarif journalier doit être supérieur à 0'),
  weekly_price: z.coerce.number().positive().optional().nullable(),
  monthly_price: z.coerce.number().positive().optional().nullable(),
  deposit: z.coerce.number().min(0, 'La caution ne peut pas être négative').default(3000),
  /** Assurance incluse dans le prix : responsabilité civile seule ou tous risques (null = non renseignée) */
  insurance_coverage: z.enum(['THIRD_PARTY', 'COMPREHENSIVE']).nullable().optional(),
  /** Franchise restant à la charge du client en cas de sinistre (MAD) */
  insurance_excess: z.number().min(0, 'La franchise ne peut pas être négative').max(100000).nullable().optional(),
  min_rental_days: z.coerce.number().int().min(1, 'Durée minimale: 1 jour').default(1),
  status: z.enum(VEHICLE_STATUSES).default('AVAILABLE'),
  published: z.coerce.boolean().default(true),
  license_plate: z.string().trim().optional().default(''),
  unit_number: z.string().trim().optional().default(''),
  /** Présentation rédigée par l'agence ; un texte vide efface la description */
  description: z.string().trim().max(1500, 'Description limitée à 1 500 caractères').nullable().optional(),
  images: z.array(z.string().url('URL image invalide')).default([]),
  features: z.array(z.string().trim()).default([]),
});

type KindFields = {
  vehicle_type?: VehicleType | null;
  category?: string | null;
  seats?: number | null;
  doors?: number | null;
  engine_cc?: number | null;
  license_required?: string | null;
};

/** Incohérences entre le type de véhicule et ses caractéristiques (messages en français) */
export function vehicleKindIssues(vehicle: KindFields): string[] {
  const type: VehicleType = vehicle.vehicle_type ?? 'CAR';
  const issues: string[] = [];
  if (vehicle.category && !categoryMatchesType(vehicle.category, type)) {
    issues.push(
      type === 'MOTORCYCLE'
        ? 'Catégorie invalide pour une moto (Scooter, Roadster, Trail, Sportive ou Custom).'
        : 'Catégorie invalide pour une voiture.'
    );
  }
  if (type === 'MOTORCYCLE') {
    if (vehicle.seats != null && vehicle.seats > 2) issues.push('Une moto compte 1 ou 2 places.');
  } else {
    if (vehicle.seats != null && vehicle.seats < 2) issues.push('Une voiture compte au moins 2 places.');
    if (vehicle.doors != null && vehicle.doors < 2) issues.push('Une voiture compte au moins 2 portes.');
    if (vehicle.engine_cc != null || vehicle.license_required != null) {
      issues.push('La cylindrée et le permis moto ne concernent que les motos.');
    }
  }
  return issues;
}

/**
 * Harmonise les champs propres à chaque type avant l'enregistrement :
 * une moto n'a ni portes ni climatisation ; une voiture n'a ni cylindrée ni permis moto.
 */
export function normalizeVehicleKindFields<T extends KindFields & { air_conditioning?: boolean | null }>(vehicle: T): T {
  if ((vehicle.vehicle_type ?? 'CAR') === 'MOTORCYCLE') {
    return { ...vehicle, doors: 0, air_conditioning: false };
  }
  return { ...vehicle, engine_cc: null, license_required: null };
}

export const vehicleCreateSchema = vehicleBaseSchema.superRefine((vehicle, ctx) => {
  for (const message of vehicleKindIssues(vehicle)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

/** Mise à jour partielle : la cohérence type / catégorie est vérifiée par la route après fusion avec l'existant */
export const vehicleUpdateSchema = vehicleBaseSchema.partial();

/**
 * Ne garde que les champs réellement envoyés par le client.
 * Zod applique les valeurs par défaut même dans un schéma partiel : sans ce filtre, une simple
 * dépublication ({ published: false }) remettait images et équipements à vide.
 */
export function onlyProvidedFields<T extends Record<string, unknown>>(parsed: T, body: unknown): Partial<T> {
  const provided = new Set(body && typeof body === 'object' ? Object.keys(body as Record<string, unknown>) : []);
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => provided.has(key))) as Partial<T>;
}

export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;
