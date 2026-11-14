import { NextRequest } from 'next/server';
import { geofenceSchema } from '@/lib/tracking/schemas';
import { parseJson, requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { deleteGeofence, saveGeofence } from '@/lib/tracking/geofence.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/agency/tracking/geofences/[id] — remplace la définition de la zone et ses véhicules (tracking.manage). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.manage', 'geofences.patch', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const geofenceId = requireUuid(id);
    const body = await parseJson(geofenceSchema, request);
    await saveGeofence(db, agencyId, geofenceId, body);
    return trackingSuccess({ id: geofenceId });
  });
}

/** DELETE /api/agency/tracking/geofences/[id] — supprime la zone (les alertes passées sont conservées). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.manage', 'geofences.delete', async ({ db, agencyId }) => {
    const { id } = await context.params;
    await deleteGeofence(db, agencyId, requireUuid(id));
    return trackingSuccess({ deleted: true });
  });
}
