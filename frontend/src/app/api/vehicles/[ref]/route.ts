import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { forwardJsonRequest, markDeprecated } from '@/lib/api/forward-request';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { getServerAuth } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/availability/status';
import { toPublicVehicle } from '@/lib/vehicles/public';
import { unexpectedVehicleFields, violationResponseInit } from '@/lib/vehicles/protected-fields';
import {
  DELETE as deleteAgencyVehicle,
  PATCH as patchAgencyVehicle,
} from '@/app/api/agencies/[id]/vehicles/[vehicleId]/route';

type Ctx = { params: Promise<{ ref: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(_req: NextRequest, context: Ctx) {
  try {
    const { ref } = await context.params;
    let vehicle = await vehiclesService.getVehicleBySlug(ref);
    if (!vehicle) {
      vehicle = await vehiclesService.getVehicleById(ref);
    }
    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Véhicule introuvable' }, { status: 404 });
    }
    const agency = vehicle.agency;
    const vehicleArchived = 'archived_at' in vehicle && vehicle.archived_at != null;
    const agencyArchived = Boolean(
      agency && 'archived_at' in agency && agency.archived_at != null
    );
    if (!vehicle.published || vehicleArchived || agency?.status !== 'ACTIVE' || agencyArchived) {
      return NextResponse.json({ success: false, error: 'Véhicule introuvable' }, { status: 404 });
    }
    return NextResponse.json(
      { success: true, data: toPublicVehicle(vehicle) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    return serverError(error, '/api/vehicles/[ref]');
  }
}

/**
 * Agence propriétaire, lue avec la session de l'appelant (RLS) : un véhicule que l'appelant ne peut pas voir
 * donne 404, sans révéler s'il existe. L'agence vient de la base, jamais du navigateur.
 */
async function resolveVehicleOwner(ref: string): Promise<{ id: string; agency_id: string } | null> {
  if (!isUuid(ref)) return null;
  const supabase = await createClient();
  if (!supabase) throw new Error('Client Supabase indisponible.');
  const { data, error } = await supabase.from('vehicles').select('id, agency_id').eq('id', ref).maybeSingle();
  if (error) throw new Error(`Lecture du véhicule impossible : ${error.message}`);
  return (data as { id: string; agency_id: string } | null) ?? null;
}

/**
 * Route historique. Délègue à PATCH /api/agencies/[id]/vehicles/[vehicleId] (validation Zod partagée,
 * permission vehicles.manage) après un filtrage strict : tout champ hors du schéma (agency_id, featured…) est refusé.
 */
export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    const { ref } = await context.params;
    if (!(await getServerAuth())) return failure('Authentification requise', 401);

    const vehicle = await resolveVehicleOwner(ref);
    if (!vehicle) return failure('Véhicule introuvable', 404);

    const body: unknown = await req.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return failure('Corps de requête JSON invalide.', 400);
    }
    const violations = unexpectedVehicleFields(body as Record<string, unknown>);
    if (violations.length > 0) {
      const { status, message } = violationResponseInit(violations);
      return failure(message, status);
    }

    const response = await patchAgencyVehicle(forwardJsonRequest(req, body), {
      params: Promise.resolve({ id: vehicle.agency_id, vehicleId: vehicle.id }),
    });
    return markDeprecated(response, `/api/agencies/${vehicle.agency_id}/vehicles/${vehicle.id}`);
  } catch (error: unknown) {
    return serverError(error, '/api/vehicles/[ref]');
  }
}

/** Route historique. Délègue à DELETE /api/agencies/[id]/vehicles/[vehicleId] (vehicles.manage). */
export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const { ref } = await context.params;
    if (!(await getServerAuth())) return failure('Authentification requise', 401);

    const vehicle = await resolveVehicleOwner(ref);
    if (!vehicle) return failure('Véhicule introuvable', 404);

    const response = await deleteAgencyVehicle(forwardJsonRequest(req), {
      params: Promise.resolve({ id: vehicle.agency_id, vehicleId: vehicle.id }),
    });
    return markDeprecated(response, `/api/agencies/${vehicle.agency_id}/vehicles/${vehicle.id}`);
  } catch (error: unknown) {
    return serverError(error, '/api/vehicles/[ref]');
  }
}
