import { createAdminClient } from '@/lib/supabase/server';
import { bookingsService } from '@/lib/services/bookings.service';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { toPublicVehicles } from '@/lib/vehicles/public';
import {
  FOLLOW_UP_EVENTS,
  PENDING_STATUSES,
  REMINDER_AFTER_MINUTES,
  pickAlternatives,
  planPendingFollowUps,
  planReviewRequests,
  type FollowUpBooking,
} from './follow-up';
import { offerPendingAlternatives, remindAgency, requestReview, type ChannelOutcome } from './notifications';

const SELECT = '*, vehicle:vehicles(*), agency:agencies(*), events:booking_events(event_type, created_at)';
const MAX_PER_RUN = 25;

export type FollowUpReport = {
  reminders: number;
  alternatives: number;
  reviewRequests: number;
  failures: number;
};

function delivered(outcome: ChannelOutcome): boolean {
  return outcome.email === 'sent' || outcome.whatsapp === 'sent';
}

/**
 * Un passage de la tâche planifiée. Un envoi qui n'a abouti sur aucun canal n'est pas journalisé :
 * il sera retenté au passage suivant (fournisseur en panne, modèle WhatsApp pas encore approuvé…).
 */
export async function runBookingFollowUp(appUrl: string, now = new Date()): Promise<FollowUpReport> {
  const supabase = await createAdminClient();
  if (!supabase) throw new Error('Base de données indisponible pour les relances.');
  const report: FollowUpReport = { reminders: 0, alternatives: 0, reviewRequests: 0, failures: 0 };

  // Statuts des véhicules dont la location est terminée (sortie des lectures publiques)
  const { error: expireError } = await supabase.rpc('expire_completed_bookings');
  if (expireError) console.warn('[FollowUp] Expiration des locations terminées impossible :', expireError.message);

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

  for (const { booking, action, waitingMinutes } of planPendingFollowUps((pending ?? []) as FollowUpBooking[], now)) {
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

  const completedSince = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
  const { data: completed, error: completedError } = await supabase
    .from('bookings')
    .select(SELECT)
    .eq('status', 'COMPLETED')
    .gte('updated_at', completedSince)
    .order('updated_at', { ascending: true })
    .limit(MAX_PER_RUN);
  if (completedError) throw new Error(completedError.message);
  const completedRows = (completed ?? []) as FollowUpBooking[];
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
