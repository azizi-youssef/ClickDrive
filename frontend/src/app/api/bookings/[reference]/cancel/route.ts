import { after, NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { verifyBookingLink } from '@/lib/auth/booking-access-link';
import { isCustomerCancelReason } from '@/lib/bookings/customer-cancel';
import { notifyCustomerCancelled } from '@/lib/bookings/notifications';
import { bookingsService } from '@/lib/services/bookings.service';
import { PrivilegedAccessUnavailableError } from '@/lib/supabase/privileged';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rate-limit';

function single(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Annulation d'une demande par le client, depuis son lien de suivi signé (sans compte) : la signature
 * (exp + sig) prouve qu'il a reçu ce lien. Possible tant que l'agence n'a pas accepté la demande.
 * Corps : { exp, sig, reason? } — motif facultatif, pris dans une liste fermée.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const limited = checkRateLimit(`booking-cancel:${clientIpFromRequest(req)}`, 10, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { success: false, error: 'Trop de tentatives. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const { reference: rawReference } = await context.params;
    const reference = decodeURIComponent(rawReference).trim().toUpperCase();
    const body: unknown = await req.json().catch(() => null);
    const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

    if (!verifyBookingLink('track', reference, single(fields.exp), single(fields.sig))) {
      return NextResponse.json({ success: false, error: 'Lien de suivi invalide ou expiré.' }, { status: 403 });
    }

    const rawReason = fields.reason;
    if (rawReason !== undefined && rawReason !== null && rawReason !== '' && !isCustomerCancelReason(rawReason)) {
      return NextResponse.json({ success: false, error: 'Motif inconnu.' }, { status: 400 });
    }
    const reason = isCustomerCancelReason(rawReason) ? rawReason : null;

    const result = await bookingsService.cancelByCustomer(reference, reason);
    if (!result.success) {
      const status = result.notFound ? 404 : result.notCancellable ? 409 : 503;
      return NextResponse.json({ success: false, error: result.error, status: result.status }, { status });
    }

    // L'agence est prévenue après la réponse (son espace se met à jour de lui-même)
    const appUrl = req.nextUrl.origin;
    after(() => notifyCustomerCancelled(reference, appUrl, reason));
    return NextResponse.json({ success: true, status: 'CANCELLED' });
  } catch (error: unknown) {
    if (error instanceof PrivilegedAccessUnavailableError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 });
    }
    return serverError(error, '/api/bookings/[reference]/cancel', 'L’annulation n’a pas pu être enregistrée.');
  }
}
