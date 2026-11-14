import { NextRequest } from 'next/server';
import { routeQuerySchema } from '@/lib/tracking/schemas';
import { parseQuery, requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchTripRoute } from '@/lib/tracking/trip.service';
import { recordSensitiveAccess } from '@/lib/tracking/tracking.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/agency/tracking/trips/[id]/route — tracé d'un trajet (rééchantillonné, 1 500 points au plus), consultation journalisée. */
export async function GET(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.read', 'trips.route', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const tripId = requireUuid(id);
    const { max_points } = parseQuery(routeQuerySchema, request);
    const route = await fetchTripRoute(db, agencyId, tripId, max_points);
    await recordSensitiveAccess(db, agencyId, 'trip_route.read', 'vehicle_trip', tripId, { points: route.points.length });
    return trackingSuccess(route);
  });
}
