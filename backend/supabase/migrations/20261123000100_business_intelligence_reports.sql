-- ============================================================================
-- ClickDrive — Analytics & Business Intelligence (espaces Super-Admin et agence)
-- ============================================================================
--
-- Tous les agrégats des écrans « Statistiques » sont calculés ici : aucune table n'est ramenée au
-- serveur ni au navigateur. Jours comptés à l'heure du Maroc (Africa/Casablanca).
--
-- 1. analytics_booking_facts()      : une ligne par demande reçue sur la période (statut, étapes
--                                     franchies, délai de première réponse de l'agence). Interne.
-- 2. analytics_period_totals()      : entonnoir demande → acceptation → remise → restitution, refus,
--                                     expirations, non-retraits, chiffre d'affaires confirmé, délai de
--                                     réponse (médiane, 90e centile), délai d'anticipation. Interne.
-- 3. analytics_breakdowns()         : voitures / motos, catégories, points de prise en charge, pays et
--                                     langues des clients. Interne.
-- 4. analytics_monthly_series()     : 12 mois glissants et mêmes mois de l'année précédente. Interne.
-- 5. analytics_fleet_usage/summary(): taux d'occupation (nuits réservées / jours de présence en flotte)
--                                     et revenu par véhicule, au prorata des nuits de la période. Interne.
-- 6. Journal du revenu récurrent (MRR) : subscription_mrr_events, alimenté par déclencheurs sur
--    agency_subscriptions, agencies (statut, archivage) et subscription_plans (prix). Chaque ligne
--    porte la contribution précédente et la nouvelle : nouveaux abonnements, hausses, baisses et
--    résiliations se lisent sans reconstitution. Contribution d'une agence = abonnement ACTIVE ou
--    TRIAL d'une agence ACTIVE non archivée, au prix payé (sinon au prix de la formule), comme
--    subscriptionService.getSubscriptionStats(). Historique antérieur à cette migration : chaque
--    abonnement facturé compte à sa date de création, à son prix actuel (aucune autre trace).
-- 7. agency_analytics_report(agence, du, au) : reports.read sur l'agence (authenticated).
--    admin_analytics_report(du, au)          : reports.read plateforme, donc SUPER_ADMIN seul.
--    Période par défaut : 30 derniers jours ; période précédente de même durée, juste avant ;
--    au plus 1 096 jours.
--
-- Définitions (communes aux deux espaces)
--   demande reçue   : réservation créée sur la période ;
--   acceptée        : événement AGENCY_ACCEPTED, confirmed_at renseigné ou statut confirmé ;
--   remise          : statut ACTIVE / COMPLETED, pickup_actual_at ou HANDOVER_PICKUP_COMPLETED ;
--   restituée       : COMPLETED ;
--   expirée sans réponse : EXPIRED sans acceptation ; non retirée : EXPIRED après acceptation ;
--   confirmée (chiffre d'affaires) : APPROVED, CONFIRMED, READY_FOR_PICKUP, ACTIVE, RENTED, COMPLETED ;
--   délai de réponse : création → premier AGENCY_ACCEPTED / AGENCY_REJECTED / ALTERNATIVE_PROPOSED.
--
-- Additive : aucune donnée existante n'est modifiée (le journal MRR est seulement amorcé).
--
-- Rollback
--   DROP FUNCTION IF EXISTS public.admin_analytics_report(DATE, DATE);
--   DROP FUNCTION IF EXISTS public.agency_analytics_report(UUID, DATE, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_subscription_report(DATE);
--   DROP FUNCTION IF EXISTS public.analytics_agency_ranking(DATE, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_fleet_summary(UUID, DATE, DATE, BOOLEAN);
--   DROP FUNCTION IF EXISTS public.analytics_fleet_usage(UUID, DATE, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_monthly_series(UUID, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_breakdowns(UUID, DATE, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_period_totals(UUID, DATE, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_booking_facts(UUID, DATE, DATE);
--   DROP FUNCTION IF EXISTS public.analytics_resolve_period(DATE, DATE);
--   DROP TRIGGER IF EXISTS trg_agency_subscriptions_mrr ON public.agency_subscriptions;
--   DROP TRIGGER IF EXISTS trg_agencies_mrr ON public.agencies;
--   DROP TRIGGER IF EXISTS trg_subscription_plans_mrr ON public.subscription_plans;
--   DROP FUNCTION IF EXISTS public.trg_subscription_mrr_from_subscription();
--   DROP FUNCTION IF EXISTS public.trg_subscription_mrr_from_agency();
--   DROP FUNCTION IF EXISTS public.trg_subscription_mrr_from_plan();
--   DROP FUNCTION IF EXISTS public.log_subscription_mrr(UUID, TEXT);
--   DROP TABLE IF EXISTS public.subscription_mrr_events;
--   DROP INDEX IF EXISTS public.idx_bookings_agency_created, public.idx_bookings_created;
--   Les écrans Statistiques exigent ces fonctions : revenir aussi au code précédent.
--
-- Validation staging
--   /admin/analytics et la section « Statistiques » de l'espace agence sur 30 jours, 90 jours et
--   12 mois ; changer la formule d'une agence puis vérifier la ligne du mois dans « Mouvements MRR » ;
--   un gérant sans reports.read reçoit 403 ; un compte agence n'obtient pas admin_analytics_report.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
      FROM unnest(ARRAY[
          'public.bookings', 'public.booking_events', 'public.vehicles', 'public.agencies',
          'public.subscription_plans', 'public.agency_subscriptions'
      ]) AS t
     WHERE to_regclass(t) IS NULL;
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261123000100 : tables absentes de cette base (%).', v_missing
            USING HINT = 'Vérifiez le projet Supabase sélectionné. Sur une base vide, appliquez d''abord backend/supabase/schema.sql, puis toutes les migrations dans l''ordre de leur nom de fichier.';
    END IF;

    -- Colonnes apportées par des migrations antérieures : une migration sautée (éditeur SQL) est
    -- signalée ici, avec le fichier à appliquer, au lieu d'une erreur au milieu d'une fonction
    SELECT string_agg(format('public.%s.%s (%s)', r.tbl, r.col, r.migration), ', ' ORDER BY r.migration, r.tbl, r.col)
      INTO v_missing
      FROM (VALUES
          ('bookings', 'customer_country', '20261005_booking_system_v2.sql'),
          ('bookings', 'confirmed_at', '20261005_booking_system_v2.sql'),
          ('agencies', 'archived_at', '20261010000100_agency_access_control.sql'),
          ('bookings', 'pickup_actual_at', '20261012000400_agency_fleet_and_availability.sql'),
          ('vehicles', 'archived_at', '20261012000400_agency_fleet_and_availability.sql'),
          ('agency_subscriptions', 'price_paid', '20261026000100_agency_subscription_monetization.sql'),
          ('subscription_plans', 'sort_order', '20261026000100_agency_subscription_monetization.sql'),
          ('vehicles', 'vehicle_type', '20261106000100_motorcycle_rentals.sql'),
          ('bookings', 'customer_locale', '20261111000100_customer_locale.sql'),
          ('agencies', 'review_count', 'schema.sql')
      ) AS r(tbl, col, migration)
     WHERE NOT EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = to_regclass('public.' || r.tbl)
            AND a.attname = r.col
            AND a.attnum > 0
            AND NOT a.attisdropped
     );
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 20261123000100 : colonnes absentes de cette base : %.', v_missing
            USING HINT = 'Appliquez d''abord les migrations indiquées entre parenthèses, dans l''ordre de leur nom (elles ne modifient pas les données existantes), puis relancez celle-ci. Rien n''a été appliqué.';
    END IF;

    IF to_regprocedure('public.has_platform_permission(text)') IS NULL
       OR to_regprocedure('public.has_agency_permission(uuid, text)') IS NULL THEN
        RAISE EXCEPTION 'Migration 20261123000100 : fonctions de droits absentes (has_platform_permission, has_agency_permission).'
            USING HINT = 'Appliquez d''abord 20261010000100_agency_access_control.sql. Rien n''a été appliqué.';
    END IF;
END;
$$;

-- 0. Index : les rapports filtrent les demandes par date de création ------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_agency_created ON public.bookings (agency_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON public.bookings (created_at);

-- 1. Période demandée → bornes validées et période précédente de même durée ---------------------
CREATE OR REPLACE FUNCTION public.analytics_resolve_period(p_from DATE, p_to DATE)
RETURNS TABLE (period_from DATE, period_to DATE, period_days INTEGER, previous_from DATE, previous_to DATE)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_to DATE := COALESCE(p_to, (now() AT TIME ZONE 'Africa/Casablanca')::date);
    v_from DATE := COALESCE(p_from, v_to - 29);
    v_days INTEGER;
BEGIN
    IF v_from > v_to THEN
        RAISE EXCEPTION 'Invalid date range' USING ERRCODE = '22023';
    END IF;
    v_days := v_to - v_from + 1;
    IF v_days > 1096 THEN
        RAISE EXCEPTION 'Date range too long' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_from, v_to, v_days, v_from - v_days, v_from - 1;
END;
$$;

-- 2. Faits par demande reçue ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_booking_facts(p_agency_id UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
    booking_id UUID,
    agency_id UUID,
    vehicle_type TEXT,
    category TEXT,
    status TEXT,
    created_day DATE,
    start_date DATE,
    total_days INTEGER,
    total_price NUMERIC,
    pickup_location TEXT,
    customer_country TEXT,
    customer_locale TEXT,
    is_confirmed BOOLEAN,
    accepted BOOLEAN,
    picked_up BOOLEAN,
    returned BOOLEAN,
    alternative BOOLEAN,
    response_minutes NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT b.id,
           b.agency_id,
           COALESCE(v.vehicle_type, 'CAR'),
           COALESCE(NULLIF(btrim(v.category), ''), 'Non renseignée'),
           b.status,
           (b.created_at AT TIME ZONE 'Africa/Casablanca')::date,
           b.start_date,
           b.total_days,
           COALESCE(b.total_price, 0),
           COALESCE(NULLIF(btrim(b.pickup_location), ''), 'Non précisé'),
           COALESCE(NULLIF(initcap(btrim(b.customer_country)), ''), 'Non précisé'),
           COALESCE(NULLIF(btrim(b.customer_locale), ''), 'fr'),
           b.status IN ('APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'RENTED', 'COMPLETED'),
           b.status IN ('APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'RENTED', 'COMPLETED')
               OR b.confirmed_at IS NOT NULL
               OR ev.accepted_at IS NOT NULL,
           b.status IN ('ACTIVE', 'RENTED', 'COMPLETED')
               OR b.pickup_actual_at IS NOT NULL
               OR COALESCE(ev.picked_up, false),
           b.status = 'COMPLETED',
           b.status = 'ALTERNATIVE_PROPOSED' OR COALESCE(ev.alternative, false),
           CASE
               WHEN ev.first_response_at IS NOT NULL
               THEN round((extract(epoch FROM ev.first_response_at - b.created_at) / 60)::numeric, 1)
           END
      FROM public.bookings b
      LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
      LEFT JOIN LATERAL (
          SELECT min(e.created_at) FILTER (
                     WHERE e.event_type IN ('AGENCY_ACCEPTED', 'AGENCY_REJECTED', 'ALTERNATIVE_PROPOSED')
                       AND e.created_at >= b.created_at
                 ) AS first_response_at,
                 min(e.created_at) FILTER (WHERE e.event_type = 'AGENCY_ACCEPTED') AS accepted_at,
                 bool_or(e.event_type = 'HANDOVER_PICKUP_COMPLETED') AS picked_up,
                 bool_or(e.event_type = 'ALTERNATIVE_PROPOSED') AS alternative
            FROM public.booking_events e
           WHERE e.booking_id = b.id
      ) ev ON true
     WHERE (p_agency_id IS NULL OR b.agency_id = p_agency_id)
       AND b.created_at >= (p_from::timestamp AT TIME ZONE 'Africa/Casablanca')
       AND b.created_at < ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Casablanca');
$$;

-- 3. Totaux d'une période : entonnoir, chiffre d'affaires, délais --------------------------------
CREATE OR REPLACE FUNCTION public.analytics_period_totals(p_agency_id UUID, p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'requests', count(*),
        'accepted', count(*) FILTER (WHERE f.accepted),
        'pickedUp', count(*) FILTER (WHERE f.picked_up),
        'returned', count(*) FILTER (WHERE f.returned),
        'rejected', count(*) FILTER (WHERE f.status = 'REJECTED'),
        'expiredUnanswered', count(*) FILTER (WHERE f.status = 'EXPIRED' AND NOT f.accepted),
        'noShow', count(*) FILTER (WHERE f.status = 'EXPIRED' AND f.accepted AND NOT f.picked_up),
        'cancelled', count(*) FILTER (WHERE f.status = 'CANCELLED'),
        'alternatives', count(*) FILTER (WHERE f.alternative),
        'awaitingDecision', count(*) FILTER (
            WHERE NOT f.accepted
              AND f.status IN ('PENDING', 'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED')
        ),
        'upcoming', count(*) FILTER (WHERE f.status IN ('APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP')),
        'inProgress', count(*) FILTER (WHERE f.status IN ('ACTIVE', 'RENTED')),
        'confirmed', count(*) FILTER (WHERE f.is_confirmed),
        'revenue', COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0),
        'rentalDays', COALESCE(sum(f.total_days) FILTER (WHERE f.is_confirmed), 0),
        'responsesMeasured', count(f.response_minutes),
        'responseMedianMinutes', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY f.response_minutes))::numeric),
        'responseP90Minutes', round((percentile_cont(0.9) WITHIN GROUP (ORDER BY f.response_minutes))::numeric),
        'respondedWithin1h', count(*) FILTER (WHERE f.response_minutes <= 60),
        'respondedWithin24h', count(*) FILTER (WHERE f.response_minutes <= 1440),
        'leadTimeMedianDays', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY f.start_date - f.created_day))::numeric, 1)
    )
    FROM public.analytics_booking_facts(p_agency_id, p_from, p_to) f;
$$;

-- 4. Répartitions de la période ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_breakdowns(p_agency_id UUID, p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH f AS MATERIALIZED (
        SELECT * FROM public.analytics_booking_facts(p_agency_id, p_from, p_to)
    ), grouped AS (
        SELECT 'vehicleTypes' AS dimension, f.vehicle_type AS label, count(*) AS requests,
               count(*) FILTER (WHERE f.is_confirmed) AS confirmed,
               COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0) AS revenue
          FROM f GROUP BY f.vehicle_type
        UNION ALL
        SELECT 'categories', f.category, count(*), count(*) FILTER (WHERE f.is_confirmed),
               COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0)
          FROM f GROUP BY f.category
        UNION ALL
        SELECT 'pickupLocations', f.pickup_location, count(*), count(*) FILTER (WHERE f.is_confirmed),
               COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0)
          FROM f GROUP BY f.pickup_location
        UNION ALL
        SELECT 'countries', f.customer_country, count(*), count(*) FILTER (WHERE f.is_confirmed),
               COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0)
          FROM f GROUP BY f.customer_country
        UNION ALL
        SELECT 'locales', f.customer_locale, count(*), count(*) FILTER (WHERE f.is_confirmed),
               COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0)
          FROM f GROUP BY f.customer_locale
    ), ranked AS (
        SELECT g.*, row_number() OVER (PARTITION BY g.dimension ORDER BY g.requests DESC, g.revenue DESC, g.label) AS position
          FROM grouped g
    ), dims AS (
        SELECT d AS dimension FROM unnest(ARRAY['vehicleTypes', 'categories', 'pickupLocations', 'countries', 'locales']) AS d
    )
    SELECT jsonb_object_agg(
        dims.dimension,
        COALESCE((
            SELECT jsonb_agg(
                       jsonb_build_object('label', r.label, 'requests', r.requests, 'confirmed', r.confirmed, 'revenue', r.revenue)
                       ORDER BY r.position
                   )
              FROM ranked r
             WHERE r.dimension = dims.dimension AND r.position <= 10
        ), '[]'::jsonb)
    )
    FROM dims;
