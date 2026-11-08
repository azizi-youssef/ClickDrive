# ClickDrive — Remédiation de l’audit technique du 6 novembre 2026

Statut au 7 novembre 2026 : **phases 0 à 3 réalisées en grande partie ; phase 4 (accessibilité des dialogues, tests de
composants, E2E écrits) réalisée sauf exécution des E2E ; phases 5 à 7 partielles**.
Ce document distingue ce qui est **vérifié** (test exécuté, résultat observé) de ce qui est **NON VÉRIFIÉ**.
Score audité de départ : **7,3/10**. Aucun score n’est revendiqué sans preuve.

---

## 1. Incident de sécurité critique (action requise du propriétaire)

**Constat vérifié.** Le dépôt GitHub `azizi-youssef/CarDrive` est **public** (API GitHub : HTTP 200 sans authentification).
Le commit `36ae3c3` (4 octobre 2026, branches `main` et `Youssef`) contient la clé Supabase **`service_role`** du projet
de production (`wviqbs…`, expiration 2106) dans `.env.example`, `backend/.env.example` et plusieurs `scripts/*.mjs`.
Cette clé contourne toute la RLS : lecture et écriture de toutes les données (réservations, CIN, permis…).
Elle n’est plus dans les fichiers actuels, mais reste lisible dans l’historique. La clé `anon` (publique par nature) y figure aussi.

**Procédure (à faire immédiatement, par le propriétaire du projet Supabase) :**

1. Supabase → *Project Settings → API Keys* : créer de nouvelles clés (*publishable* et *secret*) puis **désactiver les clés
   JWT historiques** (`anon` / `service_role`). Alternative : rotation du *JWT secret* (invalide aussi toutes les sessions).
