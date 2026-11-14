import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateJson, validateBody, validateQuery } from './validate';

describe('API Validation Helpers', () => {
  const testSchema = z.object({
    name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères'),
    count: z.coerce.number().int().min(1),
  });

  describe('validateJson', () => {
    it('returns success with parsed data for valid input', () => {
      const result = validateJson({ name: 'KlickDrive', count: 5 }, testSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('KlickDrive');
        expect(result.data.count).toBe(5);
      }
    });

    it('returns structured failure response for invalid input', async () => {
      const result = validateJson({ name: 'A', count: 0 }, testSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('au moins 2 caractères');
        expect(result.fields['name']).toBeDefined();
        const jsonBody = await result.response.json();
        expect(result.response.status).toBe(400);
        expect(jsonBody.success).toBe(false);
        expect(jsonBody.fields.name).toContain('au moins 2 caractères');
      }
    });
  });

  describe('validateBody', () => {
    it('parses valid JSON Request body', async () => {
      const req = new Request('https://klickdrive.ma/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nador Auto', count: '10' }),
      });

      const result = await validateBody(req, testSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(10);
      }
    });

    it('handles malformed JSON body gracefully with 400', async () => {
      const req = new Request('https://klickdrive.ma/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json',
      });

      const result = await validateBody(req, testSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Format JSON invalide');
        expect(result.response.status).toBe(400);
      }
    });

    it('rejects bot requests filling honeypot field', async () => {
      const req = new Request('https://klickdrive.ma/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Spam Bot',
          count: 1,
          website: 'https://spam-link.ru',
        }),
      });

      const result = await validateBody(req, testSchema, { honeypotField: 'website' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Requête refusée.');
        expect(result.response.status).toBe(400);
      }
    });
  });

  describe('validateQuery', () => {
    it('parses URLSearchParams properly', () => {
      const params = new URLSearchParams('name=Marketplace&count=42');
      const result = validateQuery(params, testSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Marketplace');
        expect(result.data.count).toBe(42);
      }
    });
  });
});

