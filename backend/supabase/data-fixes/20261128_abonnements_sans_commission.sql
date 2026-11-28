-- ============================================================================
-- ClickDrive — Forfaits : retrait des mentions « commission » et « pourcentage »
-- ============================================================================
-- Script de DONNÉES à relire puis exécuter à la main (éditeur SQL Supabase).
-- La plateforme est financée uniquement par les abonnements des agences : l'application
-- n'affiche plus ni commission, ni « part agence », ni « montant net ».
--
-- Les avantages des forfaits sont enregistrés en base (subscription_plans.features).
-- Ils contiennent encore « 0% de commission sur… » et « 100% des revenus locatifs… ».
-- Ce script les remplace par une seule phrase, sans pourcentage :
--   « Montant des locations encaissé en totalité par l’agence »
-- (même texte que le repli de src/lib/services/subscription.service.ts).
--
-- Le schéma n'est PAS modifié : les colonnes bookings.commission_* restent en place
-- (lues par d'anciennes fonctions SQL) ; l'application écrit commission_rate = 0.
-- ============================================================================


-- ── Étape 0 : aperçu (lecture seule) ────────────────────────────────────────
SELECT slug, name, features
FROM public.subscription_plans
ORDER BY sort_order;


-- ── Étape 1 : correction (transaction) ──────────────────────────────────────
BEGIN;

UPDATE public.subscription_plans p
SET features = sub.new_features,
    updated_at = now()
FROM (
  SELECT plan.id,
         COALESCE(
           jsonb_agg(to_jsonb(cleaned.feature) ORDER BY cleaned.first_position),
           '[]'::jsonb
         ) AS new_features
  FROM public.subscription_plans plan
  LEFT JOIN LATERAL (
    -- Chaque avantage « commission / 100 % » devient la phrase commune ; doublons retirés,
    -- ordre d'origine conservé (première occurrence)
    SELECT feature, MIN(position) AS first_position
    FROM (
      SELECT CASE
               WHEN f.value ILIKE '%commission%' OR f.value ~ '100\s*%'
                 THEN 'Montant des locations encaissé en totalité par l’agence'
               ELSE f.value
             END AS feature,
             f.ordinality AS position
      FROM jsonb_array_elements_text(plan.features) WITH ORDINALITY AS f(value, ordinality)
    ) mapped
    GROUP BY feature
  ) cleaned ON true
  GROUP BY plan.id
) sub
WHERE p.id = sub.id
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p.features) AS f(value)
    WHERE f.value ILIKE '%commission%' OR f.value ~ '100\s*%'
  )
RETURNING p.slug, p.features;

-- Contrôle : plus aucun avantage ne parle de commission ni de pourcentage (doit renvoyer 0 ligne)
SELECT slug, f.value
FROM public.subscription_plans, jsonb_array_elements_text(features) AS f(value)
WHERE f.value ILIKE '%commission%' OR f.value ~ '\d\s*%';

-- COMMIT;   -- ← à exécuter si les résultats sont corrects
-- ROLLBACK; -- ← sinon
