import { agencyBookingActionSchema } from '@clickdrive/shared/booking-schema';
import { serverError } from '@/lib/api/server-error';
import { after, NextRequest, NextResponse } from 'next/server';
import { notifyBookingStatusByReference } from '@/lib/bookings/notifications';
import { trackServerEvent } from '@/lib/analytics/server';
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
    // Le client est prévenu par e-mail de la réponse de l'agence (envoi après la réponse HTTP)
    const appUrl = req.nextUrl.origin;

    if (action === 'approve') {
      const result = await bookingsService.approveBooking(reference, notes, auth.userId);
      if (result.success) {
        after(() => notifyBookingStatusByReference(reference, 'CONFIRMED', appUrl));
        after(() => trackServerEvent('Demande acceptée', `${appUrl}/agency`).then(() => undefined));
      }
      return NextResponse.json(result, {
        status: result.success ? 200 : result.availabilityConflict || result.transitionConflict ? 409 : 400,
      });
    }

    if (action === 'reject') {
      const result = await bookingsService.rejectBooking(reference, reason, auth.userId);
      if (result.success) after(() => notifyBookingStatusByReference(reference, 'REJECTED', appUrl, reason));
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
      if (result.success) after(() => notifyBookingStatusByReference(reference, 'ALTERNATIVE_PROPOSED', appUrl, notes));
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, error: `Action ${action} non reconnue` }, { status: 400 });
  } catch (error: unknown) {
    return serverError(error, '/api/bookings/[reference]/status');
  }
}
