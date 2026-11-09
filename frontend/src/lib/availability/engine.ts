import { isBlockingBookingStatus } from '@clickdrive/shared/booking-status';
import { Vehicle, Booking } from '@/types';

/**
 * Checks if two date ranges overlap
 */
export function doDatesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Determines if a specific vehicle is available for the given date range,
 * considering accepted/active bookings. Pending requests have no expiry policy
 * and therefore do not reserve dates.
 */
export function isVehicleAvailable(
  vehicle: Vehicle,
  bookings: Pick<Booking, 'vehicle_id' | 'start_date' | 'end_date' | 'status'>[],
  startDate?: string,
  endDate?: string
): boolean {
  if (!vehicle.published) {
    return false;
  }

  if (!startDate || !endDate) {
    return vehicle.status === 'AVAILABLE';
  }

  if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'BLOCKED') {
    return false;
  }

  // Check against active/confirmed bookings
  const hasConflict = bookings.some((b) => {
    if (b.vehicle_id !== vehicle.id) return false;
    if (!isBlockingBookingStatus(b.status)) return false;
    return doDatesOverlap(startDate, endDate, b.start_date, b.end_date);
  });

  return !hasConflict;
}

/**
 * Core Proposition Moteur:
 * When a requested vehicle is unavailable or being viewed,
 * find exact or equivalent models available at other verified agencies in Nador!
 */
export function findSameModelAlternatives(params: {
  currentVehicle: Vehicle;
  allVehicles: Vehicle[];
  allBookings: Booking[];
  startDate?: string;
  endDate?: string;
}): Vehicle[] {
  const { currentVehicle, allVehicles, allBookings, startDate, endDate } = params;

  return allVehicles.filter((v) => {
    // Exclude the current vehicle itself
    if (v.id === currentVehicle.id) return false;

    // Check same model or same brand+category
    const isExactModelMatch =
      v.brand.toLowerCase() === currentVehicle.brand.toLowerCase() &&
      v.model.toLowerCase() === currentVehicle.model.toLowerCase();

    const isCategoryMatch =
      v.category === currentVehicle.category &&
      v.transmission === currentVehicle.transmission;

    if (!isExactModelMatch && !isCategoryMatch) {
      return false;
    }

    // Must be available for the selected dates
    return isVehicleAvailable(v, allBookings, startDate, endDate);
  });
}
