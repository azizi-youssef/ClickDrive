import { z } from 'zod';
import { emailSchema, moroccanPhoneSchema, optionalMoroccanPhoneSchema } from './auth';

/**
 * Numéro de CIN marocain : 1 ou 2 lettres suivies de 5 à 7 chiffres
 * Exemples : AB123456, U123456, BK12345
 */
export const MOROCCAN_CIN_REGEX = /^[A-Z]{1,2}\d{5,7}$/i;

/**
 * Numéro de passeport international (pour les résidents étrangers ou MRE) :
 * 6 à 12 caractères alphanumériques
 */
export const PASSPORT_REGEX = /^[A-Z0-9]{6,12}$/i;

/**
 * Vérifie si une chaîne correspond à un document d'identité valide (CIN marocaine ou passeport)
 */
export const IDENTITY_DOCUMENT_REGEX = /^(?:[A-Z]{1,2}\d{5,7}|[A-Z0-9]{6,12})$/i;

/**
 * Numéro de permis de conduire marocain ou international
 * Exemple marocain : 25/123456 ou format standard alphanumérique
 */
export const DRIVING_LICENSE_REGEX = /^(?:\d{2}\/\d{5,8}|[A-Z0-9/-]{5,20})$/i;

/**
 * Calcule l'âge en années révolues à partir d'une date de naissance (AAAA-MM-JJ)
 */
export function calculateAge(birthDateString: string): number {
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export const customerIdentitySchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'Le prénom doit contenir au moins 2 caractères')
      .max(80, 'Le prénom ne doit pas dépasser 80 caractères'),
    lastName: z
      .string()
      .trim()
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(80, 'Le nom ne doit pas dépasser 80 caractères'),
    cin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        IDENTITY_DOCUMENT_REGEX,
        'Numéro de document d’identité invalide (CIN marocaine ex: AB123456 ou numéro de passeport)'
      ),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance requise (AAAA-MM-JJ)'),
    licenseNumber: z
      .string()
      .trim()
      .regex(DRIVING_LICENSE_REGEX, 'Numéro de permis de conduire invalide (ex: 25/123456)'),
    licenseExpiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date d’expiration du permis requise (AAAA-MM-JJ)')
      .optional()
      .or(z.literal('')),
    nationality: z.string().trim().min(2).max(60).default('Maroc'),
    phone: moroccanPhoneSchema,
    email: emailSchema.optional().or(z.literal('')),
  })
  .refine((data) => calculateAge(data.birthDate) >= 21, {
    message: 'Le conducteur principal doit être âgé d’au moins 21 ans pour louer un véhicule',
    path: ['birthDate'],
  })
  .refine(
    (data) => {
      if (!data.licenseExpiry) return true;
      return new Date(data.licenseExpiry) > new Date();
    },
    {
      message: 'Le permis de conduire est expiré',
      path: ['licenseExpiry'],
    }
  );

export const customerDocumentUploadSchema = z.object({
  customerId: z.string().uuid().optional(),
  documentType: z.enum(['CIN_FRONT', 'CIN_BACK', 'PASSPORT', 'LICENSE_FRONT', 'LICENSE_BACK']),
  fileUrl: z.string().url('URL du fichier invalide'),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'La taille du fichier ne doit pas dépasser 10 Mo'),
});

export const customerProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  phone: optionalMoroccanPhoneSchema,
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
});

export type CustomerIdentityInput = z.infer<typeof customerIdentitySchema>;
export type CustomerDocumentUploadInput = z.infer<typeof customerDocumentUploadSchema>;
export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateSchema>;