2. Mettre à jour `SUPABASE_SERVICE_ROLE_KEY` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` chez l’hébergeur (production, préproduction)
   et dans les `.env.local` des postes. Redéployer.
3. Examiner les journaux Supabase (API, base) depuis le 4 octobre pour détecter des accès non attendus.
4. Facultatif, après rotation : purger l’historique (`git filter-repo`) puis *force push* — action destructive, non réalisée
   sans accord explicite. La rotation suffit à rendre la clé exposée inutilisable.

Contrôles réalisés : aucun fichier `.env*` contenant des valeurs réelles n’est suivi par Git (seuls les `.env.example`,
avec des valeurs factices) ; aucun secret n’est exposé via une variable `NEXT_PUBLIC_*` ; aucune valeur secrète n’a été
affichée pendant l’analyse (seule la *claim* `role` des jetons a été décodée).

---

## 2. Traçabilité des constats

| Constat d’audit | État initial (vérifié) | Correction | Preuve de test | Statut |
|---|---|---|---|---|
| Isolation des réservations (RLS) | Politiques et privilèges de colonnes corrects **dans les migrations** ; jamais testés | Tests multi-utilisateurs sur un vrai PostgreSQL ; migration de durcissement | `tests/db/rls.spec.ts` : 37 tests | **Corrigé (dépôt)** — état de la base déployée NON VÉRIFIÉ |
| Colonnes sensibles (CIN, permis, naissance, notes, vol, téléphone, e-mail) | Lecture SQL retirée à `anon`/`authenticated` | Vérifié pour chaque colonne, client et agence | 7 tests « permission denied » | **Vérifié** |
| Politiques d’écriture `WITH CHECK (true)` | Présentes (inertes car privilèges retirés) | Supprimées (`20261107000100`) | test « aucune politique permissive » | **Corrigé** |
| Fonctions `SECURITY DEFINER` exécutables par `anon` | `expire_completed_bookings()` écrivait sans session ; RPC d’admin appelables | `REVOKE EXECUTE … FROM anon` | 7 tests « sans session, refusé » | **Corrigé** |
| `is_admin()` accorde des droits à `ADMIN` historique | Oui (non utilisé par les politiques) | Aligné sur `SUPER_ADMIN` | test « ADMIN sans droit global » | **Corrigé** |
| Rôle `ADMIN` historique traité comme super-admin côté application | `isPlatformAdminRole` incluait `ADMIN` → `GET /api/bookings` lui renvoyait toutes les réservations avec PII | `SUPER_ADMIN` uniquement (`@clickdrive/shared`) | `lib/auth/access.spec.ts` | **Corrigé** |
| `/account/*` non protégé par le middleware | Exact (le layout serveur protégeait déjà) | Middleware : session, profil, redirection sûre, `noindex` | test `privateAreaFor` + vérification HTTP 307 | **Corrigé** |
| Middleware ouvert si Supabase non configuré | Oui, y compris en production | Fail-closed en production (503) | revue de code | **Corrigé** |
| Disponibilité fail-open | La route renvoyait `available: true` sur erreur ; le service aussi ; la carte se repliait sur le statut flotte | États AVAILABLE / UNAVAILABLE / UNKNOWN ; 503 si inconnu ; aucune demande sur disponibilité non vérifiée | `lib/availability/status.spec.ts` (16 tests) + HTTP 404/400 | **Corrigé** |
| Anti-chevauchement en base | Contrainte d’exclusion présente | Vérifiée | test « deux réservations confirmées » | **Vérifié** |
| Secrets WhatsApp | Côté serveur uniquement ; HMAC timing-safe déjà correct | — | revue de code | **Vérifié** |
| Envoi WhatsApp sans nouvelle tentative ; faux succès en production si non configuré ; numéro complet en journal | Exact | Retries bornés (429/5xx/réseau, jamais après timeout), échec explicite en production, numéros masqués, plus de contenu de message stocké | `lib/notifications/retry.spec.ts` (8 tests) | **Corrigé** |
| Clé `service_role` dans l’historique public | Non signalé par l’audit | Signalement + procédure | décodage de la *claim* `role` | **Action propriétaire requise** |
| Migrations : versions en double, BOM UTF-8 | 9 fichiers partageaient une version ; 1 BOM bloquant | Renommage (ordre conservé), BOM retiré | `tests/db/migrations.spec.ts` | **Corrigé** |
| Fiches véhicule rendues côté client | Exact (HTML sans contenu) | Composant serveur + métadonnées réelles + JSON-LD `Car`/`Motorcycle` + vraie 404 | HTTP : `<h1>`, canonique, JSON-LD, 404 | **Corrigé** |
| Champs internes exposés par l’API publique | `select('*')` : plaque, n° interne, documents | Projection publique (API, HTML préchargé) ; complet pour `SUPER_ADMIN` | 0/13 véhicules exposés (HTTP) | **Corrigé** |
| Canoniques fausses | `/cgv`, `/about`, fiches agence → accueil | Canoniques propres ; plus d’héritage de la racine | HTTP | **Corrigé** |
| `hreflang` | `fr-MA → /` déclaré sur toutes les pages | Retiré : une URL par page, langue par cookie (pas d’URL par langue) | HTTP | **Corrigé** |
| Image Open Graph `/og-…png` absente ; icône Apple en `.ico` | Exact (aggravé par le changement de marque) | `opengraph-image`, `twitter-image`, `apple-icon` générés | PNG 1200×630 et 180×180 | **Corrigé** |
| Pages privées indexables | Pas de `noindex` sur `/account`, `/agency`, `/login` | `X-Robots-Tag` + métadonnées | HTTP | **Corrigé** |
| Sitemap listait les agences inactives | `getAgencies(false)` | Agences actives uniquement | revue de code | **Corrigé** |
| Titres en double (« … \| ClickDrive \| ClickDrive Nador ») | Exact | Titres sans marque (gabarit) | HTTP | **Corrigé** |
| Anglais absent | Exact | `en.ts` complet + statuts de réservation | `lib/i18n/i18n.spec.ts` | **Corrigé** |
| RTL appliqué après hydratation ; décalage serveur/client | Exact (source d’erreurs d’hydratation) | Langue lue côté serveur (cookie, sinon `Accept-Language`), `lang`/`dir` dans le premier HTML | HTTP : `ar` → `dir="rtl"` | **Corrigé** |
| jsPDF dans le navigateur | Non : utilisé uniquement côté serveur | — | revue des imports | **Sans objet** |
| Tests : Vitest, composants, E2E | Uniquement `node:test` | Vitest + couverture + PGlite (DB réelle) ; React Testing Library (jsdom) ; Playwright bureau + mobile ; suites historiques conservées | 104 + 39 tests exécutés ; E2E écrits | **Partiel** (E2E : NON EXÉCUTÉS ici, voir §4) |
| CI | Node 20, sans typecheck, build pointant vers Express | Node 22.12, typecheck, tests DB, couverture, build ; job staging conditionnel (migrations + Playwright + rapport) | — | **Écrit, NON VÉRIFIÉ sur GitHub** |
| Modale de réservation : piège de focus | Présent mais contournable (clic sur une zone neutre → Tab sortait du dialogue) ; page d’arrière-plan lisible au lecteur d’écran | Mécanisme commun `useModalDialog` : page `inert`, Tab piégé même hors focus, Échap au premier plan, focus rendu à l’ouverture | 8 tests du mécanisme + 4 tests de la modale + vérification au clavier dans le navigateur | **Corrigé** |
| Autres dialogues | 8 modales sans Échap, piège ni retour du focus ; titres non reliés ; boutons « X » sans nom ; avis sans `role="dialog"` | Même mécanisme sur 13 dialogues (agence, admin, avis, visionneuse, filtres mobile) ; titres/descriptions reliés ; `alertdialog` pour les actions destructives | `Dialog.spec.tsx` (4) ; filtres mobile vérifiés dans le navigateur | **Corrigé** |
| Focus volé pendant la saisie (dialogues agence) | L’effet se relançait à chaque rendu du parent (temps réel) et renvoyait le focus sur « Fermer » | Fermeture lue par référence : l’effet ne dépend que de l’ouverture | test de non-régression (saisie + rendus) | **Corrigé** |
| Formulaire véhicule agence | 15 libellés non reliés aux champs ; zone photos inaccessible au clavier ; interrupteur « Publier » sans nom ; pas de dialogue | Libellés reliés, zone photos activable (Entrée/Espace), `role="switch"` nommé, dialogue modal, erreur annoncée | `VehicleFormModal.spec.tsx` (5) | **Corrigé** |
| Bouton « Réserver » hors d’écran (≥ 1024 px, écran peu haut) | Colonne collante de 1 023 px : à 1024×768 le bouton restait sous le bord, même au focus (WCAG 2.4.11) | Colonne limitée à la hauteur de l’écran, défilement interne | mesure dans le navigateur : bouton visible au focus | **Corrigé** |
| Clic « Réserver » perdu au retour sur l’onglet | Le rafraîchissement de disponibilité désactivait le bouton pendant la vérification | Rafraîchissement en arrière-plan sans repasser par « Vérification… » ; échec → « non vérifiée » (fail-closed conservé) | 2 tests + vérification dans le navigateur | **Corrigé** |
| Refus d’une demande par l’agence « ne fonctionne pas » (signalé le 7 novembre) | Bouton « Refuser » grisé tant que le motif est vide, sans explication ; champ du motif au milieu du dossier. Journal serveur : aucune requête de refus envoyée. Base saine (refus accepté depuis les 6 statuts autorisés) | Bouton toujours actif : sans motif, il amène au champ, le marque invalide et explique ce qui manque | `BookingDetailModal.spec.tsx` (3, dont le parcours complet avec confirmation) + `tests/db/booking-actions.spec.ts` (6) | **Corrigé** — à confirmer par l’agence |
| Bannière cookies au-dessus des dialogues | `z-100` : visible mais inutilisable (page inerte) par-dessus les modales | `z-45` : sous les dialogues, au-dessus des barres fixes | vérifié dans le navigateur | **Corrigé** |

---

## 3. Migrations

| Fichier | Nature |
|---|---|
| 9 renommages (`20261010000100` … `20261012000700`) | Versions uniques, ordre d’application inchangé. Aucun effet sur une base où elles ont été appliquées à la main. Si `supabase db push` est adopté sur une base existante : `supabase migration repair --status applied <versions>` d’abord. |
| `20261010000200_populate_images_features.sql` | BOM UTF-8 retiré (contenu identique). |
| `20261107000100_security_hardening.sql` (nouveau) | Additif : suppression de 2 politiques inertes, `REVOKE EXECUTE … FROM anon` sur 7 fonctions, `is_admin()` → `SUPER_ADMIN`. |

Toutes les migrations s’appliquent sur une base vierge (PostgreSQL 18 via PGlite) : **vérifié**.
Application sur le projet Supabase réel (`wviqbs…`) : **NON VÉRIFIÉ** — rappel : la migration `20261103000100` n’y était pas
appliquée au 6 novembre (recherche par dates en erreur 500).

---

## 4. Résultats des tests (exécutés le 7 novembre 2026)

| Suite | Commande | Résultat |
|---|---|---|
| Unitaires + composants Vitest (dont 29 tests de composants en jsdom) | `npm run test:unit -w frontend` | **104 / 104** |
| Migrations + RLS (PostgreSQL réel, PGlite) | `npm run test:db -w frontend` | **39 / 39** |
| Suites historiques `node:test` (16 fichiers) | `npm run test:legacy -w frontend` | **0 échec** (code de sortie 0) |
| TypeScript | `npm run typecheck` | **0 erreur** (l’appel `setLoading` resté sans état dans `admin/settings/commission/page.tsx`, qui faisait échouer la CI GitHub, est supprimé) |
| ESLint | `npm run lint` | 0 erreur, 228 avertissements (nettoyage en cours par le propriétaire) |
| Build de production | `npm run build -w frontend` | **Réussi** (Next.js 16.4.5, aucun avertissement), après correction de l’erreur TypeScript |
| Étapes du job CI `quality`, rejouées en local dans l’ordre | `npm ls`, `build:shared`, lint, typecheck, unitaires, base, historiques, couverture, build | **Toutes en succès** ; exécution sur GitHub Actions à confirmer après le push |
| E2E Playwright publics (bureau + mobile) | `npm run test:e2e:public -w frontend` | **NON EXÉCUTÉS ici** : le bac à sable de l’agent interdit le lancement de Chromium. Seuls les 8 tests HTTP sans navigateur ont tourné (8/8 : redirections des espaces privés + `noindex`, 404, rendu serveur de la fiche) |
| E2E Playwright authentifiés (parcours 1, 5 à 10) | `npm run test:e2e -w frontend` + variables `E2E_*` | **NON EXÉCUTÉS** : exigent un staging avec comptes de test (jamais la production) |
| Contrôle WCAG automatique (axe-core, 6 pages) | inclus dans les E2E publics | **NON EXÉCUTÉ** (même raison) |
| Vérification manuelle dans le navigateur (serveur local) | clavier + mesures DOM | Modale de réservation, filtres mobile, RTL 375 px : **conformes** (voir §2) |
| Lighthouse / Core Web Vitals | — | **NON MESURÉ** |

### Parcours E2E écrits (`frontend/e2e/`)

| # | Parcours demandé | Fichier | Données | Statut |
|---|---|---|---|---|
| 1 | Inscription / connexion client | `staging/journeys.e2e.ts` | compte de test, écriture | Écrit, NON EXÉCUTÉ |
| 2 | Découverte des véhicules | `public/discovery.e2e.ts` | lecture | Écrit, NON EXÉCUTÉ (navigateur) |
| 3 | Filtrage du catalogue (voitures/motos, filtres mobile) | `public/discovery.e2e.ts` | lecture | Écrit, NON EXÉCUTÉ ; filtres mobile vérifiés manuellement |
| 4 | Fiche véhicule (SSR, JSON-LD, 404, modale au clavier sans envoi) | `public/discovery.e2e.ts` | lecture | Partie HTTP **exécutée (verte)** ; partie navigateur NON EXÉCUTÉE ; modale vérifiée manuellement |
| 5 | Envoi d’une demande de réservation | `staging/journeys.e2e.ts` | écriture | Écrit, NON EXÉCUTÉ |
| 6 | Historique client | `staging/journeys.e2e.ts` | compte de test | Écrit, NON EXÉCUTÉ |
| 7 | Connexion agence | `staging/journeys.e2e.ts` | compte de test | Écrit, NON EXÉCUTÉ |
| 8 | Création de véhicule (non publié) | `staging/journeys.e2e.ts` | écriture | Écrit, NON EXÉCUTÉ |
| 9 | Gestion des réservations agence | `staging/journeys.e2e.ts` | compte de test | Écrit, NON EXÉCUTÉ (lecture + dialogue uniquement) |
| 10 | Super administrateur : agences | `staging/journeys.e2e.ts` | compte de test | Écrit, NON EXÉCUTÉ |
| 11 | Navigation arabe (RTL) | `public/access-and-locale.e2e.ts` | lecture | Écrit, NON EXÉCUTÉ ; RTL vérifié manuellement (`dir="rtl"`, aucun débordement à 375 px) |

Garde-fou : `e2e/support/env.ts` refuse toute écriture si l’URL cible est `clickdrive.ma`, même avec `E2E_ALLOW_WRITES=1`.
Le serveur local lit la base de production : seuls les parcours en lecture seule doivent y être lancés.

---

## 5. Restant à faire (priorisé)

1. **Rotation de la clé `service_role`** (propriétaire, immédiat).
2. Appliquer `20261103000100` et `20261107000100` sur le projet Supabase réel, puis relancer les tests RLS sur staging.
3. Couverture i18n : la plupart des textes d’interface (cartes, fiche, réservation, tableaux de bord) sont écrits en français
   dans les composants, hors dictionnaires — l’interface anglaise n’est donc que partiellement traduite. Constaté aussi en
   arabe : la page est bien en RTL, mais le titre du catalogue reste « Location de voiture à Nador ».
4. Exécuter les E2E : `npm run test:e2e:public -w frontend` sur un poste (serveur local), puis la suite complète sur staging
   avec les comptes de test ; corriger ce que remonte axe-core.
5. Accessibilité restante : carrousels et menus de navigation (non audités), contraste (à mesurer par axe), zoom 200 %,
   lecteur d’écran réel (NVDA / VoiceOver) — non vérifiés.
6. Incohérence de contact à confirmer : le pied de page affiche le WhatsApp `+212 767 137 136`, le reste du site
   (`CLICKDRIVE_WHATSAPP_NUMBER`, barre de navigation, carte de réservation) `+212 661 987 654`. Non modifié : donnée métier.
7. Catalogue : pagination et filtrage côté serveur (le catalogue complet est encore chargé puis filtré côté client).
8. Observabilité : identifiants de corrélation, journaux structurés, contrôle de santé base de données, alertes.
9. Backend Express historique : documenter puis retirer une fois l’absence de dépendance prouvée.

---

## 6. Liste de contrôle avant production

- [ ] Clés Supabase historiques désactivées, nouvelles clés configurées chez l’hébergeur.
- [ ] Migrations appliquées sur staging, tests RLS verts sur staging, puis production.
- [ ] `NODE_ENV=production`, variables `WHATSAPP_*` configurées (sinon les envois échouent explicitement).
- [ ] CI GitHub verte (lint, types, tests unitaires, tests base, build).
- [ ] Vérification manuelle : `/account` sans session → connexion ; recherche avec dates → 200 ; fiche véhicule → HTML rendu.
- [ ] Retour arrière : redéployer la version précédente chez l’hébergeur ; les migrations sont additives (pas de retour de schéma nécessaire).

---

## 7. Score pondéré (provisoire, fondé sur les preuves ci-dessus)

| Dimension | Poids | Note | Justification courte |
|---|---:|---:|---|
| Architecture | 8 % | 8,0 | BFF canonique ; backend Express encore présent |
| Qualité du code | 8 % | 7,0 | 0 erreur lint/TS (hors fichier en cours), 262 avertissements |
| API et services | 8 % | 8,0 | Fail-closed, projection publique, bornes de pagination |
| Authentification / autorisation | 12 % | 8,5 | 3 niveaux (route, service, RLS) testés ; base déployée non vérifiée |
| Base de données et confidentialité | 12 % | 6,0 | RLS prouvée, mais clé `service_role` publique tant qu’elle n’est pas révoquée |
| Performance | 10 % | 6,5 | Fiches en SSR ; catalogue non paginé ; aucune mesure Lighthouse |
| SEO | 7 % | 8,5 | Métadonnées, canoniques, JSON-LD, images, sitemap vérifiés |
| UX/UI | 7 % | 7,5 | Bouton « Réserver » atteignable sur écran peu haut, clic non perdu au retour sur l’onglet |
| Accessibilité | 7 % | 8,0 | 13 dialogues conformes et testés, formulaire véhicule nommé ; axe-core et lecteur d’écran non exécutés |
| Internationalisation | 5 % | 6,5 | 6 dictionnaires complets, RTL serveur ; textes de composants non traduits |
| Tests et CI/CD | 10 % | 7,0 | Unitaires, composants, DB réelle exécutés ; E2E écrits mais non exécutés ; CI non exécutée |
| Sécurité et exploitation | 6 % | 4,0 | Fuite de clé active ; observabilité non améliorée |
| **Total** | 100 % | **7,18** | **≈ 7,6 dès la révocation de la clé** (base 6,0 → 8,0 ; sécurité 4,0 → 6,5) |

Calcul : somme des poids × notes. La version précédente de ce tableau annonçait « ≈ 7,1 » ; le calcul exact donnait 7,02.
Écart corrigé ici. Gain de cette phase : +0,16 (UX, accessibilité, tests).

Le score baisse par rapport à l’audit initial parce qu’un risque critique non identifié par l’audit a été découvert ;
les corrections apportées sont réelles et vérifiées, mais elles ne compensent pas une clé administrateur publique.
