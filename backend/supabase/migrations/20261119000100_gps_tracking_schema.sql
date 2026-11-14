-- ========================================================================
-- ClickDrive : suivi GPS de la flotte — schéma, permissions, RLS, Realtime
-- Migration additive : 20261119000100_gps_tracking_schema.sql
--
-- Décisions structurantes (voir docs/gps-tracking.md) :
--   * le suivi est rattaché au VÉHICULE ; le statut d'une réservation n'est qu'un contexte métier ;
--   * l'agence propriétaire est la seule à lire les positions ; un client n'a aucun accès ;
--   * le Super Admin n'a PAS d'accès implicite : il lui faut une autorisation de support explicite,
--     motivée, limitée dans le temps et journalisée (tracking_support_grants) ;
--   * les écritures de l'agence passent par des fonctions SECURITY DEFINER qui revérifient la permission
--     et écrivent l'audit dans la même transaction ; les tables ne sont en lecture seule (RLS) pour
--     le rôle authenticated ;
--   * l'ingestion (fournisseur GPS) passe par la fonction réservée au service_role (migration suivante).
-- ========================================================================

BEGIN;

-- ------------------------------------------------------------------------
-- 1. Permissions et matrice de rôles
-- ------------------------------------------------------------------------
INSERT INTO public.permissions (permission_key, description) VALUES
    ('tracking.read', 'Consulter le suivi GPS de la flotte de l’agence'),
    ('tracking.manage', 'Gérer les boîtiers GPS et les zones géographiques'),
    ('tracking.alerts.manage', 'Traiter les alertes de suivi GPS'),
    ('tracking.settings.manage', 'Modifier les paramètres, la conservation et la conformité du suivi GPS')
ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;

-- agency_admin : tout ; agency_manager : lecture, gestion des boîtiers/zones et traitement des alertes ;
-- agency_agent et viewer : aucun accès. super_admin n'est volontairement PAS ajouté (accès par autorisation de support).
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
    ('agency_admin', 'tracking.read'),
    ('agency_admin', 'tracking.manage'),
    ('agency_admin', 'tracking.alerts.manage'),
    ('agency_admin', 'tracking.settings.manage'),
    ('agency_manager', 'tracking.read'),
    ('agency_manager', 'tracking.manage'),
    ('agency_manager', 'tracking.alerts.manage')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------
-- 2. Cohérence agence ↔ véhicule : clé composite (permet les clés étrangères composites)
-- ------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'vehicles_id_agency_id_key' AND conrelid = 'public.vehicles'::regclass
    ) THEN
        ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_id_agency_id_key UNIQUE (id, agency_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 3. Paramètres du suivi (une ligne par agence)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_settings (
    agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
    retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 730),
    trip_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (trip_retention_days BETWEEN 30 AND 1825),
    offline_after_minutes INTEGER NOT NULL DEFAULT 15 CHECK (offline_after_minutes BETWEEN 2 AND 1440),
    moving_speed_kmh INTEGER NOT NULL DEFAULT 5 CHECK (moving_speed_kmh BETWEEN 1 AND 30),
    trip_end_idle_minutes INTEGER NOT NULL DEFAULT 5 CHECK (trip_end_idle_minutes BETWEEN 1 AND 60),
    speed_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
    speed_limit_kmh INTEGER CHECK (speed_limit_kmh IS NULL OR speed_limit_kmh BETWEEN 20 AND 250),
    unexpected_movement_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME NOT NULL DEFAULT '22:00',
    quiet_hours_end TIME NOT NULL DEFAULT '06:00',
    -- Déclarations de l'agence (responsable de traitement) : elles documentent, elles ne prouvent aucune conformité
    legal_basis TEXT CHECK (legal_basis IS NULL OR legal_basis IN ('CONTRACT', 'LEGITIMATE_INTEREST', 'CONSENT', 'OTHER')),
    cndp_reference TEXT CHECK (cndp_reference IS NULL OR char_length(cndp_reference) <= 120),
    customers_informed_at TIMESTAMPTZ,
    customers_informed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tracking_settings_speed_limit_required CHECK (NOT speed_alerts_enabled OR speed_limit_kmh IS NOT NULL)
);

