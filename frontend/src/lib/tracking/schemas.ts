import { z } from 'zod';
import { ALERT_SEVERITIES, ALERT_STATUSES, ALERT_TYPES, LEGAL_BASES, TRACKING_STATES, type NormalizedTrackingEvent } from './types';
import { isValidCoordinate } from './geo.utils';

/**
 * Suivi GPS — schémas Zod : requêtes de l'API agence, événements du webhook, réponses des fonctions SQL.
 * Zod v4. Les corps de requête sont « stricts » : un champ inconnu (agency_id, vehicle_id…) est refusé.
 */

const DAY_MS = 86_400_000;

export const uuidSchema = z.uuid();
export const isoDateTime = z.iso.datetime({ offset: true });

const optionalAgencyId = z.object({ agency_id: uuidSchema.optional() });

const booleanParam = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** Lit `?agency_id=` : l'agence est toujours revalidée côté serveur (appartenance + permission) */
export const agencyQuerySchema = optionalAgencyId;

// ---------------------------------------------------------------------------
// Requêtes de lecture
// ---------------------------------------------------------------------------
export const fleetQuerySchema = optionalAgencyId.extend({
  q: z.string().trim().max(80).optional(),
  state: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(['ALL', 'ALERTS', ...TRACKING_STATES]))
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

function rangeSchema(maxDays: number) {
  return z
    .object({ from: isoDateTime, to: isoDateTime })
    .superRefine((range, ctx) => {
      const from = Date.parse(range.from);
      const to = Date.parse(range.to);
      if (!(to > from)) ctx.addIssue({ code: 'custom', message: 'La fin de période doit suivre le début.', path: ['to'] });
      else if (to - from > maxDays * DAY_MS) {
        ctx.addIssue({ code: 'custom', message: `La période ne peut pas dépasser ${maxDays} jours.`, path: ['to'] });
      }
    });
}

export const historyQuerySchema = optionalAgencyId
  .extend({
    from: isoDateTime,
    to: isoDateTime,
    limit: z.coerce.number().int().min(1).max(1000).default(500),
    // Curseur opaque : « <recorded_at ISO>|<id> », encodé en base64url
    cursor: z.string().max(200).optional(),
    include_suspect: booleanParam.optional(),
  })
  .and(rangeSchema(31));

export const tripsQuerySchema = optionalAgencyId
  .extend({
    from: isoDateTime,
    to: isoDateTime,
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25),
    vehicle_id: uuidSchema.optional(),
  })
  .and(rangeSchema(93));