$$;

-- 5. Série mensuelle : 12 mois finissant au mois de p_to, et les mêmes mois un an plus tôt ------
CREATE OR REPLACE FUNCTION public.analytics_monthly_series(p_agency_id UUID, p_to DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH months AS (
        SELECT (date_trunc('month', p_to::timestamp) - make_interval(months => g))::date AS month_start
          FROM generate_series(11, 0, -1) AS g
    ), window_bounds AS (
        SELECT ((date_trunc('month', p_to::timestamp) - interval '23 months')::date::timestamp AT TIME ZONE 'Africa/Casablanca') AS since,
               (((date_trunc('month', p_to::timestamp) + interval '1 month')::date)::timestamp AT TIME ZONE 'Africa/Casablanca') AS until
    ), facts AS (
        SELECT date_trunc('month', b.created_at AT TIME ZONE 'Africa/Casablanca')::date AS month_start,
               b.status IN ('APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'RENTED', 'COMPLETED') AS is_confirmed,
               COALESCE(b.total_price, 0) AS total_price
          FROM public.bookings b, window_bounds w
         WHERE (p_agency_id IS NULL OR b.agency_id = p_agency_id)
           AND b.created_at >= w.since
           AND b.created_at < w.until
    ), per_month AS (
        SELECT month_start,
               count(*) AS requests,
               count(*) FILTER (WHERE is_confirmed) AS confirmed,
               COALESCE(sum(total_price) FILTER (WHERE is_confirmed), 0) AS revenue
          FROM facts
         GROUP BY month_start
    )
    SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                   'month', to_char(m.month_start, 'YYYY-MM'),
                   'requests', COALESCE(cur.requests, 0),
                   'confirmed', COALESCE(cur.confirmed, 0),
                   'revenue', COALESCE(cur.revenue, 0),
                   'previousYearRequests', COALESCE(prev.requests, 0),
                   'previousYearRevenue', COALESCE(prev.revenue, 0),
                   'partial', (m.month_start + interval '1 month')::date > (now() AT TIME ZONE 'Africa/Casablanca')::date
               )
               ORDER BY m.month_start
           ), '[]'::jsonb)
      FROM months m
      LEFT JOIN per_month cur ON cur.month_start = m.month_start
      LEFT JOIN per_month prev ON prev.month_start = (m.month_start - interval '1 year')::date;
