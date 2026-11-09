-- ========================================================================
-- ClickDrive : arrivée en ferry au port de Beni Ansar
-- Migration : 20261110000100_ferry_arrival.sql
--
-- Additive. Le client qui choisit le port comme lieu de prise en charge précise sa traversée
-- (compagnie, trajet, heure d'arrivée) pour que l'agence fixe le rendez-vous, comme le numéro
-- de vol pour l'aéroport. Colonne écrite uniquement quand le client la renseigne.
-- ========================================================================

BEGIN;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS ferry_details TEXT
        CHECK (ferry_details IS NULL OR char_length(ferry_details) <= 160);

NOTIFY pgrst, 'reload schema';

COMMIT;
