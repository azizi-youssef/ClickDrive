import { describe, expect, it } from 'vitest';
import { isLegacyAdminRole, isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { privateAreaFor } from '@/lib/supabase/middleware';
import { canPortalAccessRedirect, isSafeRedirect } from '@/lib/auth/login-portals';
import { canAccessAdminPortal, canManageAgencyFleet } from '@/lib/auth/portals';

describe('Rôles plateforme (ACCESS_CONTROL.md)', () => {
  it('seul SUPER_ADMIN a des droits globaux', () => {
    expect(isPlatformAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isPlatformAdminRole('ADMIN')).toBe(false);
    expect(isPlatformAdminRole('CUSTOMER')).toBe(false);
    expect(isPlatformAdminRole('AGENCY_OWNER')).toBe(false);
    expect(isLegacyAdminRole('ADMIN')).toBe(true);
  });

  it('le rôle historique ADMIN n’ouvre ni le portail admin ni la gestion de flotte', () => {
    expect(canAccessAdminPortal('ADMIN')).toBe(false);
    expect(canManageAgencyFleet('ADMIN')).toBe(false);
    expect(canAccessAdminPortal('SUPER_ADMIN')).toBe(true);
  });
});

describe('Espaces privés protégés par le middleware', () => {
  it.each([
    ['/account', 'account'],
    ['/account/bookings/CD-2026-100001', 'account'],
    ['/agency', 'agency'],
    ['/agency/settings', 'agency'],
    ['/admin', 'admin'],
    ['/admin/fleet/motos', 'admin'],
  ])('%s → %s', (path, area) => {
    expect(privateAreaFor(path)).toBe(area);
  });

  it.each(['/', '/search', '/motos', '/cars/dacia-logan', '/login', '/agency/join', '/agency/login', '/admin/login', '/accounts-info', '/administration'])(
    '%s reste public',
    (path) => {
      expect(privateAreaFor(path)).toBeNull();
    }
  );
});

describe('Redirections après connexion', () => {
  it('n’accepte que des chemins internes', () => {
    expect(isSafeRedirect('/account/bookings')).toBe(true);
    expect(isSafeRedirect('//evil.example')).toBe(false);
    expect(isSafeRedirect('https://evil.example')).toBe(false);
    expect(isSafeRedirect('/\\evil.example')).toBe(false);
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false);
  });

  it('chaque portail ne redirige que vers son espace', () => {
    expect(canPortalAccessRedirect('client', '/account')).toBe(true);
    expect(canPortalAccessRedirect('client', '/admin')).toBe(false);
    expect(canPortalAccessRedirect('agency', '/account')).toBe(false);
    expect(canPortalAccessRedirect('admin', '/agency')).toBe(true);
  });
});
