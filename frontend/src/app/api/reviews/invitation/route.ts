import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverError } from '@/lib/api/server-error';
import { verifyBookingLink } from '@/lib/auth/booking-access-link';
import { checkDistributedRateLimit, checkRateLimit, clientIpFromRequest } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/server';

const invitationSchema = z
  .object({
    reference: z.string().trim().regex(/^[A-Z0-9-]{6,40}$/i, 'Référence invalide.'),
    exp: z.string().regex(/^\d+$/),
    sig: z.string().min(16).max(128),
    rating: z.number().int().min(1, 'Choisissez une note de 1 à 5.').max(5, 'Choisissez une note de 1 à 5.'),
    comment: z.string().trim().min(10, 'Votre avis doit contenir au moins 10 caractères.').max(1000, 'Votre avis ne doit pas dépasser 1 000 caractères.'),
  })
  .strict();

/**
 * Avis vérifié publié depuis le lien signé envoyé après la location (client avec ou sans compte).
 * Conditions : lien valide pour cette référence, location terminée, un seul avis par location.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const distributed = await checkDistributedRateLimit(`review-invitation:${ip}`, 5, 10 * 60_000).catch(() => null);
    if (!distributed && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Service momentanément indisponible.' }, { status: 503 });
    }
    const limited = distributed ?? checkRateLimit(`review-invitation:${ip}`, 5, 10 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { success: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const parsed = invitationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Avis invalide.' }, { status: 400 });
    }
    const { reference, exp, sig, rating, comment } = parsed.data;
    if (!verifyBookingLink('review', reference.toUpperCase(), exp, sig)) {
      return NextResponse.json({ success: false, error: 'Lien d’avis invalide ou expiré.' }, { status: 403 });
    }

    const supabase = await createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Service momentanément indisponible.' }, { status: 503 });
    }
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, vehicle_id, agency_id, customer_id, status')
      .or(`reference.eq.${reference.toUpperCase()},booking_ref.eq.${reference.toUpperCase()}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking || booking.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Un avis ne peut être publié qu’après la fin de la location.' },
        { status: 403 }
      );
    }

    const { data: created, error: insertError } = await supabase
      .from('reviews')
      .insert({
        booking_id: booking.id,
        vehicle_id: booking.vehicle_id,
        agency_id: booking.agency_id,
        customer_id: booking.customer_id,
        author_name: 'Client vérifié',
        rating,
        comment,
      })
      .select('id, rating, comment, created_at')
      .single();
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ success: false, error: 'Un avis a déjà été publié pour cette location.' }, { status: 409 });
      }
      throw new Error(insertError.message);
    }
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return serverError(error, '/api/reviews/invitation');
  }
}
