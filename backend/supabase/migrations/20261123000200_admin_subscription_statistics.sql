-- ============================================================================
-- ClickDrive — Statistiques d'abonnement de la plateforme calculées en base
-- ============================================================================
--
-- admin_subscription_statistics() remplace le calcul fait par subscriptionService.getSubscriptionStats(),
-- qui chargeait toutes les agences, tous les abonnements et tous les véhicules (lecture paginée) dans
-- le serveur pour en tirer quatre nombres et une répartition. Mêmes règles qu'avant :
--   totalAgencies         agences non archivées (tous statuts) ;
--   fleetCapacityTotal    véhicules non archivés de ces agences ;
--   monthlyRecurringRevenue / activeSubscribers
--                         abonnements ACTIVE ou TRIAL, à une formule existante, d'une agence ACTIVE non
--                         archivée, au prix payé (sinon au prix de la formule) — une formule déduite de
--                         la flotte n'est jamais un revenu (même règle qu'analytics_subscription_report) ;
--   plansDistribution     toutes les formules actives (ordre d'affichage), plus une formule retirée de la
--                         grille qui a encore des abonnés facturés.
-- Droit : agencies.read plateforme (comme la route /api/admin/subscriptions), donc SUPER_ADMIN seul.
--
-- Additive : aucune donnée n'est modifiée.
--
-- Rollback
--   DROP FUNCTION IF EXISTS public.admin_subscription_statistics();
--   et revenir au calcul applicatif de getSubscriptionStats() (code précédent).
--
-- Validation staging
--   /admin : la carte « Revenu récurrent » affiche le même MRR que /admin/analytics ;
--   un compte agence reçoit une erreur de droit en appelant la fonction.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_missing TEXT;
BEGIN
    IF to_regclass('public.agency_subscriptions') IS NULL
       OR to_regclass('public.subscription_plans') IS NULL
       OR to_regclass('public.agencies') IS NULL
       OR to_regclass('public.vehicles') IS NULL THEN
        RAISE EXCEPTION 'Migration 20261123000200 : tables absentes (agencies, vehicles, subscription_plans, agency_subscriptions). Appliquez d''abord le schéma de base.';
    END IF;

    -- Colonnes apportées par des migrations antérieures (une migration sautée est nommée ici)
    SELECT string_agg(format('public.%s.%s (%s)', r.tbl, r.col, r.migration), ', ' ORDER BY r.migration, r.tbl, r.col)
      INTO v_missing
      FROM (VALUES
          ('agencies', 'archived_at', '20261010000100_agency_access_control.sql'),
          ('vehicles', 'archived_at', '20261012000400_agency_fleet_and_availability.sql'),
          ('agency_subscriptions', 'price_paid', '20261026000100_agency_subscription_monetization.sql'),
          ('subscription_plans', 'is_active', '20261026000100_agency_subscription_monetization.sql'),
          ('subscription_plans', 'sort_order', '20261026000100_agency_subscription_monetization.sql')
      ) AS r(tbl, col, migration)
     WHERE NOT EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = to_regclass('public.' || r.tbl)
            AND a.attname = r.col
            AND a.attnum > 0
            AND NOT a.attisdropped
     );
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261123000200 : colonnes absentes de cette base : %.', v_missing
            USING HINT = 'Appliquez d''abord les migrations indiquées entre parenthèses, dans l''ordre de leur nom, puis relancez celle-ci. Rien n''a été appliqué.';
    END IF;

    IF to_regprocedure('public.has_platform_permission(text)') IS NULL THEN
        RAISE EXCEPTION 'Migration 20261123000200 : fonction de droits has_platform_permission absente.'
            USING HINT = 'Appliquez d''abord 20261010000100_agency_access_control.sql. Rien n''a été appliqué.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_subscription_statistics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT public.has_platform_permission('agencies.read') THEN
        RAISE EXCEPTION 'Not authorized to read subscription statistics' USING ERRCODE = '42501';
    END IF;

    WITH billed AS (
        SELECT s.plan_id, COALESCE(NULLIF(s.price_paid, 0), p.price_monthly, 0) AS revenue
          FROM public.agency_subscriptions s
          JOIN public.agencies a ON a.id = s.agency_id
          JOIN public.subscription_plans p ON p.id = s.plan_id
         WHERE a.status = 'ACTIVE'
           AND a.archived_at IS NULL
           AND s.status IN ('ACTIVE', 'TRIAL')
    ), per_plan AS (
        SELECT p.slug,
               p.name,
               p.is_active,
               p.sort_order,
               count(b.plan_id) AS subscribers,
               COALESCE(sum(b.revenue), 0) AS revenue
          FROM public.subscription_plans p
          LEFT JOIN billed b ON b.plan_id = p.id
         GROUP BY p.id, p.slug, p.name, p.is_active, p.sort_order
        HAVING p.is_active OR count(b.plan_id) > 0
    )
    SELECT jsonb_build_object(
        'monthlyRecurringRevenue', (SELECT COALESCE(sum(revenue), 0) FROM billed),
        'activeSubscribers', (SELECT count(*) FROM billed),
        'totalAgencies', (SELECT count(*) FROM public.agencies WHERE archived_at IS NULL),
        'fleetCapacityTotal', (
            SELECT count(*)
              FROM public.vehicles v
              JOIN public.agencies a ON a.id = v.agency_id
             WHERE v.archived_at IS NULL AND a.archived_at IS NULL
        ),
        'plansDistribution', COALESCE((
            SELECT jsonb_agg(
                       jsonb_build_object('slug', slug, 'planName', name, 'count', subscribers, 'revenue', revenue)
                       ORDER BY NOT is_active, sort_order, name
                   )
              FROM per_plan
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_subscription_statistics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_subscription_statistics() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
