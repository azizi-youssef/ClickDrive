import { NextRequest } from 'next/server';
import { fleetQuerySchema } from '@/lib/tracking/schemas';
import { parseQuery, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchFleetOverview } from '@/lib/tracking/location.service';

export const dynamic = 'force-dynamic';

/** GET /api/agency/tracking/vehicles — flotte de l'agence : compteurs, états et dernières positions (paginé, 500 max). */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.read', 'vehicles.list', async ({ db, agencyId }) => {
    const query = parseQuery(fleetQuerySchema, request);
    const overview = await fetchFleetOverview(db, agencyId, query);
    return trackingSuccess(overview);
  });
}
