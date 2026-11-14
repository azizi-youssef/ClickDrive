-- ============================================================================
-- ClickDrive — Journal des messages WhatsApp (fiabilisation du webhook)
-- ============================================================================
--
-- Problèmes corrigés
--   - Meta renvoie un webhook tant qu'il n'a pas reçu 200 rapidement : un même message client était
--     traité plusieurs fois (plusieurs réponses automatiques).
--   - Les accusés de réception remplaçaient tout le metadata de l'entrée audit_logs (référence du dossier,
--     type de message perdus) et pouvaient faire reculer un statut (« read » puis « delivered »).
--   - Le journal des envois était gardé en mémoire, propre à chaque instance serveur.
--
-- Contenu
--   - whatsapp_messages : un enregistrement par message (sortant ou entrant), identifié par le wamid Meta
--     (UNIQUE : un message entrant déjà enregistré n'est pas retraité). Aucun texte de message n'est stocké.
--   - record_whatsapp_outbound() : enregistre un envoi sans jamais faire reculer un statut déjà reçu.
--   - record_whatsapp_status() : applique un accusé de réception dans l'ordre SENT < DELIVERED < READ < FAILED.
--   Accès réservé au serveur (service-role) : RLS activée sans politique, privilèges retirés aux rôles utilisateur.
--
-- Données personnelles : numéro de l'interlocuteur (pour la fenêtre de 24 h et le suivi) et référence du
-- dossier. Durée de conservation à définir (purge suggérée : DELETE ... WHERE created_at < now() - interval '13 months').
--
-- Rollback
--   DROP FUNCTION IF EXISTS public.record_whatsapp_status(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
--   DROP FUNCTION IF EXISTS public.record_whatsapp_outbound(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT);
--   DROP TABLE IF EXISTS public.whatsapp_messages;
--
-- Ordre de déploiement : appliquer AVANT le code qui l'utilise (sinon les envois restent possibles mais le
-- journal, le dédoublonnage et la fenêtre de 24 h sont indisponibles : l'application le journalise et continue).
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
      FROM unnest(ARRAY['public.bookings', 'public.agencies']) AS t
     WHERE to_regclass(t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261117000100 : tables absentes de cette base (%).', v_missing
            USING HINT = 'Vérifiez le projet Supabase sélectionné. Sur une base vide, appliquez d''abord backend/supabase/schema.sql, puis toutes les migrations dans l''ordre de leur nom de fichier.';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identifiant Meta ; NULL pour un envoi refusé avant d'atteindre Meta (plusieurs NULL possibles)
    wamid TEXT UNIQUE,
    direction TEXT NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
    status TEXT NOT NULL CHECK (status IN ('SENT', 'DELIVERED', 'READ', 'FAILED', 'SIMULATED', 'RECEIVED')),
    -- Interlocuteur, chiffres seulement (E.164 sans « + »)
    phone TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL CHECK (message_type IN ('TEXT', 'TEMPLATE', 'INBOUND')),
    template_name TEXT,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_ref TEXT,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    error TEXT CHECK (error IS NULL OR char_length(error) <= 500),
    -- Horodatage Meta du dernier statut (ou de la réception d'un message entrant)
    status_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_inbound_phone
    ON public.whatsapp_messages (phone, created_at DESC) WHERE direction = 'INBOUND';
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_booking ON public.whatsapp_messages (booking_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_messages TO service_role;

-- Rang d'un statut : un accusé de réception ne fait jamais reculer l'état d'un message
CREATE OR REPLACE FUNCTION public.whatsapp_status_rank(p_status TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE p_status
        WHEN 'SIMULATED' THEN 0
        WHEN 'SENT' THEN 1
        WHEN 'DELIVERED' THEN 2
        WHEN 'READ' THEN 3
        WHEN 'FAILED' THEN 4
        ELSE 0
    END;
$$;

CREATE OR REPLACE FUNCTION public.record_whatsapp_outbound(
    p_wamid TEXT,
    p_status TEXT,
    p_phone TEXT,
    p_message_type TEXT,
    p_template_name TEXT DEFAULT NULL,
    p_booking_id UUID DEFAULT NULL,
    p_booking_ref TEXT DEFAULT NULL,
    p_agency_id UUID DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.whatsapp_messages (
        wamid, direction, status, phone, message_type, template_name, booking_id, booking_ref, agency_id, error
    ) VALUES (
        NULLIF(p_wamid, ''), 'OUTBOUND', p_status, coalesce(p_phone, ''), p_message_type, p_template_name,
        p_booking_id, p_booking_ref, p_agency_id, left(p_error, 500)
    )
    ON CONFLICT (wamid) DO UPDATE
       SET message_type = EXCLUDED.message_type,
           template_name = coalesce(EXCLUDED.template_name, whatsapp_messages.template_name),
           booking_id = coalesce(EXCLUDED.booking_id, whatsapp_messages.booking_id),
           booking_ref = coalesce(EXCLUDED.booking_ref, whatsapp_messages.booking_ref),
           agency_id = coalesce(EXCLUDED.agency_id, whatsapp_messages.agency_id),
           phone = CASE WHEN whatsapp_messages.phone = '' THEN EXCLUDED.phone ELSE whatsapp_messages.phone END,
           -- Un accusé de réception arrivé avant l'enregistrement de l'envoi est conservé
           status = CASE
               WHEN public.whatsapp_status_rank(EXCLUDED.status) > public.whatsapp_status_rank(whatsapp_messages.status)
               THEN EXCLUDED.status ELSE whatsapp_messages.status
           END,
           updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_whatsapp_status(
    p_wamid TEXT,
    p_status TEXT,
    p_phone TEXT DEFAULT NULL,
    p_error TEXT DEFAULT NULL,
    p_status_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT;
BEGIN
    IF p_status NOT IN ('SENT', 'DELIVERED', 'READ', 'FAILED') OR coalesce(p_wamid, '') = '' THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.whatsapp_messages (wamid, direction, status, phone, message_type, error, status_at)
    VALUES (p_wamid, 'OUTBOUND', p_status, coalesce(p_phone, ''), 'TEXT', left(p_error, 500), coalesce(p_status_at, now()))
    ON CONFLICT (wamid) DO UPDATE
       SET status = EXCLUDED.status,
           error = coalesce(EXCLUDED.error, whatsapp_messages.error),
           status_at = EXCLUDED.status_at,
           updated_at = now()
     WHERE public.whatsapp_status_rank(EXCLUDED.status) > public.whatsapp_status_rank(whatsapp_messages.status);

    SELECT status INTO v_status FROM public.whatsapp_messages WHERE wamid = p_wamid;
    RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_status_rank(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_whatsapp_outbound(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_whatsapp_status(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_status_rank(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_outbound(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_status(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
