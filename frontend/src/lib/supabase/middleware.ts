import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPlatformAdminRole } from '@clickdrive/shared';
import { isPublicLoginPath, loginUrl, type LoginPortal } from '@/lib/auth/login-portals';

/**
 * Garde des espaces privés (première barrière, côté navigation).
 * Ce n'est PAS la seule barrière : chaque route /api vérifie elle-même l'authentification,
 * l'appartenance et les permissions, et la base applique ses politiques RLS.
 *
 * - /account/* : session valide et profil existant (espace client) ;
 * - /agency/*  : membre ACTIF d'une agence ACTIVE (ou SUPER_ADMIN) ;
 * - /admin/*   : SUPER_ADMIN uniquement (le rôle historique ADMIN n'a pas de droit global).
 */

type PrivateArea = 'account' | 'agency' | 'admin';

function isActiveAgency(value: unknown): boolean {
  const agency = Array.isArray(value) ? value[0] : value;
  if (typeof agency !== 'object' || agency === null) return false;
  const record = agency as Record<string, unknown>;
  return record.status === 'ACTIVE' && !record.archived_at;
}

function startsWithSegment(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/** Zone privée de la page demandée (null : page publique) */
export function privateAreaFor(path: string): PrivateArea | null {
  if (isPublicLoginPath(path)) return null;
  if (startsWithSegment(path, '/account')) return 'account';
  if (startsWithSegment(path, '/admin')) return 'admin';
  if (startsWithSegment(path, '/agency') && !startsWithSegment(path, '/agency/join')) return 'agency';
  return null;
}

const PORTAL_FOR_AREA: Record<PrivateArea, LoginPortal> = {
  account: 'client',
  agency: 'agency',
  admin: 'admin',
};

/** Les espaces privés ne doivent jamais être indexés ni mis en cache partagé */
function markPrivate(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function redirectToLogin(request: NextRequest, area: PrivateArea, error?: string): NextResponse {
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return markPrivate(
    NextResponse.redirect(new URL(loginUrl(PORTAL_FOR_AREA[area], { redirect: path, error }), request.url))
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const area = privateAreaFor(path);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    // Configuration manquante : en production, les espaces privés sont fermés (fail-closed)
    if (area && process.env.NODE_ENV === 'production') {
      return markPrivate(
        new NextResponse('Service d’authentification indisponible.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' },
        })
      );
    }
    return area ? markPrivate(supabaseResponse) : supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valide le jeton auprès de Supabase Auth (et rafraîchit la session si nécessaire)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!area) return supabaseResponse;
  if (!user) return redirectToLogin(request, area);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Session sans profil exploitable : accès refusé (jamais de rôle supposé)
  if (profileError || !profile?.role) {
    return redirectToLogin(request, area, 'forbidden');
  }

  const role = String(profile.role);
  const isSuperAdmin = isPlatformAdminRole(role);

  if (area === 'admin' && !isSuperAdmin) {
    return redirectToLogin(request, 'admin', 'forbidden');
  }

  if (area === 'agency' && !isSuperAdmin) {
    const { data: memberRows, error } = await supabase
      .from('agency_members')
      .select('agency_id, status, agencies(status, archived_at)')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE');

    const hasActiveAgency = !error && memberRows?.some((row) => isActiveAgency(row.agencies));
    if (!hasActiveAgency) {
      const isSuspended = memberRows?.some((row) => {
        const agency = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
        return typeof agency === 'object' && agency !== null && 'status' in agency && agency.status === 'SUSPENDED';
      });
      return redirectToLogin(request, 'agency', isSuspended ? 'suspended' : 'forbidden');
    }
  }

  return markPrivate(supabaseResponse);
}
