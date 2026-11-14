import { NextRequest } from 'next/server';
import { settingsPatchSchema } from '@/lib/tracking/schemas';
import { parseJson, trackingSuccess, withTracking } from '@/lib/tracking/access';
import { getTrackingSettings, updateTrackingSettings } from '@/lib/tracking/tracking.service';

export const dynamic = 'force-dynamic';

/** GET /api/agency/tracking/settings — paramètres de l'agence (valeurs par défaut si jamais configurés). */
export async function GET(request: NextRequest) {
  return withTracking(request, 'tracking.read', 'settings.get', async ({ db, agencyId }) =>
    trackingSuccess(await getTrackingSettings(db, agencyId))
  );
}

/** PATCH /api/agency/tracking/settings — conservation, seuils, limite de vitesse, conformité (tracking.settings.manage). */
export async function PATCH(request: NextRequest) {
  return withTracking(request, 'tracking.settings.manage', 'settings.patch', async ({ db, agencyId }) => {
    const changes = await parseJson(settingsPatchSchema, request);
    return trackingSuccess(await updateTrackingSettings(db, agencyId, changes));
  });
}
