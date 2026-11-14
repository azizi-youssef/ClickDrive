import { z } from 'zod';

/**
 * Expression régulière pour les numéros marocains :
 * Accepte les formats :
 * - +212 612 345 678, +212612345678
 * - 00212 612 345 678, 00212612345678
 * - 0612345678, 0712345678, 0512345678 (avec ou sans espaces/tirets)
 * Préfixes autorisés après l'indicatif : 5 (fixe), 6 (mobile), 7 (mobile)
 */
export const MOROCCAN_PHONE_REGEX = /^(?:(?:\+|00)212\s*|0)[5-7](?:[ -]?\d{2}){4}$/;

/**
 * Normalise un numéro marocain au format canonique international +212XXXXXXXXX
 */
export function normalizeMoroccanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s.-]/g, '');
  if (cleaned.startsWith('+212')) return cleaned;
  if (cleaned.startsWith('00212')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('0')) return `+212${cleaned.slice(1)}`;
  return `+212${cleaned}`;
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'L’adresse e-mail est requise')
  .max(254, 'L’adresse e-mail ne doit pas dépasser 254 caractères')
  .email('Adresse e-mail invalide')
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit comporter au moins 8 caractères')
  .max(128, 'Le mot de passe ne doit pas dépasser 128 caractères')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une lettre majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre');

export const moroccanPhoneSchema = z
  .string()
  .trim()
  .regex(MOROCCAN_PHONE_REGEX, 'Numéro de téléphone marocain invalide (ex: 0612345678 ou +212612345678)')
  .transform(normalizeMoroccanPhone);

export const optionalMoroccanPhoneSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((val) => (val && val.length > 0 ? val : undefined))
  .pipe(
    z
      .string()
      .regex(MOROCCAN_PHONE_REGEX, 'Numéro de téléphone marocain invalide (ex: 0612345678 ou +212612345678)')
      .transform(normalizeMoroccanPhone)
      .optional()
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis'),
  portal: z.enum(['client', 'agency', 'admin']).default('client'),
  rememberMe: z.boolean().default(false),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Le nom complet doit comporter au moins 2 caractères')
      .max(100, 'Le nom complet ne doit pas dépasser 100 caractères'),
    email: emailSchema,
    phone: optionalMoroccanPhoneSchema,
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Veuillez confirmer votre mot de passe'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['passwordConfirmation'],
  });

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
    newPassword: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Veuillez confirmer votre nouveau mot de passe'),
  })
  .refine((data) => data.newPassword === data.passwordConfirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['passwordConfirmation'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Le nouveau mot de passe doit être différent de l’ancien',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
