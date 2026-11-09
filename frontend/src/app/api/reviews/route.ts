import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { getServerAuth } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkDistributedRateLimit,
  checkRateLimit,
  clientIpFromRequest,
} from '@/lib/rate-limit';
import { reviewsService } from '@/lib/services/reviews.service';
import { reviewInputSchema } from '@/lib/validations/reviews';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get('vehicle_id') || searchParams.get('vehicleId');
    if (!vehicleId) {
      return NextResponse.json(
        { success: false, error: 'Paramètre vehicle_id requis' },
        { status: 400 }
      );
    }
    const reviews = await reviewsService.getReviewsForVehicle(vehicleId);
    return NextResponse.json({ success: true, data: reviews });
  } catch (error: unknown) {
    return serverError(error, '/api/reviews');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth || auth.role !== 'CUSTOMER') {
      return NextResponse.json(
        { success: false, error: 'Authentification client requise.' },
        { status: 401 }
      );
    }

    const distributedLimit = await checkDistributedRateLimit(
      `review-post:${auth.userId}:${clientIpFromRequest(req)}`,
      3,
      60 * 60_000
    ).catch(() => null);
    if (!distributedLimit && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Service de protection anti-abus indisponible.' },
        { status: 503 }
      );
    }
    const limited =
      distributedLimit ??
      checkRateLimit(`review-post:${auth.userId}:${clientIpFromRequest(req)}`, 3, 60 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { success: false, error: 'Trop d\'avis. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const body: unknown = await req.json();
    const parsed = reviewInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Service de données indisponible.' },
        { status: 503 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, vehicle_id, agency_id, customer_id, status')
      .eq('id', parsed.data.booking_id)
      .maybeSingle();

    if (bookingError) {
      console.error('[Reviews] Booking eligibility lookup failed:', bookingError.message);
      return NextResponse.json(
        { success: false, error: 'Impossible de vérifier cette location.' },
        { status: 500 }
      );
    }
    if (!booking || booking.customer_id !== auth.userId || booking.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Seul le client d\'une location terminée peut publier un avis.' },
        { status: 403 }
      );
    }

    const created = await reviewsService.addReview({
      booking_id: booking.id,
      vehicle_id: booking.vehicle_id,
      agency_id: booking.agency_id,
      customer_id: auth.userId,
      author_name: 'Client vérifié',
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    ) {
      return NextResponse.json(
        { success: false, error: 'Un avis a déjà été publié pour cette location.' },
        { status: 409 }
      );
    }
    return serverError(error, '/api/reviews');
  }
}
