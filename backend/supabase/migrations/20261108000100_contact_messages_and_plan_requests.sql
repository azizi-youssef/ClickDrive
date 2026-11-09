-- ========================================================================
-- ClickDrive : messages de contact et demandes de changement de formule
-- Migration : 20261108000100_contact_messages_and_plan_requests.sql
--
-- Additive et sans perte de données. Vérifiée par les tests en base
-- (frontend/src/tests/db/contact-and-plan-requests.spec.ts) sur une base vierge.
--
-- 1. contact_messages : le formulaire /contact enregistre enfin les messages
--    (il simulait l'envoi). Écriture uniquement par le serveur (service_role) après
--    validation et limitation de débit ; lecture et suivi par l'administration.
-- 2. subscription_change_requests : un changement de formule demandé par une agence
--    n'active plus la nouvelle formule sans paiement. La demande attend la validation
--    de l'administration, qui applique la formule une fois le règlement reçu.
-- ========================================================================

BEGIN;

-- 1. Messages du formulaire de contact -----------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE CHECK (reference ~ '^MSG-[0-9]{8}-[A-Z0-9]{6}$'),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
    email TEXT NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254),
    phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 30),
    category TEXT NOT NULL CHECK (category IN ('reservation', 'agency-partner', 'vehicle', 'technical', 'billing', 'other')),
    subject TEXT CHECK (subject IS NULL OR char_length(subject) <= 150),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 20 AND 5000),
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'CLOSED')),
    team_notified_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
    ON public.contact_messages (status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct sans session ; le formulaire public passe par l'API serveur
REVOKE ALL ON public.contact_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

DROP POLICY IF EXISTS "Platform support reads contact messages" ON public.contact_messages;
CREATE POLICY "Platform support reads contact messages"
    ON public.contact_messages FOR SELECT
    TO authenticated
    USING (public.has_platform_permission('customers.read'));

DROP POLICY IF EXISTS "Platform support updates contact messages" ON public.contact_messages;
CREATE POLICY "Platform support updates contact messages"
    ON public.contact_messages FOR UPDATE
    TO authenticated
    USING (public.has_platform_permission('customers.read'))
    WITH CHECK (public.has_platform_permission('customers.read'));

-- 2. Demandes de changement de formule -------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    current_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    requested_plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (status IN ('PENDING_PAYMENT', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    payment_reference TEXT CHECK (payment_reference IS NULL OR char_length(payment_reference) <= 120),
    decision_note TEXT CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_change_requests_distinct_plan CHECK (current_plan_id IS DISTINCT FROM requested_plan_id),
    CONSTRAINT subscription_change_requests_decision CHECK (
        (status = 'PENDING_PAYMENT' AND decided_at IS NULL) OR (status <> 'PENDING_PAYMENT' AND decided_at IS NOT NULL)
    )
);

-- Une seule demande en attente par agence
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_change_requests_pending
    ON public.subscription_change_requests (agency_id)
    WHERE status = 'PENDING_PAYMENT';

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_status_created
    ON public.subscription_change_requests (status, created_at DESC);

ALTER TABLE public.subscription_change_requests ENABLE ROW LEVEL SECURITY;

-- Écritures uniquement par le serveur, après contrôle des droits dans l'API
REVOKE ALL ON public.subscription_change_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_change_requests TO authenticated;
GRANT ALL ON public.subscription_change_requests TO service_role;

DROP POLICY IF EXISTS "Agencies read own plan change requests" ON public.subscription_change_requests;
CREATE POLICY "Agencies read own plan change requests"
    ON public.subscription_change_requests FOR SELECT
    TO authenticated
    USING (
        public.has_agency_permission(agency_id, 'agencies.read')
        OR public.has_platform_permission('agencies.read')
    );

NOTIFY pgrst, 'reload schema';

COMMIT;
