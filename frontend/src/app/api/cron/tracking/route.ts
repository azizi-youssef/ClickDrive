import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { runTrackingMaintenance } from '@/lib/tracking/retention.service';

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
 * Maintenance du suivi GPS : alertes « hors ligne », trajets abandonnés, purge selon la conservation de chaque agence.
 * Appelée toutes les 5 minutes (.github/workflows/tracking-maintenance.yml) avec « Authorization: Bearer CRON_SECRET ».
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
    const report = await runTrackingMaintenance();
    return NextResponse.json({ success: true, ...report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return serverError(error, '/api/cron/tracking');
  }
}
