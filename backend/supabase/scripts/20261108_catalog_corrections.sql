-- ========================================================================
-- ClickDrive : corrections du catalogue relevées lors de l'évaluation du 8 novembre 2026
--
-- Script ponctuel, À RELIRE PUIS EXÉCUTER MANUELLEMENT (éditeur SQL Supabase) : ce n'est pas une
-- migration et il n'est jamais appliqué automatiquement. Idéalement, prévenir chaque agence
-- concernée (ou lui demander de corriger elle-même depuis son espace).
--
-- Chaque correction ne s'applique que si la valeur erronée est toujours en place : une fiche
-- déjà corrigée par l'agence n'est pas modifiée. Les slugs (URL des fiches) ne changent pas.
-- ========================================================================

-- 1. Aperçu : les fiches visées et leurs valeurs actuelles
SELECT slug, brand, model, vehicle_type, category, transmission
FROM public.vehicles
WHERE slug IN (
    'suzuki-v-strom-1050-2024-s3csa',
    'yamaha-mt-09-2025-u08hk',
    'hyundai-ticson-2025-ud0lt',
    'mercedes-classe-c-220-2025-07qhu',
    'hyundai-i20-2026-51cny'
)
ORDER BY slug;

-- 2. Corrections
BEGIN;

-- Suzuki V-Strom 1050 : moto trail à boîte manuelle (saisie « SUZUKI », Scooter, automatique)
UPDATE public.vehicles
SET brand = 'Suzuki', category = 'Trail', transmission = 'MANUAL', updated_at = now()
WHERE slug = 'suzuki-v-strom-1050-2024-s3csa' AND category = 'Scooter';

-- Yamaha MT-09 : roadster à boîte manuelle (saisie Scooter, automatique)
UPDATE public.vehicles
SET category = 'Roadster', transmission = 'MANUAL', updated_at = now()
WHERE slug = 'yamaha-mt-09-2025-u08hk' AND category = 'Scooter';

-- Hyundai « Ticson » : faute de frappe pour Tucson, classé Luxe au lieu de SUV
UPDATE public.vehicles
SET model = 'Tucson', category = 'SUV', updated_at = now()
WHERE slug = 'hyundai-ticson-2025-ud0lt' AND model = 'Ticson';

-- Mercedes Classe C 220 à 1 700 DH/jour : classée Économique. Berline proposée
-- (« Luxe » si l'agence préfère ce positionnement : à confirmer avec elle)
UPDATE public.vehicles
SET category = 'Berline', updated_at = now()
WHERE slug = 'mercedes-classe-c-220-2025-07qhu' AND category = 'Économique';

-- Hyundai i20 : modèle saisi « I20 »
UPDATE public.vehicles
SET model = 'i20', updated_at = now()
WHERE slug = 'hyundai-i20-2026-51cny' AND model = 'I20';

-- Vérifier le résultat (même requête que l'aperçu) avant de valider :
--   COMMIT;    pour enregistrer
--   ROLLBACK;  pour tout annuler
