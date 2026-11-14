import { z } from 'zod';
import { emailSchema, moroccanPhoneSchema, optionalMoroccanPhoneSchema } from './auth';

/**
 * Identifiant Commun de l’Entreprise (Maroc) :
 * Exactement 15 chiffres obligatoires.
 */
export const ICE_REGEX = /^\d{15}$/;

/**
 * Registre de Commerce (Maroc) : 1 à 10 chiffres (numéro au tribunal de commerce).
 */
export const RC_REGEX = /^\d{1,10}$/;

export const AGENCY_DOCUMENT_TYPES = [
  'ICE',
  'RC',
  'PATENTE',
  'INSURANCE',
  'RIB',
  'CIN_GERANT',
  'AUTORISATION',
  'OTHER',
] as const;

export const agencyDocumentSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(AGENCY_DOCUMENT_TYPES, {
    message: 'Type de document d’entreprise non reconnu',
  }),
  name: z.string().trim().min(2, 'Le nom du document doit comporter au moins 2 caractères').max(200),
  file_url: z.string().trim().url('URL du document invalide'),
  verified: z.boolean().default(false),
  uploaded_at: z.string().datetime().optional(),
});

export const deliveryRatesSchema = z.object({
  agency_pickup: z.coerce.number().min(0, 'Le tarif ne peut pas être négatif').default(0),
  airport: z.coerce.number().min(0, 'Le tarif ne peut pas être négatif').default(0),
  hotel: z.coerce.number().min(0, 'Le tarif ne peut pas être négatif').default(0),
  address: z.coerce.number().min(0, 'Le tarif ne peut pas être négatif').default(0),
});

export const openingHourSlotSchema = z.object({
  open: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Format d’heure invalide (HH:mm)'),
  close: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Format d’heure invalide (HH:mm)'),
  closed: z.boolean().default(false),
});

export const weeklyOpeningHoursSchema = z.object({
  monday: openingHourSlotSchema.optional(),
  tuesday: openingHourSlotSchema.optional(),
  wednesday: openingHourSlotSchema.optional(),
  thursday: openingHourSlotSchema.optional(),
  friday: openingHourSlotSchema.optional(),
  saturday: openingHourSlotSchema.optional(),
  sunday: openingHourSlotSchema.optional(),
});

/**
 * Formulaire de référencement / création d'agence avec ses identifiants légaux
 */
export const agencyRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Le nom de l’agence doit comporter au moins 2 caractères')
    .max(120, 'Le nom ne doit pas dépasser 120 caractères'),
  ice: z
    .string()
    .trim()
    .regex(ICE_REGEX, 'L’ICE marocain doit comporter exactement 15 chiffres'),
  rc: z
    .string()
    .trim()
    .regex(RC_REGEX, 'Le numéro de Registre de Commerce (RC) est invalide')
    .optional()
    .or(z.literal('')),
  manager_name: z
    .string()
    .trim()
    .min(2, 'Le nom du gérant doit comporter au moins 2 caractères')
    .max(100),
  email: emailSchema,
  phone: moroccanPhoneSchema,
  whatsapp: optionalMoroccanPhoneSchema,
  address: z
    .string()
    .trim()
    .min(5, 'L’adresse doit être suffisamment détaillée (min. 5 caractères)')
    .max(240),
  city: z
    .string()
    .trim()
    .min(2, 'La ville est requise')
    .max(100)
    .default('Nador'),
  region: z
    .string()
    .trim()
    .max(100)
    .default('Oriental'),
  postal_code: z
    .string()
    .trim()
    .max(10)
    .optional()
    .default(''),
  latitude: z.coerce.number().min(-90).max(90).optional().default(35.1688),
  longitude: z.coerce.number().min(-180).max(180).optional().default(-2.9335),
  description: z
    .string()
    .trim()
    .max(2000, 'La description ne doit pas dépasser 2 000 caractères')
    .optional()
    .default(''),
  logo_url: z
    .string()
    .trim()
    .url('URL du logo invalide')
    .or(z.literal(''))
    .optional()
    .default(''),
  banner_url: z
    .string()
    .trim()
    .url('URL de la bannière invalide')
    .or(z.literal(''))
    .optional()
    .default(''),
  documents: z.array(agencyDocumentSchema).default([]),
});

/**
 * Mise à jour du profil agence par son gérant
 */
export const agencyProfileUpdateSchema = agencyRegistrationSchema.partial().extend({
  opening_hours: weeklyOpeningHoursSchema.optional(),
  delivery_rates: deliveryRatesSchema.optional(),
  deposit_terms: z.string().trim().max(1000).optional(),
  cancellation_policy: z.string().trim().max(1000).optional(),
});

export type AgencyDocumentInput = z.infer<typeof agencyDocumentSchema>;
export type AgencyRegistrationInput = z.infer<typeof agencyRegistrationSchema>;
export type AgencyProfileUpdateInput = z.infer<typeof agencyProfileUpdateSchema>;
export type DeliveryRatesInput = z.infer<typeof deliveryRatesSchema>;
export type WeeklyOpeningHoursInput = z.infer<typeof weeklyOpeningHoursSchema>;

