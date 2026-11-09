import { z } from 'zod';
import { BOOKING_STATUSES } from '@clickdrive/shared/booking-status';

export const agencyInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Le slug doit être en minuscules, sans espaces.'),
  description: z.string().trim().max(2000).default(''),
  phone: z.string().trim().min(6).max(40),
  whatsapp: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(254),
  address: z.string().trim().min(2).max(240),
  city: z.string().trim().min(2).max(100),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  logo_url: z.string().trim().url().max(2048).or(z.literal('')).default(''),
  banner_url: z.string().trim().url().max(2048).or(z.literal('')).default(''),
});

export const agencyPatchSchema = agencyInputSchema.partial().extend({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']).optional(),
  verified: z.boolean().optional(),
});

export const createAgencyWithAuthSchema = z.object({
  name: z.string().trim().min(2, 'Le nom commercial doit contenir au moins 2 caractères.').max(120),
  manager_name: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().min(6, 'Numéro de téléphone requis.').max(40),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Adresse email invalide.').max(254),
  password: z.string().trim().min(8, 'Le mot de passe temporaire doit comporter au moins 8 caractères.').optional(),
  address: z.string().trim().min(2, 'L’adresse complète est requise.').max(240),
  city: z.string().trim().min(2, 'La ville est requise.').max(100).default('Nador'),
  region: z.string().trim().max(100).default('Oriental'),
  latitude: z.number().min(-90).max(90).optional().default(35.1688),
  longitude: z.number().min(-180).max(180).optional().default(-2.9335),
  status: z.enum(['ACTIVE', 'PENDING']).default('ACTIVE'),
  description: z.string().trim().max(2000).optional().default(''),
  logo_url: z.string().trim().url().or(z.literal('')).optional().default(''),
});

export const resetAgencyPasswordSchema = z.object({
  password: z.string().trim().min(8, 'Le mot de passe doit comporter au moins 8 caractères.').optional(),
});

export const agencyMemberRoleSchema = z.enum([
  'agency_admin',
  'agency_manager',
  'agency_agent',
  'viewer',
]);

export const agencyInviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: agencyMemberRoleSchema,
});

export const agencyMemberRoleUpdateSchema = z.object({
  role: agencyMemberRoleSchema,
});

export const agencyArchiveSchema = z.object({
  confirmationName: z.string().trim().min(2).max(120),
});

export const agencyCustomerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).default(''),
  status: z.enum(BOOKING_STATUSES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
