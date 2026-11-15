-- ============================================================================
-- ClickDrive — Relances sans blocage et expiration des demandes périmées
-- ============================================================================
--
-- 1. Sélection des relances (lib/bookings/follow-up-runner.ts). La tâche lisait les 25 demandes les
--    plus anciennes, y compris celles dont toutes les relances étaient déjà parties : dès 25 demandes
--    ainsi « épuisées », les plus récentes n'étaient plus jamais relancées (de même pour les demandes
--    d'avis, plafonnées à 25 par période de 30 jours). Les deux fonctions ci-dessous ne renvoient que
--    les réservations qui attendent encore une action ; le tri et la limite viennent APRÈS ce filtre.
--      pending_follow_up_candidates() : rappel à l'agence, puis alternatives au client ;
--      review_request_candidates()    : demande d'avis après la restitution.
--    Statuts, fenêtres (7 et 30 jours) et noms d'événements : mêmes valeurs que lib/bookings/follow-up.ts.
--    Les délais en minutes sont passés par l'application (une seule source).
--
-- 2. Adresse de substitution. Un client sans e-mail est enregistré avec « <chiffres du téléphone>@clickdrive.ma »
--    (customer_email est NOT NULL) : aucune boîte ne la lit. Les alternatives, envoyées par e-mail
--    seulement, ne sont pas proposées à ces clients ; la demande d'avis ne l'est que si l'application
--    indique qu'un canal WhatsApp existe (p_include_without_email). Même motif que
--    lib/bookings/customer-email.ts.
--
-- 3. expire_completed_bookings() : une demande jamais traitée (REQUESTED … ALTERNATIVE_PROPOSED) dont la
--    date de prise en charge est passée restait ouverte indéfiniment. Elle passe en EXPIRED, avec un
--    événement BOOKING_EXPIRED dans booking_events, dans la même instruction. Le reste de la fonction
--    est inchangé (locations terminées, réservations acceptées non commencées, statut des véhicules).
--
-- Fonctions de relance : service-role uniquement (lecture des données de tous les clients).
--
-- Rollback
--   DROP FUNCTION IF EXISTS public.pending_follow_up_candidates(INTEGER, INTEGER, INTEGER);
--   DROP FUNCTION IF EXISTS public.review_request_candidates(INTEGER, INTEGER, BOOLEAN);
--   puis réappliquer expire_completed_bookings() de 20261101000200. Sans les fonctions de relance,
--   l'application revient d'elle-même à l'ancienne lecture (avec un avertissement dans les journaux).
-- ============================================================================

BEGIN;