$$;

-- 6. Occupation et revenu par véhicule -----------------------------------------------------------
-- Jours de présence : du plus tard de (début de période, ajout du véhicule) au plus tôt de (fin de
-- période, archivage). Nuits réservées : réservations confirmées, [début, fin) borné à la période
-- (une location rendue le jour même compte une nuit). Revenu : au prorata des nuits de la période.
CREATE OR REPLACE FUNCTION public.analytics_fleet_usage(p_agency_id UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
    vehicle_id UUID,
    agency_id UUID,
    label TEXT,
    vehicle_type TEXT,
    category TEXT,
    archived BOOLEAN,
    available_days INTEGER,
    booked_days INTEGER,
    bookings INTEGER,
    revenue NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH fleet AS (
        SELECT v.id,
               v.agency_id,
               concat_ws(' ', v.brand, v.model)
                   || CASE WHEN NULLIF(btrim(v.license_plate), '') IS NOT NULL THEN ' · ' || btrim(v.license_plate)
                           WHEN NULLIF(btrim(v.unit_number), '') IS NOT NULL THEN ' · ' || btrim(v.unit_number)
                           ELSE '' END AS label,
               COALESCE(v.vehicle_type, 'CAR') AS vehicle_type,
               v.category,
               v.archived_at IS NOT NULL AS archived,
               GREATEST(p_from, (v.created_at AT TIME ZONE 'Africa/Casablanca')::date) AS present_from,
               LEAST(p_to + 1, COALESCE((v.archived_at AT TIME ZONE 'Africa/Casablanca')::date, p_to + 1)) AS present_until
          FROM public.vehicles v
         WHERE (p_agency_id IS NULL OR v.agency_id = p_agency_id)
           AND (v.created_at AT TIME ZONE 'Africa/Casablanca')::date <= p_to
           AND (v.archived_at IS NULL OR (v.archived_at AT TIME ZONE 'Africa/Casablanca')::date > p_from)
    ), stays AS (
        SELECT b.vehicle_id,
               b.total_price,
               GREATEST(b.end_date, b.start_date + 1) - b.start_date AS nights,
               LEAST(GREATEST(b.end_date, b.start_date + 1), p_to + 1) - GREATEST(b.start_date, p_from) AS overlap
          FROM public.bookings b
         WHERE (p_agency_id IS NULL OR b.agency_id = p_agency_id)
           AND b.status IN ('APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'RENTED', 'COMPLETED')
           AND b.start_date <= p_to
           AND GREATEST(b.end_date, b.start_date + 1) > p_from
    ), usage AS (
        SELECT s.vehicle_id,
               count(*)::INTEGER AS bookings,
               sum(s.overlap)::INTEGER AS booked_days,
               sum(COALESCE(s.total_price, 0) * s.overlap / s.nights) AS revenue
          FROM stays s
         WHERE s.overlap > 0
         GROUP BY s.vehicle_id
    )
    SELECT f.id,
           f.agency_id,
           f.label,
           f.vehicle_type,
           f.category,
           f.archived,
           GREATEST(0, f.present_until - f.present_from)::INTEGER,
           LEAST(COALESCE(u.booked_days, 0), GREATEST(0, f.present_until - f.present_from))::INTEGER,
           COALESCE(u.bookings, 0),
           round(COALESCE(u.revenue, 0), 2)
      FROM fleet f
      LEFT JOIN usage u ON u.vehicle_id = f.id
     WHERE f.present_until > f.present_from;
$$;

CREATE OR REPLACE FUNCTION public.analytics_fleet_summary(
    p_agency_id UUID,
    p_from DATE,
    p_to DATE,
    p_include_vehicles BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH u AS MATERIALIZED (
        SELECT * FROM public.analytics_fleet_usage(p_agency_id, p_from, p_to)
    )
    SELECT jsonb_build_object(
        'vehicles', (SELECT count(*) FROM u),
        'availableDays', (SELECT COALESCE(sum(available_days), 0) FROM u),
        'bookedDays', (SELECT COALESCE(sum(booked_days), 0) FROM u),
        'occupancyRate', (SELECT round(100.0 * sum(booked_days) / NULLIF(sum(available_days), 0), 1) FROM u),
        'revenue', (SELECT round(COALESCE(sum(revenue), 0)) FROM u),
        'revenuePerVehicle', (SELECT round(sum(revenue) / NULLIF(count(*), 0)) FROM u),
        'idleVehicles', (SELECT count(*) FROM u WHERE booked_days = 0),
        'byType', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'vehicleType', t.vehicle_type,
                       'vehicles', t.vehicles,
                       'occupancyRate', round(100.0 * t.booked_days / NULLIF(t.available_days, 0), 1),
                       'revenue', round(t.revenue),
                       'revenuePerVehicle', round(t.revenue / NULLIF(t.vehicles, 0))
                   ) ORDER BY t.vehicle_type)
              FROM (
                  SELECT vehicle_type, count(*) AS vehicles, sum(available_days) AS available_days,
                         sum(booked_days) AS booked_days, COALESCE(sum(revenue), 0) AS revenue
                    FROM u GROUP BY vehicle_type
              ) t
        ), '[]'::jsonb),
        'items', CASE WHEN p_include_vehicles THEN COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'vehicleId', x.vehicle_id,
                       'label', x.label,
                       'vehicleType', x.vehicle_type,
                       'category', x.category,
                       'archived', x.archived,
                       'availableDays', x.available_days,
                       'bookedDays', x.booked_days,
                       'occupancyRate', round(100.0 * x.booked_days / NULLIF(x.available_days, 0), 1),
                       'bookings', x.bookings,
                       'revenue', round(x.revenue)
                   ) ORDER BY x.revenue DESC, x.booked_days DESC, x.label)
              FROM (SELECT * FROM u ORDER BY revenue DESC, booked_days DESC, label LIMIT 200) x
        ), '[]'::jsonb) END
    );
