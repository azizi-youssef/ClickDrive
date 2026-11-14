-- ============================================================================
-- ClickDrive — Remises longue durée des agences
-- ============================================================================
--
-- Chaque agence peut définir jusqu'à 4 paliers de remise selon la durée de location, appliqués à
-- tous ses véhicules (ex. −5 % dès 3 jours, −10 % dès 7 jours). Le prix est calculé côté serveur
-- (calculateRentalPrice) : le client paie le meilleur prix entre ces paliers et les tarifs
-- semaine / mois du véhicule, sans cumul.
--
-- Format : tableau JSON [{ "min_days": 7, "percent": 10 }, …]
--   - min_days : entier de 2 à 90 jours
--   - percent  : entier de 1 à 50 %
-- Ordre, unicité des seuils et progression des remises sont vérifiés par l'API (settingsUpdateSchema).
-- ============================================================================

BEGIN;

-- Prérequis : table des agences présente sur CE projet (sinon échec immédiat, sans rien créer)
DO $$
BEGIN
    IF to_regclass('public.agencies') IS NULL THEN
        RAISE EXCEPTION 'Migration 20261118000100 : tables absentes de cette base (public.agencies).'
            USING HINT = 'Appliquez d''abord schema.sql et les migrations précédentes sur ce projet.';
    END IF;
END
$$;

ALTER TABLE public.agencies
    ADD COLUMN IF NOT EXISTS duration_discounts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_duration_discounts_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_duration_discounts_check CHECK (
    jsonb_typeof(duration_discounts) = 'array'
    AND jsonb_array_length(duration_discounts) <= 4
    AND NOT jsonb_path_exists(
        duration_discounts,
        '$[*] ? (@.type() != "object"
                 || !(exists(@.min_days)) || !(exists(@.percent))
                 || @.min_days.type() != "number" || @.percent.type() != "number"
                 || @.min_days.floor() != @.min_days || @.percent.floor() != @.percent
                 || @.min_days < 2 || @.min_days > 90
                 || @.percent < 1 || @.percent > 50)'
    )
);

COMMENT ON COLUMN public.agencies.duration_discounts IS
    'Paliers de remise selon la durée de location, pour toute la flotte : [{"min_days": 7, "percent": 10}] (4 au plus).';

NOTIFY pgrst, 'reload schema';

COMMIT;
