import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { runBookingFollowUp } from '@/lib/bookings/follow-up-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;
  const header = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Relances des demandes sans réponse et demandes d'avis. Appelée toutes les 15 minutes par une
 * tâche planifiée (.github/workflows/booking-follow-up.yml) avec « Authorization: Bearer CRON_SECRET ».
 */
export async function GET(req: NextRequest) {
  const allowed = authorized(req);
  if (allowed === null) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET non configuré.' }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Accès refusé.' }, { status: 401 });
  }
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
    const report = await runBookingFollowUp(appUrl.replace(/\/$/, ''));
    return NextResponse.json({ success: true, ...report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return serverError(error, '/api/cron/booking-follow-up');
  }
}
