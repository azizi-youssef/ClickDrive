import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { isPlatformAdminRole } from '@clickdrive/shared';
import { requireAgencyPortalApi } from '@/lib/auth/agency-api';
import { agenciesService } from '@/lib/services/agencies.service';
import { vehiclesService } from '@/lib/services/vehicles.service';

export async function GET() {
  const { auth, denied } = await requireAgencyPortalApi();
  if (denied) return denied;

  try {
    const [allAgencies, vehicles] = await Promise.all([
      agenciesService.getAgencies(!auth || isPlatformAdminRole(auth.role) ? false : true),
      vehiclesService.getVehicles(),
    ]);

    let agencies = allAgencies;
    if (auth && !isPlatformAdminRole(auth.role)) {
      const allowed = new Set(auth.agencyIds);
      agencies = agencies.filter((a) => allowed.has(a.id));
    }

    const withCounts = agencies.map((agency) => ({
      ...agency,
      vehicle_count:
        agency.vehicle_count ?? vehicles.filter((v) => v.agency_id === agency.id).length,
    }));

    return NextResponse.json({
      success: true,
      data: withCounts,
      meta: { total: withCounts.length },
    });
  } catch (error: unknown) {
    return serverError(error, '/api/agencies/mine');
  }
}
