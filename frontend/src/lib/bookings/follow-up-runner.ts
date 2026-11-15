import { createAdminClient } from '@/lib/supabase/server';
import { bookingsService } from '@/lib/services/bookings.service';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { toPublicVehicles } from '@/lib/vehicles/public';
import {
  ALTERNATIVES_AFTER_MINUTES,
  FOLLOW_UP_EVENTS,
  PENDING_STATUSES,
  REMINDER_AFTER_MINUTES,
  REVIEW_AFTER_MINUTES,
  pickAlternatives,
  planPendingFollowUps,
  planReviewRequests,
  type FollowUpBooking,
} from './follow-up';
import { deliverableCustomerEmail } from './customer-email';
import { templateName } from './whatsapp-templates';
import { offerPendingAlternatives, remindAgency, requestReview, type ChannelOutcome } from './notifications';

const SELECT = '*, vehicle:vehicles(*), agency:agencies(*), events:booking_events(event_type, created_at)';
const MAX_PER_RUN = 25;

type AdminClient = NonNullable<Awaited<ReturnType<typeof createAdminClient>>>;

export type FollowUpReport = {
  reminders: number;
  alternatives: number;
  reviewRequests: number;
  failures: number;
};

function delivered(outcome: ChannelOutcome): boolean {
  return outcome.email === 'sent' || outcome.whatsapp === 'sent';
}

