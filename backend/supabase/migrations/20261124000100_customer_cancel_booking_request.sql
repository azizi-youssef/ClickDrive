-- ============================================================================
-- Annulation d'une demande par le client (lien de suivi signé, sans compte)
-- ============================================================================
-- Le client qui change d'avis retire lui-même sa demande tant que l'agence ne l'a pas acceptée :
-- l'agence n'a plus à la traiter et le véhicule n'est pas retenu pour rien. Une réservation acceptée
-- relève du contrat de l'agence : le client la contacte (aucune annulation ici).
--
-- customer_cancel_booking_request(référence, motif) :
--   - réservée au serveur (service_role) : la route vérifie d'abord le lien signé du client ;
--   - verrou de la réservation : une décision de l'agence au même moment passe avant ou après, jamais
--     les deux (l'agence qui accepte d'abord rend l'annulation impossible) ;
--   - statut CANCELLED, commission annulée et événement CUSTOMER_CANCELLED journalisés ensemble ;
--   - motif facultatif, pris dans une liste fermée (aucun texte libre stocké).
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
      FROM unnest(ARRAY['public.bookings', 'public.booking_events']) AS t
     WHERE to_regclass(t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261124000100 : tables absentes de cette base (%).', v_missing
            USING HINT = 'Vérifiez le projet Supabase sélectionné. Sur une base vide, appliquez d''abord backend/supabase/schema.sql, puis toutes les migrations dans l''ordre de leur nom de fichier.';
    END IF;

    SELECT string_agg(c, ', ') INTO v_missing
      FROM unnest(ARRAY['reference', 'booking_ref', 'status', 'commission_status', 'updated_at']) AS c
     WHERE NOT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = c
     );
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261124000100 : colonnes absentes de public.bookings (%).', v_missing
            USING HINT = 'Appliquez d''abord les migrations précédentes, dans l''ordre de leur nom de fichier.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_cancel_booking_request(
    p_reference TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reference TEXT := upper(btrim(coalesce(p_reference, '')));
    v_booking public.bookings%ROWTYPE;
BEGIN
    IF v_reference = '' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF p_reason IS NOT NULL AND p_reason NOT IN ('plans_changed', 'found_elsewhere', 'dates_changed', 'other') THEN
        RAISE EXCEPTION 'CUSTOMER_CANCEL_INVALID_REASON' USING ERRCODE = '22023';
    END IF;

    -- Verrou : une décision de l'agence en cours est attendue, puis le statut relu
    SELECT * INTO v_booking
      FROM public.bookings
     WHERE upper(reference) = v_reference OR upper(booking_ref) = v_reference
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;

    IF v_booking.status NOT IN ('PENDING', 'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_cancellable', 'status', v_booking.status);
    END IF;

    UPDATE public.bookings
       SET status = 'CANCELLED',
           commission_status = 'CANCELLED',
           updated_at = now()
     WHERE id = v_booking.id;

    INSERT INTO public.booking_events (booking_id, actor_id, actor_role, event_type, metadata)
    VALUES (v_booking.id, NULL, 'CUSTOMER', 'CUSTOMER_CANCELLED',
            jsonb_build_object('previous_status', v_booking.status, 'reason', p_reason, 'channel', 'tracking_link'));

    RETURN jsonb_build_object('ok', true, 'status', 'CANCELLED', 'previous_status', v_booking.status);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_cancel_booking_request(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_cancel_booking_request(TEXT, TEXT) TO service_role;

COMMIT;