$$;

-- 7. Classement des agences (administration) ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_agency_ranking(p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH f AS MATERIALIZED (
        SELECT * FROM public.analytics_booking_facts(NULL, p_from, p_to)
    ), per_agency AS (
        SELECT f.agency_id,
               count(*) AS requests,
               count(*) FILTER (WHERE f.accepted) AS accepted,
               count(*) FILTER (WHERE f.status = 'REJECTED') AS rejected,
               count(*) FILTER (WHERE f.status = 'EXPIRED' AND NOT f.accepted) AS expired_unanswered,
               count(*) FILTER (WHERE f.is_confirmed) AS confirmed,
               COALESCE(sum(f.total_price) FILTER (WHERE f.is_confirmed), 0) AS revenue,
               count(f.response_minutes) AS responses_measured,
               round((percentile_cont(0.5) WITHIN GROUP (ORDER BY f.response_minutes))::numeric) AS response_median
          FROM f
         GROUP BY f.agency_id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'agencyId', a.id,
               'name', a.name,
               'city', a.city,
               'requests', p.requests,
               'accepted', p.accepted,
               'rejected', p.rejected,
               'expiredUnanswered', p.expired_unanswered,
               'confirmed', p.confirmed,
               'revenue', p.revenue,
               'responsesMeasured', p.responses_measured,
               'responseMedianMinutes', p.response_median,
               'rating', CASE WHEN COALESCE(a.review_count, 0) > 0 THEN a.rating END,
               'reviewCount', COALESCE(a.review_count, 0)
           ) ORDER BY p.requests DESC, p.revenue DESC, a.name), '[]'::jsonb)
      FROM (SELECT * FROM per_agency ORDER BY requests DESC, revenue DESC LIMIT 15) p
      JOIN public.agencies a ON a.id = p.agency_id;
