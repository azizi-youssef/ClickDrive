import { describe, it, expect } from 'vitest';
import {
  MOROCCAN_CIN_REGEX,
  PASSPORT_REGEX,
  IDENTITY_DOCUMENT_REGEX,
  DRIVING_LICENSE_REGEX,
  calculateAge,
  customerIdentitySchema,
} from './customer';

describe('Customer Validations', () => {
  describe('CIN, Passport and Driving License regexes', () => {
    it('validates Moroccan CIN formats', () => {
      expect(MOROCCAN_CIN_REGEX.test('A12345')).toBe(true);
      expect(MOROCCAN_CIN_REGEX.test('AB123456')).toBe(true);
      expect(MOROCCAN_CIN_REGEX.test('U1234567')).toBe(true);
      expect(MOROCCAN_CIN_REGEX.test('123456')).toBe(false); // no letter
      expect(MOROCCAN_CIN_REGEX.test('ABC123456')).toBe(false); // 3 letters
    });

    it('validates Passport formats', () => {
      expect(PASSPORT_REGEX.test('AB123456')).toBe(true);
      expect(PASSPORT_REGEX.test('12AB3456')).toBe(true);
      expect(PASSPORT_REGEX.test('SHORT')).toBe(false); // < 6 chars
    });

    it('validates Moroccan driving license formats', () => {
      expect(DRIVING_LICENSE_REGEX.test('25/123456')).toBe(true);
      expect(DRIVING_LICENSE_REGEX.test('B-1234567')).toBe(true);
      expect(DRIVING_LICENSE_REGEX.test('12')).toBe(false); // too short
    });
  });

  describe('calculateAge', () => {
    it('calculates age correctly based on birthdate', () => {
      const today = new Date();
      const birthYear25 = today.getFullYear() - 25;
      const birthDateStr = `${birthYear25}-01-01`;
      expect(calculateAge(birthDateStr)).toBeGreaterThanOrEqual(24);
    });
  });

  describe('customerIdentitySchema', () => {
    it('accepts valid driver older than 21 with unexpired license', () => {
      const res = customerIdentitySchema.safeParse({
        firstName: 'Yassine',
        lastName: 'El Amrani',
        cin: 'AB123456',
        birthDate: '1995-05-15',
        licenseNumber: '25/987654',
        licenseExpiry: '2030-01-01',
        phone: '0661234567',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.nationality).toBe('Maroc');
        expect(res.data.phone).toBe('+212661234567');
      }
    });

    it('rejects driver under 21 years old', () => {
      const res = customerIdentitySchema.safeParse({
        firstName: 'Amine',
        lastName: 'Alaoui',
        cin: 'BK123456',
        birthDate: '2015-05-15', // child / minor
        licenseNumber: '25/987654',
        phone: '0661234567',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('âgé d’au moins 21 ans');
      }
    });

    it('rejects driver with expired license', () => {
      const res = customerIdentitySchema.safeParse({
        firstName: 'Yassine',
        lastName: 'El Amrani',
        cin: 'AB123456',
        birthDate: '1995-05-15',
        licenseNumber: '25/987654',
        licenseExpiry: '2020-01-01', // in the past
        phone: '0661234567',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('expiré');
      }
    });
  });
});

