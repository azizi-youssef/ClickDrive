import { after, NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { notifyBookingCreated } from '@/lib/bookings/notifications';
import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { getServerAuth, hasAccessPermission } from '@/lib/auth/server';
import { bookingsService } from '@/lib/services/bookings.service';
import { bookingRequestSchema } from '@/lib/validations/booking';
import { CLICKDRIVE_WHATSAPP_NUMBER } from '@/lib/constants/contact';
import {
  checkDistributedRateLimit,
  checkRateLimit,
  clientIpFromRequest,
  RateLimitUnavailableError,
} from '@/lib/rate-limit';
import { redactBookingCustomerData } from '@/lib/auth/booking-access';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';
import { signedBookingLink } from '@/lib/auth/booking-access-link';

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (
      typeof body === 'object' &&
      body !== null &&
      'website' in body &&
      typeof body.website === 'string' &&
      body.website.trim().length > 0
    ) {
      return NextResponse.json({ success: false, error: 'Requête refusée' }, { status: 400 });
    }

    const ip = clientIpFromRequest(req);
    const distributedLimit = await checkDistributedRateLimit(`booking-post:${ip}`, 8, 60_000).catch(
      (err) => {
        console.warn('[RateLimit] Distributed rate limit check failed, using memory fallback:', err?.message);
        return null;
      }
    );
    if (!distributedLimit && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Service de protection anti-abus indisponible.' },
        { status: 503 }
      );
    }
    const limited = distributedLimit ?? checkRateLimit(`booking-post:${ip}`, 8, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { success: false, error: 'Trop de demandes. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const validation = bookingRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const idempotencyKey = req.headers.get('idempotency-key');
    if (
      !idempotencyKey ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Une clé Idempotency-Key UUID valide est requise.' },
        { status: 400 }
      );
    }

    const auth = await getServerAuth();
    const result = await bookingsService.createBookingRequest(
      validation.data,
      auth?.userId,
      idempotencyKey
    );

    if (!result.success || !result.booking) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erreur lors de la création de la demande',
        },
        {
          status: result.idempotencyConflict
            ? 409
            : result.availabilityConflict
              ? 409
            : result.serviceUnavailable
              ? 503
              : 400,
        }
      );
    }

    const appUrl = req.nextUrl.origin;
    const { notificationService } = await import('@/lib/services/notification.service');
    const agencyWhatsAppMessage = notificationService.formatAgencyWhatsAppMessage(result.booking, appUrl);
    // Numéro réel de l'agence ; à défaut, l'assistance ClickDrive (jamais un numéro fictif)
    const agencyPhone = result.booking.agency?.whatsapp || result.booking.agency?.phone || CLICKDRIVE_WHATSAPP_NUMBER;
    const agencyWhatsAppUrl = notificationService.generateWhatsAppLink(agencyPhone, agencyWhatsAppMessage);
    const pdfUrl = `${appUrl}${signedBookingPdfPath(result.booking.reference || '')}`;
    const trackingPath = signedBookingLink('track', result.booking.reference || '');

    if (!result.idempotentReplay) {
      // E-mails au client (accusé de réception) et à l'agence, envoyés après la réponse
      const createdBooking = result.booking;
      after(() => notifyBookingCreated(createdBooking, appUrl));
      await notificationService.sendDashboardNotification({
        agencyId: result.booking.agency_id,
        title: `Nouvelle demande de réservation ${result.booking.reference}`,
        message: `${result.booking.customer_name} — ${result.booking.vehicle?.brand} ${result.booking.vehicle?.model} (${result.booking.total_days}j à ${result.booking.pickup_location})`,
        link: `/agency?booking=${encodeURIComponent(result.booking.reference || '')}`,
        type: 'BOOKING',
      });
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      reference: result.booking.reference,
      pdfUrl,
      trackingUrl: trackingPath,
      agencyWhatsAppUrl,
      agencyWhatsAppMessage,
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitUnavailableError) {
      return serverError(error, '/api/bookings', 'Service de protection anti-abus indisponible.', 503);
    }
    return serverError(error, '/api/bookings');
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let agencyId = searchParams.get('agencyId') || undefined;
    let customerId = searchParams.get('customerId') || undefined;

    const auth = await getServerAuth();
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
    }

    let canReadCustomerData = false;
    const isAdmin = isPlatformAdminRole(auth.role);

    if (!isAdmin) {
      if (agencyId && !(await hasAccessPermission('bookings.read', agencyId))) {
        return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
      }
      if (!agencyId && auth.agencyIds.length === 1) {
        agencyId = auth.agencyIds[0];
      } else if (!agencyId && auth.agencyIds.length > 1) {
        return NextResponse.json(
          { success: false, error: 'Paramètre agencyId requis' },
          { status: 400 }
        );
      }
      if (!agencyId && auth.role === 'CUSTOMER') {
        customerId = auth.userId;
      } else if (!agencyId && auth.agencyIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
      }
      canReadCustomerData = agencyId
        ? await hasAccessPermission('customers.read', agencyId)
        : customerId === auth.userId;
    } else {
      canReadCustomerData = true;
    }

    const bookings = await bookingsService.getBookings(
      { agencyId, customerId },
      canReadCustomerData
    );
    const visibleBookings = canReadCustomerData
      ? bookings
      : bookings.map(redactBookingCustomerData);
    return NextResponse.json({ success: true, bookings: visibleBookings });
  } catch (error: unknown) {
    return serverError(error, '/api/bookings');
  }
}
