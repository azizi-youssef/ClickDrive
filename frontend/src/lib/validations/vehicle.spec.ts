import { describe, it, expect } from 'vitest';
import {
  MOROCCAN_PLATE_REGEX,
  vehiclePricingIssues,
  vehicleAvailabilitySchema,
  vehicleCreateSchema,
} from './vehicle';

describe('Vehicle Validations', () => {
  describe('MOROCCAN_PLATE_REGEX', () => {
    it('accepts standard Moroccan plate formats', () => {
      expect(MOROCCAN_PLATE_REGEX.test('12345-A-50')).toBe(true);
      expect(MOROCCAN_PLATE_REGEX.test('12345|A|50')).toBe(true);
      expect(MOROCCAN_PLATE_REGEX.test('12345/A/50')).toBe(true);
      expect(MOROCCAN_PLATE_REGEX.test('12345-أ-50')).toBe(true);
      expect(MOROCCAN_PLATE_REGEX.test('123456 RS')).toBe(true);
      expect(MOROCCAN_PLATE_REGEX.test('WW-123456')).toBe(true);
    });
  });

  describe('vehiclePricingIssues', () => {
    it('detects when weekly price exceeds 7x daily price', () => {
      const issues = vehiclePricingIssues({
        daily_price: 300,
        weekly_price: 2500, // 300 * 7 = 2100 < 2500
      });
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('tarif à la semaine ne peut pas excéder 7 fois');
    });

    it('detects when monthly price exceeds 30x daily price', () => {
      const issues = vehiclePricingIssues({
        daily_price: 300,
        monthly_price: 10000, // 300 * 30 = 9000 < 10000
      });
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('tarif mensuel ne peut pas excéder 30 fois');
    });

    it('passes for consistent pricing', () => {
      const issues = vehiclePricingIssues({
        daily_price: 300,
        weekly_price: 1800, // discount
        monthly_price: 7000, // discount
      });
      expect(issues.length).toBe(0);
    });
  });

  describe('vehicleAvailabilitySchema', () => {
    it('accepts valid date range', () => {
      const res = vehicleAvailabilitySchema.safeParse({
        status: 'MAINTENANCE',
        from: '2026-06-01',
        to: '2026-06-05',
        reason: 'Vidange et révision générale',
      });
      expect(res.success).toBe(true);
    });

    it('rejects when to date is before from date', () => {
      const res = vehicleAvailabilitySchema.safeParse({
        status: 'BLOCKED',
        from: '2026-06-10',
        to: '2026-06-05',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('postérieure ou égale');
      }
    });
  });

  describe('vehicleCreateSchema with pricing check', () => {
    it('validates a complete valid car creation payload', () => {
      const res = vehicleCreateSchema.safeParse({
        vehicle_type: 'CAR',
        brand: 'dacia',
        model: 'Logan',
        year: 2024,
        category: 'Berline',
        transmission: 'MANUAL',
        fuel: 'DIESEL',
        daily_price: 250,
        weekly_price: 1500,
        monthly_price: 5500,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.brand).toBe('Dacia');
      }
    });

    it('fails when car has inconsistent weekly pricing', () => {
      const res = vehicleCreateSchema.safeParse({
        vehicle_type: 'CAR',
        brand: 'Renault',
        model: 'Clio',
        year: 2023,
        category: 'Compacte',
        transmission: 'MANUAL',
        fuel: 'DIESEL',
        daily_price: 200,
        weekly_price: 2000, // > 7 * 200
      });
      expect(res.success).toBe(false);
    });
  });
});
