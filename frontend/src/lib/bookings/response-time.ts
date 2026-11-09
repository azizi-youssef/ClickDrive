import { createAdminClient } from '@/lib/supabase/server';

/**
 * Délai de réponse d'une agence : médiane entre la demande et la première réponse de l'agence
 * (acceptation, refus ou alternative), sur les 120 derniers jours. Affiché seulement à partir de
 * 3 réponses mesurées : en dessous, la valeur ne dirait rien de fiable.
 */

const RESPONSE_EVENTS = new Set(['AGENCY_ACCEPTED', 'AGENCY_REJECTED', 'ALTERNATIVE_PROPOSED']);
export const MIN_RESPONSES = 3;

type EventLike = { event_type: string; created_at: string };
type BookingLike = { created_at: string; events?: EventLike[] | null };

/** Minutes entre la demande et la première réponse de l'agence, ou null sans réponse */
export function responseMinutes(booking: BookingLike): number | null {
  const start = Date.parse(booking.created_at);
  if (!Number.isFinite(start)) return null;
  const answers = (booking.events ?? [])
    .filter((event) => RESPONSE_EVENTS.has(event.event_type))
    .map((event) => Date.parse(event.created_at))
    .filter((time) => Number.isFinite(time) && time >= start);
  return answers.length > 0 ? (Math.min(...answers) - start) / 60_000 : null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Libellé arrondi vers le haut, pour ne jamais promettre plus vite que la réalité */
export function responseTimeLabel(minutes: number): string {
  if (minutes <= 30) return 'en moins de 30 min';
  if (minutes <= 60) return 'en moins de 1 h';
  if (minutes <= 120) return 'en moins de 2 h';
  if (minutes <= 360) return 'en moins de 6 h';
  if (minutes <= 24 * 60) return 'en moins de 24 h';
  return 'en plus de 24 h';
}

export type AgencyResponseTime = { medianMinutes: number; responses: number; label: string };

export function summarizeResponseTimes(bookings: readonly BookingLike[]): AgencyResponseTime | null {
  const values = bookings.map(responseMinutes).filter((value): value is number => value !== null);
  const value = median(values);
  if (value === null || values.length < MIN_RESPONSES) return null;
  return { medianMinutes: Math.round(value), responses: values.length, label: responseTimeLabel(value) };
}

export async function loadAgencyResponseTime(agencyId: string, now = new Date()): Promise<AgencyResponseTime | null> {
  try {
    const supabase = await createAdminClient();
    if (!supabase) return null;
    const since = new Date(now.getTime() - 120 * 24 * 60 * 60_000).toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .select('created_at, events:booking_events(event_type, created_at)')
      .eq('agency_id', agencyId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return summarizeResponseTimes((data ?? []) as BookingLike[]);
  } catch (error) {
    console.warn('[ResponseTime] Délai de réponse indisponible :', error instanceof Error ? error.message : error);
    return null;
  }
}
