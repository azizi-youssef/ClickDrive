import { z } from 'zod';
import { BOOKING_STATUSES, type BookingStatus } from './booking-status';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_FORMAT_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const deliveryTypeEnum = z.enum(['AGENCY_PICKUP', 'AIRPORT', 'HOTEL', 'ADDRESS']);

export const bookingDatesSchema = z
  .object({
    startDate: z.string().regex(DATE_FORMAT_REGEX, 'Date de début requise (AAAA-MM-JJ)'),
    endDate: z.string().regex(DATE_FORMAT_REGEX, 'Date de fin requise (AAAA-MM-JJ)'),
    pickupTime: z.string().regex(TIME_FORMAT_REGEX, 'Heure de prise en charge invalide (HH:mm)').default('10:00'),
    dropoffTime: z.string().regex(TIME_FORMAT_REGEX, 'Heure de restitution invalide (HH:mm)').default('10:00'),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'La date de retour doit être égale ou postérieure à la date de début',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      const diffMs = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= 90;
    },
    {
      message: 'La durée de location maximale est de 90 jours',
      path: ['endDate'],
    }
  );

export const bookingAvailabilityCheckSchema = z
  .object({
    vehicleId: z.string().regex(UUID_PATTERN, 'Identifiant véhicule invalide'),
    startDate: z.string().regex(DATE_FORMAT_REGEX, 'Date de début requise (AAAA-MM-JJ)'),
    endDate: z.string().regex(DATE_FORMAT_REGEX, 'Date de fin requise (AAAA-MM-JJ)'),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'La date de fin doit être postérieure ou égale à la date de début',
    path: ['endDate'],
  });

export const bookingCancellationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Le motif d’annulation doit contenir au moins 5 caractères')
    .max(500, 'Le motif d’annulation ne doit pas dépasser 500 caractères'),
  notifyCustomer: z.boolean().default(true),
});

export const bookingRequestSchema = z
  .object({
    // Identifiants issus de la base (UUID) : tout autre format est refusé avant toute requête
    vehicleId: z.string().regex(UUID_PATTERN, 'Identifiant véhicule invalide'),
    agencyId: z.string().regex(UUID_PATTERN, 'Identifiant agence invalide'),
    firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
    lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    // CIN et permis : facultatifs à la demande (présentés en original à la remise des clés) ; vérifiés s'ils sont fournis
    cin: z.string().trim().min(3, 'Numéro de CIN ou passeport trop court').optional().or(z.literal('')),
    phone: z.string().min(8, 'Numéro de téléphone valide requis'),
    email: z.string().email('Adresse email valide').optional().or(z.literal('')),
    country: z.string().min(2, 'Pays de résidence requis').default('Maroc'),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance requise (AAAA-MM-JJ)'),
    licenseNumber: z.string().trim().min(3, 'Numéro de permis de conduire trop court').optional().or(z.literal('')),
    licenseExpiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'expiration du permis invalide (AAAA-MM-JJ)")
      .optional()
      .or(z.literal('')),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de prise en charge requise'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de restitution requise'),
    pickupTime: z.string().default('10:00'),
    dropoffTime: z.string().default('10:00'),
    deliveryType: deliveryTypeEnum.default('AIRPORT'),
    pickupLocation: z.string().min(2, 'Lieu de prise en charge requis'),
    dropoffLocation: z.string().min(2, 'Lieu de restitution requis'),
    flightNumber: z.string().optional(),
    flightArrivalTime: z.string().optional(),
    // Arrivée en ferry au port : compagnie, traversée, heure (texte libre court)
    ferryDetails: z.string().trim().max(160, 'Précisions sur la traversée limitées à 160 caractères').optional(),
    childSeat: z.boolean().default(false),
    additionalDriver: z.boolean().default(false),
    customerNotes: z.string().optional(),
    // Langue du client (site traduit) : e-mails et messages de suivi dans sa langue
    locale: z.enum(['fr', 'ar', 'en', 'de', 'es', 'nl']).optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'La date de retour doit être égale ou postérieure à la date de début',
    path: ['endDate'],
  })
  .refine((data) => !data.licenseExpiry || new Date(data.licenseExpiry) >= new Date(data.endDate), {
    message: 'Le permis de conduire doit être valide pendant toute la durée de la location',
    path: ['licenseExpiry'],
  });

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
export type BookingDatesInput = z.infer<typeof bookingDatesSchema>;
export type BookingAvailabilityCheckInput = z.infer<typeof bookingAvailabilityCheckSchema>;
export type BookingCancellationInput = z.infer<typeof bookingCancellationSchema>;

const bookingStatusEnum = z.enum(
  BOOKING_STATUSES as unknown as [BookingStatus, ...BookingStatus[]]
);

export const bookingStatusUpdateSchema = z.object({
  status: bookingStatusEnum,
  rejectionReason: z.string().optional(),
});

export const agencyBookingActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'propose_alternative']),
  notes: z.string().optional(),
  reason: z.string().optional(),
  alternativeVehicleId: z.string().optional(),
});
