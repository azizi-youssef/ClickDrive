-- ========================================================================
-- ClickDrive : langue du client sur la demande de réservation
-- Migration : 20261111000100_customer_locale.sql
--
-- Additive. Le site est traduit (fr, ar, en, de, es, nl) : la langue dans laquelle le client a
-- envoyé sa demande sert aux e-mails et messages de suivi qui lui sont adressés. NULL = français
-- (demandes antérieures). Le code applicatif n'écrit la colonne que pour une langue autre que le
-- français et sait se passer d'elle tant que la migration n'est pas appliquée.
-- ========================================================================

BEGIN;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS customer_locale TEXT
        CHECK (customer_locale IS NULL OR customer_locale IN ('fr', 'ar', 'en', 'de', 'es', 'nl'));

NOTIFY pgrst, 'reload schema';

COMMIT;
