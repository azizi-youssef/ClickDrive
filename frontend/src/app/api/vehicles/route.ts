import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { vehiclesService } from '@/lib/services/vehicles.service';
import type { SearchFilters } from '@/types';
import { isValidDateOnly } from '@/lib/utils/date-only';
import { getServerAuth } from '@/lib/auth/server';
import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { toPublicVehicles } from '@/lib/vehicles/public';
import { forwardJsonRequest, markDeprecated } from '@/lib/api/forward-request';
import { isUuid } from '@/lib/availability/status';
import { unexpectedVehicleFields, violationResponseInit } from '@/lib/vehicles/protected-fields';
import { POST as createAgencyVehicle } from '@/app/api/agencies/[id]/vehicles/route';

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

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Route historique. Délègue à POST /api/agencies/[id]/vehicles (validation Zod partagée, permission
 * vehicles.manage, contrôle de capacité de la formule) : une seule implémentation de la création.
 *
 * `agency_id` n'est jamais une autorité : il désigne seulement l'agence visée, qui doit faire partie des
 * agences actives de la session (ou SUPER_ADMIN), puis la route canonique revérifie vehicles.manage.
 * Sans `agency_id`, l'agence est déduite de la session si elle est unique.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth) return failure('Authentification requise', 401);

    const body: unknown = await req.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return failure('Corps de requête JSON invalide.', 400);
    }
    const payload = body as Record<string, unknown>;

    const violations = unexpectedVehicleFields(payload, ['agency_id']);
    if (violations.length > 0) {
      const { status, message } = violationResponseInit(violations);
      return failure(message, status);
    }

    const requested = payload.agency_id;
    let agencyId: string;
    if (requested !== undefined && requested !== null && requested !== '') {
      if (!isUuid(requested)) return failure('agency_id invalide', 400);
      agencyId = requested;
    } else if (auth.agencyIds.length === 1) {
      agencyId = auth.agencyIds[0];
    } else {
      return failure('agency_id requis', 400);
    }
    if (!isPlatformAdminRole(auth.role) && !auth.agencyIds.includes(agencyId)) {
      return failure('Accès refusé', 403);
    }

    const vehicle = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'agency_id'));
    const response = await createAgencyVehicle(forwardJsonRequest(req, vehicle), {
      params: Promise.resolve({ id: agencyId }),
    });

    // Contrat historique : 201 à la création
    if (response.status === 200) {
      return markDeprecated(NextResponse.json(await response.json(), { status: 201 }), `/api/agencies/${agencyId}/vehicles`);
    }
    return markDeprecated(response, `/api/agencies/${agencyId}/vehicles`);
  } catch (error: unknown) {
    return serverError(error, '/api/vehicles');
  }
}
