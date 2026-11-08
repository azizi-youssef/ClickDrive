import { NextRequest, NextResponse } from 'next/server';
import { bookingsService } from '@/lib/services/bookings.service';
import { pdfService } from '@/lib/services/pdf.service';
import { authorizeBookingRead } from '@/lib/auth/booking-access';
import { getServerAuth } from '@/lib/auth/server';
import { verifyBookingPdfSignature } from '@/lib/auth/booking-pdf-link';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await context.params;
    if (!reference) {
      return new NextResponse('Référence requise', { status: 400 });
    }

    const hasSignedLink = verifyBookingPdfSignature(
      reference,
      req.nextUrl.searchParams.get('exp'),
      req.nextUrl.searchParams.get('sig')
    );
    const auth = await getServerAuth();
    if (!auth && !hasSignedLink) {
      return new NextResponse('Authentification requise', { status: 401 });
    }

    const booking = await bookingsService.getBookingByReference(reference, true);
    if (!booking) {
      return new NextResponse('Demande de réservation introuvable', { status: 404 });
    }

    if (auth && !hasSignedLink) {
      const access = await authorizeBookingRead(auth, booking);
      if (!access.allowed) {
        return new NextResponse('Demande de réservation introuvable', { status: 404 });
      }
      if (!access.canReadCustomerData) {
        return new NextResponse('Accès au dossier client refusé', { status: 403 });
      }
    }

    const pdfBytes = pdfService.generateBookingRequestPdf(booking);

    const allowedRoles = ['CUSTOMER', 'AGENCY_OWNER', 'AGENCY_MANAGER', 'AGENCY_STAFF', 'SUPER_ADMIN'] as const;
    type AllowedRole = (typeof allowedRoles)[number];
    const actorRole: AllowedRole =
      auth && allowedRoles.includes(auth.role as AllowedRole)
        ? (auth.role as AllowedRole)
        : 'CUSTOMER';

    await bookingsService.logEvent(booking.id, 'PDF_GENERATED', actorRole, auth?.userId, {
      reference: booking.reference || reference,
      downloaded_at: new Date().toISOString(),
    });

    const filename = `ClickDrive_Demande_${booking.reference || reference}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: unknown) {
    console.error('[API /api/bookings/[reference]/pdf] Error:', error);
    return new NextResponse('Erreur lors de la génération du PDF.', { status: 500 });
  }
}
