import { z } from 'zod';

export const PAYMENT_CURRENCIES = ['MAD', 'EUR', 'USD'] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const PAYMENT_METHODS = [
  'CASH',
  'CREDIT_CARD',
  'CMI',
  'BANK_TRANSFER',
  'STRIPE',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'REFUNDED',
  'FAILED',
  'CANCELLED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const COMMISSION_STATUSES = [
  'PENDING',
  'DUE',
  'COLLECTED',
  'WAIVED',
] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const DEPOSIT_STATUSES = [
  'HELD',
  'RELEASED',
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Montant monétaire positif avec 2 décimales au maximum */
export const monetaryAmountSchema = z.coerce
  .number()
  .positive('Le montant doit être strictement supérieur à 0')
  .max(1_000_000, 'Montant supérieur au plafond autorisé')
  .refine((val) => Number(val.toFixed(2)) === val, {
    message: 'Le montant ne peut pas comporter plus de 2 décimales',
  });

export const createPaymentSchema = z.object({
  bookingId: z.string().regex(UUID_REGEX, 'Identifiant de réservation invalide (UUID requis)'),
  agencyId: z.string().regex(UUID_REGEX, 'Identifiant agence invalide (UUID requis)'),
  amount: monetaryAmountSchema,
  currency: z.enum(PAYMENT_CURRENCIES).default('MAD'),
  paymentMethod: z.enum(PAYMENT_METHODS, {
    message: 'Méthode de paiement invalide',
  }),
  transactionReference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updatePaymentStatusSchema = z.object({
  paymentId: z.string().regex(UUID_REGEX, 'Identifiant de paiement invalide (UUID requis)'),
  status: z.enum(PAYMENT_STATUSES, {
    message: 'Statut de paiement invalide',
  }),
  transactionReference: z.string().trim().max(100).optional(),
  failureReason: z.string().trim().max(500).optional(),
});

export const depositManagementSchema = z.object({
  bookingId: z.string().regex(UUID_REGEX, 'Identifiant de réservation invalide'),
  depositAmount: z.coerce.number().min(0, 'Le montant de la caution ne peut pas être négatif'),
  status: z.enum(DEPOSIT_STATUSES),
  deductedAmount: z.coerce.number().min(0).optional().default(0),
  deductionReason: z.string().trim().max(500).optional(),
});

export const commissionSettingsSchema = z.object({
  agencyId: z.string().regex(UUID_REGEX, 'Identifiant agence invalide').optional(),
  commissionRatePercent: z.coerce
    .number()
    .min(0, 'Le taux de commission ne peut pas être négatif')
    .max(100, 'Le taux de commission ne peut pas dépasser 100%'),
  minCommissionMad: z.coerce
    .number()
    .min(0, 'La commission minimale ne peut pas être négative')
    .default(0),
});

export const commissionStatusUpdateSchema = z.object({
  bookingId: z.string().regex(UUID_REGEX, 'Identifiant de réservation invalide'),
  commissionStatus: z.enum(COMMISSION_STATUSES),
  amountMad: monetaryAmountSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type DepositManagementInput = z.infer<typeof depositManagementSchema>;
export type CommissionSettingsInput = z.infer<typeof commissionSettingsSchema>;
export type CommissionStatusUpdateInput = z.infer<typeof commissionStatusUpdateSchema>;

