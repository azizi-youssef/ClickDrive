import { NextRequest } from 'next/server';
import { mapDbError } from '@/lib/tracking/errors';
import { trackingSuccess, withTracking } from '@/lib/tracking/access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agency/tracking/support-grants — accès de support plateforme accordés à cette agence (transparence).
 * Réservé aux administrateurs (tracking.settings.manage) ; ne contient aucune position.
 */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.settings.manage', 'support-grants.list', async ({ db, agencyId }) => {
    const { data, error } = await db
      .from('tracking_support_grants')
      .select('id, reason, starts_at, expires_at, revoked_at, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw mapDbError(error, 'support-grants.list');
    return trackingSuccess({ grants: data ?? [] });
  });
}
