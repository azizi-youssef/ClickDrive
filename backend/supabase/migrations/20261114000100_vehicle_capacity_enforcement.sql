-- ============================================================================
-- ClickDrive — Capacité de flotte appliquée en base (Phase 1, remédiation sécurité)
-- ============================================================================
--
-- Objet
--   La limite de véhicules de la formule était vérifiée seulement par l'application
--   (subscriptionService.canAgencyAddVehicle), avant l'insertion :
--   - deux ajouts simultanés pouvaient compter le même nombre de véhicules et dépasser la limite ;
--   - un membre `vehicles.manage` pouvait insérer directement par PostgREST (politique RLS
--     « Authorized members manage agency vehicles ») sans aucun contrôle de capacité ;
--   - déplacer un véhicule vers une autre agence (UPDATE agency_id) n'était pas contrôlé.
--
--   Ce déclencheur rejoue la même règle que l'application, pour tous les rôles, de façon atomique :
--   - formule de l'abonnement de l'agence (agency_subscriptions → subscription_plans.max_vehicles) ;
--   - sans abonnement : palier déduit du nombre de véhicules (≤15 starter, ≤25 pro, ≤35 business,
--     sinon unlimited), parmi les formules actives — même règle que la migration 20261101000100 ;
--   - max_vehicles NULL = illimité ; aucune formule trouvée = refus (fail-closed) ;
--   - un verrou consultatif par agence (pg_advisory_xact_lock) sérialise les ajouts concurrents :
--     le second attend la fin de la transaction du premier, puis compte la flotte à jour.
--
--   Les erreurs portent un message stable lu par l'API :
--   VEHICLE_CAPACITY_REACHED (409) et VEHICLE_CAPACITY_UNVERIFIABLE (503).
--
-- Additive : aucune donnée existante n'est modifiée ; une agence déjà au-delà de sa limite garde
-- ses véhicules mais ne peut plus en ajouter.
--
-- Rollback
--   DROP TRIGGER IF EXISTS trg_enforce_vehicle_capacity ON public.vehicles;
--   DROP FUNCTION IF EXISTS public.enforce_vehicle_capacity();
--
-- Validation staging (avant production)
--   1. Appliquer après toutes les migrations précédentes (dépend de 20261026000100 et 20261101000100).
--   2. Vérifier : agence sans abonnement à 15 véhicules → 16e ajout refusé ; agence « pro » → 25 maximum.
--   3. Lancer deux créations simultanées à capacité − 1 : une seule doit aboutir.
--   4. Vérifier le seed : aucune agence de seed.sql ne dépasse 15 véhicules.
-- ============================================================================

-- Prérequis : schéma de base et migrations d'abonnement déjà appliqués sur CE projet.
-- Sans eux, échec immédiat avec un message clair (jamais une application partielle).
DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
      FROM unnest(ARRAY['public.vehicles', 'public.agencies', 'public.subscription_plans', 'public.agency_subscriptions']) AS t
     WHERE to_regclass(t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261114000100 : tables absentes de cette base (%).', v_missing
            USING HINT = 'Vérifiez le projet Supabase sélectionné. Sur une base vide, appliquez d''abord backend/supabase/schema.sql, puis toutes les migrations dans l''ordre de leur nom de fichier.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_vehicle_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
    v_max INTEGER;
    v_slug TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id THEN
        RETURN NEW;
    END IF;

    -- Un seul ajout à la fois par agence, jusqu'à la fin de la transaction
    PERFORM pg_advisory_xact_lock(hashtextextended('vehicle_capacity:' || NEW.agency_id::TEXT, 0));

    -- Flotte actuelle de l'agence cible (la ligne en cours d'insertion n'est pas encore visible)
    SELECT count(*)::INTEGER INTO v_count
      FROM public.vehicles
     WHERE agency_id = NEW.agency_id;

    SELECT p.max_vehicles INTO v_max
      FROM public.agency_subscriptions s
      JOIN public.subscription_plans p ON p.id = s.plan_id
     WHERE s.agency_id = NEW.agency_id;

    IF NOT FOUND THEN
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
    BEFORE INSERT OR UPDATE OF agency_id ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_vehicle_capacity();

NOTIFY pgrst, 'reload schema';
