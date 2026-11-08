# ClickDrive — Audit UI/UX (phase 1)

*Date : 4 novembre 2026 · Commit audité : `cebe3f8` · Arbre de travail propre.*

## Méthode

- **Rendu réel mesuré** sur le build de production local (`next start`), page par page, dans des iframes de même origine à **1920, 1440, 1280, 1024, 768, 430, 390 et 360 px** : débordement horizontal, titres `h1`, images sans `alt` ou cassées, cibles tactiles < 24 px, champs sans libellé, textes < 11 px, contrastes WCAG (hors texte posé sur photo), sauts de niveaux de titres, landmarks `main`.
- **Pages mesurées (14)** : accueil, catalogue `/search`, fiche véhicule, annuaire et fiche agence, à propos, FAQ, contact, CGV, connexion, devenir partenaire, page SEO `location-voiture-nador-aeroport`, page 404.
- **Revue visuelle** (captures) : accueil, catalogue PC et mobile.
- **Code** : espace client, parcours de réservation, dashboards agence et admin (non rendus : ils exigent une connexion), cohérence des couleurs, composants, dépendances.
- **Données réelles** lues via l'API : 3 agences, 11 véhicules.

**Non couvert** : rendu connecté (espace client, dashboards), scores Lighthouse (non exécutés), lecteur d'écran réel, parcours complet en arabe hors hero et carrousel des marques.

## 1. Points forts

- **Aucun débordement horizontal** sur les 14 pages et les 8 largeurs, à une exception près (1 px, voir M9).
- **Structure saine** : un seul `h1` par page, aucune image sans `alt`, aucune image cassée, aucun saut de titre hors `/agency/join`.
- **Identité de base cohérente** : graphite `#0B1220` + rouge `#E63946` largement dominants, Plus Jakarta Sans auto-hébergée.
- **Catalogue mobile solide** : formulaire empilé, bouton « Filtres », cartes complètes (photo, statut, catégorie, boîte, carburant, places, agence, prix, caution, CTA).
- **Statuts honnêtes** dans le catalogue (« Disponible » / « En location »), dashboards alimentés par de vraies données, autorisations côté serveur.
- Récemment refaits : hero, annuaire des agences, dashboards admin et agence, paramètres agence, carrousel des marques.

## 2. Constats priorisés

### Critique — intégrité des données (à corriger avant toute refonte visuelle)

| # | Constat | Preuve | Impact |
|---|---------|--------|--------|
| C1 | **Note inventée sur la fiche agence** : « ★ 4.9 (0 avis) ». | `app/agencies/[slug]/page.tsx:159` affiche `agency.rating` sans tenir compte de `review_count` ; les 3 agences ont `rating = 4.9` et `review_count = 0` en base. | Un client lit une note excellente qui n'existe pas. Contraire au brief (« Do not invent ratings »). |
| C2 | **Agences et prix fictifs sur l'accueil** : section « alternatives » avec « Agence Rif Drive », « Agence Marchica Rent », « Agence Nador Auto », 330–380 DH. | Rendu de l'accueil ; mention « Exemple simulé » en 10 px. « Marchica Rent » ressemble à l'agence réelle « Marchica Car ». | Faux contenu commercial, confusion avec une vraie agence. |
| C3 | **Horaires inventés** : « Ouvert 7j/7 de 08:00 à 21:00 » sur chaque fiche agence. | `app/agencies/[slug]/page.tsx:195`, texte en dur, aucune donnée d'horaires en base. | Promesse fausse pour chaque agence. |

### Élevé

