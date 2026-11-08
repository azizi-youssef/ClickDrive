import { isPlatformAdminRole } from '@clickdrive/shared';
import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth/server';

/** Bloque la requête si l'utilisateur n'est pas admin plateforme. */
export async function requirePlatformAdminApi(): Promise<NextResponse | null> {
  const auth = await getServerAuth();
  if (!auth || !isPlatformAdminRole(auth.role)) {
    return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
  }
  return null;
}