-- ------------------------------------------------------------------------
-- 4. Boîtiers GPS (inventaire des appareils)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    vehicle_id UUID,
    provider TEXT NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
    external_device_id TEXT NOT NULL CHECK (
        char_length(external_device_id) BETWEEN 1 AND 128 AND external_device_id ~ '^[A-Za-z0-9._:-]+$'
    ),
    label TEXT CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 80),
    device_model TEXT CHECK (device_model IS NULL OR char_length(device_model) <= 80),
    -- PENDING : enregistré, aucune donnée reçue ; ACTIVE : communique ; DISABLED : mis en pause par l'agence ;
    -- DISCONNECTED : retiré du service (libère l'identifiant fournisseur)
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED', 'DISCONNECTED')),
    installed_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    last_position_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    -- Fonctions réellement observées sur l'appareil (allumage, sabotage…) : jamais supposées
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(capabilities) = 'object'),
    -- Métadonnées non sensibles du fournisseur ; JAMAIS de secret ni d'identifiant d'accès
    provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
        jsonb_typeof(provider_metadata) = 'object' AND octet_length(provider_metadata::text) <= 2000
    ),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_trackers_disconnected_unassigned CHECK (status <> 'DISCONNECTED' OR vehicle_id IS NULL),
    CONSTRAINT vehicle_trackers_id_agency_key UNIQUE (id, agency_id),
    -- Le véhicule appartient à la même agence ; sa suppression physique détache le boîtier (PostgreSQL ≥ 15)
    CONSTRAINT vehicle_trackers_vehicle_agency_fk FOREIGN KEY (vehicle_id, agency_id)
        REFERENCES public.vehicles (id, agency_id) ON DELETE SET NULL (vehicle_id)
);

-- Un identifiant d'appareil n'existe qu'une fois (hors appareils retirés) : le webhook le résout sans ambiguïté
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_trackers_device_active
    ON public.vehicle_trackers (provider, external_device_id) WHERE status <> 'DISCONNECTED';
-- Un véhicule n'a qu'un seul boîtier à la fois
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_trackers_vehicle
    ON public.vehicle_trackers (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_trackers_agency_status
    ON public.vehicle_trackers (agency_id, status);

-- Historique d'affectation boîtier ↔ véhicule (réaffectations tracées)
CREATE TABLE IF NOT EXISTS public.vehicle_tracker_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    tracker_id UUID NOT NULL REFERENCES public.vehicle_trackers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    unassigned_at TIMESTAMPTZ,
    unassigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 300),
    CONSTRAINT vehicle_tracker_assignments_period CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);
CREATE INDEX IF NOT EXISTS idx_tracker_assignments_tracker ON public.vehicle_tracker_assignments (tracker_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_assignments_vehicle ON public.vehicle_tracker_assignments (vehicle_id, assigned_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracker_assignments_open
    ON public.vehicle_tracker_assignments (tracker_id) WHERE unassigned_at IS NULL;

-- ------------------------------------------------------------------------
-- 5. Positions (historique append-only)
-- ------------------------------------------------------------------------
-- Volume : table ordinaire (non partitionnée) ; voir docs/gps-tracking.md § Capacité pour la décision et les seuils.
CREATE TABLE IF NOT EXISTS public.vehicle_locations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agency_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    tracker_id UUID NOT NULL REFERENCES public.vehicle_trackers(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    speed_kmh REAL CHECK (speed_kmh IS NULL OR (speed_kmh >= 0 AND speed_kmh <= 400)),
    heading_deg REAL CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg < 360)),
    altitude_m REAL,
    accuracy_m REAL CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
    satellites SMALLINT CHECK (satellites IS NULL OR satellites >= 0),
    ignition BOOLEAN,
    odometer_km DOUBLE PRECISION CHECK (odometer_km IS NULL OR odometer_km >= 0),
    battery_v REAL CHECK (battery_v IS NULL OR (battery_v >= 0 AND battery_v <= 100)),
    -- OK : exploitable ; JUMP : saut incohérent ; LOW_ACCURACY : fix imprécis ; LATE : reçu après un événement plus récent
    quality TEXT NOT NULL DEFAULT 'OK' CHECK (quality IN ('OK', 'JUMP', 'LOW_ACCURACY', 'LATE')),
    dedupe_key TEXT NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
        jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 2000
    ),
    -- Aucun couple (0, 0) : valeur de repli des boîtiers sans fix
    CONSTRAINT vehicle_locations_not_null_island CHECK (NOT (latitude = 0 AND longitude = 0)),
    CONSTRAINT vehicle_locations_vehicle_agency_fk FOREIGN KEY (vehicle_id, agency_id)
        REFERENCES public.vehicles (id, agency_id) ON DELETE CASCADE
);

