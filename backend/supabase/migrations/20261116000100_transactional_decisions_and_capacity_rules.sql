-- ============================================================================
-- ClickDrive — Phase 3 : décisions transactionnelles et règles de capacité
-- ============================================================================
--
-- 1. agency_decide_booking() — décision d'une agence (approuver, refuser, proposer une alternative)
--    en UNE transaction : verrou de la réservation, contrôle du statut attendu (garde de concurrence),
--    mise à jour alignée sur la machine à états partagée (APPROVED / REJECTED / ALTERNATIVE_PROPOSED)
--    et journal booking_events. Si une étape échoue, rien n'est écrit (plus de décision sans historique).
--    L'approbation ne modifie plus le statut de flotte du véhicule : RENTED est posé à la remise des clés
--    (état des lieux), ce qui rend justes les indicateurs « actuellement loués » et le taux d'occupation.
--    Le chevauchement reste arbitré par la contrainte no_overlapping_confirmed_bookings (23P01).
--    Appelée uniquement par le serveur (service-role) APRÈS contrôle de bookings.manage sur l'agence.
--
-- 2. admin_decide_plan_change() — décision de l'administration sur un changement de formule, atomique :
--    verrou de la demande, une seule décision possible, formule appliquée et demande close ensemble.
--    Une validation et un refus simultanés ne peuvent plus laisser la formule appliquée avec une
--    demande refusée. La flotte actuelle doit tenir dans la nouvelle formule.
--
-- 3. enforce_vehicle_capacity() — règle de capacité précisée (même règle côté application) :
--    - véhicules archivés exclus du compte (désarchiver un véhicule est contrôlé) ;
--    - custom_vehicle_limit de l'abonnement prioritaire sur la limite de la formule ;
--    - abonnement CANCELLED ou EXPIRED : traité comme une absence d'abonnement (palier déduit de la
--      flotte) ; ACTIVE, TRIAL et PAST_DUE (délai de grâce) gardent la limite de leur formule.
--
-- Additive : aucune donnée existante n'est modifiée.
-- Les véhicules déjà passés en RENTED par d'anciennes approbations le restent jusqu'à leur restitution
-- ou au nettoyage expire_completed_bookings() (aucune correction automatique : un statut RENTED peut
-- aussi avoir été posé à la main par l'agence pour une location hors plateforme).
--
-- Rollback
--   DROP FUNCTION IF EXISTS public.agency_decide_booking(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.admin_decide_plan_change(UUID, TEXT, UUID, TEXT, TEXT);
--   puis réappliquer enforce_vehicle_capacity() de 20261114000100 (et son déclencheur).
--   L'application de la phase 3 exige ces fonctions : revenir aussi au code précédent.
--
-- Validation staging
--   approuver / refuser / proposer une alternative depuis l'espace agence (statuts APPROVED, REJECTED,
--   ALTERNATIVE_PROPOSED et événements visibles) ; deux approbations simultanées de dates qui se
--   chevauchent (une seule réussit) ; valider puis refuser la même demande de formule (la seconde échoue).
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
      FROM unnest(ARRAY[
          'public.bookings', 'public.booking_events', 'public.vehicles', 'public.subscription_plans',
          'public.agency_subscriptions', 'public.subscription_change_requests'
      ]) AS t
     WHERE to_regclass(t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261116000100 : tables absentes de cette base (%).', v_missing
            USING HINT = 'Vérifiez le projet Supabase sélectionné. Sur une base vide, appliquez d''abord backend/supabase/schema.sql, puis toutes les migrations dans l''ordre de leur nom de fichier.';
    END IF;
END;
$$;

-- 1. Décisions agence ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_decide_booking(
    p_booking_id UUID,
    p_agency_id UUID,
    p_action TEXT,
    p_expected_status TEXT,
    p_actor_id UUID,
    p_actor_role TEXT DEFAULT 'AGENCY_OWNER',
    p_notes TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_alternative_vehicle_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_alt RECORD;
    v_now TIMESTAMPTZ := now();
    v_status TEXT;
BEGIN
    IF p_action NOT IN ('approve', 'reject', 'propose_alternative') THEN
        RAISE EXCEPTION 'AGENCY_DECISION_INVALID_ACTION' USING ERRCODE = '22023';
    END IF;

    -- Verrou de la réservation : deux décisions simultanées sont traitées l'une après l'autre
    SELECT * INTO v_booking
      FROM public.bookings
     WHERE id = p_booking_id AND agency_id = p_agency_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF v_booking.status IS DISTINCT FROM p_expected_status THEN
        RETURN jsonb_build_object('ok', false, 'code', 'transition_conflict', 'status', v_booking.status);
    END IF;

    IF p_action = 'approve' THEN
        v_status := 'APPROVED';
        UPDATE public.bookings
           SET status = v_status,
               agency_status = 'ACCEPTED',
               commission_status = 'CONFIRMED',
               agency_notes = NULLIF(btrim(coalesce(p_notes, '')), ''),
               confirmed_at = v_now,
               updated_at = v_now
         WHERE id = p_booking_id;

        INSERT INTO public.booking_events (booking_id, actor_id, actor_role, event_type, metadata)
        VALUES
            (p_booking_id, p_actor_id, coalesce(p_actor_role, 'AGENCY_OWNER'), 'AGENCY_ACCEPTED',
             jsonb_build_object('agencyNotes', p_notes)),
            (p_booking_id, NULL, 'SYSTEM', 'COMMISSION_CONFIRMED',
             jsonb_build_object('commission_amount', v_booking.commission_amount));

    ELSIF p_action = 'reject' THEN
        v_status := 'REJECTED';
        UPDATE public.bookings
           SET status = v_status,
               agency_status = 'REJECTED',
               commission_status = 'CANCELLED',
               rejection_reason = coalesce(NULLIF(btrim(coalesce(p_reason, '')), ''), 'Non disponible'),
               updated_at = v_now
         WHERE id = p_booking_id;

        INSERT INTO public.booking_events (booking_id, actor_id, actor_role, event_type, metadata)
        VALUES (p_booking_id, p_actor_id, coalesce(p_actor_role, 'AGENCY_OWNER'), 'AGENCY_REJECTED',
                jsonb_build_object('reason', p_reason));

    ELSE
        -- Alternative : même agence, publiée, non archivée, louable (contrôle repris dans la transaction)
        SELECT id, brand, model, published, archived_at, status INTO v_alt
          FROM public.vehicles
         WHERE id = p_alternative_vehicle_id AND agency_id = p_agency_id;
        IF NOT FOUND
           OR v_alt.published IS NOT TRUE
           OR v_alt.archived_at IS NOT NULL
           OR v_alt.status NOT IN ('AVAILABLE', 'RENTED')
           OR p_alternative_vehicle_id = v_booking.vehicle_id THEN
            RETURN jsonb_build_object('ok', false, 'code', 'alternative_ineligible');
        END IF;

        v_status := 'ALTERNATIVE_PROPOSED';
        UPDATE public.bookings
           SET status = v_status,
               agency_status = 'ALTERNATIVE_PROPOSED',
               agency_notes = coalesce(
                   NULLIF(btrim(coalesce(p_notes, '')), ''),
                   format('Véhicule alternatif proposé : %s %s', v_alt.brand, v_alt.model)
               ),
               updated_at = v_now
         WHERE id = p_booking_id;

        INSERT INTO public.booking_events (booking_id, actor_id, actor_role, event_type, metadata)
        VALUES (p_booking_id, p_actor_id, coalesce(p_actor_role, 'AGENCY_OWNER'), 'ALTERNATIVE_PROPOSED',
                jsonb_build_object(
                    'alternativeVehicleId', v_alt.id,
                    'alternativeVehicleName', v_alt.brand || ' ' || v_alt.model,
                    'notes', p_notes
                ));
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_decide_booking(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_decide_booking(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID)
    TO service_role;

-- 2. Décision sur un changement de formule ----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_decide_plan_change(
    p_request_id UUID,
    p_decision TEXT,
    p_admin_id UUID,
    p_payment_reference TEXT DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request public.subscription_change_requests%ROWTYPE;
    v_plan public.subscription_plans%ROWTYPE;
    v_count INTEGER;
BEGIN
    IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'PLAN_DECISION_INVALID' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_request
      FROM public.subscription_change_requests
     WHERE id = p_request_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF v_request.status <> 'PENDING_PAYMENT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'already_decided', 'status', v_request.status);
    END IF;

    IF p_decision = 'APPROVED' THEN
        SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_request.requested_plan_id;
        IF NOT FOUND OR v_plan.is_active IS NOT TRUE THEN
            RETURN jsonb_build_object('ok', false, 'code', 'plan_unavailable');
        END IF;

        -- Même verrou que enforce_vehicle_capacity() : aucun ajout de véhicule pendant le contrôle
        PERFORM pg_advisory_xact_lock(hashtextextended('vehicle_capacity:' || v_request.agency_id::TEXT, 0));
        SELECT count(*)::INTEGER INTO v_count
          FROM public.vehicles
         WHERE agency_id = v_request.agency_id AND archived_at IS NULL;
        IF v_plan.max_vehicles IS NOT NULL AND v_count > v_plan.max_vehicles THEN
            RETURN jsonb_build_object('ok', false, 'code', 'fleet_exceeds_plan',
                                      'vehicles', v_count, 'max_vehicles', v_plan.max_vehicles);
        END IF;

        -- Nouvelle formule = nouveau cycle ; une surcharge de capacité propre à l'ancienne formule est retirée
        INSERT INTO public.agency_subscriptions (
            agency_id, plan_id, status, price_paid, billing_cycle_start, billing_cycle_end,
            auto_renew, custom_vehicle_limit, updated_at
        ) VALUES (
            v_request.agency_id, v_plan.id, 'ACTIVE', v_plan.price_monthly, CURRENT_DATE,
            (CURRENT_DATE + INTERVAL '1 month')::DATE, true, NULL, now()
        )
        ON CONFLICT (agency_id) DO UPDATE
           SET plan_id = EXCLUDED.plan_id,
               status = 'ACTIVE',
               price_paid = EXCLUDED.price_paid,
               billing_cycle_start = EXCLUDED.billing_cycle_start,
               billing_cycle_end = EXCLUDED.billing_cycle_end,
               auto_renew = true,
               custom_vehicle_limit = NULL,
               updated_at = now();
    END IF;

    UPDATE public.subscription_change_requests
       SET status = p_decision,
           decided_by = p_admin_id,
           decided_at = now(),
           payment_reference = NULLIF(btrim(coalesce(p_payment_reference, '')), ''),
           decision_note = NULLIF(btrim(coalesce(p_note, '')), ''),
           updated_at = now()
     WHERE id = p_request_id;

    RETURN jsonb_build_object('ok', true, 'status', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_plan_change(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_plan_change(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;

-- 3. Règle de capacité précisée ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_vehicle_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
    v_max INTEGER;
    v_custom INTEGER;
    v_sub_status TEXT;
    v_slug TEXT;
BEGIN
    -- Un véhicule archivé n'occupe pas de place
    IF NEW.archived_at IS NOT NULL THEN
        RETURN NEW;
    END IF;
    -- Mise à jour : contrôle seulement si le véhicule change d'agence ou est désarchivé
    IF TG_OP = 'UPDATE'
       AND NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id
       AND NOT (OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL) THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('vehicle_capacity:' || NEW.agency_id::TEXT, 0));

    SELECT count(*)::INTEGER INTO v_count
      FROM public.vehicles
     WHERE agency_id = NEW.agency_id
       AND archived_at IS NULL
       AND id IS DISTINCT FROM NEW.id;

    SELECT p.max_vehicles, s.custom_vehicle_limit, s.status INTO v_max, v_custom, v_sub_status
      FROM public.agency_subscriptions s
      JOIN public.subscription_plans p ON p.id = s.plan_id
     WHERE s.agency_id = NEW.agency_id;

    IF FOUND AND v_sub_status IN ('ACTIVE', 'TRIAL', 'PAST_DUE') THEN
        v_max := coalesce(v_custom, v_max);
    ELSE
        -- Sans abonnement valide : palier déduit de la flotte
        v_slug := CASE
            WHEN v_count <= 15 THEN 'starter'
            WHEN v_count <= 25 THEN 'pro'
            WHEN v_count <= 35 THEN 'business'
            ELSE 'unlimited'
        END;
        SELECT p.max_vehicles INTO v_max
          FROM public.subscription_plans p
         WHERE p.slug = v_slug AND p.is_active;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'VEHICLE_CAPACITY_UNVERIFIABLE'
                USING ERRCODE = 'P0001',
                      HINT = 'Aucune formule active ne couvre cette agence.';
        END IF;
    END IF;

    IF v_max IS NOT NULL AND v_count >= v_max THEN
        RAISE EXCEPTION 'VEHICLE_CAPACITY_REACHED'
            USING ERRCODE = 'P0001',
                  DETAIL = format('%s/%s véhicules', v_count, v_max);
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_vehicle_capacity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_vehicle_capacity ON public.vehicles;
CREATE TRIGGER trg_enforce_vehicle_capacity
    BEFORE INSERT OR UPDATE OF agency_id, archived_at ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_vehicle_capacity();

NOTIFY pgrst, 'reload schema';

COMMIT;
