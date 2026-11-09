import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { contactMessageSchema } from '@/lib/validations/contact';
import { ContactUnavailableError, submitContactMessage } from '@/lib/services/contact.service';
import { checkDistributedRateLimit, checkRateLimit, clientIpFromRequest } from '@/lib/rate-limit';

const LIMIT = 5;
const WINDOW_MS = 10 * 60_000;

/** Formulaire /contact : enregistrement réel, alerte à l'équipe et accusé de réception */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ success: false, error: 'Requête invalide.' }, { status: 400 });
    }

    // Champ piège invisible : rempli seulement par les robots
    if ('website' in body && typeof body.website === 'string' && body.website.trim().length > 0) {
      return NextResponse.json({ success: false, error: 'Requête refusée.' }, { status: 400 });
    }

    const ip = clientIpFromRequest(req);
    const distributed = await checkDistributedRateLimit(`contact-post:${ip}`, LIMIT, WINDOW_MS).catch((err) => {
      console.warn('[RateLimit] Limiteur partagé indisponible pour /api/contact :', err?.message);
      return null;
    });
    if (!distributed && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Service momentanément indisponible. Écrivez-nous sur WhatsApp.' },
        { status: 503 }
      );
    }
    const limited = distributed ?? checkRateLimit(`contact-post:${ip}`, LIMIT, WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { success: false, error: 'Trop de messages envoyés. Réessayez dans quelques minutes.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const parsed = contactMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Formulaire invalide.',
          fields: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? ''), issue.message])),
        },
        { status: 400 }
      );
    }

    const result = await submitContactMessage(parsed.data);
    return NextResponse.json(
      { success: true, reference: result.reference, acknowledged: result.acknowledged === 'sent' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ContactUnavailableError) {
      console.error('[Contact]', error.message);
      return NextResponse.json(
        { success: false, error: 'Envoi impossible pour le moment. Écrivez-nous sur WhatsApp ou par e-mail.' },
        { status: 503 }
      );
    }
    return serverError(error, '/api/contact');
  }
}
