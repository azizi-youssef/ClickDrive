import { NextRequest } from 'next/server';
import { encodeCursor, historyQuerySchema } from '@/lib/tracking/schemas';
import { parseQuery, requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchVehicleHistory } from '@/lib/tracking/location.service';
import { recordSensitiveAccess } from '@/lib/tracking/tracking.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/agency/tracking/vehicles/[id]/history?from&to&limit&cursor — positions historisées.
 * Période bornée à 31 jours, 1 000 points par page (curseur), consultation journalisée dans l'audit.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.read', 'vehicles.history', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const vehicleId = requireUuid(id);
    const query = parseQuery(historyQuerySchema, request);

    const page = await fetchVehicleHistory(db, agencyId, vehicleId, query);
    // L'accès est tracé une fois le véhicule validé (un véhicule étranger échoue avant : 404, sans trace de lecture)
    await recordSensitiveAccess(db, agencyId, 'history.read', 'vehicle', vehicleId, {
      from: query.from,
      to: query.to,
      returned: page.points.length,
    });
    return trackingSuccess(
      { points: page.points, limit: page.limit },
      { meta: { next_cursor: page.next_cursor ? encodeCursor(page.next_cursor) : null } }
    );
  });
}
