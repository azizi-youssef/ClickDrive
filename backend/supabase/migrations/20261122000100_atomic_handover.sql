-- ============================================================================
-- ClickDrive — Remise et restitution du véhicule en une seule transaction
-- ============================================================================
--
-- La remise des clés (départ) et la restitution (retour) étaient quatre écritures séparées depuis
-- l'application (lib/services/delivery.service.ts) : statut de la réservation, statut et compteur du
-- véhicule, état des lieux dans booking_events, journal audit_logs. Une écriture en échec après la
-- première laissait un état incohérent, par exemple un véhicule déclaré endommagé au retour resté
-- AVAILABLE (donc réservable) au lieu de passer en MAINTENANCE.
--
-- agency_record_handover() fait les quatre écritures ensemble, comme agency_decide_booking() pour les
-- décisions : verrou de la réservation, garde sur l'agence et sur le statut lu, transition de la
-- machine à états (même règle que canPerformHandover, @clickdrive/shared/booking-state-machine) :
--   remise       : APPROVED / CONFIRMED / READY_FOR_PICKUP → ACTIVE,   véhicule → RENTED
--   restitution  : ACTIVE                                  → COMPLETED, véhicule → AVAILABLE ou MAINTENANCE
-- Toute erreur annule l'ensemble. Les contrôles de saisie (kilométrage de retour, retenue sur caution)
-- restent faits par l'application, qui construit aussi le contenu de l'état des lieux.
--
-- Service-role uniquement (la permission bookings.manage est vérifiée par la route).
--
-- Rollback
--   DROP FUNCTION IF EXISTS public.agency_record_handover(UUID, UUID, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT, JSONB, JSONB);
--   L'application exige cette fonction pour la remise des clés : revenir aussi au code précédent.
-- ============================================================================

BEGIN;

-- Prérequis : schéma des réservations et du journal présent sur CE projet (sinon échec immédiat)
DO $$
BEGIN
    IF to_regclass('public.bookings') IS NULL
       OR to_regclass('public.vehicles') IS NULL
       OR to_regclass('public.booking_events') IS NULL
       OR to_regclass('public.audit_logs') IS NULL THEN
        RAISE EXCEPTION 'Migration 20261122000100 : tables absentes (public.bookings, public.vehicles, public.booking_events, public.audit_logs). Appliquez d''abord le schéma de base.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.agency_record_handover(
    p_booking_id UUID,
    p_agency_id UUID,
    p_action TEXT,
    p_expected_status TEXT,
    p_actor_id UUID,
    p_actor_role TEXT,
    p_mileage INTEGER,
    p_vehicle_status TEXT,
    p_event_metadata JSONB DEFAULT '{}'::jsonb,
    p_audit_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_status TEXT;
BEGIN
    IF p_action IS NULL OR p_action NOT IN ('pickup', 'return') THEN
        RAISE EXCEPTION 'AGENCY_HANDOVER_INVALID_ACTION' USING ERRCODE = '22023';
    END IF;
    IF p_mileage IS NULL OR p_mileage < 0 THEN
        RAISE EXCEPTION 'AGENCY_HANDOVER_INVALID_MILEAGE' USING ERRCODE = '22023';
    END IF;
    IF (p_action = 'pickup' AND p_vehicle_status IS DISTINCT FROM 'RENTED')
       OR (p_action = 'return' AND coalesce(p_vehicle_status, '') NOT IN ('AVAILABLE', 'MAINTENANCE')) THEN
        RAISE EXCEPTION 'AGENCY_HANDOVER_INVALID_VEHICLE_STATUS' USING ERRCODE = '22023';
    END IF;

    -- Verrou de la réservation : deux remises simultanées sont traitées l'une après l'autre
    SELECT * INTO v_booking
      FROM public.bookings
     WHERE id = p_booking_id AND agency_id = p_agency_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF v_booking.status IS DISTINCT FROM p_expected_status
       OR (p_action = 'pickup' AND v_booking.status NOT IN ('APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP'))
       OR (p_action = 'return' AND v_booking.status <> 'ACTIVE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'transition_conflict', 'status', v_booking.status);
    END IF;

    IF p_action = 'pickup' THEN
        v_status := 'ACTIVE';
        UPDATE public.bookings
           SET status = v_status, reviewed_at = v_now, updated_at = v_now
         WHERE id = p_booking_id;
    ELSE
        v_status := 'COMPLETED';
        UPDATE public.bookings
           SET status = v_status, completed_at = v_now, updated_at = v_now
         WHERE id = p_booking_id;
    END IF;

    -- Statut et compteur du véhicule, bornés à l'agence
    IF v_booking.vehicle_id IS NOT NULL THEN
        UPDATE public.vehicles
           SET status = p_vehicle_status, mileage = p_mileage, updated_at = v_now
         WHERE id = v_booking.vehicle_id AND agency_id = p_agency_id;
    END IF;

    INSERT INTO public.booking_events (booking_id, actor_id, actor_role, event_type, metadata)
    VALUES (
        p_booking_id,
        p_actor_id,
        coalesce(p_actor_role, 'AGENCY_MANAGER'),
        CASE p_action WHEN 'pickup' THEN 'HANDOVER_PICKUP_COMPLETED' ELSE 'HANDOVER_RETURN_COMPLETED' END,
        coalesce(p_event_metadata, '{}'::jsonb)
    );

    INSERT INTO public.audit_logs (user_id, agency_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id,
        p_agency_id,
        CASE p_action WHEN 'pickup' THEN 'VEHICLE_HANDOVER_PICKUP' ELSE 'VEHICLE_HANDOVER_RETURN' END,
        'booking',
        p_booking_id::text,
        coalesce(p_audit_metadata, '{}'::jsonb)
    );

    RETURN jsonb_build_object('ok', true, 'status', v_status, 'vehicle_status', p_vehicle_status);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_record_handover(UUID, UUID, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT, JSONB, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_record_handover(UUID, UUID, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT, JSONB, JSONB)
    TO service_role;

COMMIT;