-- Prérequis : schéma des réservations présent sur CE projet (sinon échec immédiat, rien n'est créé)
DO $$
BEGIN
    IF to_regclass('public.bookings') IS NULL
       OR to_regclass('public.booking_events') IS NULL
       OR to_regclass('public.reviews') IS NULL THEN
        RAISE EXCEPTION 'Migration 20261121000100 : tables absentes (public.bookings, public.booking_events, public.reviews). Appliquez d''abord le schéma de base.';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Demandes en attente qui appellent encore une relance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pending_follow_up_candidates(
    p_limit INTEGER,
    p_reminder_after_minutes INTEGER,
    p_alternatives_after_minutes INTEGER
)
RETURNS TABLE (booking_id UUID)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT b.id
      FROM public.bookings b
     WHERE b.status IN ('REQUESTED', 'PENDING', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW')
       AND b.created_at >= now() - interval '7 days'
       AND b.created_at <= now() - make_interval(mins => GREATEST(p_reminder_after_minutes, 0))
       AND (
            -- Rappel à l'agence pas encore parti
            NOT EXISTS (
                SELECT 1 FROM public.booking_events e
                 WHERE e.booking_id = b.id AND e.event_type = 'AGENCY_REMINDER_SENT'
            )
            -- Rappel parti, alternatives dues et pas encore envoyées (client joignable par e-mail)
            OR (
                b.created_at <= now() - make_interval(mins => GREATEST(p_alternatives_after_minutes, 0))
                AND b.customer_email !~* '^[0-9]*@clickdrive\.ma$'
                AND NOT EXISTS (
                    SELECT 1 FROM public.booking_events e
                     WHERE e.booking_id = b.id AND e.event_type = 'CUSTOMER_ALTERNATIVES_SENT'
                )
            )
       )
     ORDER BY b.created_at ASC, b.id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.pending_follow_up_candidates(INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_follow_up_candidates(INTEGER, INTEGER, INTEGER) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Locations terminées à qui demander un avis
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_request_candidates(
    p_limit INTEGER,
    p_review_after_minutes INTEGER,
    p_include_without_email BOOLEAN
)
RETURNS TABLE (booking_id UUID)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT b.id
      FROM public.bookings b
     WHERE b.status = 'COMPLETED'
       AND COALESCE(b.completed_at, b.end_date::timestamptz) >= now() - interval '30 days'
       AND COALESCE(b.completed_at, b.end_date::timestamptz) <= now() - make_interval(mins => GREATEST(p_review_after_minutes, 0))
       AND (COALESCE(p_include_without_email, FALSE) OR b.customer_email !~* '^[0-9]*@clickdrive\.ma$')
       AND NOT EXISTS (
            SELECT 1 FROM public.booking_events e
             WHERE e.booking_id = b.id AND e.event_type = 'REVIEW_REQUESTED'
       )
       AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = b.id)
     ORDER BY COALESCE(b.completed_at, b.end_date::timestamptz) ASC, b.id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.review_request_candidates(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_request_candidates(INTEGER, INTEGER, BOOLEAN) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Expiration : demandes jamais traitées dont la date de prise en charge est passée
-- ----------------------------------------------------------------------------
-- Droits inchangés (CREATE OR REPLACE les conserve) : authenticated et service_role, pas anon.
CREATE OR REPLACE FUNCTION public.expire_completed_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
    v_requests INTEGER := 0;
BEGIN
    WITH changed AS (
        UPDATE public.bookings
           SET status = CASE
               WHEN status IN ('ACTIVE', 'RENTED') THEN 'COMPLETED'
               ELSE 'EXPIRED'
           END,
               updated_at = NOW()
         WHERE end_date < CURRENT_DATE
           AND status IN ('APPROVED', 'CONFIRMED', 'ACTIVE', 'RENTED', 'READY_FOR_PICKUP')
        RETURNING vehicle_id
    )
    SELECT count(*) INTO v_count FROM changed;

    -- Demande restée sans décision jusqu'à sa date de prise en charge : close et journalisée.
    -- SKIP LOCKED : une demande en cours de décision par l'agence (agency_decide_booking) est laissée à
    -- la décision ; elle sera reprise au passage suivant si elle est toujours ouverte.
    WITH stale AS (
        SELECT id, status
          FROM public.bookings
         WHERE start_date < CURRENT_DATE
           AND status IN ('REQUESTED', 'PENDING', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED')
           FOR UPDATE SKIP LOCKED
    ), expired AS (
        UPDATE public.bookings b
           SET status = 'EXPIRED',
               updated_at = NOW()
          FROM stale
         WHERE b.id = stale.id
        RETURNING b.id, stale.status AS previous_status
    ), logged AS (
        INSERT INTO public.booking_events (booking_id, actor_role, event_type, metadata)
        SELECT id, 'SYSTEM', 'BOOKING_EXPIRED',
               jsonb_build_object('previous_status', previous_status, 'reason', 'start_date_passed')
          FROM expired
        RETURNING 1
    )
    SELECT count(*) INTO v_requests FROM logged;

    -- Keep operational vehicle state aligned when no current or future booking remains.
    UPDATE public.vehicles v
       SET status = 'AVAILABLE'
     WHERE v.status IN ('RENTED', 'BLOCKED')
       AND NOT EXISTS (
           SELECT 1 FROM public.bookings b
            WHERE b.vehicle_id = v.id
              AND b.status IN ('APPROVED', 'CONFIRMED', 'ACTIVE', 'READY_FOR_PICKUP')
              AND b.end_date >= CURRENT_DATE
       );

    RETURN v_count + v_requests;
END;
$$;

-- Rattrapage des demandes déjà périmées
SELECT public.expire_completed_bookings();

COMMIT;