/** Fonction SQL absente : migration 20261121000100 pas encore appliquée sur ce projet */
function isMissingFunction(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

/** Réservations complètes (véhicule, agence, événements), dans l'ordre des identifiants renvoyés par la base */
async function loadCandidates(supabase: AdminClient, rows: unknown): Promise<FollowUpBooking[]> {
  const ids = Array.isArray(rows)
    ? rows
        .map((row) => (row as { booking_id?: unknown } | null)?.booking_id)
        .filter((id): id is string => typeof id === 'string')
    : [];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('bookings').select(SELECT).in('id', ids);
  if (error) throw new Error(error.message);
  const rank = new Map(ids.map((id, index) => [id, index]));
  return ((data ?? []) as FollowUpBooking[]).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/**
 * Demandes qui attendent encore une relance. Le filtre « déjà relancée » est fait en base AVANT la limite :
 * sinon les 25 demandes les plus anciennes, déjà relancées, occuperaient chaque passage et les suivantes
 * ne seraient jamais traitées.
 */
async function pendingCandidates(supabase: AdminClient, now: Date): Promise<FollowUpBooking[]> {
  const { data, error } = await supabase.rpc('pending_follow_up_candidates', {
    p_limit: MAX_PER_RUN,
    p_reminder_after_minutes: REMINDER_AFTER_MINUTES,
    p_alternatives_after_minutes: ALTERNATIVES_AFTER_MINUTES,
  });
  if (!error) return loadCandidates(supabase, data);
  if (!isMissingFunction(error)) throw new Error(error.message);

  console.warn('[FollowUp] pending_follow_up_candidates() absente (migration 20261121000100) : ancienne lecture, des demandes récentes peuvent ne pas être relancées.');
  const pendingSince = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const pendingUntil = new Date(now.getTime() - REMINDER_AFTER_MINUTES * 60_000).toISOString();
  const { data: pending, error: pendingError } = await supabase
    .from('bookings')
    .select(SELECT)
    .in('status', [...PENDING_STATUSES])
    .gte('created_at', pendingSince)
    .lte('created_at', pendingUntil)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);
  if (pendingError) throw new Error(pendingError.message);
  return (pending ?? []) as FollowUpBooking[];
}

/** Locations terminées sans demande d'avis ni avis, même principe (filtre en base avant la limite) */
async function reviewCandidates(supabase: AdminClient, now: Date): Promise<FollowUpBooking[]> {
  const { data, error } = await supabase.rpc('review_request_candidates', {
    p_limit: MAX_PER_RUN,
    p_review_after_minutes: REVIEW_AFTER_MINUTES,
    // Un client sans e-mail n'est joignable que par le modèle WhatsApp de demande d'avis
    p_include_without_email: templateName('reviewRequest') !== null,
  });
  if (!error) return loadCandidates(supabase, data);
  if (!isMissingFunction(error)) throw new Error(error.message);

  console.warn('[FollowUp] review_request_candidates() absente (migration 20261121000100) : ancienne lecture, des avis peuvent ne pas être demandés.');
  const completedSince = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
  const { data: completed, error: completedError } = await supabase
    .from('bookings')
    .select(SELECT)
    .eq('status', 'COMPLETED')
    .gte('updated_at', completedSince)
    .order('updated_at', { ascending: true })
    .limit(MAX_PER_RUN);
  if (completedError) throw new Error(completedError.message);
  return (completed ?? []) as FollowUpBooking[];
}

/**
 * Un passage de la tâche planifiée. Un envoi qui n'a abouti sur aucun canal n'est pas journalisé :
 * il sera retenté au passage suivant (fournisseur en panne, modèle WhatsApp pas encore approuvé…).
 */
export async function runBookingFollowUp(appUrl: string, now = new Date()): Promise<FollowUpReport> {
  const supabase = await createAdminClient();
  if (!supabase) throw new Error('Base de données indisponible pour les relances.');
  const report: FollowUpReport = { reminders: 0, alternatives: 0, reviewRequests: 0, failures: 0 };

  // Locations terminées, demandes périmées (EXPIRED) et statuts des véhicules
  const { error: expireError } = await supabase.rpc('expire_completed_bookings');
  if (expireError) console.warn('[FollowUp] Expiration des locations terminées impossible :', expireError.message);

  const pending = await pendingCandidates(supabase, now);
  for (const { booking, action, waitingMinutes } of planPendingFollowUps(pending, now)) {
    try {
      if (action === 'remind') {
        const outcome = await remindAgency(booking, appUrl, waitingMinutes);
        if (!delivered(outcome)) {
          report.failures += 1;
          continue;
        }
        await bookingsService.logEvent(booking.id, FOLLOW_UP_EVENTS.agencyReminder, 'SYSTEM', undefined, { ...outcome });
        report.reminders += 1;
      } else {
        // Alternatives envoyées par e-mail seulement : rien à faire pour un client sans adresse
        if (!deliverableCustomerEmail(booking.customer_email)) continue;
        const available = toPublicVehicles(
          await vehiclesService.getVehicles({ startDate: booking.start_date.slice(0, 10), endDate: booking.end_date.slice(0, 10) })
        );
        const alternatives = pickAlternatives(available, booking, appUrl);
        // Rien à proposer : on le note pour ne pas réévaluer cette demande à chaque passage
        const outcome = alternatives.length > 0 ? await offerPendingAlternatives(booking, appUrl, alternatives) : null;
        if (outcome && !delivered(outcome)) {
          report.failures += 1;
          continue;
        }
        await bookingsService.logEvent(booking.id, FOLLOW_UP_EVENTS.alternatives, 'SYSTEM', undefined, {
          proposed: alternatives.length,
          ...(outcome ?? {}),
        });
        if (outcome) report.alternatives += 1;
      }
    } catch (error) {
      report.failures += 1;
      console.error(`[FollowUp] ${action} ${booking.reference} :`, error instanceof Error ? error.message : error);
    }
  }

  const completedRows = await reviewCandidates(supabase, now);
  const reviewed = new Set<string>();
  if (completedRows.length > 0) {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('booking_id')
      .in('booking_id', completedRows.map((booking) => booking.id));
    for (const row of reviews ?? []) if (row.booking_id) reviewed.add(row.booking_id as string);
  }

  for (const booking of planReviewRequests(completedRows, reviewed, now)) {
    try {
      const outcome = await requestReview(booking, appUrl);
      if (!delivered(outcome)) {
        report.failures += 1;
        continue;
      }
      await bookingsService.logEvent(booking.id, FOLLOW_UP_EVENTS.reviewRequest, 'SYSTEM', undefined, { ...outcome });
      report.reviewRequests += 1;
    } catch (error) {
      report.failures += 1;
      console.error(`[FollowUp] avis ${booking.reference} :`, error instanceof Error ? error.message : error);
    }
  }

  return report;
}
