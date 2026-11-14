import { NextRequest } from 'next/server';
import { alertsQuerySchema } from '@/lib/tracking/schemas';
import { parseQuery, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchAlerts } from '@/lib/tracking/alert.service';

export const dynamic = 'force-dynamic';

/** GET /api/agency/tracking/alerts?status&type&severity&vehicle_id&page&page_size — alertes de l'agence (100 par page). */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.read', 'alerts.list', async ({ db, agencyId }) => {
    const query = parseQuery(alertsQuerySchema, request);
    const page = await fetchAlerts(db, agencyId, query);
    return trackingSuccess(page, { meta: { page: query.page, page_size: query.page_size } });
  });
}
