import { z } from 'zod';

export const CONTACT_CATEGORIES = ['reservation', 'agency-partner', 'vehicle', 'technical', 'billing', 'other'] as const;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : null));

/** Message du formulaire /contact (mêmes bornes que la table contact_messages) */
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Le nom est requis').max(120, 'Le nom est trop long'),
  email: z.string().trim().max(254, 'Adresse e-mail trop longue').email('Adresse e-mail invalide'),
  phone: z
    .string()
    .trim()
    .max(30, 'Numéro de téléphone trop long')
    .regex(/^[+0-9 ().-]*$/, 'Numéro de téléphone invalide')
    .optional()
    .transform((value) => (value ? value : null)),
  category: z.enum(CONTACT_CATEGORIES, { message: 'Veuillez choisir une catégorie' }),
  subject: optionalText(150, 'L’objet est trop long'),
  message: z
    .string()
    .trim()
    .min(20, 'Le message doit contenir au moins 20 caractères')
    .max(5000, 'Le message ne doit pas dépasser 5 000 caractères'),
  /** Langue de la page du formulaire : celle de l'accusé de réception (non enregistrée) */
  locale: z.enum(['fr', 'ar', 'en', 'de', 'es', 'nl']).optional(),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
