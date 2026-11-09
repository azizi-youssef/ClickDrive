import { isAgencyRole, isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { type UserRole } from '@clickdrive/shared/roles';

export type LoginPortal = 'client' | 'agency' | 'admin';

export const LOGIN_PATH = '/login';
const INTERNAL_ORIGIN = 'https://clickdrive.invalid';

/** Routes publiques de connexion (y compris redirections legacy). */
export function isPublicLoginPath(path: string): boolean {
  return path === LOGIN_PATH || path === '/admin/login' || path === '/agency/login';
}

export function loginUrl(
  portal: LoginPortal,
  options?: { redirect?: string; error?: string }
): string {
  const params = new URLSearchParams();
  params.set('portal', portal);
  if (options?.redirect) params.set('redirect', options.redirect);
  if (options?.error) params.set('error', options.error);
  const qs = params.toString();
  return qs ? `${LOGIN_PATH}?${qs}` : LOGIN_PATH;
}

export function parseLoginPortal(value: string | null | undefined): LoginPortal {
  if (value === 'agency' || value === 'admin' || value === 'client') return value;
  return 'client';
}

export const PORTAL_DEFAULT_REDIRECT: Record<LoginPortal, string> = {
  client: '/account',
  agency: '/agency',
  admin: '/admin',
};

export function isSafeRedirect(value: string | null | undefined): value is string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return false;
  if (/[\\\u0000-\u001F\u007F]/.test(value)) return false;
  try {
    return new URL(value, INTERNAL_ORIGIN).origin === INTERNAL_ORIGIN;
  } catch {
    return false;
  }
}

export function portalForRole(role: UserRole): LoginPortal | null {
  if (isPlatformAdminRole(role)) return 'admin';
  if (isAgencyRole(role)) return 'agency';
  return role === 'CUSTOMER' ? 'client' : null;
}

export function canPortalAccessRedirect(portal: LoginPortal, value: string): boolean {
  if (!isSafeRedirect(value)) return false;
  const pathname = new URL(value, INTERNAL_ORIGIN).pathname;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return portal === 'admin';
  if (pathname === '/agency' || pathname.startsWith('/agency/')) {
    return portal === 'agency' || portal === 'admin';
  }
  if (pathname === '/account' || pathname.startsWith('/account/')) return portal === 'client';
  return true;
}
