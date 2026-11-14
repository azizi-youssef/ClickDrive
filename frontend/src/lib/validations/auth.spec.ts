import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  MOROCCAN_PHONE_REGEX,
  normalizeMoroccanPhone,
  moroccanPhoneSchema,
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from './auth';

describe('Auth Validations', () => {
  describe('emailSchema', () => {
    it('accepts valid email and normalizes it to lowercase and trimmed', () => {
      const res = emailSchema.safeParse('  User@Example.COM  ');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe('user@example.com');
      }
    });

    it('rejects invalid email formats', () => {
      expect(emailSchema.safeParse('').success).toBe(false);
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('@missinguser.com').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('accepts strong passwords meeting requirements', () => {
      expect(passwordSchema.safeParse('Password123').success).toBe(true);
      expect(passwordSchema.safeParse('KlickDrive2026!').success).toBe(true);
    });

    it('rejects passwords shorter than 8 characters', () => {
      const res = passwordSchema.safeParse('Pass1');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('8 caractères');
      }
    });

    it('rejects passwords without uppercase letter', () => {
      const res = passwordSchema.safeParse('password123');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('majuscule');
      }
    });

    it('rejects passwords without a digit', () => {
      const res = passwordSchema.safeParse('PasswordOnly');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('chiffre');
      }
    });
  });

  describe('MOROCCAN_PHONE_REGEX and moroccanPhoneSchema', () => {
    it('validates various Moroccan phone formats', () => {
      expect(MOROCCAN_PHONE_REGEX.test('0612345678')).toBe(true);
      expect(MOROCCAN_PHONE_REGEX.test('0712345678')).toBe(true);
      expect(MOROCCAN_PHONE_REGEX.test('0522334455')).toBe(true);
      expect(MOROCCAN_PHONE_REGEX.test('+212612345678')).toBe(true);
      expect(MOROCCAN_PHONE_REGEX.test('00212612345678')).toBe(true);
      expect(MOROCCAN_PHONE_REGEX.test('06 12 34 56 78')).toBe(true);
      expect(MOROCCAN_PHONE_REGEX.test('+212 6 12 34 56 78')).toBe(true);
    });

    it('rejects non-Moroccan or malformed numbers', () => {
      expect(MOROCCAN_PHONE_REGEX.test('0123456789')).toBe(false); // French prefix
      expect(MOROCCAN_PHONE_REGEX.test('061234567')).toBe(false); // Too short
      expect(MOROCCAN_PHONE_REGEX.test('06123456789')).toBe(false); // Too long
      expect(MOROCCAN_PHONE_REGEX.test('abcd')).toBe(false);
    });

    it('normalizes Moroccan phone numbers into standard E.164 +212 format', () => {
      expect(normalizeMoroccanPhone('0612345678')).toBe('+212612345678');
      expect(normalizeMoroccanPhone('00212612345678')).toBe('+212612345678');
      expect(normalizeMoroccanPhone('+212 6 12 34 56 78')).toBe('+212612345678');

      const parsed = moroccanPhoneSchema.safeParse('06 12 34 56 78');
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('+212612345678');
      }
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login credentials', () => {
      const res = loginSchema.safeParse({
        email: 'agency@klickdrive.ma',
        password: 'Password123',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.portal).toBe('client');
        expect(res.data.rememberMe).toBe(false);
      }
    });

    it('accepts custom portal and rememberMe', () => {
      const res = loginSchema.safeParse({
        email: 'admin@klickdrive.ma',
        password: 'Password123',
        portal: 'admin',
        rememberMe: true,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.portal).toBe('admin');
        expect(res.data.rememberMe).toBe(true);
      }
    });
  });

  describe('registerSchema', () => {
    it('validates a complete registration payload with matching passwords', () => {
      const res = registerSchema.safeParse({
        fullName: 'Karim Bennani',
        email: 'karim@gmail.com',
        phone: '0612345678',
        password: 'SecretPassword123',
        passwordConfirmation: 'SecretPassword123',
      });
      expect(res.success).toBe(true);
    });

    it('fails when passwords do not match', () => {
      const res = registerSchema.safeParse({
        fullName: 'Karim Bennani',
        email: 'karim@gmail.com',
        password: 'SecretPassword123',
        passwordConfirmation: 'DifferentPassword123',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('ne correspondent pas');
      }
    });
  });

  describe('updatePasswordSchema', () => {
    it('enforces that new password is confirmed and different from current password', () => {
      const resSame = updatePasswordSchema.safeParse({
        currentPassword: 'Password123',
        newPassword: 'Password123',
        passwordConfirmation: 'Password123',
      });
      expect(resSame.success).toBe(false);

      const resValid = updatePasswordSchema.safeParse({
        currentPassword: 'Password123',
        newPassword: 'NewPassword456',
        passwordConfirmation: 'NewPassword456',
      });
      expect(resValid.success).toBe(true);
    });
  });
});

