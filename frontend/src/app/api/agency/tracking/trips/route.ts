import { NextRequest } from 'next/server';
import { tripsQuerySchema } from '@/lib/tracking/schemas';
import { parseQuery, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchTripsPage } from '@/lib/tracking/trip.service';

export const dynamic = 'force-dynamic';

/** GET /api/agency/tracking/trips?from&to&page&page_size[&vehicle_id] — trajets de toute l'agence (historique). */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.read', 'trips.list', async ({ db, agencyId }) => {
    const query = parseQuery(tripsQuerySchema, request);
    const page = await fetchTripsPage(db, agencyId, query);
    return trackingSuccess(page, { meta: { page: query.page, page_size: query.page_size } });
  });
}
