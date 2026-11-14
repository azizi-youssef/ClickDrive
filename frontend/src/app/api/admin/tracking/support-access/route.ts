import { NextRequest, NextResponse } from 'next/server';
import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { getServerAuth } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { TrackingError } from '@/lib/tracking/errors';
import { parseJson, trackingErrorResponse, trackingFailure, trackingSuccess } from '@/lib/tracking/access';
import { supportGrantSchema, uuidSchema } from '@/lib/tracking/schemas';
import { grantSupportAccess, revokeSupportAccess } from '@/lib/tracking/tracking.service';
import { trackingLog } from '@/lib/tracking/log';

export const dynamic = 'force-dynamic';

async function superAdminClient(): Promise<NonNullable<Awaited<ReturnType<typeof createClient>>> | NextResponse> {
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = await createClient();
  } catch {
    return trackingFailure(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.');
  }
  if (!db) return trackingFailure(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.');
  const auth = await getServerAuth();
  if (!auth) return trackingFailure(401, 'UNAUTHENTICATED', 'Authentification requise.');
  // Première barrière ; la base revérifie is_super_admin() dans la fonction
  if (!isPlatformAdminRole(auth.role)) return trackingFailure(403, 'FORBIDDEN', 'Accès refusé.');
  return db;
}

/**
 * POST /api/admin/tracking/support-access — un Super Admin demande un accès de LECTURE aux positions d'une agence.
 * Motif (≥ 10 caractères) obligatoire, durée de 5 à 120 minutes, journalisé, visible et révocable par l'agence.
 * Sans cette autorisation, un Super Admin n'a aucun accès au suivi GPS.
 */
export async function POST(request: NextRequest) {
  const client = await superAdminClient();
  if (client instanceof NextResponse) return client;
  try {
    const body = await parseJson(supportGrantSchema, request);
    const grantId = await grantSupportAccess(client, body.agency_id, body.reason, body.minutes);
    trackingLog('info', 'support_access.granted', { grant_id: grantId, agency_id: body.agency_id, minutes: body.minutes });
    return trackingSuccess({ id: grantId, minutes: body.minutes }, { status: 201 });
  } catch (error) {
    return trackingErrorResponse(error, 'support-access.grant');
  }
}

/** DELETE /api/admin/tracking/support-access?grant_id=… — le Super Admin met fin à son propre accès. */
export async function DELETE(request: NextRequest) {
  const client = await superAdminClient();
  if (client instanceof NextResponse) return client;
  try {
    const parsed = uuidSchema.safeParse(new URL(request.url).searchParams.get('grant_id'));
    if (!parsed.success) throw new TrackingError(422, 'VALIDATION', 'grant_id invalide.');
    await revokeSupportAccess(client, parsed.data);
    return trackingSuccess({ revoked: true });
  } catch (error) {
    return trackingErrorResponse(error, 'support-access.revoke');
  }
}
