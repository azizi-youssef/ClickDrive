-- ============================================================================
-- ClickDrive — Remises longue durée distinctes pour les motos
-- ============================================================================
--
-- Jusqu'ici les paliers de remise de l'agence (agencies.duration_discounts) s'appliquaient à toute la
-- flotte. Une agence qui loue des voitures et des motos peut vouloir des remises différentes : les
-- paliers existants restent ceux des VOITURES (colonne inchangée) et une seconde liste, indépendante,
-- est réservée aux MOTOS.
--
--   agencies.duration_discounts            : paliers des voitures
--   agencies.motorcycle_duration_discounts : paliers des motos
--
-- Même format et mêmes bornes pour les deux : [{ "min_days": 7, "percent": 10 }, …], 4 paliers au plus,
-- durée de 2 à 90 jours, remise de 1 à 50 %. Le type d'un véhicule est donné par vehicles.vehicle_type
-- (à défaut, sa catégorie) ; le prix est calculé côté serveur (calculateRentalPrice).
--
-- Aucun prix ne change au déploiement : à la création de la colonne, les paliers actuels de chaque
-- agence sont recopiés pour les motos (elles en bénéficiaient déjà). La recopie n'a lieu qu'une fois :
-- rejouer le fichier ne touche jamais aux réglages ensuite saisis par les agences.
-- ============================================================================

BEGIN;

-- Prérequis : paliers de la migration 20261118000100 présents sur CE projet (sinon échec immédiat)
DO $$
BEGIN
    IF to_regclass('public.agencies') IS NULL
       OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'agencies' AND column_name = 'duration_discounts'
       ) THEN
        RAISE EXCEPTION 'Migration 20261120000100 : colonne public.agencies.duration_discounts absente de cette base.'
            USING HINT = 'Appliquez d''abord la migration 20261118000100_agency_duration_discounts.sql.';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agencies' AND column_name = 'motorcycle_duration_discounts'
    ) THEN
        ALTER TABLE public.agencies
            ADD COLUMN motorcycle_duration_discounts JSONB NOT NULL DEFAULT '[]'::jsonb;

        -- Les motos bénéficiaient déjà des paliers existants : on les reprend à l'identique
        UPDATE public.agencies
        SET motorcycle_duration_discounts = duration_discounts
        WHERE duration_discounts <> '[]'::jsonb;
    END IF;
END
$$;

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_motorcycle_duration_discounts_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_motorcycle_duration_discounts_check CHECK (
    jsonb_typeof(motorcycle_duration_discounts) = 'array'
    AND jsonb_array_length(motorcycle_duration_discounts) <= 4
    AND NOT jsonb_path_exists(
        motorcycle_duration_discounts,
        '$[*] ? (@.type() != "object"
                 || !(exists(@.min_days)) || !(exists(@.percent))
                 || @.min_days.type() != "number" || @.percent.type() != "number"
                 || @.min_days.floor() != @.min_days || @.percent.floor() != @.percent
                 || @.min_days < 2 || @.min_days > 90
                 || @.percent < 1 || @.percent > 50)'
    )
);

COMMENT ON COLUMN public.agencies.duration_discounts IS
    'Paliers de remise selon la durée de location, pour les VOITURES : [{"min_days": 7, "percent": 10}] (4 au plus).';
COMMENT ON COLUMN public.agencies.motorcycle_duration_discounts IS
    'Paliers de remise selon la durée de location, pour les MOTOS (indépendants de ceux des voitures) : [{"min_days": 7, "percent": 10}] (4 au plus).';

NOTIFY pgrst, 'reload schema';

COMMIT;
