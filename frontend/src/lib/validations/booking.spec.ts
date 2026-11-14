import { describe, it, expect } from 'vitest';
import {
  bookingDatesSchema,
  bookingAvailabilityCheckSchema,
  bookingCancellationSchema,
} from './booking';

describe('Booking Validations', () => {
  describe('bookingDatesSchema', () => {
    it('accepts valid start and end dates', () => {
      const res = bookingDatesSchema.safeParse({
        startDate: '2026-07-01',
        endDate: '2026-07-07',
        pickupTime: '10:00',
        dropoffTime: '18:00',
      });
      expect(res.success).toBe(true);
    });

    it('rejects when return date is before start date', () => {
      const res = bookingDatesSchema.safeParse({
        startDate: '2026-07-10',
        endDate: '2026-07-05',
        pickupTime: '10:00',
        dropoffTime: '10:00',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('postérieure à la date de début');
      }
    });

    it('rejects rentals longer than 90 days', () => {
      const res = bookingDatesSchema.safeParse({
        startDate: '2026-01-01',
        endDate: '2026-05-01', // ~120 days
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('maximale est de 90 jours');
      }
    });
  });

  describe('bookingAvailabilityCheckSchema', () => {
    it('validates UUID vehicleId and date format', () => {
      const res = bookingAvailabilityCheckSchema.safeParse({
        vehicleId: '123e4567-e89b-12d3-a456-426614174000',
        startDate: '2026-08-01',
        endDate: '2026-08-10',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid vehicle UUID', () => {
      const res = bookingAvailabilityCheckSchema.safeParse({
        vehicleId: 'invalid-id',
        startDate: '2026-08-01',
        endDate: '2026-08-10',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('bookingCancellationSchema', () => {
    it('accepts well-formed cancellation reason', () => {
      const res = bookingCancellationSchema.safeParse({
        reason: 'Imprévu familial de dernière minute',
        notifyCustomer: true,
      });
      expect(res.success).toBe(true);
    });

    it('rejects too short reason', () => {
      const res = bookingCancellationSchema.safeParse({
        reason: 'Non',
      });
      expect(res.success).toBe(false);
    });
  });
});

