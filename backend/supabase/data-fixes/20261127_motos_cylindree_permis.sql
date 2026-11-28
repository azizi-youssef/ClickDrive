-- ============================================================================
-- ClickDrive — Correction des fiches motos (cylindrée, permis, catégorie)
-- ============================================================================
-- Script de DONNÉES à relire puis exécuter à la main (éditeur SQL Supabase).
-- Il n'est volontairement PAS dans migrations/ : il corrige des fiches saisies par
-- les agences, il ne modifie pas le schéma.
--
-- Constat sur le site en ligne (27/11/2026) :
--   • Yamaha MT-09 (Krinicar)        : 125 cm³, permis A1, catégorie « Scooter »
--                                      → 890 cm³, permis A, catégorie « Roadster »
--   • BMW R 1300 RS (Marchica Car)   : 1025 cm³, permis A2
--                                      → 1300 cm³, permis A
--   • Suzuki V-Strom 1050 (Marchica) : catégorie « Scooter », permis A2
--                                      → catégorie « Trail », permis A (environ 79 kW :
--                                        au-delà de la limite de 35 kW du permis A2)
--
-- Règle appliquée désormais par la validation (src/lib/validations/vehicle.ts) :
--   ≤ 50 cm³ → AM, A1 ou B ; 51–125 cm³ → A1 ; > 125 cm³ → A2 ou A.
--
-- Mode d'emploi :
--   1. Exécuter l'étape 0 et vérifier qu'elle renvoie exactement les 3 fiches attendues.
--   2. Exécuter l'étape 1 (transaction). Vérifier les lignes renvoyées par RETURNING.
--   3. COMMIT si tout est correct, sinon ROLLBACK.
--   Le catalogue public est mis en cache 60 s : la correction apparaît au plus tard une minute après.
-- ============================================================================


-- ── Étape 0 : aperçu (lecture seule) ────────────────────────────────────────
SELECT v.id, a.name AS agence, v.brand, v.model, v.year, v.category,
       v.engine_cc, v.license_required, v.transmission
FROM public.vehicles v
LEFT JOIN public.agencies a ON a.id = v.agency_id
WHERE v.vehicle_type = 'MOTORCYCLE'
  AND (
        (v.brand ILIKE 'yamaha' AND v.model ILIKE 'mt-09%')
     OR (v.brand ILIKE 'bmw'    AND v.model ILIKE 'r 1300 rs%')
     OR (v.brand ILIKE 'suzuki' AND v.model ILIKE 'v-strom 1050%')
  )
ORDER BY v.brand, v.model;


-- ── Étape 1 : correction (transaction) ──────────────────────────────────────
BEGIN;

-- Yamaha MT-09 : moteur 890 cm³, roadster, permis A
UPDATE public.vehicles
SET engine_cc = 890,
    license_required = 'A',
    category = 'Roadster',
    updated_at = now()
WHERE vehicle_type = 'MOTORCYCLE'
  AND brand ILIKE 'yamaha'
  AND model ILIKE 'mt-09%'
  AND (engine_cc IS DISTINCT FROM 890 OR license_required IS DISTINCT FROM 'A' OR category IS DISTINCT FROM 'Roadster')
RETURNING id, brand, model, engine_cc, license_required, category;

-- BMW R 1300 RS : moteur 1300 cm³, permis A
UPDATE public.vehicles
SET engine_cc = 1300,
    license_required = 'A',
    updated_at = now()
WHERE vehicle_type = 'MOTORCYCLE'
  AND brand ILIKE 'bmw'
  AND model ILIKE 'r 1300 rs%'
  AND (engine_cc IS DISTINCT FROM 1300 OR license_required IS DISTINCT FROM 'A')
RETURNING id, brand, model, engine_cc, license_required, category;

-- Suzuki V-Strom 1050 : trail (et non scooter), permis A
UPDATE public.vehicles
SET category = 'Trail',
    license_required = 'A',
    updated_at = now()
WHERE vehicle_type = 'MOTORCYCLE'
  AND brand ILIKE 'suzuki'
  AND model ILIKE 'v-strom 1050%'
  AND (category IS DISTINCT FROM 'Trail' OR license_required IS DISTINCT FROM 'A')
RETURNING id, brand, model, engine_cc, license_required, category;

-- À décider avec l'agence (laissé en commentaire) : la V-Strom 1050 n'existe qu'en boîte manuelle,
-- la fiche indique « Automatique ».
-- UPDATE public.vehicles SET transmission = 'MANUAL', updated_at = now()
-- WHERE vehicle_type = 'MOTORCYCLE' AND brand ILIKE 'suzuki' AND model ILIKE 'v-strom 1050%';

-- Contrôle : plus aucune moto incohérente (doit renvoyer 0 ligne)
SELECT id, brand, model, engine_cc, license_required
FROM public.vehicles
WHERE vehicle_type = 'MOTORCYCLE'
  AND engine_cc IS NOT NULL
  AND license_required IS NOT NULL
  AND NOT (
        (engine_cc <= 50  AND license_required IN ('AM', 'A1', 'B'))
     OR (engine_cc > 50 AND engine_cc <= 125 AND license_required = 'A1')
     OR (engine_cc > 125 AND license_required IN ('A2', 'A'))
  );

-- COMMIT;   -- ← à exécuter si les résultats sont corrects
-- ROLLBACK; -- ← sinon


-- ── Étape 2 (facultative, à valider séparément) : contrainte en base ────────
-- Empêche toute nouvelle incohérence, même hors de l'application. À transformer en
-- migration seulement après l'étape 1 (sinon l'ajout échoue sur les fiches erronées).
--
-- ALTER TABLE public.vehicles
--   ADD CONSTRAINT vehicles_license_matches_engine_cc CHECK (
--     engine_cc IS NULL OR license_required IS NULL
--     OR (engine_cc <= 50  AND license_required IN ('AM', 'A1', 'B'))
--     OR (engine_cc > 50 AND engine_cc <= 125 AND license_required = 'A1')
--     OR (engine_cc > 125 AND license_required IN ('A2', 'A'))
--   );
