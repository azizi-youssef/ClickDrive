import { NextRequest } from 'next/server';
import { requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { revokeSupportAccess } from '@/lib/tracking/tracking.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/agency/tracking/support-grants/[id] — l'agence met fin immédiatement à un accès de support (tracking.settings.manage). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.settings.manage', 'support-grants.revoke', async ({ db }) => {
    const { id } = await context.params;
    await revokeSupportAccess(db, requireUuid(id));
    return trackingSuccess({ revoked: true });
  });
}
