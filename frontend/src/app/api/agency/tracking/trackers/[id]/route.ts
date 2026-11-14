import { NextRequest } from 'next/server';
import { trackerPatchSchema } from '@/lib/tracking/schemas';
import { parseJson, requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { updateTracker, type TrackerPatch } from '@/lib/tracking/tracker.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/agency/tracking/trackers/[id] — une opération par requête :
 *   { label?, device_model?, installed_at?, enabled? } | { vehicle_id: uuid|null, reason? } | { disconnect: true, reason? }
 * Permission tracking.manage ; le boîtier doit appartenir à l'agence (404 sinon, sans distinguer « inexistant »).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.manage', 'trackers.patch', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const trackerId = requireUuid(id);
    const body = await parseJson(trackerPatchSchema, request);

    let patch: TrackerPatch;
    if (body.disconnect) {
      patch = { kind: 'disconnect', reason: body.reason };
    } else if ('vehicle_id' in body) {
      patch = { kind: 'assign', vehicle_id: body.vehicle_id ?? null, reason: body.reason };
    } else {
      const changes: Record<string, unknown> = {};
      for (const key of ['label', 'device_model', 'installed_at', 'enabled'] as const) {
        if (key in body) changes[key] = body[key];
      }
      patch = { kind: 'fields', changes };
    }
    await updateTracker(db, agencyId, trackerId, patch);
    return trackingSuccess({ id: trackerId });
  });
}
