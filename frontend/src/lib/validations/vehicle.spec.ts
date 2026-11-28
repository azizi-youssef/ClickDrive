import { describe, it, expect } from 'vitest';
import {
  MOROCCAN_PLATE_REGEX,
  vehiclePricingIssues,
  vehicleAvailabilitySchema,
  vehicleCreateSchema,
  vehicleKindIssues,
} from './vehicle';
import { defaultLicenseForEngineCc, isLicenseConsistentWithEngineCc } from '@/lib/vehicles/kind';

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
  describe('Motos : cohérence cylindrée ↔ permis', () => {
    const moto = {
      vehicle_type: 'MOTORCYCLE' as const,
      brand: 'Yamaha',
      model: 'MT-09',
      year: 2025,
      category: 'Roadster',
      transmission: 'MANUAL',
      fuel: 'GASOLINE',
      seats: 2,
      daily_price: 250,
      deposit: 5000,
    };

    it('accepte les fiches corrigées (Yamaha MT-09 890 cm³ et BMW R 1300 RS 1300 cm³, permis A)', () => {
      expect(vehicleCreateSchema.safeParse({ ...moto, engine_cc: 890, license_required: 'A' }).success).toBe(true);
      expect(
        vehicleCreateSchema.safeParse({ ...moto, brand: 'BMW', model: 'R 1300 RS', category: 'Sportive', engine_cc: 1300, license_required: 'A' }).success
      ).toBe(true);
    });

    it('refuse une grosse cylindrée avec un permis A1 (erreur de la fiche MT-09 « 125 cm³ / A1 » inversée)', () => {
      const result = vehicleCreateSchema.safeParse({ ...moto, engine_cc: 890, license_required: 'A1' });
      expect(result.success).toBe(false);
      expect(vehicleKindIssues({ ...moto, engine_cc: 890, license_required: 'A1' })[0]).toContain('A2 ou A');
    });

    it('refuse une 125 cm³ avec un permis A ou A2, accepte A1', () => {
      expect(vehicleKindIssues({ ...moto, engine_cc: 125, license_required: 'A' })).toHaveLength(1);
      expect(vehicleKindIssues({ ...moto, engine_cc: 125, license_required: 'A2' })).toHaveLength(1);
      expect(vehicleKindIssues({ ...moto, engine_cc: 125, license_required: 'A1' })).toEqual([]);
    });

    it('cyclomoteur ≤ 50 cm³ : AM, A1 ou B', () => {
      for (const license of ['AM', 'A1', 'B']) expect(isLicenseConsistentWithEngineCc(50, license)).toBe(true);
      expect(isLicenseConsistentWithEngineCc(50, 'A')).toBe(false);
    });

    it('sans cylindrée ou sans permis, aucune incohérence signalée (moto électrique, fiche incomplète)', () => {
      expect(isLicenseConsistentWithEngineCc(null, 'A1')).toBe(true);
      expect(isLicenseConsistentWithEngineCc(890, null)).toBe(true);
    });

    it('permis proposé par défaut selon la cylindrée', () => {
      expect(defaultLicenseForEngineCc(49)).toBe('AM');
      expect(defaultLicenseForEngineCc(125)).toBe('A1');
      expect(defaultLicenseForEngineCc(126)).toBe('A');
    });

    it('prix > 0, caution ≥ 0 et année plausible', () => {
      expect(vehicleCreateSchema.safeParse({ ...moto, engine_cc: 890, license_required: 'A', daily_price: 0 }).success).toBe(false);
      expect(vehicleCreateSchema.safeParse({ ...moto, engine_cc: 890, license_required: 'A', deposit: -1 }).success).toBe(false);
      expect(vehicleCreateSchema.safeParse({ ...moto, engine_cc: 890, license_required: 'A', year: 1985 }).success).toBe(false);
      expect(
        vehicleCreateSchema.safeParse({ ...moto, engine_cc: 890, license_required: 'A', year: new Date().getFullYear() + 2 }).success
      ).toBe(false);
    });
  });
});
