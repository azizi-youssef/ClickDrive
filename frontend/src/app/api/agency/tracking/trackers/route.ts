import { NextRequest } from 'next/server';
import { publicProviders } from '@/lib/tracking/providers/provider.factory';
import { trackerCreateSchema } from '@/lib/tracking/schemas';
import { parseJson, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { listTrackers, registerTracker } from '@/lib/tracking/tracker.service';

export const dynamic = 'force-dynamic';

/** GET /api/agency/tracking/trackers[?include_disconnected=1] — boîtiers de l'agence et fournisseurs disponibles. */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.read', 'trackers.list', async ({ db, agencyId }) => {
    const includeDisconnected = new URL(request.url).searchParams.get('include_disconnected') === '1';
    const trackers = await listTrackers(db, agencyId, includeDisconnected);
    return trackingSuccess({ trackers, providers: publicProviders() });
  });
}

/** POST /api/agency/tracking/trackers — enregistre un boîtier (permission tracking.manage) ; 201 + identifiant. */
export async function POST(request: NextRequest) {
  return withTracking(request, 'tracking.manage', 'trackers.create', async ({ db, agencyId }) => {
    const body = await parseJson(trackerCreateSchema, request);
    const id = await registerTracker(db, agencyId, body);
    return trackingSuccess({ id }, { status: 201 });
  });
}
