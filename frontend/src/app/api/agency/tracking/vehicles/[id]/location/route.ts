import { NextRequest } from 'next/server';
import { requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchLatestLocation } from '@/lib/tracking/location.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/agency/tracking/vehicles/[id]/location — dernière position connue et état de connexion (rafraîchissement léger). */
export async function GET(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.read', 'vehicles.location', async ({ db, agencyId }) => {
    const { id } = await context.params;
    return trackingSuccess(await fetchLatestLocation(db, agencyId, requireUuid(id)));
  });
}