| # | Constat | Preuve | Impact |
|---|---------|--------|--------|
| H1 | **Contraste insuffisant du rouge de marque** : texte blanc sur `#E63946` = **4,17:1** (seuil AA 4,5:1) sur tous les boutons principaux (« Rechercher », « Réserver ce véhicule », « Devenir agence partenaire », « Envoyer le message »…) ; texte rouge sur gris clair = 3,85–3,98:1 (sur-titres, liens CGV). | Mesuré sur toutes les pages. | Échec WCAG AA systémique sur les actions les plus importantes. |
| H2 | **Statuts de réservation illisibles dans l'espace client** : code brut anglais (`REQUESTED`, `APPROVED`…) ; seuls `CONFIRMED`/`PENDING` ont une couleur, une demande `REQUESTED` s'affiche avec le badge rouge « loué ». Frise de suivi sans `SENT_TO_AGENCY`, `AGENCY_REVIEW`, `ALTERNATIVE_PROPOSED`, `EXPIRED`. | `app/account/page.tsx:278-286`, `app/account/bookings/[reference]/page.tsx:93-125`. | Le client ne comprend pas où en est sa demande — distinction demande / validation / confirmation non tenue. |
| H3 | **Champs de formulaire sans libellé accessible** : 5 sur `/contact`, 5 sur `/agency/join`. Les libellés sont visibles mais non reliés (`<label>` sans `htmlFor`). | Mesuré + `app/contact/ContactClient.tsx:390`, `app/agency/join/page.tsx:113-171`. | Lecteurs d'écran : champs anonymes ; clic sur le libellé inactif. |
| H4 | **Horaires du support contradictoires** : « Support 7j/7 » (menu, footer, traductions), « lundi au samedi 9h–18h » (accueil), « Lun–Ven 9h–18h, Sam 9h–13h » (contact). | `Footer.tsx:85`, `Navbar.tsx:142`, `fr.ts:89`, `page.tsx:205`, `ContactClient.tsx:317`. | Perte de confiance ; au moins deux affirmations sont fausses. |
| H5 | **Design system fragmenté** : 57 couleurs hex distinctes, 5 rouges (`#E63946`, `#C92F3B`, `#B4232F`, `#D32F3C`, `#BF2935`), 6+ graphites ; `#667085` et `#E4E7EC` du brief absents ; 6 tailles d'arrondi courantes ; aucun `Button`/`Input` partagé (`components/ui` = `Badge`, `PriceDisplay`) ; trois kits parallèles (public ad hoc, `lib/design/tokens.ts` agence, `AdminUI.tsx`). | Comptage sur `src/**/*.tsx`. | Incohérences visuelles inévitables, coût de chaque évolution. |
| H6 | **Pages publiques clés rendues côté navigateur** : accueil, catalogue, fiche véhicule et fiche agence sont des pages `'use client'` entières ; véhicules et agences chargés après l'affichage ; accueil ≈ **477 Ko de JS compressé** (20 fichiers) ; deux librairies d'animation (framer-motion **et** gsap). | Mesuré (ressources) + `package.json`. | Affichage plus lent sur mobile, contenu catalogue moins exploitable par les moteurs. |

### Moyen

| # | Constat | Preuve |
|---|---------|--------|
| M1 | Filtres proposant des catégories sans aucun véhicule : « Berline », « 7 places » (données : Économique, SUV, Luxe ; tous 5 places). | Catalogue + API. |
| M2 | Message contradictoire au catalogue : « Choisissez vos dates pour vérifier la disponibilité » alors que des dates sont pré-remplies et que les cartes affichent déjà « Disponible ». | Catalogue PC et mobile. |
| M3 | Landmarks : deux `<main>` imbriqués sur `/agencies` (introduit par la refonte récente) et la 404 ; aucun `<main>` sur `/agency/join` (+ saut de niveau de titre). | Mesuré. |
| M4 | Cibles < 24 px : liens de la barre supérieure (17 px de haut), fils d'Ariane (16 px), liens e-mail CGV/contact (18 px), raccourcis agences du footer (22 px). | Mesuré, toutes largeurs ≥ 768 px. |
| M5 | Textes < 11 px : 31 sur l'accueil (étiquettes de catégories en 10 px, « / jour » en 9 px), 11 sur le catalogue et les pages SEO. | Mesuré. |
| M6 | Photographie : 10 véhicules sur 11 n'ont qu'une photo ; certaines sont des visuels avec texte (« CLIO5 », « TUCSON ») plutôt que des photos du véhicule. | API + catalogue. |
| M7 | Accueil très long (~8 900 px à 1366 px) avec messages en double : encart « ClickDrive pour les professionnels » puis encart agence identique en tête du footer. | Rendu. |
| M8 | `/api/auth/me` appelé deux fois à chaque page. | Ressources réseau. |
| M9 | `/agencies/[slug]` déborde de 1 px à 360 px. | Mesuré. |
| M10 | Page de connexion : « © 2026 ClickDrive » à 2,86:1, séparateur « ou » à 3,10:1. | Mesuré. |

### Faible

| # | Constat |
|---|---------|
| L1 | 14 balises `<img>` brutes (logos, avatars) à côté de `next/image` ; à revoir au cas par cas. |
| L2 | Lieu affiché « Aeroport » sans accent (valeur du catalogue). |
| L3 | Plaque d'immatriculation lisible sur une photo de véhicule (Renault Kardian). |

## 3. Lecture par catégorie demandée

- **Incohérences visuelles** : H5, H1, M5.
- **UX** : H2, M1, M2, M7.
- **Navigation** : M3, M4, M7.
- **Mobile** : bonne base (aucun débordement, recherche empilée) ; M4, M5, M9.
- **Accessibilité** : H1, H3, M3, M4, M10.
- **Duplication de composants** : H5 (trois kits, pas de Button/Input communs), M7.
- **Performance UI** : H6, M8, L1.
- **Freins à la conversion** : C1–C3 (confiance), H1 (bouton principal), H2 (suivi), H4, M1.

## 4. Feuille de route priorisée

