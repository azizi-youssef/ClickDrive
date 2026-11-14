import { z } from 'zod';
import {
  USER_ROLES,
  AGENCY_MEMBER_ROLES,
  ACCESS_PERMISSIONS,
  AGENCY_STATUSES,
  type UserRole,
  type AgencyMemberRole,
  type AccessPermission,
  type AgencyStatus,
} from '@clickdrive/shared/roles';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const userRoleEnum = z.enum(USER_ROLES as unknown as [UserRole, ...UserRole[]]);
export const agencyMemberRoleEnum = z.enum(AGENCY_MEMBER_ROLES as unknown as [AgencyMemberRole, ...AgencyMemberRole[]]);
export const accessPermissionEnum = z.enum(ACCESS_PERMISSIONS as unknown as [AccessPermission, ...AccessPermission[]]);
export const agencyStatusEnum = z.enum(AGENCY_STATUSES as unknown as [AgencyStatus, ...AgencyStatus[]]);

export const ADMIN_ACTION_TYPES = [
  'ROLE_CHANGE',
  'AGENCY_STATUS_CHANGE',
  'VEHICLE_OVERRIDE',
  'BOOKING_FORCE_STATUS',
  'COMMISSION_OVERRIDE',
  'SYSTEM_SETTINGS_UPDATE',
] as const;
export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];

export const adminRoleAssignmentSchema = z.object({
  targetUserId: z.string().regex(UUID_REGEX, 'Identifiant utilisateur invalide (UUID requis)'),
  role: userRoleEnum,
  reason: z
    .string()
    .trim()
    .min(5, 'Le motif du changement de rôle doit comporter au moins 5 caractères')
    .max(500, 'Le motif ne doit pas dépasser 500 caractères'),
});

export const adminAgencyActionSchema = z.object({
  agencyId: z.string().regex(UUID_REGEX, 'Identifiant agence invalide (UUID requis)'),
  status: agencyStatusEnum,
  reason: z
    .string()
    .trim()
    .min(5, 'Le motif de la décision doit comporter au moins 5 caractères')
    .max(1000, 'Le motif ne doit pas dépasser 1 000 caractères'),
  notifyAgency: z.boolean().default(true),
});

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().regex(UUID_REGEX).optional(),
  actionType: z.enum(ADMIN_ACTION_TYPES).optional(),
  targetId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)').optional(),
});

export const adminPlatformConfigSchema = z.object({
  maintenanceMode: z.boolean().default(false),
  registrationsEnabled: z.boolean().default(true),
  defaultCommissionRate: z.coerce.number().min(0).max(100).default(15),
  supportPhone: z.string().trim().optional(),
  supportEmail: z.string().trim().email().optional(),
  emergencyBanner: z
    .object({
      enabled: z.boolean().default(false),
      messageFr: z.string().trim().max(300).optional(),
      messageAr: z.string().trim().max(300).optional(),
      severity: z.enum(['INFO', 'WARNING', 'DANGER']).default('INFO'),
    })
    .optional(),
});

export type AdminRoleAssignmentInput = z.infer<typeof adminRoleAssignmentSchema>;
export type AdminAgencyActionInput = z.infer<typeof adminAgencyActionSchema>;
export type AdminAuditQueryInput = z.infer<typeof adminAuditQuerySchema>;
export type AdminPlatformConfigInput = z.infer<typeof adminPlatformConfigSchema>;
