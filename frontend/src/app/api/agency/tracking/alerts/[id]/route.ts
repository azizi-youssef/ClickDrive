import { NextRequest } from 'next/server';
import { alertPatchSchema } from '@/lib/tracking/schemas';
import { parseJson, requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { acknowledgeAlert } from '@/lib/tracking/alert.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/agency/tracking/alerts/[id] — { "action": "acknowledge" } (idempotent) ; permission tracking.alerts.manage. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.alerts.manage', 'alerts.patch', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const alertId = requireUuid(id);
    await parseJson(alertPatchSchema, request);
    return trackingSuccess(await acknowledgeAlert(db, agencyId, alertId));
  });
}