-- Idempotence : la même observation d'un même boîtier n'existe qu'une fois
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_locations_dedupe ON public.vehicle_locations (tracker_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_time ON public.vehicle_locations (vehicle_id, recorded_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_agency_time ON public.vehicle_locations (agency_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_booking ON public.vehicle_locations (booking_id, recorded_at) WHERE booking_id IS NOT NULL;

-- ------------------------------------------------------------------------
-- 6. Dernière position connue (une ligne par véhicule) — table diffusée par Realtime
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_tracking_latest (
    vehicle_id UUID PRIMARY KEY,
    agency_id UUID NOT NULL,
    tracker_id UUID NOT NULL REFERENCES public.vehicle_trackers(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    speed_kmh REAL CHECK (speed_kmh IS NULL OR (speed_kmh >= 0 AND speed_kmh <= 400)),
    heading_deg REAL CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg < 360)),
    ignition BOOLEAN,
    accuracy_m REAL,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    movement_state TEXT NOT NULL DEFAULT 'STATIONARY' CHECK (movement_state IN ('MOVING', 'STATIONARY')),
    last_moving_at TIMESTAMPTZ,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    suspect_streak SMALLINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_tracking_latest_vehicle_agency_fk FOREIGN KEY (vehicle_id, agency_id)
        REFERENCES public.vehicles (id, agency_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_latest_agency ON public.vehicle_tracking_latest (agency_id);

-- ------------------------------------------------------------------------
-- 7. Trajets
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    tracker_id UUID REFERENCES public.vehicle_trackers(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    start_latitude DOUBLE PRECISION NOT NULL CHECK (start_latitude >= -90 AND start_latitude <= 90),
    start_longitude DOUBLE PRECISION NOT NULL CHECK (start_longitude >= -180 AND start_longitude <= 180),
    end_latitude DOUBLE PRECISION CHECK (end_latitude IS NULL OR (end_latitude >= -90 AND end_latitude <= 90)),
    end_longitude DOUBLE PRECISION CHECK (end_longitude IS NULL OR (end_longitude >= -180 AND end_longitude <= 180)),
    distance_km DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    max_speed_kmh REAL NOT NULL DEFAULT 0 CHECK (max_speed_kmh >= 0 AND max_speed_kmh <= 400),
    point_count INTEGER NOT NULL DEFAULT 0 CHECK (point_count >= 0),
    last_position_at TIMESTAMPTZ NOT NULL,
    last_moving_at TIMESTAMPTZ,
    closed_reason TEXT CHECK (closed_reason IS NULL OR closed_reason IN (
        'IDLE', 'IGNITION_OFF', 'DEVICE_GAP', 'DATA_BREAK', 'STALE', 'TRACKER_REASSIGNED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_trips_period CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT vehicle_trips_completed_has_end CHECK (status <> 'COMPLETED' OR (ended_at IS NOT NULL AND duration_seconds IS NOT NULL)),
    CONSTRAINT vehicle_trips_vehicle_agency_fk FOREIGN KEY (vehicle_id, agency_id)
        REFERENCES public.vehicles (id, agency_id) ON DELETE CASCADE
);
-- Un seul trajet en cours par véhicule (sûreté en cas de requêtes concurrentes)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_trips_open ON public.vehicle_trips (vehicle_id) WHERE status = 'IN_PROGRESS';
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_vehicle_start ON public.vehicle_trips (vehicle_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_agency_start ON public.vehicle_trips (agency_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_booking ON public.vehicle_trips (booking_id) WHERE booking_id IS NOT NULL;

-- ------------------------------------------------------------------------
-- 8. Zones géographiques (cercles ; `shape`/`geometry` préparent les polygones)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    -- Seul CIRCLE est évalué aujourd'hui. Pour ajouter POLYGON : élargir la contrainte, renseigner `geometry`
    -- (GeoJSON Polygon) et compléter tracking_ingest_event ; aucune autre table ne change.
    shape TEXT NOT NULL DEFAULT 'CIRCLE' CHECK (shape = 'CIRCLE'),
    center_latitude DOUBLE PRECISION NOT NULL CHECK (center_latitude >= -90 AND center_latitude <= 90),
    center_longitude DOUBLE PRECISION NOT NULL CHECK (center_longitude >= -180 AND center_longitude <= 180),
    radius_m INTEGER NOT NULL CHECK (radius_m BETWEEN 25 AND 100000),
    geometry JSONB CHECK (geometry IS NULL OR jsonb_typeof(geometry) = 'object'),
    enabled BOOLEAN NOT NULL DEFAULT true,
    alert_on_enter BOOLEAN NOT NULL DEFAULT true,
    alert_on_exit BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_geofences_id_agency_key UNIQUE (id, agency_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_geofences_name ON public.vehicle_geofences (agency_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.vehicle_geofence_assignments (
    geofence_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    agency_id UUID NOT NULL,
    -- État courant connu (NULL = inconnu : la première position fixe l'état sans alerte)
    inside BOOLEAN,
    state_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (geofence_id, vehicle_id),
    CONSTRAINT vehicle_geofence_assignments_geofence_fk FOREIGN KEY (geofence_id, agency_id)
        REFERENCES public.vehicle_geofences (id, agency_id) ON DELETE CASCADE,
    CONSTRAINT vehicle_geofence_assignments_vehicle_fk FOREIGN KEY (vehicle_id, agency_id)
        REFERENCES public.vehicles (id, agency_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_geofence_assignments_vehicle ON public.vehicle_geofence_assignments (vehicle_id);

-- ------------------------------------------------------------------------
-- 9. Alertes
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    tracker_id UUID REFERENCES public.vehicle_trackers(id) ON DELETE SET NULL,
    geofence_id UUID,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'DEVICE_OFFLINE', 'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'SPEED_LIMIT',
        'UNEXPECTED_MOVEMENT', 'TRACKER_DISCONNECTED', 'TRACKER_TAMPER'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
    description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
    -- Condition durable (hors ligne, vitesse excessive, sabotage…) : une seule alerte ouverte tant qu'elle dure
    ongoing BOOLEAN NOT NULL DEFAULT false,
    dedupe_key TEXT NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED')),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
        jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 2000
    ),
    CONSTRAINT tracking_alerts_ack_consistent CHECK ((status = 'ACKNOWLEDGED') = (acknowledged_at IS NOT NULL)),
    CONSTRAINT tracking_alerts_vehicle_agency_fk FOREIGN KEY (vehicle_id, agency_id)
        REFERENCES public.vehicles (id, agency_id) ON DELETE CASCADE,
    CONSTRAINT tracking_alerts_geofence_agency_fk FOREIGN KEY (geofence_id, agency_id)
        REFERENCES public.vehicle_geofences (id, agency_id) ON DELETE SET NULL (geofence_id)
);
-- Pas de doublon pour une même condition en cours / un même événement ponctuel
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_alerts_ongoing
    ON public.tracking_alerts (agency_id, dedupe_key) WHERE ongoing AND resolved_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_alerts_discrete
    ON public.tracking_alerts (agency_id, dedupe_key) WHERE NOT ongoing;
CREATE INDEX IF NOT EXISTS idx_tracking_alerts_agency_status ON public.tracking_alerts (agency_id, status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_alerts_vehicle ON public.tracking_alerts (vehicle_id, occurred_at DESC);

-- ------------------------------------------------------------------------
-- 10. Audit dédié (immuable) et autorisations de support plateforme
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Identifiants sans clé étrangère : le journal est immuable, une suppression d'agence ou de compte ne doit
    -- ni le bloquer ni le réécrire
    agency_id UUID,
    actor_id UUID,
    actor_kind TEXT NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user', 'system', 'platform_support')),
    action TEXT NOT NULL CHECK (char_length(action) BETWEEN 3 AND 80),
    entity_type TEXT NOT NULL CHECK (char_length(entity_type) BETWEEN 1 AND 60),
    entity_id TEXT,
    -- Jamais de coordonnées, de secret ni de donnée personnelle de locataire dans les métadonnées
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
        jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 4000
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_audit_agency_time ON public.tracking_audit_log (agency_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tracking_audit_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Seule la fonction de purge planifiée (qui pose ce drapeau local) peut supprimer des lignes expirées
    IF TG_OP = 'DELETE' AND current_setting('tracking.audit_purge', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'tracking_audit_log is append-only' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS tracking_audit_immutable ON public.tracking_audit_log;
CREATE TRIGGER tracking_audit_immutable
    BEFORE UPDATE OR DELETE ON public.tracking_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.tracking_audit_immutable();

CREATE TABLE IF NOT EXISTS public.tracking_support_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    granted_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 500),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Autorisation courte : 2 heures au plus (lecture seule : tracking.read uniquement)
    CONSTRAINT tracking_support_grants_duration CHECK (expires_at > starts_at AND expires_at <= starts_at + interval '2 hours')
);
CREATE INDEX IF NOT EXISTS idx_tracking_support_grants_active
    ON public.tracking_support_grants (granted_to, agency_id, expires_at) WHERE revoked_at IS NULL;

-- Suivi des rejets d'ingestion (monitoring des webhooks) : aucune coordonnée, aucun corps de requête
CREATE TABLE IF NOT EXISTS public.tracking_ingest_failures (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 40),
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 60),
    device_ref TEXT CHECK (device_ref IS NULL OR char_length(device_ref) <= 128),
    detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_ingest_failures_time ON public.tracking_ingest_failures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_ingest_failures_reason ON public.tracking_ingest_failures (provider, reason, created_at DESC);

-- ------------------------------------------------------------------------
-- 11. Fonctions d'autorisation du module
-- ------------------------------------------------------------------------
-- Le raccourci « Super Admin » de has_agency_permission ne s'applique pas aux permissions tracking.* :
-- l'accès plateforme au suivi passe uniquement par tracking_support_grants.
CREATE OR REPLACE FUNCTION public.has_agency_permission(
    p_agency_id UUID,
    p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (public.is_super_admin() AND p_permission NOT LIKE 'tracking.%')
       OR EXISTS (
           SELECT 1
           FROM public.agency_members am
           JOIN public.agencies a ON a.id = am.agency_id
           JOIN public.role_permissions rp ON rp.role_key = am.role
           WHERE am.agency_id = p_agency_id
             AND am.user_id = auth.uid()
             AND am.status = 'ACTIVE'
             AND a.status = 'ACTIVE'
             AND a.archived_at IS NULL
             AND rp.permission_key = p_permission
       );
$$;

CREATE OR REPLACE FUNCTION public.has_tracking_permission(p_agency_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_permission LIKE 'tracking.%'
       AND (
            public.has_agency_permission(p_agency_id, p_permission)
            OR (
                p_permission = 'tracking.read'
                AND public.is_super_admin()
                AND EXISTS (
                    SELECT 1
                    FROM public.tracking_support_grants g
                    JOIN public.agencies a ON a.id = g.agency_id
                    WHERE g.agency_id = p_agency_id
                      AND g.granted_to = auth.uid()
                      AND g.revoked_at IS NULL
                      AND g.starts_at <= now()
                      AND g.expires_at > now()
                      AND a.archived_at IS NULL
                )
            )
       );
$$;

-- Agences accessibles pour une permission : évalué une seule fois par requête dans les politiques RLS
CREATE OR REPLACE FUNCTION public.tracking_agency_ids(p_permission TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT am.agency_id
    FROM public.agency_members am
    JOIN public.agencies a ON a.id = am.agency_id
    JOIN public.role_permissions rp ON rp.role_key = am.role
    WHERE p_permission LIKE 'tracking.%'
      AND am.user_id = auth.uid()
      AND am.status = 'ACTIVE'
      AND a.status = 'ACTIVE'
      AND a.archived_at IS NULL
      AND rp.permission_key = p_permission
    UNION
    SELECT g.agency_id
    FROM public.tracking_support_grants g
    JOIN public.agencies a ON a.id = g.agency_id
    WHERE p_permission = 'tracking.read'
      AND g.granted_to = auth.uid()
      AND g.revoked_at IS NULL
      AND g.starts_at <= now()
      AND g.expires_at > now()
      AND a.archived_at IS NULL
      AND public.is_super_admin();
$$;

-- ------------------------------------------------------------------------
-- 12. RLS : lecture seule pour authenticated, aucun accès anon
-- ------------------------------------------------------------------------
ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_tracker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_tracking_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_geofence_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_ingest_failures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.tracking_settings, public.vehicle_trackers, public.vehicle_tracker_assignments,
    public.vehicle_locations, public.vehicle_tracking_latest, public.vehicle_trips,
    public.vehicle_geofences, public.vehicle_geofence_assignments, public.tracking_alerts,
    public.tracking_audit_log, public.tracking_support_grants, public.tracking_ingest_failures
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.tracking_settings, public.vehicle_trackers, public.vehicle_tracker_assignments,
    public.vehicle_locations, public.vehicle_tracking_latest, public.vehicle_trips,
    public.vehicle_geofences, public.vehicle_geofence_assignments, public.tracking_alerts,
    public.tracking_audit_log, public.tracking_support_grants
TO authenticated;
-- tracking_ingest_failures : service_role uniquement (aucun droit authenticated)

DROP POLICY IF EXISTS "Tracking readers read settings" ON public.tracking_settings;
CREATE POLICY "Tracking readers read settings"
    ON public.tracking_settings FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read trackers" ON public.vehicle_trackers;
CREATE POLICY "Tracking readers read trackers"
    ON public.vehicle_trackers FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read assignments" ON public.vehicle_tracker_assignments;
CREATE POLICY "Tracking readers read assignments"
    ON public.vehicle_tracker_assignments FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read locations" ON public.vehicle_locations;
CREATE POLICY "Tracking readers read locations"
    ON public.vehicle_locations FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read latest locations" ON public.vehicle_tracking_latest;
CREATE POLICY "Tracking readers read latest locations"
    ON public.vehicle_tracking_latest FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read trips" ON public.vehicle_trips;
CREATE POLICY "Tracking readers read trips"
    ON public.vehicle_trips FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read geofences" ON public.vehicle_geofences;
CREATE POLICY "Tracking readers read geofences"
    ON public.vehicle_geofences FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read geofence assignments" ON public.vehicle_geofence_assignments;
CREATE POLICY "Tracking readers read geofence assignments"
    ON public.vehicle_geofence_assignments FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking readers read alerts" ON public.tracking_alerts;
CREATE POLICY "Tracking readers read alerts"
    ON public.tracking_alerts FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.read')));

DROP POLICY IF EXISTS "Tracking managers read audit" ON public.tracking_audit_log;
CREATE POLICY "Tracking managers read audit"
    ON public.tracking_audit_log FOR SELECT TO authenticated
    USING (agency_id IN (SELECT public.tracking_agency_ids('tracking.manage')));

-- L'agence voit qui, côté plateforme, a obtenu un accès de support ; le Super Admin voit ses propres autorisations
DROP POLICY IF EXISTS "Agency admins and grantees read support grants" ON public.tracking_support_grants;
CREATE POLICY "Agency admins and grantees read support grants"
    ON public.tracking_support_grants FOR SELECT TO authenticated
    USING (
        agency_id IN (SELECT public.tracking_agency_ids('tracking.settings.manage'))
        OR granted_to = auth.uid()
    );

-- ------------------------------------------------------------------------
-- 13. Realtime : seules les dernières positions et les alertes sont diffusées ; la RLS filtre par agence
-- ------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_tracking_latest;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_alerts;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.has_tracking_permission(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_agency_ids(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tracking_permission(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_agency_ids(TEXT) TO authenticated, service_role;

COMMIT;
