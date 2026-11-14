import type { BookingStatus } from './booking-status';
import { normalizeBookingStatus } from './booking-status';

export type BookingActorRole =
  | 'CUSTOMER'
  | 'AGENCY_OWNER'
  | 'AGENCY_MANAGER'
  | 'AGENCY_STAFF'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'SUPPORT'
  | 'SYSTEM';

export type AgencyBookingAction = 'approve' | 'reject' | 'propose_alternative';

const AGENCY_ACTION_FROM: Record<AgencyBookingAction, BookingStatus[]> = {
  approve: ['REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'PENDING'],
  reject: ['REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED', 'PENDING'],
  propose_alternative: ['REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'PENDING'],
};

const AGENCY_ACTION_TO: Record<AgencyBookingAction, BookingStatus> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  propose_alternative: 'ALTERNATIVE_PROPOSED',
};

export function canPerformAgencyBookingAction(
  currentStatus: string,
  action: AgencyBookingAction
): boolean {
  const normalized = normalizeBookingStatus(currentStatus);
  const allowed = AGENCY_ACTION_FROM[action];
  return allowed.includes(normalized as BookingStatus);
}

export function targetStatusForAgencyAction(action: AgencyBookingAction): BookingStatus {
  return AGENCY_ACTION_TO[action];
}

/** Remise (départ) et restitution (retour) du véhicule, avec état des lieux */
export type HandoverAction = 'pickup' | 'return';

const HANDOVER_FROM: Record<HandoverAction, BookingStatus[]> = {
  // Remise : seulement une réservation validée par l'agence et pas encore commencée
  pickup: ['APPROVED', 'READY_FOR_PICKUP'],
  // Restitution : seulement une location en cours
  return: ['ACTIVE'],
};

const HANDOVER_TO: Record<HandoverAction, BookingStatus> = {
  pickup: 'ACTIVE',
  return: 'COMPLETED',
};

/**
 * Une remise ou une restitution n'est possible que depuis les statuts prévus (statuts historiques normalisés :
 * CONFIRMED vaut APPROVED). Jamais depuis une demande non validée, refusée, annulée, expirée ou terminée.
 */
export function canPerformHandover(currentStatus: string, action: HandoverAction): boolean {
  const normalized = normalizeBookingStatus(currentStatus);
  return HANDOVER_FROM[action].includes(normalized as BookingStatus);
}

export function targetStatusForHandover(action: HandoverAction): BookingStatus {
  return HANDOVER_TO[action];
}

/**
 * Droits globaux plateforme : uniquement SUPER_ADMIN (ACCESS_CONTROL.md).
 * Le rôle historique ADMIN n'obtient aucun droit global : il doit être promu SUPER_ADMIN
 * par une opération d'administration de confiance, après vérification d'identité.
 */
export function isPlatformAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN';
}

/** Rôle historique, conservé pour l'affichage et la migration des comptes ; sans droit global. */
export function isLegacyAdminRole(role: string): boolean {
  return role === 'ADMIN';
}

export function isPlatformStaffRole(role: string): boolean {
  return isPlatformAdminRole(role) || role === 'SUPPORT';
}

export function isAgencyRole(role: string): boolean {
  return role === 'AGENCY_OWNER' || role === 'AGENCY_MANAGER' || role === 'AGENCY_STAFF';
}
