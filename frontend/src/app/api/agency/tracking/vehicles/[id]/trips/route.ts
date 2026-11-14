import { NextRequest } from 'next/server';
import { tripsQuerySchema } from '@/lib/tracking/schemas';
import { parseQuery, requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchTripsPage } from '@/lib/tracking/trip.service';
import { fetchVehicleDetail } from '@/lib/tracking/location.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/agency/tracking/vehicles/[id]/trips?from&to&page&page_size — trajets d'un véhicule (93 jours max, 100 par page). */
export async function GET(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.read', 'vehicles.trips', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const vehicleId = requireUuid(id);
    const query = parseQuery(tripsQuerySchema, request);
    // 404 explicite si le véhicule n'appartient pas à l'agence (sinon la liste serait simplement vide)
    await fetchVehicleDetail(db, agencyId, vehicleId);
    const page = await fetchTripsPage(db, agencyId, { ...query, vehicle_id: vehicleId });
    return trackingSuccess(page, { meta: { page: query.page, page_size: query.page_size } });
  });
}
