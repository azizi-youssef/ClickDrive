import { vehicleUpdateSchema } from '@/lib/validations/vehicle';

/**
 * Champs d'un véhicule que l'API flotte n'accepte pas du navigateur.
 *
 * - immuables : identité et rattachement (`agency_id` ne change jamais par une mise à jour) ;
 * - plateforme : mise en avant payante, notes, documents — réservés à l'administration ClickDrive.
 *
 * Les champs modifiables par un membre `vehicles.manage` (statut, publication, tarifs…) sont ceux du
 * schéma Zod partagé (`vehicleUpdateSchema`, version partielle du schéma de création).
 */
export const IMMUTABLE_VEHICLE_FIELDS = ['id', 'agency_id', 'slug', 'created_at', 'updated_at', 'archived_at'] as const;
export const PLATFORM_VEHICLE_FIELDS = ['featured', 'rating', 'review_count', 'documents'] as const;

export const EDITABLE_VEHICLE_FIELDS: readonly string[] = Object.keys(vehicleUpdateSchema.shape);

export type VehicleFieldViolation = { field: string; reason: 'immutable' | 'platform' | 'unknown' };

const IMMUTABLE = new Set<string>(IMMUTABLE_VEHICLE_FIELDS);
const PLATFORM = new Set<string>(PLATFORM_VEHICLE_FIELDS);
const EDITABLE = new Set<string>(EDITABLE_VEHICLE_FIELDS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Champs protégés comparés à la valeur actuelle dans la route canonique. Les horodatages et les notes
 * (`created_at`, `updated_at`, `rating`, `review_count`) sont calculés par le serveur, peuvent changer pendant
 * l'édition et ne sont jamais écrits depuis le corps de requête : ils sont simplement ignorés.
 */
const COMPARED_ON_WRITE = ['id', 'agency_id', 'slug', 'archived_at', 'featured', 'documents'] as const;

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === false;
}

function sameValue(a: unknown, b: unknown): boolean {
  // null, undefined et false sont équivalents (ex. featured absent = non mis en avant)
  if (isEmpty(a) && isEmpty(b)) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function reasonFor(field: string): VehicleFieldViolation['reason'] {
  if (PLATFORM.has(field)) return 'platform';
  if (IMMUTABLE.has(field)) return 'immutable';
  return 'unknown';
}

/**
 * Formulaire de l'espace agence : il renvoie la ligne lue (avec id, agency_id, featured…).
 * Un champ protégé est toléré seulement s'il est identique à la valeur actuelle ; toute tentative de
 * modification est une violation. Les autres champs inconnus restent ignorés par le schéma Zod.
 */
export function protectedFieldChanges(body: unknown, current: Record<string, unknown>): VehicleFieldViolation[] {
  if (!isPlainObject(body)) return [];
  const violations: VehicleFieldViolation[] = [];
  for (const field of COMPARED_ON_WRITE) {
    if (field in body && !sameValue(body[field], current[field])) {
      violations.push({ field, reason: reasonFor(field) });
    }
  }
  return violations;
}

/**
 * Routes historiques (/api/vehicles) : liste blanche stricte. Tout champ hors du schéma partagé
 * (sauf `allowed`) est refusé, qu'il soit protégé ou inconnu.
 */
export function unexpectedVehicleFields(body: Record<string, unknown>, allowed: readonly string[] = []): VehicleFieldViolation[] {
  const extra = new Set(allowed);
  return Object.keys(body)
    .filter((field) => !EDITABLE.has(field) && !extra.has(field))
    .map((field) => ({ field, reason: reasonFor(field) }));
}

/** Réponse d'erreur : 403 pour un champ réservé à la plateforme, 400 sinon */
export function violationResponseInit(violations: VehicleFieldViolation[]): { status: number; message: string } {
  const fields = violations.map((violation) => violation.field).join(', ');
  if (violations.some((violation) => violation.reason === 'platform')) {
    return { status: 403, message: `Champ réservé à l'administration de la plateforme : ${fields}.` };
  }
  if (violations.some((violation) => violation.reason === 'immutable')) {
    return { status: 400, message: `Champ non modifiable : ${fields}.` };
  }
  return { status: 400, message: `Champ inconnu : ${fields}.` };
}
