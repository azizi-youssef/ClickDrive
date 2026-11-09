import type { Booking, Vehicle } from '@/types';
import { vehicleTypeOf } from '@/lib/vehicles/kind';
import type { AlternativeVehicle } from '@/lib/email/templates';

/**
 * Relances automatiques (tâche planifiée toutes les 15 minutes) :
 *  - agence silencieuse 30 min après une demande : rappel par e-mail et WhatsApp ;
 *  - toujours sans réponse après 2 h : le client reçoit des véhicules libres aux mêmes dates
 *    (sa demande reste valable) ;
 *  - location terminée depuis 3 h : demande d'avis vérifié.
 * Chaque relance est journalisée dans booking_events et n'est jamais envoyée deux fois.
 * Les relances ne partent qu'entre 8 h et 22 h (heure du Maroc).
 */

export const PENDING_STATUSES = ['REQUESTED', 'PENDING', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW'] as const;

export const FOLLOW_UP_EVENTS = {
  agencyReminder: 'AGENCY_REMINDER_SENT',
  alternatives: 'CUSTOMER_ALTERNATIVES_SENT',
  reviewRequest: 'REVIEW_REQUESTED',
} as const;

export const REMINDER_AFTER_MINUTES = 30;
export const ALTERNATIVES_AFTER_MINUTES = 120;
export const REVIEW_AFTER_MINUTES = 180;

type EventLike = { event_type: string; created_at?: string };
export type FollowUpBooking = Booking & { events?: EventLike[] | null };

export type PendingAction = { booking: FollowUpBooking; action: 'remind' | 'alternatives'; waitingMinutes: number };

/** Heure du Maroc (Africa/Casablanca), de 0 à 23 */
export function moroccoHour(now: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Casablanca' }).format(now);
  return Number(hour);
}

export function isFollowUpHours(now: Date): boolean {
  const hour = moroccoHour(now);
  return hour >= 8 && hour < 22;
}

function hasEvent(booking: FollowUpBooking, eventType: string): boolean {
  return (booking.events ?? []).some((event) => event.event_type === eventType);
}

function minutesSince(iso: string | undefined, now: Date): number {
  const time = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(time) ? (now.getTime() - time) / 60_000 : -1;
}

/** Actions à mener sur les demandes encore sans réponse (une action par demande et par passage) */
export function planPendingFollowUps(bookings: readonly FollowUpBooking[], now: Date): PendingAction[] {
  if (!isFollowUpHours(now)) return [];
  const actions: PendingAction[] = [];
  for (const booking of bookings) {
    if (!(PENDING_STATUSES as readonly string[]).includes(booking.status)) continue;
    const waiting = minutesSince(booking.created_at, now);
    if (waiting < REMINDER_AFTER_MINUTES) continue;
    if (!hasEvent(booking, FOLLOW_UP_EVENTS.agencyReminder)) {
      actions.push({ booking, action: 'remind', waitingMinutes: waiting });
    } else if (waiting >= ALTERNATIVES_AFTER_MINUTES && !hasEvent(booking, FOLLOW_UP_EVENTS.alternatives)) {
      actions.push({ booking, action: 'alternatives', waitingMinutes: waiting });
    }
  }
  return actions;
}

/** Locations terminées à qui demander un avis (pas encore demandé, pas encore donné) */
export function planReviewRequests(
  bookings: readonly FollowUpBooking[],
  reviewedBookingIds: ReadonlySet<string>,
  now: Date
): FollowUpBooking[] {
  if (!isFollowUpHours(now)) return [];
  return bookings.filter((booking) => {
    if (booking.status !== 'COMPLETED' || reviewedBookingIds.has(booking.id)) return false;
    if (hasEvent(booking, FOLLOW_UP_EVENTS.reviewRequest)) return false;
    const since = minutesSince((booking as { completed_at?: string }).completed_at ?? booking.end_date, now);
    return since >= REVIEW_AFTER_MINUTES && since <= 30 * 24 * 60;
  });
}

/** Jusqu'à 3 véhicules libres du même type que la demande, au prix le plus proche */
export function pickAlternatives(
  available: readonly Vehicle[],
  booking: FollowUpBooking,
  appUrl: string,
  max = 3
): AlternativeVehicle[] {
  const wantedType = booking.vehicle ? vehicleTypeOf(booking.vehicle) : 'CAR';
  const reference = Number(booking.daily_price ?? booking.vehicle?.daily_price ?? 0);
  return available
    .filter((vehicle) => vehicle.id !== booking.vehicle_id && vehicleTypeOf(vehicle) === wantedType)
    .sort((a, b) => Math.abs(a.daily_price - reference) - Math.abs(b.daily_price - reference))
    .slice(0, max)
    .map((vehicle) => ({
      label: `${vehicle.brand} ${vehicle.model}${vehicle.agency?.name ? ` · ${vehicle.agency.name}` : ''}`,
      pricePerDay: vehicle.daily_price,
      url: `${appUrl}/cars/${encodeURIComponent(vehicle.slug)}?startDate=${booking.start_date.slice(0, 10)}&endDate=${booking.end_date.slice(0, 10)}`,
    }));
}
