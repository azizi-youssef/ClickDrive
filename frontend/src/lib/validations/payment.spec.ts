import { describe, it, expect } from 'vitest';
import {
  monetaryAmountSchema,
  createPaymentSchema,
  updatePaymentStatusSchema,
  commissionSettingsSchema,
} from './payment';

describe('Payment Validations', () => {
  describe('monetaryAmountSchema', () => {
    it('accepts positive numbers with up to 2 decimals', () => {
      expect(monetaryAmountSchema.safeParse(350).success).toBe(true);
      expect(monetaryAmountSchema.safeParse('499.50').success).toBe(true);
      expect(monetaryAmountSchema.safeParse(120.99).success).toBe(true);
    });

    it('rejects 0 or negative numbers', () => {
      expect(monetaryAmountSchema.safeParse(0).success).toBe(false);
      expect(monetaryAmountSchema.safeParse(-50).success).toBe(false);
    });

    it('rejects numbers with more than 2 decimal places', () => {
      const res = monetaryAmountSchema.safeParse(12.345);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('2 décimales');
      }
    });
  });

  describe('createPaymentSchema', () => {
    it('accepts valid payment in MAD with supported payment method', () => {
      const res = createPaymentSchema.safeParse({
        bookingId: '123e4567-e89b-12d3-a456-426614174000',
        agencyId: '223e4567-e89b-12d3-a456-426614174000',
        amount: '1200.00',
        paymentMethod: 'CREDIT_CARD',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.currency).toBe('MAD');
        expect(res.data.amount).toBe(1200);
      }
    });

    it('rejects unsupported currency or payment method', () => {
      const res = createPaymentSchema.safeParse({
        bookingId: '123e4567-e89b-12d3-a456-426614174000',
        agencyId: '223e4567-e89b-12d3-a456-426614174000',
        amount: 500,
        currency: 'BITCOIN',
        paymentMethod: 'BARTER',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('updatePaymentStatusSchema', () => {
    it('accepts status updates with optional transaction reference', () => {
      const res = updatePaymentStatusSchema.safeParse({
        paymentId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PAID',
        transactionReference: 'CMI-TX-998877',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('commissionSettingsSchema', () => {
    it('validates commission percentages between 0 and 100', () => {
      expect(
        commissionSettingsSchema.safeParse({
          commissionRatePercent: 15,
        }).success
      ).toBe(true);

      expect(
        commissionSettingsSchema.safeParse({
          commissionRatePercent: 120, // > 100%
        }).success
      ).toBe(false);
    });
  });
});

