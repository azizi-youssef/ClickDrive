/**
 * Suivi GPS — types du domaine (partagés serveur / navigateur).
 * Les valeurs énumérées reflètent les contraintes CHECK des migrations 20261119000100/200.
 */

export const TRACKING_STATES = ['UNTRACKED', 'DISABLED', 'AWAITING', 'OFFLINE', 'MOVING', 'STATIONARY'] as const;
export type TrackingState = (typeof TRACKING_STATES)[number];

export const TRACKER_STATUSES = ['PENDING', 'ACTIVE', 'DISABLED', 'DISCONNECTED'] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

export const LOCATION_QUALITIES = ['OK', 'JUMP', 'LOW_ACCURACY', 'LATE'] as const;
export type LocationQuality = (typeof LOCATION_QUALITIES)[number];

export const ALERT_TYPES = [
  'DEVICE_OFFLINE',
  'GEOFENCE_ENTER',
  'GEOFENCE_EXIT',
  'SPEED_LIMIT',
  'UNEXPECTED_MOVEMENT',
  'TRACKER_DISCONNECTED',
  'TRACKER_TAMPER',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const LEGAL_BASES = ['CONTRACT', 'LEGITIMATE_INTEREST', 'CONSENT', 'OTHER'] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

/** Libellés français (le back-office agence est en français uniquement) */
export const STATE_LABELS: Record<TrackingState, string> = {
  UNTRACKED: 'Sans boîtier',
  DISABLED: 'Boîtier en pause',
  AWAITING: 'En attente de position',
  OFFLINE: 'Hors ligne',
  MOVING: 'En mouvement',
  STATIONARY: 'À l’arrêt',
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  DEVICE_OFFLINE: 'Boîtier hors ligne',
  GEOFENCE_ENTER: 'Entrée dans une zone',
  GEOFENCE_EXIT: 'Sortie d’une zone',
  SPEED_LIMIT: 'Vitesse excessive',
  UNEXPECTED_MOVEMENT: 'Mouvement inattendu',
  TRACKER_DISCONNECTED: 'Boîtier débranché',
  TRACKER_TAMPER: 'Boîtier manipulé',
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  INFO: 'Information',
  WARNING: 'Avertissement',
  CRITICAL: 'Critique',
};

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface VehicleIdentity {
  id: string;
  brand: string;
  model: string;
  unit_number: string | null;
  license_plate: string | null;
}

export interface LivePosition extends GeoPoint {
  speed_kmh: number | null;
  heading_deg: number | null;
  ignition: boolean | null;
  accuracy_m: number | null;
  recorded_at: string;
}

export interface FleetVehicle extends VehicleIdentity {
  vehicle_type: 'CAR' | 'MOTORCYCLE';
  state: TrackingState;
  open_alerts: number;
  booking_reference: string | null;
  tracker: { id: string; provider: string; label: string | null; status: TrackerStatus; last_seen_at: string | null } | null;
  position: LivePosition | null;
}

export interface FleetSummary {
  total_vehicles: number;
  tracked: number;
  online: number;
  moving: number;
  stationary: number;
  offline: number;
  awaiting: number;
  disabled: number;
  untracked: number;
  open_alerts: number;
}

export interface FleetOverview {
  summary: FleetSummary;
  total: number;
  limit: number;
  offset: number;
  generated_at: string;
  vehicles: FleetVehicle[];
}

export interface VehicleDetail {
  vehicle: VehicleIdentity & { vehicle_type: 'CAR' | 'MOTORCYCLE'; status: string };
  state: TrackingState;
  offline_after_minutes: number;
  tracker: {
    id: string;
    provider: string;
    label: string | null;
    status: TrackerStatus;
    last_seen_at: string | null;
    installed_at: string | null;
    capabilities: Record<string, boolean>;
  } | null;
  position: (LivePosition & { movement_state: 'MOVING' | 'STATIONARY' }) | null;
  /** Référence, dates et statut seulement : aucune donnée personnelle du locataire */
  booking: { reference: string; start_date: string; end_date: string; status: string } | null;
  today: { trips: number; distance_km: number; max_speed_kmh: number };
  open_alerts: number;
  geofences: { id: string; name: string; enabled: boolean; inside: boolean | null }[];
}

export interface HistoryPoint extends GeoPoint {
  id: number;
  recorded_at: string;
  speed_kmh: number | null;
  heading_deg: number | null;
  ignition: boolean | null;
  quality: LocationQuality;
}

export interface HistoryPage {
  points: HistoryPoint[];
  limit: number;
  next_cursor: { recorded_at: string; id: number } | null;
}

export interface TripSummary {
  id: string;
  vehicle: VehicleIdentity;
  booking_reference: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  started_at: string;
  ended_at: string | null;
  start: GeoPoint;
  end: GeoPoint | null;
  distance_km: number;
  duration_seconds: number;
  max_speed_kmh: number;
  closed_reason: string | null;
}

export interface TripsPage {
  total: number;
  limit: number;
  offset: number;
  trips: TripSummary[];
}

export interface TripRoute {
  trip_id: string;
  total_points: number;
  points: { recorded_at: string; latitude: number; longitude: number; speed_kmh: number | null }[];
}

export interface TrackingAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  occurred_at: string;
  resolved_at: string | null;
  ongoing: boolean;
  status: AlertStatus;
  acknowledged_at: string | null;
  vehicle: VehicleIdentity;
  geofence_name: string | null;
  booking_reference: string | null;
  position: GeoPoint | null;
  metadata: Record<string, unknown>;
}

