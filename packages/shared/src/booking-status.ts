/** Statuts canoniques du cycle de vie réservation (marketplace ClickDrive). */
export const BOOKING_STATUSES = [
  'REQUESTED',
  'UNDER_REVIEW',
  'SENT_TO_AGENCY',
  'AGENCY_REVIEW',
  'APPROVED',
  'REJECTED',
  'ALTERNATIVE_PROPOSED',
  'READY_FOR_PICKUP',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  /** Legacy — migrer vers REQUESTED / APPROVED */
  'PENDING',
  'CONFIRMED',
  'NO_SHOW',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuts qui bloquent le calendrier véhicule (overlap). */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  'APPROVED',
  'READY_FOR_PICKUP',
  'ACTIVE',
  'CONFIRMED',
];

export function isBlockingBookingStatus(status: string): boolean {
  return (BLOCKING_BOOKING_STATUSES as readonly string[]).includes(status);
}

export function normalizeBookingStatus(status: string): BookingStatus {
  if (status === 'PENDING') return 'REQUESTED';
  if (status === 'CONFIRMED') return 'APPROVED';
  return status as BookingStatus;
}
