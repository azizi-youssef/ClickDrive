-- ============================================================================
-- ClickDrive — Phase 2 de remédiation sécurité : privilèges des véhicules et politiques plateforme
-- ============================================================================
--
-- 1. Colonnes privées des véhicules
--    La politique RLS « Published vehicles or authorized agency reads » exposait TOUTES les colonnes des
--    véhicules publiés aux rôles anon et authenticated. La clé anon étant publique, n'importe qui lisait la
--    plaque, le numéro d'unité interne et les documents par PostgREST, sans passer par l'application.
--    → SELECT de table retiré ; SELECT accordé colonne par colonne, sauf license_plate, unit_number et
--      documents (même liste que PRIVATE_VEHICLE_FIELDS côté application). Les lignes visibles restent
--      celles de la RLS. Les routes serveur lisent ces colonnes avec la clé service-role, après contrôle
--      de la permission de l'agence.
--    → Toute nouvelle colonne publique de vehicles devra être accordée explicitement :
--        GRANT SELECT (nouvelle_colonne) ON public.vehicles TO anon, authenticated;
--
-- 2. Écritures directes sur la flotte
--    Un membre vehicles.manage pouvait écrire directement par PostgREST (politique « Authorized members
--    manage agency vehicles ») : featured, plaque, agency_id… sans les validations de l'API.
--    → INSERT / UPDATE / DELETE retirés à anon et authenticated : toutes les écritures passent par
--      /api/agencies/[id]/vehicles (Zod, vehicles.manage, champs protégés, capacité). La politique
--      d'écriture devient inerte ; elle est conservée pour mémoire.
--
-- 3. Photos et équipements
--    vehicle_images et vehicle_features avaient la RLS activée sans aucune politique de lecture : seuls
--    les clients service-role les lisaient.
--    → Lecture accordée exactement quand le véhicule est lisible (la sous-requête sur vehicles applique la
--      RLS de vehicles pour le rôle courant) : véhicules publiés d'agences actives, ou véhicules de son
--      agence avec vehicles.read. Aucune écriture directe.
--
-- 4. Rôle historique ADMIN
--    Des politiques accordaient encore des droits à profiles.role = 'ADMIN' (formules, abonnements,
--    états des lieux), contrairement à ACCESS_CONTROL.md (seul SUPER_ADMIN a des droits globaux).
--    → Réécrites avec is_super_admin(), is_agency_member() (membre ACTIF) et has_agency_permission().
--
-- Ordre de déploiement (important)
--    Déployer D'ABORD le code applicatif de la phase 2 (lectures de session en colonnes explicites),
--    PUIS appliquer cette migration. Appliquée avant, l'ancien code (embeds `vehicles(*)` avec la session)
--    échouerait sur les pages réservation.
--
-- Rollback
--    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicles TO anon, authenticated;
--    DROP POLICY IF EXISTS "Images of readable vehicles" ON public.vehicle_images;
--    DROP POLICY IF EXISTS "Features of readable vehicles" ON public.vehicle_features;
--    (politiques ADMIN : recréer depuis 20261026000100 et 20261012000400 — déconseillé)
--
-- Validation staging
--    1. Avec la clé anon : GET /rest/v1/vehicles?select=license_plate → 401/403 ; select=id,brand → OK.
--    2. Catalogue, fiche véhicule, espace client (réservations) et espace agence : affichage inchangé.
--    3. Realtime sur vehicles : vérifier que les abonnements se rafraîchissent (le polling prend le relais sinon).
--    4. npm run test:db.
-- ============================================================================

BEGIN;

-- Prérequis : schéma de base et migrations précédentes déjà appliqués sur CE projet.
DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
      FROM unnest(ARRAY[
          'public.vehicles', 'public.vehicle_images', 'public.vehicle_features',
          'public.subscription_plans', 'public.agency_subscriptions', 'public.booking_inspections'
      ]) AS t
     WHERE to_regclass(t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261115000100 : tables absentes de cette base (%).', v_missing
            USING HINT = 'Vérifiez le projet Supabase sélectionné. Sur une base vide, appliquez d''abord backend/supabase/schema.sql, puis toutes les migrations dans l''ordre de leur nom de fichier.';
    END IF;
END;
$$;

-- 1. Colonnes privées -----------------------------------------------------------
REVOKE SELECT ON TABLE public.vehicles FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    v_columns TEXT;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_columns
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'vehicles'
       AND column_name NOT IN ('license_plate', 'unit_number', 'documents');

    EXECUTE format('GRANT SELECT (%s) ON TABLE public.vehicles TO anon, authenticated', v_columns);
END;
$$;

-- 2. Écritures directes ---------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.vehicles FROM PUBLIC, anon, authenticated;

-- 3. Photos et équipements ------------------------------------------------------
DROP POLICY IF EXISTS "Images of readable vehicles" ON public.vehicle_images;
CREATE POLICY "Images of readable vehicles"
    ON public.vehicle_images FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_images.vehicle_id));

DROP POLICY IF EXISTS "Features of readable vehicles" ON public.vehicle_features;
CREATE POLICY "Features of readable vehicles"
    ON public.vehicle_features FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_features.vehicle_id));

GRANT SELECT ON TABLE public.vehicle_images, public.vehicle_features TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.vehicle_images, public.vehicle_features
    FROM PUBLIC, anon, authenticated;

-- 4. Rôle historique ADMIN ------------------------------------------------------
-- Formules : lecture publique des formules actives inchangée ; gestion réservée à SUPER_ADMIN
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Super admins manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Super admins manage subscription plans"
    ON public.subscription_plans FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Abonnements : membres ACTIFS de l'agence en lecture, SUPER_ADMIN en gestion
DROP POLICY IF EXISTS "Agencies can view own subscription" ON public.agency_subscriptions;
DROP POLICY IF EXISTS "Agency members read own subscription" ON public.agency_subscriptions;
CREATE POLICY "Agency members read own subscription"
    ON public.agency_subscriptions FOR SELECT
    TO authenticated
    USING (public.is_agency_member(agency_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Admins can manage agency subscriptions" ON public.agency_subscriptions;
DROP POLICY IF EXISTS "Super admins manage agency subscriptions" ON public.agency_subscriptions;
CREATE POLICY "Super admins manage agency subscriptions"
    ON public.agency_subscriptions FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- États des lieux : mêmes permissions que les réservations de l'agence (SUPER_ADMIN inclus)
DROP POLICY IF EXISTS "Agency members read inspections" ON public.booking_inspections;
DROP POLICY IF EXISTS "Authorized members read inspections" ON public.booking_inspections;
CREATE POLICY "Authorized members read inspections"
    ON public.booking_inspections FOR SELECT
    TO authenticated
    USING (public.has_agency_permission(agency_id, 'bookings.read'));

DROP POLICY IF EXISTS "Agency members manage inspections" ON public.booking_inspections;
DROP POLICY IF EXISTS "Authorized members manage inspections" ON public.booking_inspections;
CREATE POLICY "Authorized members manage inspections"
    ON public.booking_inspections FOR ALL
    TO authenticated
    USING (public.has_agency_permission(agency_id, 'bookings.manage'))
    WITH CHECK (public.has_agency_permission(agency_id, 'bookings.manage'));

NOTIFY pgrst, 'reload schema';

COMMIT;
