import { NextResponse } from 'next/server';
import type { AccessPermission } from '@clickdrive/shared/roles';
import { getServerAuth, hasAccessPermission, type ServerAuthContext } from '@/lib/auth/server';

export type AccessGate =
  | { auth: ServerAuthContext; denied: null }
  | { auth: null; denied: NextResponse };

export async function requireAgencyPermissionApi(
  agencyId: string,
  permission: AccessPermission
): Promise<AccessGate> {
  const auth = await getServerAuth();
  if (!auth) {
    return {
      auth: null,
      denied: NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      ),
    };
  }

  if (!(await hasAccessPermission(permission, agencyId))) {
    return {
      auth: null,
      denied: NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 }),
    };
  }
  return { auth, denied: null };
}

export async function requirePlatformPermissionApi(
  permission: AccessPermission
): Promise<AccessGate> {
  const auth = await getServerAuth();
  if (!auth) {
    return {
      auth: null,
      denied: NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      ),
    };
  }

  if (!(await hasAccessPermission(permission))) {
    return {
      auth: null,
      denied: NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 }),
    };
  }
  return { auth, denied: null };
}