export interface AlertsPage {
  total: number;
  open_total: number;
  limit: number;
  offset: number;
  alerts: TrackingAlert[];
}

export interface TrackerRecord {
  id: string;
  provider: string;
  external_device_id: string;
  label: string | null;
  device_model: string | null;
  status: TrackerStatus;
  state: TrackingState;
  installed_at: string | null;
  last_seen_at: string | null;
  last_position_at: string | null;
  disconnected_at: string | null;
  capabilities: Record<string, boolean>;
  vehicle: VehicleIdentity | null;
  history: { vehicle_label: string; assigned_at: string; unassigned_at: string | null; reason: string | null }[];
}

export interface GeofenceRecord {
  id: string;
  name: string;
  shape: 'CIRCLE';
  center_latitude: number;
  center_longitude: number;
  radius_m: number;
  enabled: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  created_at: string;
  vehicle_ids: string[];
}

export interface TrackingSettings {
  agency_id: string;
  retention_days: number;
  trip_retention_days: number;
  offline_after_minutes: number;
  moving_speed_kmh: number;
  trip_end_idle_minutes: number;
  speed_alerts_enabled: boolean;
  speed_limit_kmh: number | null;
  unexpected_movement_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  legal_basis: LegalBasis | null;
  cndp_reference: string | null;
  customers_informed_at: string | null;
  /** false : aucune ligne enregistrée, valeurs par défaut affichées */
  configured: boolean;
}

/** Événement normalisé transmis à tracking_ingest_event (clés alignées sur la fonction SQL) */
export interface NormalizedTrackingEvent {
  event_id?: string;
  recorded_at: string;
  latitude?: number;
  longitude?: number;
  speed_kmh?: number;
  heading_deg?: number;
  altitude_m?: number;
  accuracy_m?: number;
  satellites?: number;
  ignition?: boolean;
  odometer_km?: number;
  battery_v?: number;
  tamper?: boolean;
  power_disconnected?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export type IngestStatus = 'accepted' | 'duplicate' | 'unknown_device' | 'unassigned' | 'disabled' | 'rejected';

export interface IngestResult {
  status: IngestStatus;
  reason?: string;
  quality?: LocationQuality | null;
  late?: boolean;
}