1. **Intégrité des données (C1–C3, H4)** — retirer la note sans avis, la section d'agences fictives et les horaires en dur ; un seul horaire de support, vrai, partout. *Petit effort, impact confiance maximal.*
2. **Design system (H5, H1)** — jetons sémantiques (actions, succès, alerte, erreur, info, disponibilité, désactivé ; texte secondaire `#667085`, bordure `#E4E7EC`), rouge d'action conforme AA pour le texte blanc, composants `Button`, `Input`, `Select`, `Field`, `Badge`/`StatusBadge` partagés, puis migration progressive des trois kits.
3. **Parcours client (H2, H3, M2)** — libellés de statut traduits et colorés pour tous les statuts de la machine à états, frise demande → validation agence → confirmation, formulaires accessibles.
4. **Catalogue et fiches (M1, M6, H6)** — filtres dérivés des données réelles, rendu serveur des pages publiques (données préchargées), une seule librairie d'animation, consignes photo pour les agences.
5. **Accessibilité et finitions (M3–M5, M9, M10)** — landmarks, cibles ≥ 24 px, taille de texte minimale, débordement à 360 px.
6. **Dashboards** — audit rendu connecté (nécessite une session), tableaux adaptés au mobile.
7. **Qualité** — Lighthouse mesuré avant/après, typecheck, lint, tests, build.

## 5. Suivi des corrections

| Point | Statut | Correction |
|-------|--------|------------|
| C1 | Corrigé | Note affichée seulement si `review_count > 0` ; sinon « Nouveau partenaire · aucun avis pour le moment ». |
| C2 | Corrigé | Maquette fictive remplacée par un extrait réel du catalogue (catégorie la mieux fournie, véhicules, agences et prix réels, lien vers la catégorie). |
| C3 | Corrigé | Horaires en dur et promesse « caution sécurisée » retirés ; remplacés par des informations exactes (vérification, horaires confirmés par l'agence, aucun paiement en ligne). |
| H4 | Corrigé — horaires confirmés le 5 novembre 2026 | Source unique `lib/constants/contact.ts` (horaires de la page Contact : lun–ven 9h–18h, sam. 9h–13h) ; toutes les mentions « 7j/7 » et « 24/7 » publiques retirées (5 langues, footer, menu, accueil, SEO, message WhatsApp). |
| — | Corrigé | Lien WhatsApp « abonnements » des agences : numéro factice `212600000000` remplacé par le numéro de la plateforme. |
| H1 | Corrigé | Jeton `action` `#C92F3B` (5,31:1 avec texte blanc) pour tous les boutons et textes rouges sur fond clair ; `#FF6B76` sur fond sombre ; badge accent `#A61E2A` sur `#FDEDEE`. |
| H2 | Corrigé | Module unique `lib/bookings/status.ts` : 15 statuts traduits (5 langues), tons, `StatusBadge`, frise en 6 étapes ; `REQUESTED` n'est jamais présenté comme confirmé. |
| H3 | Corrigé | Libellés reliés (`htmlFor`/`id`), `aria-invalid` et `aria-describedby` sur `/contact` et `/agency/join` ; composant `Field`. |
| H5 | Corrigé (base) | Jetons sémantiques `@theme`, composants `Button`, `Input`/`Select`/`Textarea`/`Field`, `Badge`, `StatusBadge` ; surcharge des rayons supprimée. Migration progressive des écrans restants. |
| H6 | Corrigé (accueil, catalogue) | Rendu serveur des véhicules et agences ; JS de l'accueil 477 → 395 Ko, appels API 4 → 1 ; GSAP retiré, framer-motion absent de l'accueil. Fiches véhicule et agence encore rendues côté navigateur. |
| M1 | Corrigé | Filtres et catégories dérivés des données (facettes avec effectifs). |
| M2 | Corrigé | Messages de disponibilité alignés sur la période réellement appliquée. |
| M3 | Corrigé | Un seul `<main>` par page (vérifié sur 12 pages × 8 largeurs) ; `/agency/join` dans le shell public, titres sans saut de niveau. |
| M4 | Corrigé (pages publiques) | Fils d'Ariane étiquetés et ≥ 24 px, barre utilitaire, liens légaux du footer, en-têtes de filtres. Restent des liens en ligne dans le texte (exemptés WCAG 2.5.8). |
| M5 | Corrigé | Aucun texte < 11 px sur les pages publiques (63 occurrences relevées à 11 px, hors initiales d'avatar et compteurs). |
| M8 | Corrigé | Requête de profil partagée, événement `INITIAL_SESSION` ignoré : un seul `/api/auth/me`. |
| M9 | Corrigé | `/agencies/[slug]` sans débordement de 360 à 1920 px. |
| M10 | Corrigé | Connexion : texte secondaire `#667085`, bouton et liens `#C92F3B`. |
| M6, M7, L1–L3 | Ouvert | Photos (contenu des agences), longueur de l'accueil, `<img>` brutes, libellé « Aeroport », plaque visible : non traités dans cette passe. |
| Bloquant externe | Ouvert | RPC `vehicle_availability` : « cannot execute SELECT in a read-only transaction » → recherche avec dates en erreur 500. Migration SQL à appliquer sur le bon projet Supabase. |
