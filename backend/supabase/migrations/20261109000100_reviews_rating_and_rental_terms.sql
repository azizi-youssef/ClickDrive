-- ========================================================================
-- ClickDrive : avis vérifiés et conditions de location affichées « tout compris »
-- Migration : 20261109000100_reviews_rating_and_rental_terms.sql
--
-- Additive. Vérifiée par frontend/src/tests/db/reviews-and-terms.spec.ts sur une base vierge.
--
-- 1. Note des agences : calculée à partir des avis réels (déclencheur sur reviews).
--    La valeur par défaut 4,90 affichait une note sans aucun avis : remise à 0 et recalcul.
-- 2. Informations pratiques de l'agence : horaires, langues parlées, politique d'annulation,
--    frais de livraison à l'aéroport et au port (affichés sur la fiche et dans le total estimé).
-- 3. Assurance de chaque véhicule : type de couverture et franchise, affichés sur la fiche.
-- ========================================================================

BEGIN;

-- 1. Note des agences calculée à partir des avis --------------------------------
CREATE OR REPLACE FUNCTION public.refresh_agency_rating(p_agency_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.agencies AS a
    SET review_count = stats.review_count,
        rating = stats.rating
    FROM (
        SELECT count(*)::INTEGER AS review_count,
               COALESCE(round(avg(r.rating)::NUMERIC, 2), 0) AS rating
        FROM public.reviews AS r
        WHERE r.agency_id = p_agency_id
    ) AS stats
    WHERE a.id = p_agency_id;
$$;

CREATE OR REPLACE FUNCTION public.reviews_refresh_agency_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.refresh_agency_rating(NEW.agency_id);
    END IF;
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.agency_id IS DISTINCT FROM NEW.agency_id) THEN
        PERFORM public.refresh_agency_rating(OLD.agency_id);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_agency_rating ON public.reviews;
CREATE TRIGGER trg_reviews_refresh_agency_rating
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.reviews_refresh_agency_rating();

REVOKE EXECUTE ON FUNCTION public.refresh_agency_rating(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_refresh_agency_rating() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.agencies ALTER COLUMN rating SET DEFAULT 0;
ALTER TABLE public.agencies ALTER COLUMN review_count SET DEFAULT 0;

-- Recalcul de toutes les agences (une agence sans avis repasse à 0)
UPDATE public.agencies AS a
SET review_count = COALESCE(stats.review_count, 0),
    rating = COALESCE(stats.rating, 0)
FROM public.agencies AS base
LEFT JOIN (
    SELECT agency_id, count(*)::INTEGER AS review_count, round(avg(rating)::NUMERIC, 2) AS rating
    FROM public.reviews
    GROUP BY agency_id
) AS stats ON stats.agency_id = base.id
WHERE a.id = base.id;

-- 2. Informations pratiques et conditions de l'agence ------------------------------
ALTER TABLE public.agencies
    ADD COLUMN IF NOT EXISTS opening_hours TEXT
        CHECK (opening_hours IS NULL OR char_length(opening_hours) <= 300),
    ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}'
        CHECK (cardinality(languages) <= 8),
    ADD COLUMN IF NOT EXISTS cancellation_policy TEXT
        CHECK (cancellation_policy IS NULL OR char_length(cancellation_policy) <= 600),
    ADD COLUMN IF NOT EXISTS delivery_fee_airport NUMERIC(10, 2)
        CHECK (delivery_fee_airport IS NULL OR delivery_fee_airport >= 0),
    ADD COLUMN IF NOT EXISTS delivery_fee_port NUMERIC(10, 2)
        CHECK (delivery_fee_port IS NULL OR delivery_fee_port >= 0);

-- 3. Assurance de chaque véhicule ----------------------------------------------------
ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS insurance_coverage TEXT
        CHECK (insurance_coverage IS NULL OR insurance_coverage IN ('THIRD_PARTY', 'COMPREHENSIVE')),
    ADD COLUMN IF NOT EXISTS insurance_excess NUMERIC(10, 2)
        CHECK (insurance_excess IS NULL OR insurance_excess >= 0);

NOTIFY pgrst, 'reload schema';

COMMIT;
