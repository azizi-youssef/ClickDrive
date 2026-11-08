import { agencyBookingActionSchema } from '@clickdrive/shared';
import { serverError } from '@/lib/api/server-error';
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth, hasAccessPermission } from '@/lib/auth/server';
import { bookingsService } from '@/lib/services/bookings.service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await context.params;
    const body = await req.json();
    const parsed = agencyBookingActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const auth = await getServerAuth();
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
    }

    const booking = await bookingsService.getBookingByReference(reference);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Réservation introuvable' }, { status: 404 });
    }

    if (!(await hasAccessPermission('bookings.manage', booking.agency_id))) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
    }

    const { action, notes, reason, alternativeVehicleId } = parsed.data;

    if (action === 'approve') {
      const result = await bookingsService.approveBooking(reference, notes, auth.userId);
      return NextResponse.json(result, {
        status: result.success ? 200 : result.availabilityConflict || result.transitionConflict ? 409 : 400,
      });
    }

    if (action === 'reject') {
      const result = await bookingsService.rejectBooking(reference, reason, auth.userId);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === 'propose_alternative') {
      if (!alternativeVehicleId) {
        return NextResponse.json(
          { success: false, error: 'Identifiant du véhicule alternatif requis' },
          { status: 400 }
        );
      }
      const result = await bookingsService.proposeAlternative(
        reference,
        alternativeVehicleId,
        notes,
        auth.userId
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, error: `Action ${action} non reconnue` }, { status: 400 });
  } catch (error: unknown) {
    return serverError(error, '/api/bookings/[reference]/status');
  }
}
