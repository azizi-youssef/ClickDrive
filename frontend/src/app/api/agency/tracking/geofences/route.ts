import { NextRequest } from 'next/server';
import { geofenceSchema } from '@/lib/tracking/schemas';
import { parseJson, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { listGeofences, saveGeofence } from '@/lib/tracking/geofence.service';

export const dynamic = 'force-dynamic';

/** GET /api/agency/tracking/geofences — zones de l'agence et véhicules affectés. */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.read', 'geofences.list', async ({ db, agencyId }) =>
    trackingSuccess({ geofences: await listGeofences(db, agencyId) })
  );
}

/** POST /api/agency/tracking/geofences — crée une zone circulaire (permission tracking.manage) ; 201. */
export async function POST(request: NextRequest) {
  return withTracking(request, 'tracking.manage', 'geofences.create', async ({ db, agencyId }) => {
    const body = await parseJson(geofenceSchema, request);
    const id = await saveGeofence(db, agencyId, null, body);
    return trackingSuccess({ id }, { status: 201 });
  });
}
