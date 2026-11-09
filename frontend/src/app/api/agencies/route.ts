import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { requirePlatformAdminApi } from '@/lib/auth/admin-api';
import { agenciesService } from '@/lib/services/agencies.service';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { toPublicAgencies } from '@/lib/agencies/public';

export async function GET(req: NextRequest) {
  const onlyActive = req.nextUrl.searchParams.get('onlyActive') !== 'false';

  if (!onlyActive) {
    const denied = await requirePlatformAdminApi();
    if (denied) return denied;
  }

  try {
    const [agencies, vehicles] = await Promise.all([
      agenciesService.getAgencies(onlyActive),
      vehiclesService.getVehicles(),
    ]);
    const withCounts = agencies.map((agency) => ({
      ...agency,
      vehicle_count:
        agency.vehicle_count ??
        vehicles.filter((v) => v.agency_id === agency.id).length,
    }));

    return NextResponse.json({
      success: true,
      data: onlyActive ? toPublicAgencies(withCounts) : withCounts,
      meta: { total: withCounts.length },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return serverError(error, '/api/agencies');
  }
}
