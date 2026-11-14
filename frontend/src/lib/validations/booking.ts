export {
  bookingRequestSchema,
  bookingDatesSchema,
  bookingAvailabilityCheckSchema,
  bookingCancellationSchema,
  bookingStatusUpdateSchema,
  agencyBookingActionSchema,
  deliveryTypeEnum,
  DATE_FORMAT_REGEX,
  TIME_FORMAT_REGEX,
  type BookingRequestInput,
  type BookingDatesInput,
  type BookingAvailabilityCheckInput,
  type BookingCancellationInput,
} from '@clickdrive/shared/booking-schema';

import { z } from 'zod';

/** Schéma simplifié legacy (Express / compat). */
export const bookingSchema = z.object({
  vehicleId: z.string().min(1),
  agencyId: z.string().min(1),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8),
  startDate: z.string(),
  endDate: z.string(),
  pickupTime: z.string().default('10:00'),
  dropoffTime: z.string().default('10:00'),
  pickupLocation: z.string(),
  dropoffLocation: z.string(),
  notes: z.string().optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
