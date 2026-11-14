export const USER_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT',
  'AGENCY_OWNER',
  'AGENCY_MANAGER',
  'AGENCY_STAFF',
  'CUSTOMER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const AGENCY_MEMBER_ROLES = [
  'agency_admin',
  'agency_manager',
  'agency_agent',
  'viewer',
] as const;

export type AgencyMemberRole = (typeof AGENCY_MEMBER_ROLES)[number];

export const ACCESS_PERMISSIONS = [
  'agencies.read',
  'agencies.create',
  'agencies.update',
  'agencies.suspend',
  'agencies.delete',
  'members.read',
  'members.invite',
  'members.update_role',
  'members.revoke',
  'vehicles.read',
  'vehicles.manage',
  'bookings.read',
  'bookings.manage',
  'customers.read',
  'reports.read',
  // Suivi GPS : jamais accordé implicitement à un Super Admin (accès de support explicite et journalisé)
  'tracking.read',
  'tracking.manage',
  'tracking.alerts.manage',
  'tracking.settings.manage',
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];

export const TRACKING_PERMISSIONS = [
  'tracking.read',
  'tracking.manage',
  'tracking.alerts.manage',
  'tracking.settings.manage',
] as const satisfies readonly AccessPermission[];

export type TrackingPermission = (typeof TRACKING_PERMISSIONS)[number];

/**
 * Miroir TypeScript de la matrice `role_permissions` (migration 20261119000100) : sert à l'interface
 * (affichage de la navigation) et aux tests de parité. La sécurité réelle est appliquée par la base
 * (fonction has_tracking_permission), jamais par cette table.
 */
export const AGENCY_ROLE_TRACKING_PERMISSIONS: Record<AgencyMemberRole, readonly TrackingPermission[]> = {
  agency_admin: ['tracking.read', 'tracking.manage', 'tracking.alerts.manage', 'tracking.settings.manage'],
  agency_manager: ['tracking.read', 'tracking.manage', 'tracking.alerts.manage'],
  agency_agent: [],
  viewer: [],
};

export const AGENCY_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
export type AgencyStatus = (typeof AGENCY_STATUSES)[number];
