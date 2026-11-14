import { NextRequest } from 'next/server';
import { requireUuid, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { fetchVehicleDetail } from '@/lib/tracking/location.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/agency/tracking/vehicles/[id] — fiche de suivi d'un véhicule de l'agence (404 pour un véhicule d'une autre agence). */
export async function GET(request: NextRequest, context: RouteContext) {
  return withTracking(request, 'tracking.read', 'vehicles.detail', async ({ db, agencyId }) => {
    const { id } = await context.params;
    const detail = await fetchVehicleDetail(db, agencyId, requireUuid(id));
    return trackingSuccess(detail);
  });
}
