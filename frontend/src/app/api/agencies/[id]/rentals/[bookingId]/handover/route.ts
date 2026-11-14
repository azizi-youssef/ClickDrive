import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { deliveryService } from '@/lib/services';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string; bookingId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

const handoverSchema = z.object({
  type: z.enum(['PICKUP', 'RETURN']),
  mileage: z.coerce.number().int().min(0, 'Le kilométrage est requis et doit être positif'),
  fuelLevel: z.enum(['EMPTY', '1/4', '1/2', '3/4', 'FULL']).default('FULL'),
  cleanliness: z.enum(['CLEAN', 'NORMAL', 'DIRTY']).default('CLEAN'),
  checklist: z
    .object({
      spareTire: z.boolean().default(true),
      jack: z.boolean().default(true),
      registrationDoc: z.boolean().default(true),
      insuranceDoc: z.boolean().default(true),
      safetyKit: z.boolean().default(true),
    })
    .default({
      spareTire: true,
      jack: true,
      registrationDoc: true,
      insuranceDoc: true,
      safetyKit: true,
    }),
  notes: z.string().trim().optional(),
  damagesDescription: z.string().trim().optional(),
  depositReturned: z.boolean().optional().default(true),
  depositDeduction: z.coerce.number().min(0).optional().default(0),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: agencyId, bookingId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'bookings.manage');
  if (gate.denied) return gate.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure('Corps de requête JSON invalide.', 400);
  }

  const parsed = handoverSchema.safeParse(body);
  if (!parsed.success) {
    return failure(parsed.error.issues.map((i) => i.message).join(', '), 422);
  }

  const input = parsed.data;

  const result = await deliveryService.validateHandover({
    bookingId,
    agencyId,
    type: input.type,
    actorId: gate.auth.userId,
    actorRole: 'AGENCY_MANAGER',
    mileage: input.mileage,
    fuelLevel: input.fuelLevel,
    cleanliness: input.cleanliness,
    checklist: input.checklist,
    notes: input.notes,
    damagesDescription: input.damagesDescription,
    depositReturned: input.depositReturned,
    depositDeduction: input.depositDeduction,
    sendWhatsAppNotification: true,
  });

  if (!result.success) {
    const status = result.notFound
      ? 404
      : result.transitionConflict
        ? 409
        : result.invalidInput
          ? 422
          : result.serviceUnavailable
            ? 503
            : 500;
    return failure(result.error || 'Erreur lors de la validation de la remise', status);
  }

  const warnings = result.warnings ?? [];
  const baseMessage =
    input.type === 'PICKUP'
      ? 'Véhicule remis au client. Location en cours.'
      : 'Véhicule restitué et inspecté. Réservation finalisée.';

  return NextResponse.json({
    success: true,
    // Transition enregistrée ; une écriture secondaire en échec est signalée, jamais masquée
    message: warnings.includes('vehicle_not_updated')
      ? `${baseMessage} Le statut du véhicule n’a pas pu être mis à jour : vérifiez-le dans la flotte.`
      : baseMessage,
    warnings,
    status: result.bookingStatus,
    vehicleStatus: result.vehicleStatus,
    distanceDrivenKm: result.distanceDrivenKm,
    whatsappSent: result.whatsappSent,
  });
}
