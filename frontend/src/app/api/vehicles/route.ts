import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import type { SearchFilters } from '@/types';
import { isValidDateOnly } from '@/lib/utils/date-only';
import { getServerAuth } from '@/lib/auth/server';
import { isPlatformAdminRole } from '@clickdrive/shared';
import { toPublicVehicles } from '@/lib/vehicles/public';

/** Taille maximale d'une page de résultats (aucune requête non bornée) */
const MAX_LIMIT = 500;

function boundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (value === null || !Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    if (
      Boolean(startDate) !== Boolean(endDate) ||
      (startDate && !isValidDateOnly(startDate)) ||
      (endDate && !isValidDateOnly(endDate)) ||
      (startDate && endDate && startDate >= endDate)
    ) {
      return NextResponse.json(
        { success: false, error: 'La période de recherche est invalide.' },
        { status: 400 }
      );
    }

    const filters: SearchFilters = {
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      transmission: (searchParams.get('transmission') as SearchFilters['transmission']) || undefined,
      fuel: (searchParams.get('fuel') as SearchFilters['fuel']) || undefined,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      agencyId: searchParams.get('agencyId') || undefined,
      query: searchParams.get('query') || undefined,
      startDate,
      endDate,
      sortBy: (searchParams.get('sortBy') as SearchFilters['sortBy']) || undefined,
    };

    const vehicles = await vehiclesService.getVehicles(filters);
    const offset = boundedInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = boundedInt(searchParams.get('limit'), MAX_LIMIT, 1, MAX_LIMIT);
    // Champs internes (plaque, documents…) réservés au SUPER_ADMIN ; projection publique pour tous les autres
    const auth = await getServerAuth();
    const visible = auth && isPlatformAdminRole(auth.role) ? vehicles : toPublicVehicles(vehicles);
    const paginated = visible.slice(offset, offset + limit);

    return NextResponse.json(
      {
        success: true,
        data: paginated,
        meta: { total: vehicles.length, limit, offset },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    return serverError(error, '/api/vehicles');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const agencyId = body.agency_id as string | undefined;
    if (!agencyId) {
      return NextResponse.json({ success: false, error: 'agency_id requis' }, { status: 400 });
    }

    const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.manage');
    if (gate.denied) return gate.denied;

    const created = await vehiclesService.addVehicle(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Données invalides';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
