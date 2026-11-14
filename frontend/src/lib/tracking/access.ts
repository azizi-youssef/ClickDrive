import { NextResponse } from 'next/server';
import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import type { TrackingPermission } from '@clickdrive/shared/roles';
import { getServerAuth, type ServerAuthContext } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { checkDistributedRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { TrackingError } from './errors';
import type { TrackingDb } from './rpc';
import { trackingLog } from './log';
import { callRpc } from './rpc';

/**
 * Garde commune des routes /api/agency/tracking/*.
 *
 *   1. configuration Supabase disponible (sinon 503 : fail-closed, jamais de données simulées) ;
 *   2. utilisateur authentifié (401) ;
 *   3. agence résolue depuis les appartenances ACTIVES de l'utilisateur (jamais depuis le navigateur seul) ;
 *   4. permission tracking.* revérifiée par la base (403) — has_tracking_permission refuse tout accès implicite
 *      d'un Super Admin, qui ne passe que par une autorisation de support explicite, limitée et journalisée ;
 *   5. les services travaillent ensuite avec le client de l'UTILISATEUR (RLS) : la base applique l'isolation
 *      entre agences même si une route oubliait un filtre.
 */

export interface TrackingContext {
  db: TrackingDb;
  auth: ServerAuthContext;
  agencyId: string;
  /** Accès par autorisation de support plateforme (pas d'appartenance à l'agence) */
  viaSupportGrant: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trackingFailure(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json(
    { success: false, code, error: message },
    { status, headers: { 'Cache-Control': 'private, no-store', ...headers } }
  );
}

export function trackingSuccess(data: unknown, init: { status?: number; meta?: Record<string, unknown> } = {}) {
  return NextResponse.json(
    { success: true, data, ...(init.meta ? { meta: init.meta } : {}) },
    // Les positions ne sont jamais mises en cache (ni navigateur, ni CDN, ni proxy)
    { status: init.status ?? 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export type TrackingGate =
  | { ok: true; ctx: TrackingContext }
  | { ok: false; response: NextResponse };

export interface GateOptions {
  /** Plafond de requêtes par utilisateur et par minute (défaut : 240 en lecture, 60 en écriture) */
  rateLimitPerMinute?: number;
}

async function enforceUserRateLimit(userId: string, bucket: string, limit: number): Promise<NextResponse | null> {
  const key = `tracking-api:${bucket}:${userId}`;
  try {
    const distributed = await checkDistributedRateLimit(key, limit, 60_000).catch(() => null);
    const result = distributed ?? checkRateLimit(key, limit, 60_000);
    if (!result.ok) {
      return trackingFailure(429, 'RATE_LIMITED', 'Trop de requêtes. Réessayez dans un instant.', { 'Retry-After': String(result.retryAfterSec) });
    }
  } catch {
    // L'utilisateur est déjà authentifié : une panne du limiteur ne bloque pas la lecture
  }
  return null;
}

export async function requireTrackingAccess(
  request: Request,
  permission: TrackingPermission,
  options: GateOptions = {}
): Promise<TrackingGate> {
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = await createClient();
  } catch {
    return { ok: false, response: trackingFailure(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.') };
  }
  if (!db) return { ok: false, response: trackingFailure(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.') };

  const auth = await getServerAuth();
  if (!auth) return { ok: false, response: trackingFailure(401, 'UNAUTHENTICATED', 'Authentification requise.') };

  const requested = new URL(request.url).searchParams.get('agency_id');
  let agencyId: string | undefined;
  if (requested !== null) {
    if (!UUID.test(requested)) return { ok: false, response: trackingFailure(400, 'VALIDATION', 'Identifiant d’agence invalide.') };
    // Une agence dont l'utilisateur n'est pas membre n'est essayée que pour un Super Admin (accès de support) :
    // la base tranche. Pour tout autre compte, réponse identique à un refus de permission.
    if (!auth.agencyIds.includes(requested) && !isPlatformAdminRole(auth.role)) {
      return { ok: false, response: trackingFailure(403, 'FORBIDDEN', 'Accès refusé.') };
    }
    agencyId = requested;
  } else {
    agencyId = auth.agencyIds[0];
    if (!agencyId) {
      return {
        ok: false,
        response: isPlatformAdminRole(auth.role)
          ? trackingFailure(400, 'VALIDATION', 'Précisez agency_id (accès de support).')
          : trackingFailure(403, 'FORBIDDEN', 'Accès refusé.'),
      };
    }
  }

  const { data: allowed, error } = await db.rpc('has_tracking_permission', { p_agency_id: agencyId, p_permission: permission });
  if (error) {
    trackingLog('error', 'access.permission_check_failed', { code: error.code });
    return { ok: false, response: trackingFailure(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.') };
  }
  if (allowed !== true) return { ok: false, response: trackingFailure(403, 'FORBIDDEN', 'Accès refusé.') };

  const isRead = request.method === 'GET';
  const limited = await enforceUserRateLimit(auth.userId, isRead ? 'read' : 'write', options.rateLimitPerMinute ?? (isRead ? 240 : 60));
  if (limited) return { ok: false, response: limited };

  return {
    ok: true,
    ctx: { db, auth, agencyId, viaSupportGrant: !auth.agencyIds.includes(agencyId) },
  };
}

/** Traduit une erreur de service en réponse HTTP uniforme (les détails techniques restent dans les journaux) */
export function trackingErrorResponse(error: unknown, tag: string): NextResponse {
  if (error instanceof TrackingError) {
    return trackingFailure(error.status, error.code, error.message);
  }
  console.error(`[Tracking ${tag}]`, error);
  return trackingFailure(500, 'INTERNAL', 'Une erreur est survenue. Réessayez dans un instant.');
}

/** Corps JSON borné (64 Ko) : refuse les autres types de contenu et les corps volumineux */
export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) {
    throw new TrackingError(415, 'VALIDATION', 'Content-Type application/json requis.');
  }
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new TrackingError(413, 'VALIDATION', 'Requête trop volumineuse.');
  const text = await request.text();
  if (text.length > maxBytes) throw new TrackingError(413, 'VALIDATION', 'Requête trop volumineuse.');
  try {
    return JSON.parse(text);
  } catch {
    throw new TrackingError(400, 'VALIDATION', 'Corps de requête JSON invalide.');
  }
}

export function searchParamsToObject(request: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) result[key] = value;
  return result;
}

/** Valide les paramètres de requête (Zod) ; le premier message d'erreur est renvoyé tel quel (champ + raison) */
export function parseQuery<T>(schema: import('zod').ZodType<T>, request: Request): T {
  const parsed = schema.safeParse(searchParamsToObject(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new TrackingError(422, 'VALIDATION', issue ? `${issue.path.join('.') || 'requête'} : ${issue.message}` : 'Requête invalide.');
  }
  return parsed.data;
}

export async function parseJson<T>(schema: import('zod').ZodType<T>, request: Request): Promise<T> {
  const body = await readJsonBody(request);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new TrackingError(422, 'VALIDATION', issue ? `${issue.path.join('.') || 'corps'} : ${issue.message}` : 'Requête invalide.');
  }
  return parsed.data;
}

export const UUID_PATTERN = UUID;

export function requireUuid(value: string): string {
  if (!UUID.test(value)) throw new TrackingError(404, 'NOT_FOUND', 'Élément introuvable.');
  return value;
}

/**
 * Enveloppe d'une route : garde d'accès puis exécution, avec traduction uniforme des erreurs.
 * Une lecture faite par un Super Admin via une autorisation de support est journalisée AVANT d'être servie.
 */
export async function withTracking(
  request: Request,
  permission: TrackingPermission,
  tag: string,
  run: (ctx: TrackingContext) => Promise<Response>,
  options?: GateOptions
): Promise<Response> {
  const gate = await requireTrackingAccess(request, permission, options);
  if (!gate.ok) return gate.response;
  try {
    if (gate.ctx.viaSupportGrant) {
      await callRpc(gate.ctx.db, 'tracking_record_access', {
        p_agency_id: gate.ctx.agencyId,
        p_action: 'support.read',
        p_entity_type: 'api',
        p_entity_id: tag,
        p_metadata: { route: tag },
      }, { tag: 'support-audit' });
    }
    return await run(gate.ctx);
  } catch (error) {
    return trackingErrorResponse(error, tag);
  }
}
