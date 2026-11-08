import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { isBlockingBookingStatus } from '@clickdrive/shared';
import { isValidDateOnly } from '@/lib/utils/date-only';

type RouteContext = { params: Promise<{ id: string; vehicleId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

const blockPeriodSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date requis: AAAA-MM-JJ'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date requis: AAAA-MM-JJ'),
  type: z.enum(['BLOCKED', 'MAINTENANCE']).default('BLOCKED'),
  reason: z.string().trim().min(2, 'Le motif est requis').default('Bloqué par l\'agence'),
  cost: z.coerce.number().min(0).optional().default(0),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: agencyId, vehicleId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  // Vérifier que le véhicule appartient bien à l'agence
  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .select('id, brand, model')
    .eq('id', vehicleId)
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (vErr || !vehicle) return failure('Véhicule introuvable.', 404);

  const { data: unavailability, error: periodsError } = await supabase
    .from('vehicle_unavailability')
    .select('id, start_date, end_date, reason, notes, cost, created_at')
    .eq('vehicle_id', vehicleId)
    .order('start_date', { ascending: true });

  if (periodsError) {
    return failure('Erreur lors du chargement des disponibilités.', 500);
  }

  const periods = (unavailability ?? [])
    .map((period) => ({
      id: period.id,
      type: period.reason === 'MAINTENANCE' ? 'MAINTENANCE' as const : 'BLOCKED' as const,
      start_date: period.start_date,
      end_date: period.end_date,
      reason: period.notes || period.reason,
      cost: period.cost,
      created_at: period.created_at,
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return NextResponse.json({
    success: true,
    data: {
      vehicle,
      periods,
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: agencyId, vehicleId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.manage');
  if (gate.denied) return gate.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure('Corps de requête JSON invalide.', 400);
  }

  const parsed = blockPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return failure(parsed.error.issues.map((i) => i.message).join(', '), 422);
  }

  const { start_date, end_date, type, reason, cost } = parsed.data;
  if (!isValidDateOnly(start_date) || !isValidDateOnly(end_date) || start_date >= end_date) {
    return failure('La date de fin doit être postérieure à la date de début.', 400);
  }

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  // Vérifier l'appartenance
  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (vErr || !vehicle) return failure('Véhicule introuvable.', 404);

  // This read gives a useful response; the database trigger serializes the final write.
  const { data: conflicts, error: confErr } = await supabase
    .from('bookings')
    .select('id, reference, status, start_date, end_date')
    .eq('vehicle_id', vehicleId)
    .lte('start_date', end_date)
    .gte('end_date', start_date);

  if (confErr) {
    return failure('Erreur lors de la vérification des conflits.', 500);
  }

  const blockingConflict = (conflicts ?? []).find((b) => isBlockingBookingStatus(b.status));
  if (blockingConflict) {
    return failure(
      `Conflit avec la réservation ${blockingConflict.reference || blockingConflict.id} (${blockingConflict.status}) sur cet intervalle.`,
      409
    );
  }

  const { data: created, error: createError } = await supabase
    .from('vehicle_unavailability')
    .insert({
      vehicle_id: vehicleId,
      agency_id: agencyId,
      start_date,
      end_date,
      reason: type === 'MAINTENANCE' ? 'MAINTENANCE' : 'CUSTOM',
      notes: reason,
      cost: type === 'MAINTENANCE' ? cost : 0,
    })
    .select()
    .single();

  if (createError) {
    if (createError.code === '23P01') {
      return failure('Cette période chevauche une réservation confirmée ou active.', 409);
    }
    return failure('Erreur lors de la création de la période d’indisponibilité.', 500);
  }
  return NextResponse.json({ success: true, data: { ...created, type } });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: agencyId, vehicleId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.manage');
  if (gate.denied) return gate.denied;

  const periodId = request.nextUrl.searchParams.get('periodId');
  if (!periodId) return failure('Paramètre periodId manquant.', 400);

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  const { error } = await supabase
    .from('vehicle_unavailability')
    .delete()
    .eq('id', periodId)
    .eq('vehicle_id', vehicleId)
    .eq('agency_id', agencyId);

  if (error) {
    return failure('Erreur lors de la suppression de la période d’indisponibilité.', 500);
  }

  return NextResponse.json({ success: true, message: 'Période débloquée avec succès.' });
}
