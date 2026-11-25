# ClickDrive — Backlog d'implémentation *Luxury & Exclusive* (Tâche 01 · F + synthèse)

> **Date** : 24 novembre 2026 · **Référence** : `main` @ `1ca24b9`
> Ce backlog consolide les constats de `BRAND_AUDIT.md` (BR-*), `DESIGN_SYSTEM_AUDIT.md` (DS-*), `DIGITAL_EXPERIENCE_AUDIT.md` (DX-*, Q-*) et `MOBILE_READINESS_AUDIT.md` (MR-*).
> **Rien n'est à implémenter avant revue de l'audit par le propriétaire.**

Complexité : **XS** < ½ j · **S** ≤ 1 j · **M** 2–3 j · **L** 1–2 sem. · **XL** > 2 sem.

---

## 1. Audit de sécurité Git (F)

Relevé du 24/11/2026, lecture seule.

| Point | Constat |
|---|---|
| **Branche courante** | `claude/clickdrive-audit-85b668` (worktree isolé `…/.claude/worktrees/clickdrive-audit-85b668`), même commit que `main` : `1ca24b9 « change logo »` (24/11/2026). |
| **`main` vs `origin/main`** | Synchronisées (0 en avance, 0 en retard). |
| **Arbre de travail** | Propre dans ce worktree et dans le checkout principal (`git status` vide). Seul ajout de cet audit : `docs/branding/` (5 fichiers Markdown, non commités). |
| **Fichiers modifiés** | Aucun. **Aucun code applicatif, schéma, migration, logique d'auth ou de réservation n'a été touché.** |
| **Fichiers non suivis** | Aucun avant l'audit. |
| **Worktrees** | 2 : checkout principal (`main`) et ce worktree. |
| **Branches** | `Youssef` / `origin/Youssef` (dernier commit 01/11) et `admin-alertes-messages` (09/11) : **entièrement fusionnées** dans `main` (0 commit propre). `origin/v0/ui-ux-refresh` : **1 commit non fusionné** `d779daa « Améliorer l'accueil et la recherche mobile »` (23/11) touchant `frontend/src/app/HomeClient.tsx` et `frontend/src/components/search/SearchBar.tsx`. |
| **Conflits potentiels** | `git merge-tree main origin/v0/ui-ux-refresh` → **CONFLIT** sur `HomeClient.tsx` et `SearchBar.tsx`, les deux fichiers centraux de la future refonte de l'accueil et de la recherche. |
| **Stashes (pile partagée par tous les worktrees)** | `stash@{0}` « état complet avant retour au dernier commit (17/11…) » — 156 fichiers ; `stash@{1}` « état complet avant le retour de l'identité visuelle (17/11) » — 156 fichiers, contient l'identité « sable/lagune » **refusée** par le propriétaire ; `stash@{2}` « carte agence : logos entiers… » — 7 fichiers. |
| **Migrations** | 41 fichiers dans `backend/supabase/migrations/` — non modifiés, aucune nouvelle migration nécessaire pour la refonte visuelle. |
| **Historique récent** | Commits fréquents à messages génériques (« ameliorer UI/UX v11.1 », « amelioration service v7 » ×2 avec des numéros non monotones) : traçabilité faible pour revenir sur une étape de refonte. |

### Actions Git avant toute implémentation

| ID | Action | Priorité | Complexité | Dépendances |
|---|---|---|---|---|
| GIT-01 | Ne jamais `pop`/`drop` les 3 stashes ; toute restauration sélective (`git checkout <sha> -- <fichier>`) seulement sur demande explicite du propriétaire. | Critique | XS | — |
| GIT-02 | Une branche par lot de refonte, messages de commit descriptifs (ex. `brand: tokens palette luxury`), PR avec captures avant/après. | Haute | XS | — |
| GIT-03 | **Trancher `origin/v0/ui-ux-refresh`** (fusion avec résolution manuelle, ou abandon) **avant** de toucher l'accueil et la barre de recherche. | Haute | S | Décision propriétaire |
| GIT-04 | Supprimer les branches déjà fusionnées (`Youssef`, `admin-alertes-messages`) après accord. | Basse | XS | Accord propriétaire |

---

## 2. Décisions à obtenir du propriétaire (bloquantes)