$$;

-- 8. Journal du revenu récurrent mensuel -----------------------------------------------------------
-- Sans clé étrangère : la suppression d'une agence (cascade sur son abonnement) laisse une ligne
-- de résiliation dans le journal au lieu de réécrire les mois passés.
CREATE TABLE IF NOT EXISTS public.subscription_mrr_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agency_id UUID NOT NULL,
    plan_id UUID,
    status TEXT,
    previous_mrr NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (previous_mrr >= 0),
    mrr NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (mrr >= 0),
    source TEXT NOT NULL CHECK (source IN ('SUBSCRIPTION', 'AGENCY', 'PLAN_PRICE', 'BACKFILL')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_mrr_events_agency ON public.subscription_mrr_events (agency_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_mrr_events_time ON public.subscription_mrr_events (occurred_at);

COMMENT ON TABLE public.subscription_mrr_events IS
    'Évolutions de la contribution au revenu récurrent mensuel (MRR) de chaque agence : contribution précédente et nouvelle. Écrit uniquement par déclencheurs.';

ALTER TABLE public.subscription_mrr_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.subscription_mrr_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscription_mrr_events TO service_role;

-- Enregistre la contribution actuelle d'une agence si elle diffère de la dernière enregistrée
CREATE OR REPLACE FUNCTION public.log_subscription_mrr(p_agency_id UUID, p_source TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_mrr NUMERIC := 0;
    v_status TEXT;
    v_plan UUID;
    v_previous NUMERIC;
BEGIN
    IF p_agency_id IS NULL THEN
        RETURN;
    END IF;

    SELECT CASE
               WHEN a.status = 'ACTIVE' AND a.archived_at IS NULL AND s.status IN ('ACTIVE', 'TRIAL')
               THEN COALESCE(NULLIF(s.price_paid, 0), p.price_monthly, 0)
               ELSE 0
           END,
           s.status,
           s.plan_id
      INTO v_mrr, v_status, v_plan
      FROM public.agency_subscriptions s
      JOIN public.agencies a ON a.id = s.agency_id
      LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
     WHERE s.agency_id = p_agency_id;
    v_mrr := COALESCE(v_mrr, 0);

    SELECT e.mrr INTO v_previous
      FROM public.subscription_mrr_events e
     WHERE e.agency_id = p_agency_id
     ORDER BY e.occurred_at DESC, e.id DESC
     LIMIT 1;
    v_previous := COALESCE(v_previous, 0);

    IF v_previous = v_mrr THEN
        RETURN;
    END IF;

    INSERT INTO public.subscription_mrr_events (agency_id, plan_id, status, previous_mrr, mrr, source)
    VALUES (p_agency_id, v_plan, v_status, v_previous, v_mrr, p_source);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_subscription_mrr_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.log_subscription_mrr(OLD.agency_id, 'SUBSCRIPTION');
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.agency_id IS DISTINCT FROM NEW.agency_id THEN
        PERFORM public.log_subscription_mrr(OLD.agency_id, 'SUBSCRIPTION');
    END IF;
    PERFORM public.log_subscription_mrr(NEW.agency_id, 'SUBSCRIPTION');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_subscription_mrr_from_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.log_subscription_mrr(NEW.id, 'AGENCY');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_subscription_mrr_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_agency UUID;
BEGIN
    FOR v_agency IN SELECT s.agency_id FROM public.agency_subscriptions s WHERE s.plan_id = NEW.id LOOP
        PERFORM public.log_subscription_mrr(v_agency, 'PLAN_PRICE');
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agency_subscriptions_mrr ON public.agency_subscriptions;
CREATE TRIGGER trg_agency_subscriptions_mrr
    AFTER INSERT OR UPDATE OR DELETE ON public.agency_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_mrr_from_subscription();

DROP TRIGGER IF EXISTS trg_agencies_mrr ON public.agencies;
CREATE TRIGGER trg_agencies_mrr
    AFTER UPDATE OF status, archived_at ON public.agencies
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.archived_at IS DISTINCT FROM NEW.archived_at)
    EXECUTE FUNCTION public.trg_subscription_mrr_from_agency();

DROP TRIGGER IF EXISTS trg_subscription_plans_mrr ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_mrr
    AFTER UPDATE OF price_monthly ON public.subscription_plans
    FOR EACH ROW
    WHEN (OLD.price_monthly IS DISTINCT FROM NEW.price_monthly)
    EXECUTE FUNCTION public.trg_subscription_mrr_from_plan();

-- Amorçage : chaque abonnement facturé compte à sa date de création (une seule fois)
INSERT INTO public.subscription_mrr_events (agency_id, plan_id, status, previous_mrr, mrr, source, occurred_at)
SELECT s.agency_id, s.plan_id, s.status, 0, COALESCE(NULLIF(s.price_paid, 0), p.price_monthly, 0), 'BACKFILL', s.created_at
  FROM public.agency_subscriptions s
  JOIN public.agencies a ON a.id = s.agency_id
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
 WHERE a.status = 'ACTIVE' AND a.archived_at IS NULL AND s.status IN ('ACTIVE', 'TRIAL')
   AND COALESCE(NULLIF(s.price_paid, 0), p.price_monthly, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.subscription_mrr_events e WHERE e.agency_id = s.agency_id);

-- 9. Revenu récurrent : état actuel, formules et mouvements des 12 mois finissant au mois de p_to -
CREATE OR REPLACE FUNCTION public.analytics_subscription_report(p_to DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH live AS (
        SELECT s.agency_id,
               s.status,
               p.slug,
               p.name,
               p.sort_order,
               CASE
                   WHEN a.status = 'ACTIVE' AND a.archived_at IS NULL AND s.status IN ('ACTIVE', 'TRIAL')
                   THEN COALESCE(NULLIF(s.price_paid, 0), p.price_monthly, 0)
                   ELSE 0
               END AS mrr
          FROM public.agency_subscriptions s
          JOIN public.agencies a ON a.id = s.agency_id AND a.archived_at IS NULL
          LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
    ), months AS (
        SELECT (date_trunc('month', p_to::timestamp) - make_interval(months => g))::date AS month_start
          FROM generate_series(11, 0, -1) AS g
    ), bounds AS (
        SELECT m.month_start,
               (m.month_start::timestamp AT TIME ZONE 'Africa/Casablanca') AS since,
               (((m.month_start + interval '1 month')::date)::timestamp AT TIME ZONE 'Africa/Casablanca') AS until
          FROM months m
    )
    SELECT jsonb_build_object(
        'mrr', (SELECT COALESCE(sum(mrr), 0) FROM live),
        'subscribers', (SELECT count(*) FROM live WHERE mrr > 0),
        'trialSubscribers', (SELECT count(*) FROM live WHERE mrr > 0 AND status = 'TRIAL'),
        'pastDue', (SELECT count(*) FROM live WHERE status = 'PAST_DUE'),
        'cancelledOrExpired', (SELECT count(*) FROM live WHERE status IN ('CANCELLED', 'EXPIRED')),
        'averageRevenuePerSubscriber', (SELECT round(sum(mrr) / NULLIF(count(*) FILTER (WHERE mrr > 0), 0)) FROM live),
        'plans', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('slug', t.slug, 'name', t.name, 'subscribers', t.subscribers, 'mrr', t.mrr)
                             ORDER BY t.sort_order, t.name)
              FROM (
                  SELECT COALESCE(slug, 'inconnue') AS slug, COALESCE(name, 'Formule inconnue') AS name,
                         COALESCE(min(sort_order), 0) AS sort_order,
                         count(*) FILTER (WHERE mrr > 0) AS subscribers, COALESCE(sum(mrr), 0) AS mrr
                    FROM live
                   GROUP BY slug, name
                  HAVING count(*) FILTER (WHERE mrr > 0) > 0
              ) t
        ), '[]'::jsonb),
        'monthly', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'month', to_char(b.month_start, 'YYYY-MM'),
                       'mrr', (
                           SELECT COALESCE(sum(last.mrr), 0)
                             FROM (
                                 SELECT DISTINCT ON (e.agency_id) e.mrr
                                   FROM public.subscription_mrr_events e
                                  WHERE e.occurred_at < b.until
                                  ORDER BY e.agency_id, e.occurred_at DESC, e.id DESC
                             ) last
                       ),
                       'newMrr', COALESCE(mv.new_mrr, 0),
                       'expansionMrr', COALESCE(mv.expansion_mrr, 0),
                       'contractionMrr', COALESCE(mv.contraction_mrr, 0),
                       'churnedMrr', COALESCE(mv.churned_mrr, 0),
                       'newSubscribers', COALESCE(mv.new_subscribers, 0),
                       'churnedSubscribers', COALESCE(mv.churned_subscribers, 0),
                       'partial', (b.month_start + interval '1 month')::date > (now() AT TIME ZONE 'Africa/Casablanca')::date
                   ) ORDER BY b.month_start), '[]'::jsonb)
              FROM bounds b
              LEFT JOIN LATERAL (
                  SELECT sum(e.mrr) FILTER (WHERE e.previous_mrr = 0 AND e.mrr > 0) AS new_mrr,
                         sum(e.mrr - e.previous_mrr) FILTER (WHERE e.previous_mrr > 0 AND e.mrr > e.previous_mrr) AS expansion_mrr,
                         sum(e.previous_mrr - e.mrr) FILTER (WHERE e.mrr > 0 AND e.mrr < e.previous_mrr) AS contraction_mrr,
                         sum(e.previous_mrr) FILTER (WHERE e.previous_mrr > 0 AND e.mrr = 0) AS churned_mrr,
                         count(*) FILTER (WHERE e.previous_mrr = 0 AND e.mrr > 0) AS new_subscribers,
                         count(*) FILTER (WHERE e.previous_mrr > 0 AND e.mrr = 0) AS churned_subscribers
                    FROM public.subscription_mrr_events e
                   WHERE e.occurred_at >= b.since AND e.occurred_at < b.until
              ) mv ON true
        )
    );