export const alertsQuerySchema = optionalAgencyId.extend({
  status: z.enum(ALERT_STATUSES).optional(),
  type: z.enum(ALERT_TYPES).optional(),
  severity: z.enum(ALERT_SEVERITIES).optional(),
  vehicle_id: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

export const routeQuerySchema = optionalAgencyId.extend({
  max_points: z.coerce.number().int().min(20).max(1500).default(800),
});

export function encodeCursor(cursor: { recorded_at: string; id: number }): string {
  return Buffer.from(`${cursor.recorded_at}|${cursor.id}`).toString('base64url');
}

export function decodeCursor(value: string): { recorded_at: string; id: number } | null {
  try {
    const [recordedAt, id] = Buffer.from(value, 'base64url').toString('utf8').split('|');
    const parsedId = Number(id);
    if (!recordedAt || !isoDateTime.safeParse(recordedAt).success || !Number.isSafeInteger(parsedId) || parsedId < 0) return null;
    return { recorded_at: recordedAt, id: parsedId };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Corps de requête
// ---------------------------------------------------------------------------
export const providerIdSchema = z.string().trim().regex(/^[a-z][a-z0-9_-]{1,39}$/, 'Fournisseur invalide');
export const externalDeviceIdSchema = z
  .string()
  .trim()
  .min(1, 'Identifiant du boîtier requis')
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Caractères autorisés : lettres, chiffres, . _ : -');

export const trackerCreateSchema = z.strictObject({
  provider: providerIdSchema,
  external_device_id: externalDeviceIdSchema,
  label: z.string().trim().min(1).max(80).optional(),
  device_model: z.string().trim().max(80).optional(),
  vehicle_id: uuidSchema.nullable().optional(),
  installed_at: isoDateTime.optional(),
});

/**
 * Une requête = une opération : modifier des champs, affecter/retirer un véhicule, ou déconnecter.
 * (chaque opération est atomique côté base ; les mélanger ne le serait pas)
 */
export const trackerPatchSchema = z
  .strictObject({
    label: z.string().trim().max(80).nullable().optional(),
    device_model: z.string().trim().max(80).nullable().optional(),
    installed_at: isoDateTime.nullable().optional(),
    enabled: z.boolean().optional(),
    vehicle_id: uuidSchema.nullable().optional(),
    disconnect: z.literal(true).optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .superRefine((body, ctx) => {
    const fieldKeys = ['label', 'device_model', 'installed_at', 'enabled'].filter((key) => key in body);
    const hasAssign = 'vehicle_id' in body;
    const hasDisconnect = body.disconnect === true;
    const operations = Number(fieldKeys.length > 0) + Number(hasAssign) + Number(hasDisconnect);
    if (operations === 0) ctx.addIssue({ code: 'custom', message: 'Aucune modification demandée.' });
    if (operations > 1) ctx.addIssue({ code: 'custom', message: 'Une seule opération par requête (modifier, affecter ou déconnecter).' });
  });

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const geofenceSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'Nom requis').max(80),
    center_latitude: latitude,
    center_longitude: longitude,
    radius_m: z.number().int().min(25, 'Rayon minimal : 25 m').max(100_000, 'Rayon maximal : 100 km'),
    enabled: z.boolean().default(true),
    alert_on_enter: z.boolean().default(true),
    alert_on_exit: z.boolean().default(true),
    vehicle_ids: z.array(uuidSchema).max(500).default([]),
  })
  .refine((value) => isValidCoordinate(value.center_latitude, value.center_longitude), {
    message: 'Coordonnées du centre invalides.',
    path: ['center_latitude'],
  });

export const alertPatchSchema = z.strictObject({ action: z.literal('acknowledge') });

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Heure invalide (HH:MM)');

export const settingsPatchSchema = z
  .strictObject({
    retention_days: z.number().int().min(7).max(730),
    trip_retention_days: z.number().int().min(30).max(1825),
    offline_after_minutes: z.number().int().min(2).max(1440),
    moving_speed_kmh: z.number().int().min(1).max(30),
    trip_end_idle_minutes: z.number().int().min(1).max(60),
    speed_alerts_enabled: z.boolean(),
    speed_limit_kmh: z.number().int().min(20).max(250).nullable(),
    unexpected_movement_enabled: z.boolean(),
    quiet_hours_start: timeOfDay,
    quiet_hours_end: timeOfDay,
    legal_basis: z.enum(LEGAL_BASES).nullable(),
    cndp_reference: z.string().trim().max(120).nullable(),
    customers_informed: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucune modification demandée.' })
  .refine((value) => !(value.speed_alerts_enabled === true && value.speed_limit_kmh === null), {
    message: 'Renseignez une limite de vitesse pour activer l’alerte.',
    path: ['speed_limit_kmh'],
  });

export const supportGrantSchema = z.strictObject({
  agency_id: uuidSchema,
  reason: z.string().trim().min(10, 'Motif d’au moins 10 caractères requis').max(500),
  minutes: z.number().int().min(5).max(120).default(30),
});

// ---------------------------------------------------------------------------
// Webhook : enveloppe et événement normalisé (contrat « klickdrive-gateway », version 1)
// ---------------------------------------------------------------------------
export const MAX_EVENTS_PER_DELIVERY = 100;

const metadataSchema = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
  .refine((value) => Object.keys(value).length <= 20, { message: 'Trop de métadonnées' });

/**
 * Événement normalisé reçu d'une passerelle. Les clés inconnues sont IGNORÉES (strip) : un `agency_id` ou
 * `vehicle_id` fourni par l'émetteur n'est jamais transmis à la base, qui résout l'appareil elle-même.
 */
export const gatewayEventSchema = z
  .object({
    device_id: externalDeviceIdSchema,
    event_id: z.string().trim().min(1).max(200).optional(),
    recorded_at: isoDateTime,
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    speed_kmh: z.number().min(0).max(400).optional(),
    heading_deg: z.number().min(0).max(360).optional(),
    altitude_m: z.number().min(-1000).max(100_000).optional(),
    accuracy_m: z.number().min(0).max(1_000_000).optional(),
    satellites: z.number().int().min(0).max(100).optional(),
    ignition: z.boolean().optional(),
    odometer_km: z.number().min(0).max(100_000_000).optional(),
    battery_v: z.number().min(0).max(100).optional(),
    tamper: z.boolean().optional(),
    power_disconnected: z.boolean().optional(),
    metadata: metadataSchema.optional(),
  })
  .superRefine((event, ctx) => {
    const hasLat = event.latitude !== undefined;
    const hasLon = event.longitude !== undefined;
    if (hasLat !== hasLon || (hasLat && !isValidCoordinate(event.latitude, event.longitude))) {
      ctx.addIssue({ code: 'custom', message: 'Coordonnées invalides', path: ['latitude'] });
    }
    if (!hasLat && event.tamper === undefined && event.power_disconnected === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Événement vide (ni position, ni signal matériel)' });
    }
  });

export const gatewayEnvelopeSchema = z.object({
  events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_DELIVERY),
});

export type GatewayEvent = z.infer<typeof gatewayEventSchema>;

/** Convertit un événement validé en charge utile pour tracking_ingest_event (sans l'identifiant d'appareil) */
export function toIngestPayload(event: GatewayEvent): NormalizedTrackingEvent {
  const { device_id: _deviceId, ...rest } = event;
  void _deviceId;
  return rest as NormalizedTrackingEvent;
}

// ---------------------------------------------------------------------------
// Réponses des fonctions SQL (validation défensive : une dérive de schéma ne doit pas atteindre l'interface)
// ---------------------------------------------------------------------------
const nullableNumber = z.number().nullable();

const vehicleIdentity = z.object({
  id: uuidSchema,
  brand: z.string(),
  model: z.string(),
  unit_number: z.string().nullable(),
  license_plate: z.string().nullable(),
});

const livePosition = z.object({
  latitude: z.number(),
  longitude: z.number(),
  speed_kmh: nullableNumber,
  heading_deg: nullableNumber,
  ignition: z.boolean().nullable(),
  accuracy_m: nullableNumber,
  recorded_at: z.string(),
});

export const fleetOverviewSchema = z.object({
  summary: z.object({
    total_vehicles: z.number(),
    tracked: z.number(),
    online: z.number(),
    moving: z.number(),
    stationary: z.number(),
    offline: z.number(),
    awaiting: z.number(),
    disabled: z.number(),
    untracked: z.number(),
    open_alerts: z.number(),
  }),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  generated_at: z.string(),
  vehicles: z.array(
    vehicleIdentity.extend({
      vehicle_type: z.enum(['CAR', 'MOTORCYCLE']),
      state: z.enum(TRACKING_STATES),
      open_alerts: z.number(),
      booking_reference: z.string().nullable(),
      tracker: z
        .object({ id: uuidSchema, provider: z.string(), label: z.string().nullable(), status: z.string(), last_seen_at: z.string().nullable() })
        .nullable(),
      position: livePosition.nullable(),
    })
  ),
});

export const vehicleDetailSchema = z.object({
  vehicle: vehicleIdentity.extend({ vehicle_type: z.enum(['CAR', 'MOTORCYCLE']), status: z.string() }),
  state: z.enum(TRACKING_STATES),
  offline_after_minutes: z.number(),
  tracker: z
    .object({
      id: uuidSchema,
      provider: z.string(),
      label: z.string().nullable(),
      status: z.string(),
      last_seen_at: z.string().nullable(),
      installed_at: z.string().nullable(),
      capabilities: z.record(z.string(), z.boolean()),
    })
    .nullable(),
  position: livePosition.extend({ movement_state: z.enum(['MOVING', 'STATIONARY']) }).nullable(),
  booking: z.object({ reference: z.string(), start_date: z.string(), end_date: z.string(), status: z.string() }).nullable(),
  today: z.object({ trips: z.number(), distance_km: z.number(), max_speed_kmh: z.number() }),
  open_alerts: z.number(),
  geofences: z.array(z.object({ id: uuidSchema, name: z.string(), enabled: z.boolean(), inside: z.boolean().nullable() })),
});

export const historyPageSchema = z.object({
  points: z.array(
    z.object({
      id: z.number(),
      recorded_at: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      speed_kmh: nullableNumber,
      heading_deg: nullableNumber,
      ignition: z.boolean().nullable(),
      quality: z.enum(['OK', 'JUMP', 'LOW_ACCURACY', 'LATE']),
    })
  ),
  limit: z.number(),
  next_cursor: z.object({ recorded_at: z.string(), id: z.number() }).nullable(),
});

export const ingestResultSchema = z.object({
  status: z.enum(['accepted', 'duplicate', 'unknown_device', 'unassigned', 'disabled', 'rejected']),
  reason: z.string().optional(),
  quality: z.enum(['OK', 'JUMP', 'LOW_ACCURACY', 'LATE']).nullable().optional(),
  late: z.boolean().optional(),
});