| # | Décision | Bloque |
|---|---|---|
| D1 | Validation du **système de logo** (symbole + wordmark) sur maquettes | BR-01, BR-03, BR-04, BR-05, MR-07, BR-09 |
| D2 | **Palette** cible et rôle du rouge (marque ou action seule) — après le refus de l'identité « sable/lagune » le 17/11, valider sur maquettes avant tout code | BR-06, DS-08, toutes les migrations visuelles |
| D3 | **Couple typographique** latin + arabe | BR-07, DS-04, MR-10 |
| D4 | **Tagline** « Click. Drive. Explore. » : anglais partout ou traduite ; plateforme de messages | BR-08, DX-01 |
| D5 | Place du segment Luxe (offre principale ou gamme) | DX-01, DX-02, DX-03 |
| D6 | Architecture mobile : **coque Capacitor hébergée** (recommandé) vs client embarqué | MR-01 et suivants |
| D7 | Branche `v0/ui-ux-refresh` : fusionner ou abandonner | GIT-03, DX-01, DX-02 |
| D8 | Budget création logo / production photo | BR-03, BR-10 |

---

## 3. Backlog par phase

### Phase 0 — Préalables et correctifs sans risque (indépendants de la nouvelle identité)

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P0-01 | Mesures de référence : Lighthouse mobile (accueil, catalogue, fiche), captures 360/768/1440 en FR et AR, axe sur pages publiques | Q-02, Q-01 | Critique | S | Installer les dépendances existantes (`npm ci`) |
| P0-02 | Retirer la plaque « CarDrive » du hero (retouche ou nouvelle image) et remplacer `UI.png` | BR-02 | Critique | S | Image de remplacement |
| P0-03 | Remplacer la photo de la frontière de Melilla pour « Port Beni Ansar » | BR-10, Q-06 | Haute | XS | Photo sous licence |
| P0-04 | Favicon < 20 Ko (même visuel en attendant D1), une seule copie | BR-05, Q-02 | Haute | XS | — |
| P0-05 | Actions photo de la flotte visibles au tactile et au focus, `aria-label`, 44 px | DX-07, MR-06 | Haute | S | — |
| P0-06 | `global-error.tsx`, `error.tsx`, `loading.tsx` (catalogue, fiche, compte) | DX-09 | Haute | S | — |
| P0-07 | Zones sûres hautes et latérales sur les barres fixes/collantes | MR-03 | Haute | S | — |
| P0-08 | Bouton Retour Android ↔ fermeture des modales publiques | MR-04 | Haute | S | `useModalDialog` |
| P0-09 | Corriger les chaînes « CarDrive »/« KlickDrive » restantes (scripts, commentaires) | BR-02 | Basse | XS | — |
| P0-10 | Projet Playwright WebKit (iPhone) pour les e2e publics | MR-11 | Moyenne | S | P0-01 |
| P0-11 | GIT-01 à GIT-03 | §1 | Haute | S | D7 |

### Phase 1 — Fondation de marque (création, hors code)

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P1-01 | Système de logo vectoriel : symbole, wordmark, lock-ups, versions couleur/blanc/noir, favicon | BR-01, BR-03, BR-04 | Critique | L | D1, D8 |
| P1-02 | Palette maître + table de contrastes AA (mêmes rôles de jetons qu'aujourd'hui) | BR-06 | Critique | M | D2 |
| P1-03 | Typographies latin + arabe, échelle, règles RTL | BR-07 | Haute | M | D3 |
| P1-04 | Plateforme de messages et ton, tagline, 6 langues | BR-08 | Haute | M | D4 |
| P1-05 | Charte photo + brief shooting + consignes agences | BR-10 | Haute | M | D8 |
| P1-06 | Maquettes clés (accueil, catalogue, fiche, réservation, compte, agence) **validées** | — | Critique | L | P1-01 → P1-04 |

### Phase 2 — Durcissement du design system (rendu identique, aucun changement visuel)

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P2-01 | `ui/Button` seule API ; `tokens.button` et `AdminUI.Btn` en alias | DS-01 | Critique | M | P0-01 (captures) |
| P2-02 | `ui/Field` étendu ; suppression des 4 `Field` locaux | DS-03 | Haute | M | P2-01 |
| P2-03 | Fusion EmptyState / Pagination / StatusBadge / ErrorBanner / Skeleton dans `components/ui` | DS-06 | Moyenne | M | P2-01 |
| P2-04 | Codemod palette brute (995) et hex restants (172) → jetons sémantiques | DS-02 | Haute | L | — |
| P2-05 | Codemod propriétés physiques → logiques ; règles `:lang(ar)` | DS-09 | Haute | M | — |
| P2-06 | Composant `Heading` + adoption de l'échelle (340 tailles arbitraires) | DS-04 | Haute | M | — |
| P2-07 | Primitive `Card/Surface` (3 rayons, élévations officielles) | DS-05 | Moyenne | M | — |
| P2-08 | `100vh` → `dvh/svh` | DS-11 | Moyenne | S | — |
| P2-09 | Jetons d'inversion (`surface-inverse`, `text-on-inverse`) | DS-08 | Moyenne | S | — |
| P2-10 | Découpage de `Navbar` et `BookingRequestModal` à rendu identique | Q-07 | Moyenne | L | Tests existants |
| P2-11 | Garde-fous : test qui échoue si de nouveaux hex/`text-[Npx]`/`bg-action` hors `ui/` apparaissent | DS-01/02/04 | Moyenne | S | P2-01, P2-04 |

