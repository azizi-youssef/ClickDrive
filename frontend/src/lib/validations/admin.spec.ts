import { describe, it, expect } from 'vitest';
import {
  userRoleEnum,
  agencyStatusEnum,
  adminRoleAssignmentSchema,
  adminAgencyActionSchema,
  adminAuditQuerySchema,
} from './admin';

describe('Admin Validations', () => {
  describe('enums', () => {
    it('accepts valid platform and agency roles', () => {
      expect(userRoleEnum.safeParse('SUPER_ADMIN').success).toBe(true);
      expect(userRoleEnum.safeParse('AGENCY_OWNER').success).toBe(true);
      expect(userRoleEnum.safeParse('CUSTOMER').success).toBe(true);
      expect(userRoleEnum.safeParse('SUPER_HACKER').success).toBe(false);
    });

    it('accepts valid agency statuses', () => {
      expect(agencyStatusEnum.safeParse('ACTIVE').success).toBe(true);
      expect(agencyStatusEnum.safeParse('SUSPENDED').success).toBe(true);
      expect(agencyStatusEnum.safeParse('DELETED').success).toBe(false);
    });
  });

  describe('adminRoleAssignmentSchema', () => {
    it('requires valid target user UUID and sufficient reason for audit trail', () => {
      const res = adminRoleAssignmentSchema.safeParse({
        targetUserId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'SUPER_ADMIN',
        reason: 'Promotion après validation d’identité par la direction',
      });
      expect(res.success).toBe(true);
    });

    it('rejects short reason for destructive action', () => {
      const res = adminRoleAssignmentSchema.safeParse({
        targetUserId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'SUPER_ADMIN',
        reason: 'Ok', // < 5 chars
      });
      expect(res.success).toBe(false);
    });
  });

  describe('adminAgencyActionSchema', () => {
    it('accepts agency suspension with reason', () => {
      const res = adminAgencyActionSchema.safeParse({
        agencyId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'SUSPENDED',
        reason: 'Non respect des engagements de caution et documents périmés',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.notifyAgency).toBe(true);
      }
    });
  });

  describe('adminAuditQuerySchema', () => {
    it('coerces and validates query pagination', () => {
      const res = adminAuditQuerySchema.safeParse({
        page: '2',
        pageSize: '50',
        actionType: 'ROLE_CHANGE',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.page).toBe(2);
        expect(res.data.pageSize).toBe(50);
      }
    });
  });
});