$$;

-- 10. Rapports exposés ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_analytics_report(
    p_agency_id UUID,
    p_from DATE DEFAULT NULL,
    p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
BEGIN
    IF p_agency_id IS NULL OR NOT public.has_agency_permission(p_agency_id, 'reports.read') THEN
        RAISE EXCEPTION 'Not authorized to read agency reports' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_period FROM public.analytics_resolve_period(p_from, p_to);

    RETURN jsonb_build_object(
        'period', jsonb_build_object(
            'from', v_period.period_from,
            'to', v_period.period_to,
            'days', v_period.period_days,
            'previousFrom', v_period.previous_from,
            'previousTo', v_period.previous_to
        ),
        'current', public.analytics_period_totals(p_agency_id, v_period.period_from, v_period.period_to),
        'previous', public.analytics_period_totals(p_agency_id, v_period.previous_from, v_period.previous_to),
        'breakdowns', public.analytics_breakdowns(p_agency_id, v_period.period_from, v_period.period_to),
        'monthly', public.analytics_monthly_series(p_agency_id, v_period.period_to),
        'fleet', public.analytics_fleet_summary(p_agency_id, v_period.period_from, v_period.period_to, true),
        'previousFleet', public.analytics_fleet_summary(p_agency_id, v_period.previous_from, v_period.previous_to, false),
        'generatedAt', now()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_report(p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
BEGIN
    IF NOT public.has_platform_permission('reports.read') THEN
        RAISE EXCEPTION 'Not authorized to read platform reports' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_period FROM public.analytics_resolve_period(p_from, p_to);

    RETURN jsonb_build_object(
        'period', jsonb_build_object(
            'from', v_period.period_from,
            'to', v_period.period_to,
            'days', v_period.period_days,
            'previousFrom', v_period.previous_from,
            'previousTo', v_period.previous_to
        ),
        'current', public.analytics_period_totals(NULL, v_period.period_from, v_period.period_to),
        'previous', public.analytics_period_totals(NULL, v_period.previous_from, v_period.previous_to),
        'breakdowns', public.analytics_breakdowns(NULL, v_period.period_from, v_period.period_to),
        'monthly', public.analytics_monthly_series(NULL, v_period.period_to),
        'fleet', public.analytics_fleet_summary(NULL, v_period.period_from, v_period.period_to, false),
        'previousFleet', public.analytics_fleet_summary(NULL, v_period.previous_from, v_period.previous_to, false),
        'network', jsonb_build_object(
            'agencies', (SELECT count(*) FROM public.agencies WHERE status = 'ACTIVE' AND archived_at IS NULL),
            'pendingAgencies', (SELECT count(*) FROM public.agencies WHERE status = 'PENDING' AND archived_at IS NULL),
            'agenciesWithoutRequests', (
                SELECT count(*) FROM public.agencies a
                 WHERE a.status = 'ACTIVE' AND a.archived_at IS NULL
                   AND NOT EXISTS (
                       SELECT 1 FROM public.bookings b
                        WHERE b.agency_id = a.id
                          AND b.created_at >= (v_period.period_from::timestamp AT TIME ZONE 'Africa/Casablanca')
                          AND b.created_at < ((v_period.period_to + 1)::timestamp AT TIME ZONE 'Africa/Casablanca')
                   )
            ),
            'vehicles', (SELECT count(*) FROM public.vehicles WHERE archived_at IS NULL),
            'motorcycles', (SELECT count(*) FROM public.vehicles WHERE archived_at IS NULL AND vehicle_type = 'MOTORCYCLE')
        ),
        'agencies', public.analytics_agency_ranking(v_period.period_from, v_period.period_to),
        'subscriptions', public.analytics_subscription_report(v_period.period_to),
        'generatedAt', now()
    );
END;
$$;

-- 11. Droits : fonctions internes réservées au serveur, rapports aux comptes connectés -----------
REVOKE ALL ON FUNCTION public.analytics_resolve_period(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_booking_facts(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_period_totals(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_breakdowns(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_monthly_series(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_fleet_usage(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_fleet_summary(UUID, DATE, DATE, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_agency_ranking(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_subscription_report(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_subscription_mrr(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_subscription_mrr_from_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_subscription_mrr_from_agency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_subscription_mrr_from_plan() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.analytics_resolve_period(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_booking_facts(UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_period_totals(UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_breakdowns(UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_monthly_series(UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_fleet_usage(UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_fleet_summary(UUID, DATE, DATE, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_agency_ranking(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_subscription_report(DATE) TO service_role;

REVOKE ALL ON FUNCTION public.agency_analytics_report(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_report(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_analytics_report(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_report(DATE, DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
