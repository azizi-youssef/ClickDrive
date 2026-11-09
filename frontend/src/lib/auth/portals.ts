import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { type UserRole } from '@clickdrive/shared/roles';

/** Accès portail /admin : SUPER_ADMIN uniquement (le rôle historique ADMIN n'a pas de droit global). */
export function canAccessAdminPortal(role: string): boolean {
  return isPlatformAdminRole(role);
}

/** Accès portail /agency (membre agence, rôle agence, ou admin plateforme). */
export function canAccessAgencyPortal(role: string, agencyIds: string[]): boolean {
  if (isPlatformAdminRole(role)) return true;
  return agencyIds.length > 0;
}

export function agencyRoleLabel(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super administrateur';
    case 'ADMIN':
      return 'Administrateur';
    case 'AGENCY_OWNER':
      return 'Propriétaire agence';
    case 'AGENCY_MANAGER':
      return 'Manager agence';
    case 'AGENCY_STAFF':
      return 'Agent agence';
    default:
      return 'Utilisateur';
  }
}

/** Permissions fines côté agence (UI + garde API). */
export function canManageAgencyFleet(role: UserRole): boolean {
  return (
    role === 'AGENCY_OWNER' ||
    role === 'AGENCY_MANAGER' ||
    role === 'SUPER_ADMIN'
  );
}

export function canManageAgencyBookings(role: UserRole): boolean {
  return canManageAgencyFleet(role) || role === 'AGENCY_STAFF';
}
