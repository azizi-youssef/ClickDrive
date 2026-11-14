-- ========================================================================
-- ClickDrive : suivi GPS de la flotte — ingestion, trajets, alertes, gestion, lectures
-- Migration additive : 20261119000200_gps_tracking_functions.sql
--
-- Trois familles de fonctions :
--   1. internes (aucun droit pour anon/authenticated/service_role) : audit, alertes, clôture de trajet ;
--   2. service_role uniquement : ingestion d'un événement fournisseur, maintenance, purge ;
--   3. authenticated : gestion (permission revérifiée + audit transactionnel) et lectures de l'agence.
-- Toutes sont SECURITY DEFINER avec search_path figé ; l'identité vient de auth.uid(), jamais d'un paramètre.
-- ========================================================================

BEGIN;

-- ------------------------------------------------------------------------
-- 1. Fonctions internes
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tracking_haversine_km(
    lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT 2 * 6371.0088 * asin(LEAST(1.0, sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    )));
$$;

CREATE OR REPLACE FUNCTION public.tracking_write_audit(
    p_agency_id UUID, p_actor UUID, p_kind TEXT, p_action TEXT,
    p_entity_type TEXT, p_entity_id TEXT, p_metadata JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.tracking_audit_log (agency_id, actor_id, actor_kind, action, entity_type, entity_id, metadata)
    VALUES (p_agency_id, p_actor, p_kind, p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.tracking_vehicle_label(p_vehicle_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT btrim(concat_ws(' ', v.brand, v.model) || CASE WHEN v.unit_number IS NOT NULL THEN ' (' || v.unit_number || ')' ELSE '' END)
    FROM public.vehicles v WHERE v.id = p_vehicle_id;
$$;

-- Réservation de location en cours pour le véhicule à l'instant donné (contexte métier, jamais une condition du suivi)
CREATE OR REPLACE FUNCTION public.tracking_booking_for(p_vehicle_id UUID, p_at TIMESTAMPTZ)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.id
    FROM public.bookings b
    WHERE b.vehicle_id = p_vehicle_id
      AND (
          (b.status = 'ACTIVE'
           AND p_at >= COALESCE(b.pickup_actual_at, (b.start_date::timestamp AT TIME ZONE 'Africa/Casablanca') - interval '1 day')
           AND (b.return_actual_at IS NULL OR p_at <= b.return_actual_at))
          OR (b.status = 'COMPLETED'
              AND b.pickup_actual_at IS NOT NULL AND b.return_actual_at IS NOT NULL
              AND p_at BETWEEN b.pickup_actual_at AND b.return_actual_at)
      )
    ORDER BY b.start_date DESC
    LIMIT 1;
$$;

-- État de connexion affiché : UNTRACKED / DISABLED / AWAITING / OFFLINE / MOVING / STATIONARY
CREATE OR REPLACE FUNCTION public.tracking_connection_state(
    p_tracker_present BOOLEAN, p_tracker_status TEXT, p_last_seen TIMESTAMPTZ,
    p_has_latest BOOLEAN, p_movement TEXT, p_offline_minutes INTEGER
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN NOT p_tracker_present THEN 'UNTRACKED'
        WHEN p_tracker_status = 'DISABLED' THEN 'DISABLED'
        WHEN p_last_seen IS NULL THEN 'AWAITING'
        WHEN p_last_seen < now() - make_interval(mins => p_offline_minutes) THEN 'OFFLINE'
        WHEN NOT p_has_latest THEN 'AWAITING'
        WHEN p_movement = 'MOVING' THEN 'MOVING'
        ELSE 'STATIONARY'
    END;
$$;

-- Crée une alerte sans doublon : une seule alerte ouverte par condition durable, un seul enregistrement par événement ponctuel
CREATE OR REPLACE FUNCTION public.tracking_raise_alert(
    p_agency_id UUID, p_vehicle_id UUID, p_tracker_id UUID, p_geofence_id UUID, p_booking_id UUID,
    p_type TEXT, p_severity TEXT, p_title TEXT, p_description TEXT,
    p_ongoing BOOLEAN, p_dedupe_key TEXT, p_occurred_at TIMESTAMPTZ,
    p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION, p_metadata JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INTEGER;
BEGIN
    IF p_ongoing THEN
        INSERT INTO public.tracking_alerts (
            agency_id, vehicle_id, tracker_id, geofence_id, booking_id, type, severity, title, description,
            ongoing, dedupe_key, occurred_at, latitude, longitude, metadata
        ) VALUES (
            p_agency_id, p_vehicle_id, p_tracker_id, p_geofence_id, p_booking_id, p_type, p_severity, p_title, p_description,
            true, p_dedupe_key, p_occurred_at, p_latitude, p_longitude, COALESCE(p_metadata, '{}'::jsonb)
        )
        ON CONFLICT (agency_id, dedupe_key) WHERE ongoing AND resolved_at IS NULL DO NOTHING;
    ELSE
        INSERT INTO public.tracking_alerts (
            agency_id, vehicle_id, tracker_id, geofence_id, booking_id, type, severity, title, description,
            ongoing, dedupe_key, occurred_at, latitude, longitude, metadata
        ) VALUES (
            p_agency_id, p_vehicle_id, p_tracker_id, p_geofence_id, p_booking_id, p_type, p_severity, p_title, p_description,
            false, p_dedupe_key, p_occurred_at, p_latitude, p_longitude, COALESCE(p_metadata, '{}'::jsonb)
        )
        ON CONFLICT (agency_id, dedupe_key) WHERE NOT ongoing DO NOTHING;
    END IF;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_resolve_alert(p_agency_id UUID, p_dedupe_key TEXT, p_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.tracking_alerts
    SET resolved_at = GREATEST(p_at, occurred_at)
    WHERE agency_id = p_agency_id AND dedupe_key = p_dedupe_key AND ongoing AND resolved_at IS NULL;
$$;

-- Clôture un trajet : les trajets sous 100 m sont du bruit GPS et sont supprimés (les positions restent en historique)
CREATE OR REPLACE FUNCTION public.tracking_close_trip(p_trip_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip public.vehicle_trips%ROWTYPE;
    v_end TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_trip FROM public.vehicle_trips WHERE id = p_trip_id AND status = 'IN_PROGRESS' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    IF v_trip.distance_km < 0.1 THEN
        DELETE FROM public.vehicle_trips WHERE id = v_trip.id;
        RETURN;
    END IF;
    v_end := GREATEST(v_trip.started_at, COALESCE(v_trip.ended_at, v_trip.last_position_at));
    UPDATE public.vehicle_trips
    SET status = 'COMPLETED',
        ended_at = v_end,
        end_latitude = COALESCE(end_latitude, start_latitude),
        end_longitude = COALESCE(end_longitude, start_longitude),
        duration_seconds = GREATEST(0, extract(epoch FROM (v_end - started_at))::INTEGER),
        closed_reason = p_reason,
        updated_at = now()
    WHERE id = v_trip.id;
END;
$$;

-- Nettoyage lorsqu'un boîtier quitte un véhicule : la dernière position (celle du boîtier) ne doit pas rester affichée
CREATE OR REPLACE FUNCTION public.tracking_detach_cleanup(p_agency_id UUID, p_tracker_id UUID, p_vehicle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip UUID;
BEGIN
    DELETE FROM public.vehicle_tracking_latest WHERE vehicle_id = p_vehicle_id AND tracker_id = p_tracker_id;
    FOR v_trip IN SELECT id FROM public.vehicle_trips WHERE vehicle_id = p_vehicle_id AND status = 'IN_PROGRESS' LOOP
        PERFORM public.tracking_close_trip(v_trip, 'TRACKER_REASSIGNED');
    END LOOP;
    PERFORM public.tracking_resolve_alert(p_agency_id, 'OFFLINE:' || p_tracker_id, now());
    PERFORM public.tracking_resolve_alert(p_agency_id, 'TAMPER:' || p_tracker_id, now());
    PERFORM public.tracking_resolve_alert(p_agency_id, 'POWER:' || p_tracker_id, now());
    PERFORM public.tracking_resolve_alert(p_agency_id, 'SPEED:' || p_vehicle_id, now());
    UPDATE public.vehicle_geofence_assignments SET inside = NULL, state_changed_at = NULL WHERE vehicle_id = p_vehicle_id;
END;
$$;

-- ------------------------------------------------------------------------
-- 2. Ingestion d'un événement fournisseur (service_role uniquement)
-- ------------------------------------------------------------------------
-- p_event : événement normalisé par l'adaptateur (voir lib/tracking/types.ts). agency_id / vehicle_id éventuellement
-- présents dans le JSON sont ignorés : le boîtier est résolu par (provider, external_device_id) puis son véhicule et
-- son agence viennent de la base. Retour : { status: accepted | duplicate | unknown_device | unassigned | disabled | rejected }.
CREATE OR REPLACE FUNCTION public.tracking_ingest_event(
    p_provider TEXT,
    p_external_device_id TEXT,
    p_event JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_future_tolerance CONSTANT INTERVAL := interval '2 minutes';
    c_max_age CONSTANT INTERVAL := interval '72 hours';
    c_trip_gap CONSTANT INTERVAL := interval '15 minutes';
    c_start_lookback CONSTANT INTERVAL := interval '3 minutes';
    c_jump_kmh CONSTANT DOUBLE PRECISION := 250;
    c_jump_min_km CONSTANT DOUBLE PRECISION := 0.2;
    c_min_segment_km CONSTANT DOUBLE PRECISION := 0.005;
    c_max_accuracy_m CONSTANT DOUBLE PRECISION := 100;

    v_now TIMESTAMPTZ := clock_timestamp();
    v_tracker public.vehicle_trackers%ROWTYPE;
    v_settings public.tracking_settings%ROWTYPE;
    v_latest public.vehicle_tracking_latest%ROWTYPE;
    v_trip public.vehicle_trips%ROWTYPE;
    v_has_latest BOOLEAN := false;
    v_recorded TIMESTAMPTZ;
    v_lat DOUBLE PRECISION;
    v_lon DOUBLE PRECISION;
    v_speed DOUBLE PRECISION;
    v_heading DOUBLE PRECISION;
    v_alt DOUBLE PRECISION;
    v_acc DOUBLE PRECISION;
    v_sats INTEGER;
    v_ignition BOOLEAN;
    v_odo DOUBLE PRECISION;
    v_batt DOUBLE PRECISION;
    v_tamper BOOLEAN;
    v_power_cut BOOLEAN;
    v_event_id TEXT;
    v_meta JSONB;
    v_has_position BOOLEAN;
    v_dedupe TEXT;
    v_stale BOOLEAN;
    v_quality TEXT := 'OK';
    v_booking UUID;
    v_loc_id BIGINT;
    v_dt_s DOUBLE PRECISION := 0;
    v_dist_km DOUBLE PRECISION := 0;
    v_implied_kmh DOUBLE PRECISION := 0;
    v_break BOOLEAN := false;
    v_moving BOOLEAN := false;
    v_seg_valid BOOLEAN := false;
    v_open BOOLEAN := false;
    v_gf RECORD;
    v_inside BOOLEAN;
    v_d_m DOUBLE PRECISION;
    v_buffer DOUBLE PRECISION;
    v_label TEXT;
    v_local_time TIME;
    v_in_quiet BOOLEAN;
    v_created BOOLEAN;
    v_caps JSONB;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'tracking ingestion is reserved to the service role' USING ERRCODE = '42501';
    END IF;
    IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'malformed_event');
    END IF;

    -- Le boîtier (et donc l'agence et le véhicule) est résolu côté serveur ; le verrou sérialise les livraisons concurrentes
    SELECT * INTO v_tracker
    FROM public.vehicle_trackers
    WHERE provider = p_provider AND external_device_id = p_external_device_id AND status <> 'DISCONNECTED'
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'unknown_device');
    END IF;
    IF v_tracker.status = 'DISABLED' THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    -- Lecture et validation de l'événement
    BEGIN
        v_recorded := (p_event ->> 'recorded_at')::timestamptz;
        v_lat := (p_event ->> 'latitude')::double precision;
        v_lon := (p_event ->> 'longitude')::double precision;
        v_speed := (p_event ->> 'speed_kmh')::double precision;
        v_heading := (p_event ->> 'heading_deg')::double precision;
        v_alt := (p_event ->> 'altitude_m')::double precision;
        v_acc := (p_event ->> 'accuracy_m')::double precision;
        v_sats := (p_event ->> 'satellites')::integer;
        v_ignition := (p_event ->> 'ignition')::boolean;
        v_odo := (p_event ->> 'odometer_km')::double precision;
        v_batt := (p_event ->> 'battery_v')::double precision;
        v_tamper := (p_event ->> 'tamper')::boolean;
        v_power_cut := (p_event ->> 'power_disconnected')::boolean;
        v_event_id := p_event ->> 'event_id';
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'malformed_event');
    END;

    IF v_recorded IS NULL THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'missing_timestamp');
    END IF;
    IF v_recorded > v_now + c_future_tolerance THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'future_timestamp');
    END IF;
    IF v_recorded < v_now - c_max_age THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'timestamp_too_old');
    END IF;

    v_has_position := v_lat IS NOT NULL OR v_lon IS NOT NULL;
    IF v_has_position AND (
        v_lat IS NULL OR v_lon IS NULL
        OR NOT (v_lat >= -90 AND v_lat <= 90)
        OR NOT (v_lon >= -180 AND v_lon <= 180)
        OR (v_lat = 0 AND v_lon = 0)
    ) THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'invalid_coordinates');
    END IF;
    IF NOT v_has_position AND v_tamper IS NULL AND v_power_cut IS NULL THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'empty_event');
    END IF;
    IF v_event_id IS NOT NULL AND char_length(v_event_id) > 200 THEN
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'invalid_event_id');
    END IF;

    -- Lectures optionnelles : une valeur aberrante est ignorée (jamais propagée dans une distance ou une alerte)
    IF v_speed IS NOT NULL AND NOT (v_speed >= 0 AND v_speed <= 400) THEN v_speed := NULL; END IF;
    IF v_heading IS NOT NULL THEN
        IF v_heading >= 0 AND v_heading <= 360 THEN
            v_heading := mod(v_heading::numeric, 360)::double precision;
        ELSE
            v_heading := NULL;
        END IF;
    END IF;
    IF v_acc IS NOT NULL AND NOT (v_acc >= 0 AND v_acc < 1e6) THEN v_acc := NULL; END IF;
    IF v_sats IS NOT NULL AND v_sats < 0 THEN v_sats := NULL; END IF;
    IF v_odo IS NOT NULL AND NOT (v_odo >= 0 AND v_odo < 1e8) THEN v_odo := NULL; END IF;
    IF v_batt IS NOT NULL AND NOT (v_batt >= 0 AND v_batt <= 100) THEN v_batt := NULL; END IF;
    IF v_alt IS NOT NULL AND NOT (v_alt > -1000 AND v_alt < 100000) THEN v_alt := NULL; END IF;
    v_meta := CASE
        WHEN jsonb_typeof(p_event -> 'metadata') = 'object' AND octet_length((p_event -> 'metadata')::text) <= 2000
            THEN p_event -> 'metadata'
        ELSE '{}'::jsonb
    END;

    -- Boîtier enregistré mais pas encore affecté : la communication est notée, aucune position n'est conservée
    IF v_tracker.vehicle_id IS NULL THEN
        UPDATE public.vehicle_trackers
        SET last_seen_at = v_now,
            status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END,
            updated_at = v_now
        WHERE id = v_tracker.id;
        RETURN jsonb_build_object('status', 'unassigned');
    END IF;

    -- Un événement non postérieur au dernier traité est « en retard » : conservé en historique, sans effet sur l'état courant
    v_stale := v_tracker.last_event_at IS NOT NULL AND v_recorded <= v_tracker.last_event_at;

    SELECT * INTO v_settings FROM public.tracking_settings WHERE agency_id = v_tracker.agency_id;
    IF NOT FOUND THEN
        INSERT INTO public.tracking_settings (agency_id) VALUES (v_tracker.agency_id) ON CONFLICT DO NOTHING;
        SELECT * INTO v_settings FROM public.tracking_settings WHERE agency_id = v_tracker.agency_id;
    END IF;

    IF v_has_position THEN
        v_dedupe := COALESCE(
            NULLIF(btrim(v_event_id), ''),
            'pos:' || (extract(epoch FROM v_recorded) * 1000)::bigint || ':' || round(v_lat::numeric, 6) || ':' || round(v_lon::numeric, 6)
        );

        SELECT * INTO v_latest FROM public.vehicle_tracking_latest WHERE vehicle_id = v_tracker.vehicle_id;
        v_has_latest := FOUND;

        IF v_stale THEN
            v_quality := 'LATE';
        ELSIF (v_acc IS NOT NULL AND v_acc > c_max_accuracy_m) OR (v_sats IS NOT NULL AND v_sats < 3) THEN
            v_quality := 'LOW_ACCURACY';
        ELSIF v_has_latest THEN
            v_dt_s := extract(epoch FROM (v_recorded - v_latest.recorded_at));
            v_dist_km := public.tracking_haversine_km(v_latest.latitude, v_latest.longitude, v_lat, v_lon);
            IF v_dt_s > 0 THEN
                v_implied_kmh := v_dist_km / v_dt_s * 3600;
            END IF;
            -- Saut de position incohérent avec le temps écoulé. Après 2 rejets consécutifs, la nouvelle position
            -- devient la référence (le véhicule a réellement été déplacé, par exemple transporté) sans distance cumulée.
            IF v_dist_km >= c_jump_min_km AND v_implied_kmh > c_jump_kmh THEN
                IF v_latest.suspect_streak >= 2 THEN
                    v_break := true;
                ELSE
                    v_quality := 'JUMP';
                END IF;
            END IF;
        END IF;

        v_booking := public.tracking_booking_for(v_tracker.vehicle_id, v_recorded);

        INSERT INTO public.vehicle_locations (
            agency_id, vehicle_id, tracker_id, booking_id, recorded_at, received_at, latitude, longitude,
            speed_kmh, heading_deg, altitude_m, accuracy_m, satellites, ignition, odometer_km, battery_v,
            quality, dedupe_key, metadata
        ) VALUES (
            v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, v_booking, v_recorded, v_now, v_lat, v_lon,
            v_speed, v_heading, v_alt, v_acc, v_sats, v_ignition, v_odo, v_batt,
            v_quality, v_dedupe, v_meta
        )
        ON CONFLICT (tracker_id, dedupe_key) DO NOTHING
        RETURNING id INTO v_loc_id;

        IF v_loc_id IS NULL THEN
            RETURN jsonb_build_object('status', 'duplicate');
        END IF;

        IF v_quality = 'JUMP' AND v_has_latest THEN
            UPDATE public.vehicle_tracking_latest
            SET suspect_streak = LEAST(suspect_streak + 1, 100)
            WHERE vehicle_id = v_tracker.vehicle_id;
        END IF;

        IF v_quality = 'OK' THEN
            -- Mouvement : vitesse mesurée, sinon vitesse déduite de la distance parcourue
            v_moving := CASE
                WHEN v_speed IS NOT NULL THEN v_speed >= v_settings.moving_speed_kmh
                WHEN v_has_latest AND NOT v_break AND v_dt_s > 0 THEN (v_dist_km >= 0.02 AND v_implied_kmh >= v_settings.moving_speed_kmh)
                ELSE false
            END;
            IF v_moving IS NULL THEN v_moving := false; END IF;

            -- Dernière position : une observation plus ancienne ne remplace jamais une plus récente
            INSERT INTO public.vehicle_tracking_latest AS l (
                vehicle_id, agency_id, tracker_id, latitude, longitude, speed_kmh, heading_deg, ignition, accuracy_m,
                recorded_at, received_at, movement_state, last_moving_at, booking_id, suspect_streak, updated_at
            ) VALUES (
                v_tracker.vehicle_id, v_tracker.agency_id, v_tracker.id, v_lat, v_lon, v_speed, v_heading, v_ignition, v_acc,
                v_recorded, v_now, CASE WHEN v_moving THEN 'MOVING' ELSE 'STATIONARY' END,
                CASE WHEN v_moving THEN v_recorded END, v_booking, 0, v_now
            )
            ON CONFLICT (vehicle_id) DO UPDATE
            SET tracker_id = EXCLUDED.tracker_id,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                speed_kmh = EXCLUDED.speed_kmh,
                heading_deg = EXCLUDED.heading_deg,
                ignition = EXCLUDED.ignition,
                accuracy_m = EXCLUDED.accuracy_m,
                recorded_at = EXCLUDED.recorded_at,
                received_at = EXCLUDED.received_at,
                movement_state = EXCLUDED.movement_state,
                last_moving_at = CASE WHEN EXCLUDED.movement_state = 'MOVING' THEN EXCLUDED.recorded_at ELSE l.last_moving_at END,
                booking_id = EXCLUDED.booking_id,
                suspect_streak = 0,
                updated_at = EXCLUDED.updated_at
            WHERE l.recorded_at < EXCLUDED.recorded_at;

            -- ---------------- Trajets ----------------
            SELECT * INTO v_trip
            FROM public.vehicle_trips
            WHERE vehicle_id = v_tracker.vehicle_id AND status = 'IN_PROGRESS'
            FOR UPDATE;
            v_open := FOUND;

            IF v_open AND (v_break OR v_recorded - v_trip.last_position_at > c_trip_gap) THEN
                PERFORM public.tracking_close_trip(v_trip.id, CASE WHEN v_break THEN 'DATA_BREAK' ELSE 'DEVICE_GAP' END);
                v_open := false;
            END IF;

            -- Segment exploitable pour la distance : référence valide, au moins 5 m, vitesse déduite plausible,
            -- et déplacement réel (le bruit GPS d'un véhicule à l'arrêt n'est jamais cumulé)
            v_seg_valid := v_has_latest AND NOT v_break
                AND v_dist_km >= c_min_segment_km AND v_implied_kmh <= c_jump_kmh
                AND (v_moving OR v_latest.movement_state = 'MOVING');

            IF NOT v_open THEN
                IF v_moving THEN
                    IF v_has_latest AND NOT v_break AND v_latest.movement_state = 'STATIONARY'
                       AND v_recorded - v_latest.recorded_at <= c_start_lookback THEN
                        -- Le départ est le dernier point à l'arrêt : lieu de départ exact
                        INSERT INTO public.vehicle_trips (
                            agency_id, vehicle_id, tracker_id, booking_id, started_at, start_latitude, start_longitude,
                            ended_at, end_latitude, end_longitude, distance_km, max_speed_kmh, point_count,
                            last_position_at, last_moving_at
                        ) VALUES (
                            v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, v_booking,
                            v_latest.recorded_at, v_latest.latitude, v_latest.longitude,
                            v_recorded, v_lat, v_lon, CASE WHEN v_seg_valid THEN v_dist_km ELSE 0 END,
                            COALESCE(v_speed, 0), 2, v_recorded, v_recorded
                        ) RETURNING * INTO v_trip;
                    ELSE
                        INSERT INTO public.vehicle_trips (
                            agency_id, vehicle_id, tracker_id, booking_id, started_at, start_latitude, start_longitude,
                            ended_at, end_latitude, end_longitude, distance_km, max_speed_kmh, point_count,
                            last_position_at, last_moving_at
                        ) VALUES (
                            v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, v_booking,
                            v_recorded, v_lat, v_lon, v_recorded, v_lat, v_lon, 0,
                            COALESCE(v_speed, 0), 1, v_recorded, v_recorded
                        ) RETURNING * INTO v_trip;
                    END IF;

                    -- Mouvement inattendu : départ hors réservation pendant les heures calmes configurées
                    IF v_settings.unexpected_movement_enabled AND v_booking IS NULL THEN
                        v_local_time := (v_recorded AT TIME ZONE 'Africa/Casablanca')::time;
                        v_in_quiet := CASE
                            WHEN v_settings.quiet_hours_start <= v_settings.quiet_hours_end
                                THEN v_local_time >= v_settings.quiet_hours_start AND v_local_time < v_settings.quiet_hours_end
                            ELSE v_local_time >= v_settings.quiet_hours_start OR v_local_time < v_settings.quiet_hours_end
                        END;
                        IF v_in_quiet THEN
                            v_label := public.tracking_vehicle_label(v_tracker.vehicle_id);
                            PERFORM public.tracking_raise_alert(
                                v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, NULL, NULL,
                                'UNEXPECTED_MOVEMENT', 'WARNING',
                                'Mouvement inattendu',
                                format('Le véhicule %s a démarré hors réservation pendant les heures calmes.', v_label),
                                false, 'UNEXPECTED_MOVEMENT:' || v_trip.id, v_recorded, v_lat, v_lon,
                                jsonb_build_object('trip_id', v_trip.id)
                            );
                        END IF;
                    END IF;
                END IF;
            ELSE
                UPDATE public.vehicle_trips
                SET distance_km = distance_km + CASE WHEN v_seg_valid THEN v_dist_km ELSE 0 END,
                    max_speed_kmh = GREATEST(max_speed_kmh, COALESCE(v_speed, 0)),
                    point_count = point_count + 1,
                    last_position_at = v_recorded,
                    last_moving_at = CASE WHEN v_moving THEN v_recorded ELSE last_moving_at END,
                    end_latitude = CASE WHEN v_moving THEN v_lat ELSE end_latitude END,
                    end_longitude = CASE WHEN v_moving THEN v_lon ELSE end_longitude END,
                    ended_at = CASE WHEN v_moving THEN v_recorded ELSE ended_at END,
                    booking_id = COALESCE(booking_id, v_booking),
                    updated_at = v_now
                WHERE id = v_trip.id
                RETURNING * INTO v_trip;

                IF v_ignition IS FALSE THEN
                    -- Contact coupé : cette position est le lieu d'arrivée
                    UPDATE public.vehicle_trips
                    SET end_latitude = v_lat, end_longitude = v_lon, ended_at = v_recorded
                    WHERE id = v_trip.id;
                    PERFORM public.tracking_close_trip(v_trip.id, 'IGNITION_OFF');
                ELSIF NOT v_moving AND v_trip.last_moving_at IS NOT NULL
                      AND v_recorded - v_trip.last_moving_at >= make_interval(mins => v_settings.trip_end_idle_minutes) THEN
                    PERFORM public.tracking_close_trip(v_trip.id, 'IDLE');
                END IF;
            END IF;

            -- ---------------- Vitesse excessive (condition durable) ----------------
            IF v_settings.speed_alerts_enabled AND v_settings.speed_limit_kmh IS NOT NULL AND v_speed IS NOT NULL THEN
                IF v_speed > v_settings.speed_limit_kmh THEN
                    v_label := public.tracking_vehicle_label(v_tracker.vehicle_id);
                    v_created := public.tracking_raise_alert(
                        v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, NULL, v_booking,
                        'SPEED_LIMIT', 'WARNING',
                        'Vitesse excessive',
                        format('Le véhicule %s roule à %s km/h (limite configurée : %s km/h).', v_label, round(v_speed), v_settings.speed_limit_kmh),
                        true, 'SPEED:' || v_tracker.vehicle_id, v_recorded, v_lat, v_lon,
                        jsonb_build_object('speed_kmh', round(v_speed), 'limit_kmh', v_settings.speed_limit_kmh, 'peak_speed_kmh', round(v_speed))
                    );
                    IF NOT v_created THEN
                        UPDATE public.tracking_alerts
                        SET metadata = jsonb_set(metadata, '{peak_speed_kmh}', to_jsonb(round(v_speed)))
                        WHERE agency_id = v_tracker.agency_id AND dedupe_key = 'SPEED:' || v_tracker.vehicle_id
                          AND ongoing AND resolved_at IS NULL
                          AND COALESCE((metadata ->> 'peak_speed_kmh')::numeric, 0) < round(v_speed);
                    END IF;
                ELSE
                    PERFORM public.tracking_resolve_alert(v_tracker.agency_id, 'SPEED:' || v_tracker.vehicle_id, v_recorded);
                END IF;
            END IF;

            -- ---------------- Zones géographiques (cercles) ----------------
            FOR v_gf IN
                SELECT g.id, g.name, g.center_latitude, g.center_longitude, g.radius_m, g.alert_on_enter, g.alert_on_exit, a.inside AS was_inside
                FROM public.vehicle_geofence_assignments a
                JOIN public.vehicle_geofences g ON g.id = a.geofence_id AND g.agency_id = a.agency_id
                WHERE a.vehicle_id = v_tracker.vehicle_id AND g.enabled
            LOOP
                v_d_m := public.tracking_haversine_km(v_gf.center_latitude, v_gf.center_longitude, v_lat, v_lon) * 1000;
                -- Marge de sortie : évite les alertes en rafale lorsque la position oscille sur le bord de la zone
                v_buffer := LEAST(50, GREATEST(10, v_gf.radius_m * 0.05));
                v_inside := CASE WHEN v_gf.was_inside IS TRUE THEN v_d_m <= v_gf.radius_m + v_buffer ELSE v_d_m <= v_gf.radius_m END;

                IF v_gf.was_inside IS NULL THEN
                    UPDATE public.vehicle_geofence_assignments
                    SET inside = v_inside, state_changed_at = v_recorded
                    WHERE geofence_id = v_gf.id AND vehicle_id = v_tracker.vehicle_id;
                ELSIF v_inside IS DISTINCT FROM v_gf.was_inside THEN
                    UPDATE public.vehicle_geofence_assignments
                    SET inside = v_inside, state_changed_at = v_recorded
                    WHERE geofence_id = v_gf.id AND vehicle_id = v_tracker.vehicle_id;

                    IF (v_inside AND v_gf.alert_on_enter) OR (NOT v_inside AND v_gf.alert_on_exit) THEN
                        v_label := public.tracking_vehicle_label(v_tracker.vehicle_id);
                        PERFORM public.tracking_raise_alert(
                            v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, v_gf.id, v_booking,
                            CASE WHEN v_inside THEN 'GEOFENCE_ENTER' ELSE 'GEOFENCE_EXIT' END,
                            'INFO',
                            CASE WHEN v_inside THEN 'Entrée dans une zone' ELSE 'Sortie d’une zone' END,
                            format('Le véhicule %s %s la zone « %s ».', v_label, CASE WHEN v_inside THEN 'est entré dans' ELSE 'a quitté' END, v_gf.name),
                            false,
                            CASE WHEN v_inside THEN 'GEOFENCE_ENTER:' ELSE 'GEOFENCE_EXIT:' END
                                || v_gf.id || ':' || v_tracker.vehicle_id || ':' || (extract(epoch FROM v_recorded) * 1000)::bigint,
                            v_recorded, v_lat, v_lon,
                            jsonb_build_object('geofence_name', v_gf.name)
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ---------------- Signaux matériels (uniquement si le boîtier les fournit) ----------------
    IF NOT v_stale THEN
        IF v_tamper IS TRUE THEN
            v_label := public.tracking_vehicle_label(v_tracker.vehicle_id);
            PERFORM public.tracking_raise_alert(
                v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, NULL, NULL,
                'TRACKER_TAMPER', 'CRITICAL', 'Boîtier GPS manipulé',
                format('Le boîtier GPS du véhicule %s signale une manipulation.', v_label),
                true, 'TAMPER:' || v_tracker.id, v_recorded, v_lat, v_lon, '{}'::jsonb
            );
        ELSIF v_tamper IS FALSE THEN
            PERFORM public.tracking_resolve_alert(v_tracker.agency_id, 'TAMPER:' || v_tracker.id, v_recorded);
        END IF;
        IF v_power_cut IS TRUE THEN
            v_label := public.tracking_vehicle_label(v_tracker.vehicle_id);
            PERFORM public.tracking_raise_alert(
                v_tracker.agency_id, v_tracker.vehicle_id, v_tracker.id, NULL, NULL,
                'TRACKER_DISCONNECTED', 'CRITICAL', 'Boîtier GPS débranché',
                format('Le boîtier GPS du véhicule %s signale une coupure d’alimentation.', v_label),
                true, 'POWER:' || v_tracker.id, v_recorded, v_lat, v_lon, '{}'::jsonb
            );
        ELSIF v_power_cut IS FALSE THEN
            PERFORM public.tracking_resolve_alert(v_tracker.agency_id, 'POWER:' || v_tracker.id, v_recorded);
        END IF;
    END IF;

    -- ---------------- État du boîtier ----------------
    v_caps := jsonb_strip_nulls(jsonb_build_object(
        'ignition', CASE WHEN v_ignition IS NOT NULL THEN true END,
        'tamper', CASE WHEN v_tamper IS NOT NULL THEN true END,
        'power', CASE WHEN v_power_cut IS NOT NULL THEN true END,
        'odometer', CASE WHEN v_odo IS NOT NULL THEN true END
    ));
    UPDATE public.vehicle_trackers
    SET last_seen_at = v_now,
        last_event_at = CASE WHEN v_stale THEN last_event_at ELSE v_recorded END,
        last_position_at = CASE WHEN v_has_position AND v_quality = 'OK' THEN v_recorded ELSE last_position_at END,
        status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END,
        capabilities = CASE WHEN capabilities @> v_caps THEN capabilities ELSE capabilities || v_caps END,
        updated_at = v_now
    WHERE id = v_tracker.id;

    -- Le boîtier communique de nouveau : l'alerte « hors ligne » se résout
    PERFORM public.tracking_resolve_alert(v_tracker.agency_id, 'OFFLINE:' || v_tracker.id, v_now);

    RETURN jsonb_build_object(
        'status', 'accepted',
        'quality', CASE WHEN v_has_position THEN v_quality END,
        'late', v_stale
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_record_ingest_failure(
    p_provider TEXT, p_reason TEXT, p_device_ref TEXT DEFAULT NULL, p_detail TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'reserved to the service role' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.tracking_ingest_failures (provider, reason, device_ref, detail)
    VALUES (left(p_provider, 40), left(p_reason, 60), left(p_device_ref, 128), left(p_detail, 300));
END;
$$;

-- ------------------------------------------------------------------------
-- 3. Maintenance planifiée et purge (service_role uniquement)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tracking_run_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec RECORD;
    v_offline_alerts INTEGER := 0;
    v_closed_trips INTEGER := 0;
    v_created BOOLEAN;
    v_booking UUID;
    v_label TEXT;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'reserved to the service role' USING ERRCODE = '42501';
    END IF;

    -- Boîtiers affectés qui ne communiquent plus depuis plus que le délai de l'agence
    FOR v_rec IN
        SELECT t.id, t.agency_id, t.vehicle_id, t.last_seen_at
        FROM public.vehicle_trackers t
        LEFT JOIN public.tracking_settings s ON s.agency_id = t.agency_id
        WHERE t.status = 'ACTIVE'
          AND t.vehicle_id IS NOT NULL
          AND t.last_seen_at < now() - make_interval(mins => COALESCE(s.offline_after_minutes, 15))
    LOOP
        v_booking := public.tracking_booking_for(v_rec.vehicle_id, now());
        v_label := public.tracking_vehicle_label(v_rec.vehicle_id);
        v_created := public.tracking_raise_alert(
            v_rec.agency_id, v_rec.vehicle_id, v_rec.id, NULL, v_booking,
            'DEVICE_OFFLINE',
            CASE WHEN v_booking IS NOT NULL THEN 'CRITICAL' ELSE 'WARNING' END,
            'Boîtier GPS hors ligne',
            format('Le boîtier GPS du véhicule %s ne communique plus depuis le %s.', v_label,
                   to_char(v_rec.last_seen_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM à HH24:MI')),
            true, 'OFFLINE:' || v_rec.id, now(), NULL, NULL,
            jsonb_build_object('last_seen_at', v_rec.last_seen_at)
        );
        IF v_created THEN
            v_offline_alerts := v_offline_alerts + 1;
        END IF;
    END LOOP;

    -- Trajets restés ouverts parce que le boîtier a cessé d'émettre
    FOR v_rec IN
        SELECT id FROM public.vehicle_trips
        WHERE status = 'IN_PROGRESS' AND last_position_at < now() - interval '15 minutes'
    LOOP
        PERFORM public.tracking_close_trip(v_rec.id, 'STALE');
        v_closed_trips := v_closed_trips + 1;
    END LOOP;

    RETURN jsonb_build_object('offline_alerts_created', v_offline_alerts, 'stale_trips_closed', v_closed_trips);
END;
$$;

-- Purge par lots selon la durée de conservation de chaque agence (appelée en boucle par la tâche planifiée)
CREATE OR REPLACE FUNCTION public.tracking_purge_expired(p_batch INTEGER DEFAULT 5000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency RECORD;
    v_batch INTEGER := LEAST(GREATEST(COALESCE(p_batch, 5000), 100), 20000);
    v_locations INTEGER := 0;
    v_trips INTEGER := 0;
    v_alerts INTEGER := 0;
    v_failures INTEGER := 0;
    v_audit INTEGER := 0;
    v_n INTEGER;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'reserved to the service role' USING ERRCODE = '42501';
    END IF;

    FOR v_agency IN
        SELECT a.agency_id,
               COALESCE(s.retention_days, 90) AS retention_days,
               COALESCE(s.trip_retention_days, 365) AS trip_retention_days
        FROM (SELECT DISTINCT agency_id FROM public.vehicle_trackers) a
        LEFT JOIN public.tracking_settings s ON s.agency_id = a.agency_id
    LOOP
        DELETE FROM public.vehicle_locations
        WHERE id IN (
            SELECT id FROM public.vehicle_locations
            WHERE agency_id = v_agency.agency_id
              AND recorded_at < now() - make_interval(days => v_agency.retention_days)
            ORDER BY recorded_at
            LIMIT v_batch
        );
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_locations := v_locations + v_n;

        DELETE FROM public.vehicle_trips
        WHERE id IN (
            SELECT id FROM public.vehicle_trips
            WHERE agency_id = v_agency.agency_id AND status = 'COMPLETED'
              AND started_at < now() - make_interval(days => v_agency.trip_retention_days)
            LIMIT v_batch
        );
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_trips := v_trips + v_n;

        DELETE FROM public.tracking_alerts
        WHERE id IN (
            SELECT id FROM public.tracking_alerts
            WHERE agency_id = v_agency.agency_id
              AND (NOT ongoing OR resolved_at IS NOT NULL)
              AND occurred_at < now() - make_interval(days => v_agency.trip_retention_days)
            LIMIT v_batch
        );
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_alerts := v_alerts + v_n;
    END LOOP;

    DELETE FROM public.tracking_ingest_failures
    WHERE id IN (SELECT id FROM public.tracking_ingest_failures WHERE created_at < now() - interval '30 days' LIMIT v_batch);
    GET DIAGNOSTICS v_failures = ROW_COUNT;

    -- Journal d'audit : conservé 2 ans ; seul ce drapeau local autorise la suppression (trigger d'immutabilité)
    PERFORM set_config('tracking.audit_purge', 'on', true);
    DELETE FROM public.tracking_audit_log
    WHERE id IN (SELECT id FROM public.tracking_audit_log WHERE created_at < now() - interval '730 days' LIMIT v_batch);
    GET DIAGNOSTICS v_audit = ROW_COUNT;
    PERFORM set_config('tracking.audit_purge', 'off', true);

    RETURN jsonb_build_object(
        'locations_deleted', v_locations, 'trips_deleted', v_trips, 'alerts_deleted', v_alerts,
        'ingest_failures_deleted', v_failures, 'audit_rows_deleted', v_audit, 'batch', v_batch
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 4. Gestion des boîtiers
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_vehicle_tracker(
    p_agency_id UUID,
    p_provider TEXT,
    p_external_device_id TEXT,
    p_label TEXT DEFAULT NULL,
    p_vehicle_id UUID DEFAULT NULL,
    p_installed_at TIMESTAMPTZ DEFAULT NULL,
    p_device_model TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_id UUID;
BEGIN
    IF v_actor IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.manage') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF p_vehicle_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.vehicles WHERE id = p_vehicle_id AND agency_id = p_agency_id AND archived_at IS NULL
    ) THEN
        RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.tracking_settings (agency_id) VALUES (p_agency_id) ON CONFLICT DO NOTHING;

    INSERT INTO public.vehicle_trackers (
        agency_id, vehicle_id, provider, external_device_id, label, device_model, installed_at, created_by
    ) VALUES (
        p_agency_id, p_vehicle_id, p_provider, p_external_device_id, NULLIF(btrim(p_label), ''),
        NULLIF(btrim(p_device_model), ''), p_installed_at, v_actor
    ) RETURNING id INTO v_id;

    IF p_vehicle_id IS NOT NULL THEN
        INSERT INTO public.vehicle_tracker_assignments (agency_id, tracker_id, vehicle_id, assigned_by, reason)
        VALUES (p_agency_id, v_id, p_vehicle_id, v_actor, 'Enregistrement');
    END IF;

    PERFORM public.tracking_write_audit(
        p_agency_id, v_actor, 'user', 'tracker.registered', 'vehicle_tracker', v_id::text,
        jsonb_build_object('provider', p_provider, 'vehicle_id', p_vehicle_id)
    );
    RETURN v_id;
END;
$$;

-- Affecte (ou, avec un véhicule NULL, retire) un boîtier ; la réaffectation ferme l'affectation précédente
CREATE OR REPLACE FUNCTION public.assign_vehicle_tracker(
    p_tracker_id UUID,
    p_vehicle_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_t public.vehicle_trackers%ROWTYPE;
    v_old UUID;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_t FROM public.vehicle_trackers WHERE id = p_tracker_id FOR UPDATE;
    IF NOT FOUND OR NOT public.has_tracking_permission(v_t.agency_id, 'tracking.manage') THEN
        RAISE EXCEPTION 'tracker not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_vehicle_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.vehicles WHERE id = p_vehicle_id AND agency_id = v_t.agency_id AND archived_at IS NULL
    ) THEN
        RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_vehicle_id IS NULL AND v_t.vehicle_id IS NULL THEN
        RETURN;
    END IF;
    IF v_t.vehicle_id IS NOT DISTINCT FROM p_vehicle_id THEN
        RETURN;
    END IF;

    v_old := v_t.vehicle_id;
    IF v_old IS NOT NULL THEN
        UPDATE public.vehicle_tracker_assignments
        SET unassigned_at = now(), unassigned_by = v_actor,
            reason = COALESCE(left(NULLIF(btrim(p_reason), ''), 300), reason)
        WHERE tracker_id = p_tracker_id AND unassigned_at IS NULL;
        PERFORM public.tracking_detach_cleanup(v_t.agency_id, p_tracker_id, v_old);
    END IF;

    UPDATE public.vehicle_trackers
    SET vehicle_id = p_vehicle_id,
        -- Nouveau véhicule : l'état repart de « en attente de position » jusqu'au premier événement reçu
        status = CASE WHEN p_vehicle_id IS NOT NULL AND status IN ('ACTIVE', 'DISCONNECTED') THEN 'PENDING' ELSE status END,
        last_seen_at = CASE WHEN p_vehicle_id IS NOT NULL THEN NULL ELSE last_seen_at END,
        last_position_at = CASE WHEN p_vehicle_id IS NOT NULL THEN NULL ELSE last_position_at END,
        disconnected_at = NULL,
        updated_at = now()
    WHERE id = p_tracker_id;

    IF p_vehicle_id IS NOT NULL THEN
        INSERT INTO public.vehicle_tracker_assignments (agency_id, tracker_id, vehicle_id, assigned_by, reason)
        VALUES (v_t.agency_id, p_tracker_id, p_vehicle_id, v_actor, left(NULLIF(btrim(p_reason), ''), 300));
    END IF;

    PERFORM public.tracking_write_audit(
        v_t.agency_id, v_actor, 'user',
        CASE WHEN p_vehicle_id IS NULL THEN 'tracker.unassigned' WHEN v_old IS NULL THEN 'tracker.assigned' ELSE 'tracker.reassigned' END,
        'vehicle_tracker', p_tracker_id::text,
        jsonb_build_object('from_vehicle_id', v_old, 'to_vehicle_id', p_vehicle_id, 'reason', left(NULLIF(btrim(p_reason), ''), 300))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_vehicle_tracker(p_tracker_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_t public.vehicle_trackers%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_t FROM public.vehicle_trackers WHERE id = p_tracker_id FOR UPDATE;
    IF NOT FOUND OR NOT public.has_tracking_permission(v_t.agency_id, 'tracking.manage') THEN
        RAISE EXCEPTION 'tracker not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_t.status = 'DISCONNECTED' THEN
        RETURN;
    END IF;

    IF v_t.vehicle_id IS NOT NULL THEN
        UPDATE public.vehicle_tracker_assignments
        SET unassigned_at = now(), unassigned_by = v_actor,
            reason = COALESCE(left(NULLIF(btrim(p_reason), ''), 300), reason)
        WHERE tracker_id = p_tracker_id AND unassigned_at IS NULL;
        PERFORM public.tracking_detach_cleanup(v_t.agency_id, p_tracker_id, v_t.vehicle_id);
    END IF;

    UPDATE public.vehicle_trackers
    SET vehicle_id = NULL, status = 'DISCONNECTED', disconnected_at = now(), updated_at = now()
    WHERE id = p_tracker_id;

    PERFORM public.tracking_write_audit(
        v_t.agency_id, v_actor, 'user', 'tracker.disconnected', 'vehicle_tracker', p_tracker_id::text,
        jsonb_build_object('vehicle_id', v_t.vehicle_id, 'reason', left(NULLIF(btrim(p_reason), ''), 300))
    );
END;
$$;

-- Modifie libellé, modèle, date d'installation, ou met en pause / réactive (clés : label, device_model, installed_at, enabled)
CREATE OR REPLACE FUNCTION public.update_vehicle_tracker(p_tracker_id UUID, p_changes JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_t public.vehicle_trackers%ROWTYPE;
    v_key TEXT;
    v_enabled BOOLEAN;
BEGIN
    IF v_actor IS NULL OR p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_t FROM public.vehicle_trackers WHERE id = p_tracker_id FOR UPDATE;
    IF NOT FOUND OR NOT public.has_tracking_permission(v_t.agency_id, 'tracking.manage') THEN
        RAISE EXCEPTION 'tracker not found' USING ERRCODE = 'P0002';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
        IF v_key NOT IN ('label', 'device_model', 'installed_at', 'enabled') THEN
            RAISE EXCEPTION 'unknown tracker field: %', v_key USING ERRCODE = '22023';
        END IF;
    END LOOP;
    IF v_t.status = 'DISCONNECTED' THEN
        RAISE EXCEPTION 'tracker is disconnected' USING ERRCODE = '22023';
    END IF;

    IF p_changes ? 'enabled' THEN
        v_enabled := (p_changes ->> 'enabled')::boolean;
    END IF;

    UPDATE public.vehicle_trackers
    SET label = CASE WHEN p_changes ? 'label' THEN NULLIF(btrim(p_changes ->> 'label'), '') ELSE label END,
        device_model = CASE WHEN p_changes ? 'device_model' THEN NULLIF(btrim(p_changes ->> 'device_model'), '') ELSE device_model END,
        installed_at = CASE WHEN p_changes ? 'installed_at' THEN (p_changes ->> 'installed_at')::timestamptz ELSE installed_at END,
        status = CASE
            WHEN v_enabled IS TRUE AND status = 'DISABLED' THEN CASE WHEN last_event_at IS NULL THEN 'PENDING' ELSE 'ACTIVE' END
            WHEN v_enabled IS FALSE AND status IN ('PENDING', 'ACTIVE') THEN 'DISABLED'
            ELSE status
        END,
        updated_at = now()
    WHERE id = p_tracker_id;

    PERFORM public.tracking_write_audit(
        v_t.agency_id, v_actor, 'user', 'tracker.updated', 'vehicle_tracker', p_tracker_id::text,
        jsonb_build_object('fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_changes) AS k))
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 5. Zones géographiques
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_vehicle_geofence(
    p_agency_id UUID,
    p_geofence_id UUID,
    p_name TEXT,
    p_center_latitude DOUBLE PRECISION,
    p_center_longitude DOUBLE PRECISION,
    p_radius_m INTEGER,
    p_enabled BOOLEAN,
    p_alert_on_enter BOOLEAN,
    p_alert_on_exit BOOLEAN,
    p_vehicle_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_id UUID;
    v_vehicles UUID[] := COALESCE(ARRAY(SELECT DISTINCT x FROM unnest(p_vehicle_ids) AS x), '{}');
    v_old public.vehicle_geofences%ROWTYPE;
    v_reset BOOLEAN := true;
BEGIN
    IF v_actor IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.manage') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF cardinality(v_vehicles) > 0 AND (
        SELECT count(*) FROM public.vehicles WHERE agency_id = p_agency_id AND archived_at IS NULL AND id = ANY (v_vehicles)
    ) <> cardinality(v_vehicles) THEN
        RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_geofence_id IS NULL THEN
        IF (SELECT count(*) FROM public.vehicle_geofences WHERE agency_id = p_agency_id) >= 100 THEN
            RAISE EXCEPTION 'geofence limit reached' USING ERRCODE = '54000';
        END IF;
        INSERT INTO public.vehicle_geofences (
            agency_id, name, center_latitude, center_longitude, radius_m, enabled, alert_on_enter, alert_on_exit, created_by
        ) VALUES (
            p_agency_id, btrim(p_name), p_center_latitude, p_center_longitude, p_radius_m,
            COALESCE(p_enabled, true), COALESCE(p_alert_on_enter, true), COALESCE(p_alert_on_exit, true), v_actor
        ) RETURNING id INTO v_id;
    ELSE
        SELECT * INTO v_old FROM public.vehicle_geofences WHERE id = p_geofence_id AND agency_id = p_agency_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'geofence not found' USING ERRCODE = 'P0002';
        END IF;
        v_id := v_old.id;
        -- La position dans la zone est recalculée si la géométrie ou l'activation change (sinon : fausses alertes)
        v_reset := v_old.center_latitude IS DISTINCT FROM p_center_latitude
                OR v_old.center_longitude IS DISTINCT FROM p_center_longitude
                OR v_old.radius_m IS DISTINCT FROM p_radius_m
                OR v_old.enabled IS DISTINCT FROM COALESCE(p_enabled, true);
        UPDATE public.vehicle_geofences
        SET name = btrim(p_name), center_latitude = p_center_latitude, center_longitude = p_center_longitude,
            radius_m = p_radius_m, enabled = COALESCE(p_enabled, true),
            alert_on_enter = COALESCE(p_alert_on_enter, true), alert_on_exit = COALESCE(p_alert_on_exit, true),
            updated_at = now()
        WHERE id = v_id;
    END IF;

    DELETE FROM public.vehicle_geofence_assignments WHERE geofence_id = v_id AND NOT (vehicle_id = ANY (v_vehicles));
    INSERT INTO public.vehicle_geofence_assignments (geofence_id, vehicle_id, agency_id)
    SELECT v_id, x, p_agency_id FROM unnest(v_vehicles) AS x
    ON CONFLICT DO NOTHING;
    IF v_reset THEN
        UPDATE public.vehicle_geofence_assignments SET inside = NULL, state_changed_at = NULL WHERE geofence_id = v_id;
    END IF;

    PERFORM public.tracking_write_audit(
        p_agency_id, v_actor, 'user',
        CASE WHEN p_geofence_id IS NULL THEN 'geofence.created' ELSE 'geofence.updated' END,
        'vehicle_geofence', v_id::text,
        jsonb_build_object('vehicle_count', cardinality(v_vehicles), 'enabled', COALESCE(p_enabled, true), 'radius_m', p_radius_m)
    );
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_vehicle_geofence(p_geofence_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_g public.vehicle_geofences%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_g FROM public.vehicle_geofences WHERE id = p_geofence_id FOR UPDATE;
    IF NOT FOUND OR NOT public.has_tracking_permission(v_g.agency_id, 'tracking.manage') THEN
        RAISE EXCEPTION 'geofence not found' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.vehicle_geofences WHERE id = p_geofence_id;
    PERFORM public.tracking_write_audit(
        v_g.agency_id, v_actor, 'user', 'geofence.deleted', 'vehicle_geofence', p_geofence_id::text, '{}'::jsonb
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 6. Alertes, paramètres, autorisations de support, accès sensibles
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_tracking_alert(p_alert_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_a public.tracking_alerts%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_a FROM public.tracking_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND OR NOT public.has_tracking_permission(v_a.agency_id, 'tracking.alerts.manage') THEN
        RAISE EXCEPTION 'alert not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_a.status = 'ACKNOWLEDGED' THEN
        RETURN jsonb_build_object('changed', false, 'status', v_a.status, 'acknowledged_at', v_a.acknowledged_at);
    END IF;
    UPDATE public.tracking_alerts
    SET status = 'ACKNOWLEDGED', acknowledged_at = now(), acknowledged_by = v_actor
    WHERE id = p_alert_id
    RETURNING * INTO v_a;
    PERFORM public.tracking_write_audit(
        v_a.agency_id, v_actor, 'user', 'alert.acknowledged', 'tracking_alert', p_alert_id::text,
        jsonb_build_object('type', v_a.type)
    );
    RETURN jsonb_build_object('changed', true, 'status', v_a.status, 'acknowledged_at', v_a.acknowledged_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_default_settings(p_agency_id UUID)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'agency_id', p_agency_id,
        'retention_days', 90,
        'trip_retention_days', 365,
        'offline_after_minutes', 15,
        'moving_speed_kmh', 5,
        'trip_end_idle_minutes', 5,
        'speed_alerts_enabled', false,
        'speed_limit_kmh', NULL,
        'unexpected_movement_enabled', false,
        'quiet_hours_start', '22:00:00',
        'quiet_hours_end', '06:00:00',
        'legal_basis', NULL,
        'cndp_reference', NULL,
        'customers_informed_at', NULL,
        'configured', false
    );
$$;

CREATE OR REPLACE FUNCTION public.tracking_get_settings(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row JSONB;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT to_jsonb(s) - 'updated_by' - 'customers_informed_by' - 'created_at' - 'updated_at' || jsonb_build_object('configured', true)
    INTO v_row
    FROM public.tracking_settings s
    WHERE s.agency_id = p_agency_id;
    RETURN COALESCE(v_row, public.tracking_default_settings(p_agency_id));
END;
$$;

-- Clés acceptées : retention_days, trip_retention_days, offline_after_minutes, moving_speed_kmh, trip_end_idle_minutes,
-- speed_alerts_enabled, speed_limit_kmh, unexpected_movement_enabled, quiet_hours_start, quiet_hours_end,
-- legal_basis, cndp_reference, customers_informed (booléen : horodate la confirmation de l'agence)
CREATE OR REPLACE FUNCTION public.update_tracking_settings(p_agency_id UUID, p_changes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_key TEXT;
    v_before JSONB;
BEGIN
    IF v_actor IS NULL OR p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object'
       OR NOT public.has_tracking_permission(p_agency_id, 'tracking.settings.manage') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
        IF v_key NOT IN (
            'retention_days', 'trip_retention_days', 'offline_after_minutes', 'moving_speed_kmh', 'trip_end_idle_minutes',
            'speed_alerts_enabled', 'speed_limit_kmh', 'unexpected_movement_enabled', 'quiet_hours_start',
            'quiet_hours_end', 'legal_basis', 'cndp_reference', 'customers_informed'
        ) THEN
            RAISE EXCEPTION 'unknown setting: %', v_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    INSERT INTO public.tracking_settings (agency_id) VALUES (p_agency_id) ON CONFLICT DO NOTHING;
    SELECT to_jsonb(s) INTO v_before FROM public.tracking_settings s WHERE s.agency_id = p_agency_id FOR UPDATE;

    UPDATE public.tracking_settings
    SET retention_days = CASE WHEN p_changes ? 'retention_days' THEN (p_changes ->> 'retention_days')::integer ELSE retention_days END,
        trip_retention_days = CASE WHEN p_changes ? 'trip_retention_days' THEN (p_changes ->> 'trip_retention_days')::integer ELSE trip_retention_days END,
        offline_after_minutes = CASE WHEN p_changes ? 'offline_after_minutes' THEN (p_changes ->> 'offline_after_minutes')::integer ELSE offline_after_minutes END,
        moving_speed_kmh = CASE WHEN p_changes ? 'moving_speed_kmh' THEN (p_changes ->> 'moving_speed_kmh')::integer ELSE moving_speed_kmh END,
        trip_end_idle_minutes = CASE WHEN p_changes ? 'trip_end_idle_minutes' THEN (p_changes ->> 'trip_end_idle_minutes')::integer ELSE trip_end_idle_minutes END,
        speed_alerts_enabled = CASE WHEN p_changes ? 'speed_alerts_enabled' THEN (p_changes ->> 'speed_alerts_enabled')::boolean ELSE speed_alerts_enabled END,
        speed_limit_kmh = CASE WHEN p_changes ? 'speed_limit_kmh' THEN NULLIF(p_changes ->> 'speed_limit_kmh', '')::integer ELSE speed_limit_kmh END,
        unexpected_movement_enabled = CASE WHEN p_changes ? 'unexpected_movement_enabled' THEN (p_changes ->> 'unexpected_movement_enabled')::boolean ELSE unexpected_movement_enabled END,
        quiet_hours_start = CASE WHEN p_changes ? 'quiet_hours_start' THEN (p_changes ->> 'quiet_hours_start')::time ELSE quiet_hours_start END,
        quiet_hours_end = CASE WHEN p_changes ? 'quiet_hours_end' THEN (p_changes ->> 'quiet_hours_end')::time ELSE quiet_hours_end END,
        legal_basis = CASE WHEN p_changes ? 'legal_basis' THEN NULLIF(p_changes ->> 'legal_basis', '') ELSE legal_basis END,
        cndp_reference = CASE WHEN p_changes ? 'cndp_reference' THEN NULLIF(btrim(p_changes ->> 'cndp_reference'), '') ELSE cndp_reference END,
        customers_informed_at = CASE
            WHEN p_changes ? 'customers_informed' THEN CASE WHEN (p_changes ->> 'customers_informed')::boolean THEN now() ELSE NULL END
            ELSE customers_informed_at END,
        customers_informed_by = CASE
            WHEN p_changes ? 'customers_informed' THEN CASE WHEN (p_changes ->> 'customers_informed')::boolean THEN v_actor ELSE NULL END
            ELSE customers_informed_by END,
        updated_by = v_actor,
        updated_at = now()
    WHERE agency_id = p_agency_id;

    PERFORM public.tracking_write_audit(
        p_agency_id, v_actor, 'user', 'settings.updated', 'tracking_settings', p_agency_id::text,
        jsonb_build_object(
            'fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_changes) AS k),
            'retention_days_before', v_before -> 'retention_days',
            'retention_days_after', COALESCE(p_changes -> 'retention_days', v_before -> 'retention_days')
        )
    );
    RETURN public.tracking_get_settings(p_agency_id);
END;
$$;

-- Accès de support plateforme : explicite, motivé, de 5 minutes à 2 heures, lecture seule, visible par l'agence
CREATE OR REPLACE FUNCTION public.grant_tracking_support_access(
    p_agency_id UUID, p_reason TEXT, p_minutes INTEGER DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_id UUID;
    v_expires TIMESTAMPTZ;
BEGIN
    IF v_actor IS NULL OR NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF p_minutes IS NULL OR p_minutes < 5 OR p_minutes > 120 THEN
        RAISE EXCEPTION 'duration must be between 5 and 120 minutes' USING ERRCODE = '22023';
    END IF;
    IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN
        RAISE EXCEPTION 'a reason of at least 10 characters is required' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.agencies WHERE id = p_agency_id AND archived_at IS NULL) THEN
        RAISE EXCEPTION 'agency not found' USING ERRCODE = 'P0002';
    END IF;
    v_expires := now() + make_interval(mins => p_minutes);
    INSERT INTO public.tracking_support_grants (agency_id, granted_to, reason, expires_at)
    VALUES (p_agency_id, v_actor, btrim(p_reason), v_expires)
    RETURNING id INTO v_id;
    PERFORM public.tracking_write_audit(
        p_agency_id, v_actor, 'platform_support', 'support.access_granted', 'tracking_support_grant', v_id::text,
        jsonb_build_object('expires_at', v_expires, 'minutes', p_minutes, 'reason', btrim(p_reason))
    );
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_tracking_support_access(p_grant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_g public.tracking_support_grants%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_g FROM public.tracking_support_grants WHERE id = p_grant_id FOR UPDATE;
    -- Le bénéficiaire ou un administrateur de l'agence concernée peut mettre fin à l'accès
    IF NOT FOUND OR NOT (
        v_g.granted_to = v_actor OR public.has_tracking_permission(v_g.agency_id, 'tracking.settings.manage')
    ) THEN
        RAISE EXCEPTION 'grant not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_g.revoked_at IS NOT NULL THEN
        RETURN;
    END IF;
    UPDATE public.tracking_support_grants SET revoked_at = now() WHERE id = p_grant_id;
    PERFORM public.tracking_write_audit(
        v_g.agency_id, v_actor,
        CASE WHEN v_g.granted_to = v_actor THEN 'platform_support' ELSE 'user' END,
        'support.access_revoked', 'tracking_support_grant', p_grant_id::text, '{}'::jsonb
    );
END;
$$;

-- Journalise une consultation sensible (historique, tracé de trajet, lecture de support) ; actions autorisées bornées
CREATE OR REPLACE FUNCTION public.tracking_record_access(
    p_agency_id UUID, p_action TEXT, p_entity_type TEXT, p_entity_id TEXT, p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_member BOOLEAN;
BEGIN
    IF v_actor IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF p_action NOT IN ('history.read', 'trip_route.read', 'support.read') THEN
        RAISE EXCEPTION 'unsupported audit action' USING ERRCODE = '22023';
    END IF;
    v_member := public.has_agency_permission(p_agency_id, 'tracking.read');
    PERFORM public.tracking_write_audit(
        p_agency_id, v_actor, CASE WHEN v_member THEN 'user' ELSE 'platform_support' END,
        p_action, left(COALESCE(p_entity_type, 'vehicle'), 60), left(p_entity_id, 120),
        CASE WHEN jsonb_typeof(p_metadata) = 'object' THEN p_metadata ELSE '{}'::jsonb END
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 7. Lectures de l'agence (permission tracking.read vérifiée dans la fonction ; données bornées)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tracking_fleet_overview(
    p_agency_id UUID,
    p_search TEXT DEFAULT NULL,
    p_state TEXT DEFAULT 'all',
    p_limit INTEGER DEFAULT 200,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offline INTEGER;
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
    v_search TEXT := NULLIF(btrim(p_search), '');
    v_state TEXT := upper(COALESCE(NULLIF(btrim(p_state), ''), 'all'));
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF v_state NOT IN ('ALL', 'MOVING', 'STATIONARY', 'OFFLINE', 'AWAITING', 'UNTRACKED', 'DISABLED', 'ALERTS') THEN
        RAISE EXCEPTION 'invalid state filter' USING ERRCODE = '22023';
    END IF;
    IF v_search IS NOT NULL THEN
        v_search := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    END IF;
    SELECT COALESCE((SELECT offline_after_minutes FROM public.tracking_settings WHERE agency_id = p_agency_id), 15) INTO v_offline;

    WITH alerts AS (
        SELECT vehicle_id, count(*) AS open_alerts
        FROM public.tracking_alerts
        WHERE agency_id = p_agency_id AND status = 'OPEN'
        GROUP BY vehicle_id
    ),
    base AS (
        SELECT v.id, v.brand, v.model, v.unit_number, v.license_plate, v.vehicle_type, v.status AS vehicle_status,
               t.id AS tracker_id, t.provider, t.label AS tracker_label, t.status AS tracker_status, t.last_seen_at,
               l.vehicle_id AS has_latest, l.latitude, l.longitude, l.speed_kmh, l.heading_deg, l.ignition,
               l.accuracy_m, l.recorded_at, l.movement_state,
               COALESCE(bk.reference, bk.booking_ref) AS booking_reference,
               COALESCE(al.open_alerts, 0) AS open_alerts,
               public.tracking_connection_state(
                   t.id IS NOT NULL, t.status, t.last_seen_at, l.vehicle_id IS NOT NULL, l.movement_state, v_offline
               ) AS state
        FROM public.vehicles v
        LEFT JOIN public.vehicle_trackers t ON t.vehicle_id = v.id
        LEFT JOIN public.vehicle_tracking_latest l ON l.vehicle_id = v.id
        LEFT JOIN public.bookings bk ON bk.id = l.booking_id
        LEFT JOIN alerts al ON al.vehicle_id = v.id
        WHERE v.agency_id = p_agency_id AND v.archived_at IS NULL
    ),
    filtered AS (
        SELECT * FROM base
        WHERE (v_state = 'ALL' OR (v_state = 'ALERTS' AND open_alerts > 0) OR state = v_state)
          AND (v_search IS NULL
               OR concat_ws(' ', brand, model, unit_number, license_plate, tracker_label) ILIKE v_search ESCAPE '\')
    ),
    page AS (
        SELECT * FROM filtered
        ORDER BY CASE state WHEN 'OFFLINE' THEN 0 WHEN 'MOVING' THEN 1 WHEN 'STATIONARY' THEN 2 WHEN 'AWAITING' THEN 3 WHEN 'DISABLED' THEN 4 ELSE 5 END,
                 unit_number, id
        LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'total_vehicles', count(*),
                'tracked', count(*) FILTER (WHERE state <> 'UNTRACKED'),
                'online', count(*) FILTER (WHERE state IN ('MOVING', 'STATIONARY')),
                'moving', count(*) FILTER (WHERE state = 'MOVING'),
                'stationary', count(*) FILTER (WHERE state = 'STATIONARY'),
                'offline', count(*) FILTER (WHERE state = 'OFFLINE'),
                'awaiting', count(*) FILTER (WHERE state = 'AWAITING'),
                'disabled', count(*) FILTER (WHERE state = 'DISABLED'),
                'untracked', count(*) FILTER (WHERE state = 'UNTRACKED'),
                'open_alerts', COALESCE(sum(open_alerts), 0)
            ) FROM base
        ),
        'total', (SELECT count(*) FROM filtered),
        'limit', v_limit,
        'offset', v_offset,
        'generated_at', now(),
        'vehicles', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'brand', p.brand,
                'model', p.model,
                'unit_number', p.unit_number,
                'license_plate', p.license_plate,
                'vehicle_type', p.vehicle_type,
                'state', p.state,
                'open_alerts', p.open_alerts,
                'booking_reference', p.booking_reference,
                'tracker', CASE WHEN p.tracker_id IS NULL THEN NULL ELSE jsonb_build_object(
                    'id', p.tracker_id, 'provider', p.provider, 'label', p.tracker_label,
                    'status', p.tracker_status, 'last_seen_at', p.last_seen_at
                ) END,
                'position', CASE WHEN p.has_latest IS NULL THEN NULL ELSE jsonb_build_object(
                    'latitude', p.latitude, 'longitude', p.longitude, 'speed_kmh', p.speed_kmh,
                    'heading_deg', p.heading_deg, 'ignition', p.ignition, 'accuracy_m', p.accuracy_m,
                    'recorded_at', p.recorded_at
                ) END
            ) ORDER BY CASE p.state WHEN 'OFFLINE' THEN 0 WHEN 'MOVING' THEN 1 WHEN 'STATIONARY' THEN 2 WHEN 'AWAITING' THEN 3 WHEN 'DISABLED' THEN 4 ELSE 5 END,
                       p.unit_number, p.id)
            FROM page p
        ), '[]'::jsonb)
    ) INTO v_result;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_vehicle_detail(p_agency_id UUID, p_vehicle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offline INTEGER;
    v_vehicle public.vehicles%ROWTYPE;
    v_tracker public.vehicle_trackers%ROWTYPE;
    v_latest public.vehicle_tracking_latest%ROWTYPE;
    v_has_tracker BOOLEAN;
    v_has_latest BOOLEAN;
    v_booking UUID;
    v_booking_json JSONB;
    v_day_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca';
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id AND agency_id = p_agency_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT COALESCE((SELECT offline_after_minutes FROM public.tracking_settings WHERE agency_id = p_agency_id), 15) INTO v_offline;
    SELECT * INTO v_tracker FROM public.vehicle_trackers WHERE vehicle_id = p_vehicle_id;
    v_has_tracker := FOUND;
    SELECT * INTO v_latest FROM public.vehicle_tracking_latest WHERE vehicle_id = p_vehicle_id;
    v_has_latest := FOUND;

    v_booking := public.tracking_booking_for(p_vehicle_id, now());
    IF v_booking IS NOT NULL THEN
        -- Aucune donnée personnelle du locataire : référence, dates et statut seulement
        SELECT jsonb_build_object('reference', COALESCE(b.reference, b.booking_ref), 'start_date', b.start_date,
                                  'end_date', b.end_date, 'status', b.status)
        INTO v_booking_json FROM public.bookings b WHERE b.id = v_booking;
    END IF;

    RETURN jsonb_build_object(
        'vehicle', jsonb_build_object(
            'id', v_vehicle.id, 'brand', v_vehicle.brand, 'model', v_vehicle.model,
            'unit_number', v_vehicle.unit_number, 'license_plate', v_vehicle.license_plate,
            'vehicle_type', v_vehicle.vehicle_type, 'status', v_vehicle.status
        ),
        'state', public.tracking_connection_state(
            v_has_tracker, v_tracker.status, v_tracker.last_seen_at, v_has_latest, v_latest.movement_state, v_offline
        ),
        'offline_after_minutes', v_offline,
        'tracker', CASE WHEN NOT v_has_tracker THEN NULL ELSE jsonb_build_object(
            'id', v_tracker.id, 'provider', v_tracker.provider, 'label', v_tracker.label, 'status', v_tracker.status,
            'last_seen_at', v_tracker.last_seen_at, 'installed_at', v_tracker.installed_at, 'capabilities', v_tracker.capabilities
        ) END,
        'position', CASE WHEN NOT v_has_latest THEN NULL ELSE jsonb_build_object(
            'latitude', v_latest.latitude, 'longitude', v_latest.longitude, 'speed_kmh', v_latest.speed_kmh,
            'heading_deg', v_latest.heading_deg, 'ignition', v_latest.ignition, 'accuracy_m', v_latest.accuracy_m,
            'recorded_at', v_latest.recorded_at, 'movement_state', v_latest.movement_state
        ) END,
        'booking', v_booking_json,
        'today', (
            SELECT jsonb_build_object(
                'trips', count(*),
                'distance_km', round(COALESCE(sum(distance_km), 0)::numeric, 1),
                'max_speed_kmh', COALESCE(max(max_speed_kmh), 0)
            )
            FROM public.vehicle_trips WHERE vehicle_id = p_vehicle_id AND started_at >= v_day_start
        ),
        'open_alerts', (SELECT count(*) FROM public.tracking_alerts WHERE vehicle_id = p_vehicle_id AND status = 'OPEN'),
        'geofences', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'enabled', g.enabled, 'inside', a.inside) ORDER BY g.name)
            FROM public.vehicle_geofence_assignments a
            JOIN public.vehicle_geofences g ON g.id = a.geofence_id
            WHERE a.vehicle_id = p_vehicle_id
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_trips_page(
    p_agency_id UUID,
    p_vehicle_id UUID,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
    v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
    v_total BIGINT;
    v_rows JSONB;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '93 days' THEN
        RAISE EXCEPTION 'invalid date range (93 days maximum)' USING ERRCODE = '22023';
    END IF;

    SELECT count(*) INTO v_total
    FROM public.vehicle_trips t
    WHERE t.agency_id = p_agency_id AND (p_vehicle_id IS NULL OR t.vehicle_id = p_vehicle_id)
      AND t.started_at >= p_from AND t.started_at < p_to;

    SELECT COALESCE(jsonb_agg(row_json ORDER BY started_at DESC, id), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT t.started_at, t.id, jsonb_build_object(
            'id', t.id,
            'vehicle', jsonb_build_object('id', v.id, 'brand', v.brand, 'model', v.model, 'unit_number', v.unit_number, 'license_plate', v.license_plate),
            'booking_reference', COALESCE(b.reference, b.booking_ref),
            'status', t.status,
            'started_at', t.started_at,
            'ended_at', t.ended_at,
            'start', jsonb_build_object('latitude', t.start_latitude, 'longitude', t.start_longitude),
            'end', CASE WHEN t.end_latitude IS NULL THEN NULL ELSE jsonb_build_object('latitude', t.end_latitude, 'longitude', t.end_longitude) END,
            'distance_km', round(t.distance_km::numeric, 2),
            'duration_seconds', COALESCE(t.duration_seconds, GREATEST(0, extract(epoch FROM (now() - t.started_at))::integer)),
            'max_speed_kmh', t.max_speed_kmh,
            'closed_reason', t.closed_reason
        ) AS row_json
        FROM public.vehicle_trips t
        JOIN public.vehicles v ON v.id = t.vehicle_id
        LEFT JOIN public.bookings b ON b.id = t.booking_id
        WHERE t.agency_id = p_agency_id AND (p_vehicle_id IS NULL OR t.vehicle_id = p_vehicle_id)
          AND t.started_at >= p_from AND t.started_at < p_to
        ORDER BY t.started_at DESC, t.id
        LIMIT v_limit OFFSET v_offset
    ) page;

    RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'trips', v_rows);
END;
$$;

-- Tracé d'un trajet, rééchantillonné (jamais plus de p_max_points points)
CREATE OR REPLACE FUNCTION public.tracking_trip_route(p_agency_id UUID, p_trip_id UUID, p_max_points INTEGER DEFAULT 800)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip public.vehicle_trips%ROWTYPE;
    v_max INTEGER := LEAST(GREATEST(COALESCE(p_max_points, 800), 20), 1500);
    v_total BIGINT;
    v_points JSONB;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_trip FROM public.vehicle_trips WHERE id = p_trip_id AND agency_id = p_agency_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT count(*) INTO v_total
    FROM public.vehicle_locations
    WHERE vehicle_id = v_trip.vehicle_id AND quality = 'OK'
      AND recorded_at BETWEEN v_trip.started_at AND COALESCE(v_trip.ended_at, v_trip.last_position_at);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'recorded_at', recorded_at, 'latitude', latitude, 'longitude', longitude, 'speed_kmh', speed_kmh
    ) ORDER BY recorded_at, id), '[]'::jsonb) INTO v_points
    FROM (
        SELECT l.id, l.recorded_at, l.latitude, l.longitude, l.speed_kmh,
               row_number() OVER (ORDER BY l.recorded_at, l.id) AS rn
        FROM public.vehicle_locations l
        WHERE l.vehicle_id = v_trip.vehicle_id AND l.quality = 'OK'
          AND l.recorded_at BETWEEN v_trip.started_at AND COALESCE(v_trip.ended_at, v_trip.last_position_at)
    ) s
    WHERE s.rn = 1 OR s.rn = v_total OR (s.rn - 1) % GREATEST(1, ceil(v_total::numeric / v_max)::integer) = 0;

    RETURN jsonb_build_object(
        'trip_id', v_trip.id, 'total_points', v_total, 'points', v_points
    );
END;
$$;

-- Historique de positions d'un véhicule : plage de 31 jours au plus, pagination par curseur (recorded_at, id),
-- 1 000 points par page au maximum. Les positions suspectes (saut, faible précision) sont exclues par défaut.
CREATE OR REPLACE FUNCTION public.tracking_vehicle_history(
    p_agency_id UUID,
    p_vehicle_id UUID,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 500,
    p_after_recorded_at TIMESTAMPTZ DEFAULT NULL,
    p_after_id BIGINT DEFAULT NULL,
    p_include_suspect BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);
    v_rows JSONB;
    v_count INTEGER;
    v_last_at TIMESTAMPTZ;
    v_last_id BIGINT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vehicles WHERE id = p_vehicle_id AND agency_id = p_agency_id) THEN
        RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '31 days' THEN
        RAISE EXCEPTION 'invalid date range (31 days maximum)' USING ERRCODE = '22023';
    END IF;
    IF (p_after_recorded_at IS NULL) <> (p_after_id IS NULL) THEN
        RAISE EXCEPTION 'invalid cursor' USING ERRCODE = '22023';
    END IF;

    -- limit + 1 lignes : la ligne supplémentaire indique qu'une page suivante existe
    WITH page AS (
        SELECT l.id, l.recorded_at, l.latitude, l.longitude, l.speed_kmh, l.heading_deg, l.ignition, l.quality
        FROM public.vehicle_locations l
        WHERE l.vehicle_id = p_vehicle_id AND l.agency_id = p_agency_id
          AND l.recorded_at >= p_from AND l.recorded_at < p_to
          AND (p_include_suspect OR l.quality = 'OK')
          AND (p_after_recorded_at IS NULL OR (l.recorded_at, l.id) > (p_after_recorded_at, p_after_id))
        ORDER BY l.recorded_at, l.id
        LIMIT v_limit + 1
    ),
    numbered AS (
        SELECT page.*, row_number() OVER (ORDER BY page.recorded_at, page.id) AS rn FROM page
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', n.id, 'recorded_at', n.recorded_at, 'latitude', n.latitude, 'longitude', n.longitude,
               'speed_kmh', n.speed_kmh, 'heading_deg', n.heading_deg, 'ignition', n.ignition, 'quality', n.quality
           ) ORDER BY n.recorded_at, n.id) FILTER (WHERE n.rn <= v_limit), '[]'::jsonb),
           count(*),
           (array_agg(n.recorded_at ORDER BY n.rn) FILTER (WHERE n.rn = v_limit))[1],
           (array_agg(n.id ORDER BY n.rn) FILTER (WHERE n.rn = v_limit))[1]
    INTO v_rows, v_count, v_last_at, v_last_id
    FROM numbered n;

    RETURN jsonb_build_object(
        'points', v_rows,
        'limit', v_limit,
        'next_cursor', CASE WHEN v_count > v_limit
            THEN jsonb_build_object('recorded_at', v_last_at, 'id', v_last_id) END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_alerts_page(
    p_agency_id UUID,
    p_status TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT NULL,
    p_vehicle_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
    v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
    v_total BIGINT;
    v_open BIGINT;
    v_rows JSONB;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    SELECT count(*) INTO v_total
    FROM public.tracking_alerts a
    WHERE a.agency_id = p_agency_id
      AND (p_status IS NULL OR a.status = p_status)
      AND (p_type IS NULL OR a.type = p_type)
      AND (p_severity IS NULL OR a.severity = p_severity)
      AND (p_vehicle_id IS NULL OR a.vehicle_id = p_vehicle_id);
    SELECT count(*) INTO v_open FROM public.tracking_alerts WHERE agency_id = p_agency_id AND status = 'OPEN';

    SELECT COALESCE(jsonb_agg(row_json ORDER BY occurred_at DESC, id), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT a.occurred_at, a.id, jsonb_build_object(
            'id', a.id,
            'type', a.type,
            'severity', a.severity,
            'title', a.title,
            'description', a.description,
            'occurred_at', a.occurred_at,
            'resolved_at', a.resolved_at,
            'ongoing', a.ongoing AND a.resolved_at IS NULL,
            'status', a.status,
            'acknowledged_at', a.acknowledged_at,
            'vehicle', jsonb_build_object('id', v.id, 'brand', v.brand, 'model', v.model, 'unit_number', v.unit_number, 'license_plate', v.license_plate),
            'geofence_name', g.name,
            'booking_reference', COALESCE(b.reference, b.booking_ref),
            'position', CASE WHEN a.latitude IS NULL THEN NULL ELSE jsonb_build_object('latitude', a.latitude, 'longitude', a.longitude) END,
            'metadata', a.metadata
        ) AS row_json
        FROM public.tracking_alerts a
        JOIN public.vehicles v ON v.id = a.vehicle_id
        LEFT JOIN public.vehicle_geofences g ON g.id = a.geofence_id
        LEFT JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.agency_id = p_agency_id
          AND (p_status IS NULL OR a.status = p_status)
          AND (p_type IS NULL OR a.type = p_type)
          AND (p_severity IS NULL OR a.severity = p_severity)
          AND (p_vehicle_id IS NULL OR a.vehicle_id = p_vehicle_id)
        ORDER BY a.occurred_at DESC, a.id
        LIMIT v_limit OFFSET v_offset
    ) page;

    RETURN jsonb_build_object('total', v_total, 'open_total', v_open, 'limit', v_limit, 'offset', v_offset, 'alerts', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_trackers_list(p_agency_id UUID, p_include_disconnected BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offline INTEGER;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    SELECT COALESCE((SELECT offline_after_minutes FROM public.tracking_settings WHERE agency_id = p_agency_id), 15) INTO v_offline;

    RETURN jsonb_build_object('trackers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', t.id,
            'provider', t.provider,
            'external_device_id', t.external_device_id,
            'label', t.label,
            'device_model', t.device_model,
            'status', t.status,
            'state', public.tracking_connection_state(true, t.status, t.last_seen_at, true, 'STATIONARY', v_offline),
            'installed_at', t.installed_at,
            'last_seen_at', t.last_seen_at,
            'last_position_at', t.last_position_at,
            'disconnected_at', t.disconnected_at,
            'capabilities', t.capabilities,
            'vehicle', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', v.id, 'brand', v.brand, 'model', v.model, 'unit_number', v.unit_number, 'license_plate', v.license_plate
            ) END,
            'history', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'vehicle_label', COALESCE(public.tracking_vehicle_label(h.vehicle_id), 'Véhicule supprimé'),
                    'assigned_at', h.assigned_at, 'unassigned_at', h.unassigned_at, 'reason', h.reason
                ) ORDER BY h.assigned_at DESC)
                FROM (
                    SELECT * FROM public.vehicle_tracker_assignments a WHERE a.tracker_id = t.id
                    ORDER BY a.assigned_at DESC LIMIT 5
                ) h
            ), '[]'::jsonb)
        ) ORDER BY t.created_at DESC)
        FROM public.vehicle_trackers t
        LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
        WHERE t.agency_id = p_agency_id AND (p_include_disconnected OR t.status <> 'DISCONNECTED')
    ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.tracking_geofences_list(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_tracking_permission(p_agency_id, 'tracking.read') THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('geofences', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'shape', g.shape,
            'center_latitude', g.center_latitude,
            'center_longitude', g.center_longitude,
            'radius_m', g.radius_m,
            'enabled', g.enabled,
            'alert_on_enter', g.alert_on_enter,
            'alert_on_exit', g.alert_on_exit,
            'created_at', g.created_at,
            'vehicle_ids', COALESCE((SELECT jsonb_agg(a.vehicle_id ORDER BY a.vehicle_id) FROM public.vehicle_geofence_assignments a WHERE a.geofence_id = g.id), '[]'::jsonb)
        ) ORDER BY g.name)
        FROM public.vehicle_geofences g
        WHERE g.agency_id = p_agency_id
    ), '[]'::jsonb));
END;
$$;

-- ------------------------------------------------------------------------
-- 8. Privilèges d'exécution
-- ------------------------------------------------------------------------
-- Fonctions internes : aucun rôle d'API
REVOKE ALL ON FUNCTION public.tracking_write_audit(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_vehicle_label(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_booking_for(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_raise_alert(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_resolve_alert(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_close_trip(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_detach_cleanup(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tracking_haversine_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracking_connection_state(BOOLEAN, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracking_default_settings(UUID) FROM PUBLIC, anon, authenticated;

-- service_role uniquement
REVOKE ALL ON FUNCTION public.tracking_ingest_event(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracking_record_ingest_failure(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracking_run_maintenance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracking_purge_expired(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracking_ingest_event(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.tracking_record_ingest_failure(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.tracking_run_maintenance() TO service_role;
GRANT EXECUTE ON FUNCTION public.tracking_purge_expired(INTEGER) TO service_role;

-- Utilisateurs connectés : la permission est revérifiée dans chaque fonction (anon n'a aucun droit)
REVOKE ALL ON FUNCTION public.register_vehicle_tracker(UUID, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_vehicle_tracker(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disconnect_vehicle_tracker(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_vehicle_tracker(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_vehicle_geofence(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_vehicle_geofence(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acknowledge_tracking_alert(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_tracking_settings(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_tracking_support_access(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_tracking_support_access(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_record_access(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_get_settings(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_fleet_overview(UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_vehicle_detail(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_trips_page(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_trip_route(UUID, UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_vehicle_history(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ, BIGINT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_alerts_page(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_trackers_list(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tracking_geofences_list(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.register_vehicle_tracker(UUID, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_vehicle_tracker(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_vehicle_tracker(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_vehicle_tracker(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_vehicle_geofence(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_vehicle_geofence(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_tracking_alert(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_tracking_settings(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_tracking_support_access(UUID, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_tracking_support_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_record_access(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_get_settings(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_fleet_overview(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_vehicle_detail(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_trips_page(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_trip_route(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_vehicle_history(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ, BIGINT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_alerts_page(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_trackers_list(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_geofences_list(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