### Phase 3 — Application de l'identité

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P3-01 | Nouvelles valeurs de jetons (palette) dans `globals.css` | BR-06 | Critique | S | P1-02, P2-04 |
| P3-02 | Polices latin + arabe auto-hébergées (`next/font/local`) | BR-07, MR-10 | Haute | S | P1-03 |
| P3-03 | Logos et variantes exposés par `src/lib/brand/` (en-tête, pied, barres latérales repliées, PDF) | BR-01, BR-04 | Critique | S | P1-01 |
| P3-04 | Icônes PWA/Apple/maskable carrées, JSON-LD corrigé | BR-05, Q-03 | Haute | S | P1-01 |
| P3-05 | Connexion et 404 réécrites sur jetons | DS-07, DX-05 | Moyenne | M | P3-01 |
| P3-06 | E-mails et PDF alignés | BR-11 | Basse | S | P3-01, P3-03 |
| P3-07 | Nettoyage `react-bits` (Magnet, ShinyText, SpotlightCard, renommage `Reveal`), `transition-all` | DS-12 | Basse | S | — |

### Phase 4 — Expérience *Luxury & Exclusive*

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P4-01 | Accueil : hero signature, tagline, sections resserrées | DX-01, BR-08 | Haute | M | P1-06, GIT-03 |
| P4-02 | Réservation : refonte **visuelle** (aucune modification de la machine à états, des validations ni de l'API) | DX-04 | Haute | M | P2-02 |
| P4-03 | Fiche véhicule éditoriale | DX-03 | Moyenne | M | P1-05 |
| P4-04 | Catalogue : cartes aérées, prix discret | DX-02 | Moyenne | M | P2-07, GIT-03 |
| P4-05 | Espace client : squelettes, en-tête de marque, à venir/passées | DX-06 | Moyenne | M | P2-03 |
| P4-06 | Espace agence : abonnement aligné, recettes 44 px au tactile | DX-07, MR-06 | Moyenne | M | P2-01 |
| P4-07 | Gabarit de titre sans « Nador », OG par langue avec logo, `sameAs` | BR-08, BR-09, Q-03 | Moyenne | S | P3-03 |
| P4-08 | Kit réseaux sociaux | BR-09 | Moyenne | M | P1-01, P1-02 |
| P4-09 | Admin : alignement des primitives | DX-08 | Basse | M | P2-03 |
| P4-10 | Axe sur parcours connectés et `/ar` | Q-01 | Moyenne | M | Comptes staging |

### Phase 5 — Application mobile Capacitor

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P5-01 | ADR architecture mobile (coque hébergée recommandée) | MR-01 | Critique | S | D6 |
| P5-02 | Initialisation Capacitor (iOS/Android), `server.url`, écran hors ligne | MR-01, MR-09 | Critique | L | P5-01 |
| P5-03 | Icônes et splash depuis le symbole vectoriel | MR-07 | Haute | S | P3-04 |
| P5-04 | OAuth Google natif / navigateur système ; liens universels et App Links | MR-02 | Critique | M | P5-02, config Supabase Auth |
| P5-05 | Couche plateforme : partage, fichiers (XLSX/PDF), liens externes, Retour Android | MR-08, MR-04 | Haute | M | P5-02 |
| P5-06 | Navigation d'app (Réservations en premier niveau) | MR-05 | Moyenne | S | Décision produit |
| P5-07 | Notifications push (conception backend séparée) | MR-12 | Basse | L | P5-02, décision schéma |

### Phase 6 — International

| ID | Tâche | Source | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|
| P6-01 | Formateur monétaire unique `Intl` (ISO `MAD`, EUR…) | DS-10 | Moyenne | M | — |
| P6-02 | i18n des espaces agence et admin | DS-10 | Moyenne | L | P6-01 |
| P6-03 | Architecture multi-villes (pages d'atterrissage, JSON-LD, gabarits) | Q-03, BR-08 | Moyenne | L | Stratégie d'expansion |

---

## 4. Séquence recommandée

```
Phase 0 (préalables, correctifs sûrs) ──┐
Phase 1 (création de marque, hors code) ─┼─► Phase 3 (identité) ─► Phase 4 (expérience) ─► Phase 6 (international)
Phase 2 (design system, rendu identique)─┘                     └─► Phase 5 (Capacitor)
```

1. **Phase 0 et Phase 1 en parallèle** : les correctifs n'attendent pas la marque, la création de marque n'attend pas le code.
2. **Phase 2 avant la Phase 3** : on concentre d'abord les décisions visuelles dans les jetons et les composants partagés ; ensuite, changer l'identité revient à changer des valeurs, et l'opération reste réversible (un commit).
3. **Phase 4** écran par écran, accueil et réservation d'abord (conversion).
4. **Phase 5** démarre dès que P3-03/P3-04 (logo, icônes) et les correctifs P0-07/P0-08 sont livrés ; l'ADR P5-01 peut être rédigé dès maintenant.
5. **Phase 6** quand l'expansion est datée.

Ordre de grandeur (une personne, hors création graphique externe) : Phase 0 ≈ 1–1,5 sem. · Phase 2 ≈ 3–4 sem. · Phase 3 ≈ 1–1,5 sem. · Phase 4 ≈ 3–4 sem. · Phase 5 ≈ 3–5 sem. · Phase 6 ≈ 3–4 sem.

---

## 5. Risques et dépendances

| # | Risque | Probabilité | Impact | Parade |
|---|---|---|---|---|
| R1 | Nouvelle identité refusée après développement (précédent du 17/11 : identité « sable/lagune » annulée) | Moyenne | Élevé | Valider sur maquettes (P1-06) ; Phase 2 sans changement visuel ; jetons = bascule réversible. |
| R2 | Conflit avec `origin/v0/ui-ux-refresh` sur l'accueil et la recherche | Certaine si fusion tardive | Moyen | GIT-03 avant Phase 4. |
| R3 | Perte de travail via la pile de stashes partagée | Faible | Élevé | GIT-01. |
| R4 | Régressions dans les composants géants (Navbar, réservation) | Moyenne | Élevé | Découpage à rendu identique (P2-10), tests existants, captures avant/après. |
| R5 | Modification involontaire de logique protégée (réservation, auth, accès, schéma) | Faible | Critique | Périmètre de diff restreint ; revue systématique : aucune modification sous `packages/shared/`, `lib/bookings/`, `lib/validations/`, `lib/supabase/middleware.ts`, `app/api/`, `backend/supabase/migrations/` dans les lots de marque. |
| R6 | Refus App Store (règle 4.2, coque web) | Moyenne | Élevé | Valeur native (push, liens universels, partage, hors ligne). |
| R7 | OAuth Google bloqué en WebView | Certaine sans adaptation | Élevé | P5-04. |
| R8 | Qualité des photos dépendante des agences | Élevée | Élevé (segment Luxe) | Charte, consignes dans l'espace agence, shooting propriétaire pour les visuels de marque. |
| R9 | Traductions de la tagline et des messages premium | Moyenne | Moyen | Relecture native par langue (surtout AR). |
| R10 | Travaux de marque visibles avant lancement : `docs/remediation-2026-11.md` §1 indique que le dépôt GitHub est **public** | — | Moyen | Garder les sources de marque non publiées hors du dépôt jusqu'au lancement, ou rendre le dépôt privé. |
| R11 | Base de mesure absente (build, Lighthouse, tests non relancés pour cet audit) | Certaine | Moyen | P0-01 avant tout lot. |

**Dépendances externes** : designer/agence pour le logo vectoriel (P1-01), production photo (P1-05), comptes Apple Developer et Google Play (P5), configuration Supabase Auth (redirections, P5-04), relecteurs natifs (P1-04).

---

## 6. Composants à préserver / à améliorer (récapitulatif)

**À préserver** : `globals.css` (architecture de jetons, base accessible, mouvement) · `lib/a11y/useModalDialog.ts` + `agency/shell/Dialog.tsx` · `ui/StatusBadge` + `lib/bookings/status.ts` · `analytics/AnalyticsUI.tsx` · `layout/BottomNav.tsx` · `cars/VehicleCard.tsx` (repli tactile, favoris) · `not-found/NotFoundView` (logique contextuelle) · moteur i18n public (`lib/i18n/*`, `proxy.ts`) · SEO (`sitemap.ts`, `robots.ts`, `lib/seo/*`) · logique de réservation, d'accès et de suivi (intouchable).

**À améliorer** : `ui/Button` (adoption), `ui/Field` (adoption), `shared/Navbar.tsx` (taille, zones sûres, logo), `booking/BookingRequestModal.tsx` (présentation, champs), `auth/UnifiedPortalLogin.tsx` (CSS embarquée), `admin/AdminUI.tsx` et `agency/shell/Feedback.tsx` (doublons), `agency/fleet/VehicleFormModal.tsx` (actions photo), `agency/subscription/AgencySubscriptionPanel.tsx` (bleu hors marque), `shared/BrandMarquee.tsx` (36 hex), `app/HomeClient.tsx` (hero), `app/account/page.tsx` (chargement), `lib/email/templates.ts`, `app/apple-icon.tsx`, `public/manifest.webmanifest`.
