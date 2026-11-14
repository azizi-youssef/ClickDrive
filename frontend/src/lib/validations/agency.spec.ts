import { describe, it, expect } from 'vitest';
import {
  ICE_REGEX,
  RC_REGEX,
  agencyRegistrationSchema,
  agencyDocumentSchema,
  deliveryRatesSchema,
} from './agency';

describe('Agency Validations', () => {
  describe('ICE_REGEX & RC_REGEX', () => {
    it('validates 15-digit Moroccan ICE format', () => {
      expect(ICE_REGEX.test('001234567890123')).toBe(true);
      expect(ICE_REGEX.test('123456789012345')).toBe(true);
      expect(ICE_REGEX.test('12345678901234')).toBe(false); // 14 digits
      expect(ICE_REGEX.test('1234567890123456')).toBe(false); // 16 digits
      expect(ICE_REGEX.test('00123456789012A')).toBe(false); // alphanumeric
    });

    it('validates Moroccan RC numbers', () => {
      expect(RC_REGEX.test('12345')).toBe(true);
      expect(RC_REGEX.test('1')).toBe(true);
      expect(RC_REGEX.test('1234567890')).toBe(true);
      expect(RC_REGEX.test('')).toBe(false);
      expect(RC_REGEX.test('RC12345')).toBe(false);
    });
  });

  describe('agencyDocumentSchema', () => {
    it('accepts valid agency documents', () => {
      const res = agencyDocumentSchema.safeParse({
        type: 'ICE',
        name: 'Attestation ICE 2026',
        file_url: 'https://storage.klickdrive.ma/docs/ice.pdf',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.verified).toBe(false);
      }
    });

    it('rejects unsupported document types', () => {
      const res = agencyDocumentSchema.safeParse({
        type: 'UNKNOWN_TYPE',
        name: 'Unknown document',
        file_url: 'https://example.com/doc.pdf',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('agencyRegistrationSchema', () => {
    const validAgency = {
      name: 'Rif Auto Location',
      ice: '002938475610293',
      rc: '45892',
      manager_name: 'Ahmed Mansouri',
      email: 'contact@rifauto.ma',
      phone: '0661234567',
      address: '15 Boulevard Mohammed V',
      city: 'Nador',
    };

    it('accepts valid Moroccan agency registration', () => {
      const res = agencyRegistrationSchema.safeParse(validAgency);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.city).toBe('Nador');
        expect(res.data.phone).toBe('+212661234567');
        expect(res.data.documents).toEqual([]);
      }
    });

    it('rejects agency registration with invalid ICE', () => {
      const res = agencyRegistrationSchema.safeParse({
        ...validAgency,
        ice: '12345', // invalid length
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('15 chiffres');
      }
    });

    it('rejects agency registration with short address', () => {
      const res = agencyRegistrationSchema.safeParse({
        ...validAgency,
        address: 'Rue',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('deliveryRatesSchema', () => {
    it('provides sensible defaults and coerces numbers', () => {
      const res = deliveryRatesSchema.safeParse({
        airport: '150',
        hotel: 50,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.agency_pickup).toBe(0);
        expect(res.data.airport).toBe(150);
        expect(res.data.hotel).toBe(50);
        expect(res.data.address).toBe(0);
      }
    });
  });
});

