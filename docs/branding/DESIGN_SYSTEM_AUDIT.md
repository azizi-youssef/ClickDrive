# ClickDrive — Audit du design system (Tâche 01 · B)

> **Date** : 24 novembre 2026 · **Référence** : `main` @ `1ca24b9`
> **Méthode** : lecture de `frontend/src/app/globals.css`, `src/lib/design/*`, `src/components/ui/*`, des kits agence/admin/analytics ; comptages `grep` sur `frontend/src/**/*.{ts,tsx}` hors tests. Les chiffres ci-dessous sont des **mesures du 24/11**, pas ceux des rapports précédents.
> Rapports antérieurs relus et vérifiés : `docs/design-system-audit.md` (17/11), `docs/motion-design-audit.md`, `docs/audit-ui-ux.md`.

---

## 1. Synthèse chiffrée

| Indicateur | Mesure | Lecture |
|---|---|---|
| Stack | Tailwind CSS **v4** (`@import "tailwindcss"`, `@theme`), pas de `tailwind.config.*` | Configuration 100 % CSS |
| Jetons sémantiques | 30 couleurs, 11 tailles de texte, 6 ombres, 6 durées, 3 courbes | Base solide |
| Couleurs hexadécimales dans le code | **172** (+ 48 classes `[#…]`) | Hors jetons |
| Classes de palette Tailwind brutes (`emerald-*`, `red-*`, `amber-*`, `blue-*`…) | **995** (emerald 324, red 298, amber 218, blue 125) | Contournent `success/danger/warning/info` |
| `text-slate-400` | 239 | Gris 2,58:1, à réserver aux icônes |
| Tailles arbitraires `text-[Npx]` | **340** | Échelle typographique ignorée |
| Usage de `text-display/h1/h2/h3` | **0** | Échelle définie mais inutilisée |
| `<Button>` du design system | **0 usage** (`ButtonLink` : 0) | Composant mort |
| `<button>` écrits à la main | 321 | — |
| `Input/Select/Textarea` de `ui/Field` | **1 usage** vs 155 `<input>`, 52 `<select>`, 13 `<textarea>` bruts | — |
| Implémentations locales de `Field` | 5 | Doublons |
| Thème sombre | Absent (`colorScheme: 'light'`, 0 variante `dark:`) | — |
| RTL | 6 langues, `dir` serveur ; 67 marges physiques vs 71 logiques | Mixte |

**Lecture** : les **fondations** (jetons, focus, mouvement, contrastes) sont de bonne qualité. L'**adoption** est faible : les composants partagés existent mais les écrans continuent d'écrire leurs propres boutons, champs, cartes et couleurs. Changer de direction de marque aujourd'hui toucherait des centaines de fichiers au lieu d'un seul.

---

## 2. Inventaire

### 2.1 Fondations (`src/app/globals.css`)

| Couche | Contenu | Qualité |
|---|---|---|
| §1 Neutres | Échelle `slate` remappée sur les gris de marque (#F9FAFB → #0C111D) | ✅ astucieux, mais lie « slate » à la marque |
| §2 Sémantique | `ink`, `brand`, `action`, `accent-text`, `accent-on-dark`, `focus`, `canvas`, `surface`, `line`, états `success/warning/danger/info` (+ `-soft`, `-line`) | ✅ nommage par rôle |
| §3 Texte/ombres | `text-display…text-overline` fluides, `shadow-card…shadow-nav` | ✅ défini, ⚠️ peu adopté |
| §4 Mouvement | Durées 120→650 ms, `ease-standard/sheet/exit`, `--motion-*`, miroir JS `lib/design/motion.ts` | ✅ |
| Base | Focus global 2 px, sélection, fil d'Ariane ≥ 24 px, tiroir RTL | ✅ |
| Composants CSS | `.btn-primary` (2 usages), `.badge`, `.section-header-eyebrow`, `.skeleton`, `.tap-44`, `.cd-reveal` | ⚠️ `.btn-primary` = 4ᵉ système de bouton |
| Accessibilité | `prefers-reduced-motion`, `forced-colors`, champs 16 px sur mobile | ✅ remarquable |

### 2.2 Composants partagés

| Composant | Fichier | Adoption mesurée | Verdict |
|---|---|---|---|
| `Button`, `ButtonLink`, `buttonClasses` | `components/ui/Button.tsx` | **0** hors du fichier | À imposer |
| `Input`, `Select`, `Textarea`, `Field` | `components/ui/Field.tsx` | `Field` 1 fichier ; contrôles 1 usage | À imposer |
| `Badge` | `components/ui/Badge.tsx` | 3 | Correct, sous-utilisé |
| `StatusBadge` (réservations) | `components/ui/StatusBadge.tsx` | 15 | ✅ à préserver |
| `Skeleton` | `components/ui/Skeleton.tsx` | 22 (+ 40 `animate-pulse` manuels) | Partiel |
| `EmptyState` | `ui/EmptyState` (2 imports), `agency/shell/Feedback` (9), `admin/AdminUI` (2) | 3 implémentations | À fusionner |
| `Pagination` | `ui/Pagination.tsx` (2), `admin/AdminUI.tsx:415` | 2 implémentations | À fusionner |
| Dialogue modal | `lib/a11y/useModalDialog.ts` (16 fichiers), `agency/shell/Dialog.tsx` (12) | ✅ focus, Échap, inert, retour du focus | **À préserver** |
| Recettes agence | `lib/design/tokens.ts` (`button.*` 38 usages, `input`, `heading`, `shell`) | 32 fichiers | Kit parallèle aligné |
| Kit admin | `components/admin/AdminUI.tsx` (`Btn` 38 usages, `KpiCard`, `StatusBadge`, `EmptyState`, `Pagination`, `Th/Td`…) | 20 fichiers | Kit parallèle |
| Kit statistiques | `components/analytics/AnalyticsUI.tsx` (`ChartCard`, `StatTile`, `DataTable`…) | agence + admin | ✅ graphiques accessibles (tables) |
| `react-bits` | `GsapReveal` (CSS pur malgré le nom), `Magnet` (4), `ShinyText` (0), `SpotlightCard` (0) | — | Nettoyer |

---

## 3. Constats

### DS-01 — Quatre systèmes de boutons, le composant officiel jamais utilisé

| Champ | Détail |
|---|---|
| **État actuel** | `ui/Button` : 0 usage. `tokens.ts → button.primary/secondary/ghost/danger` : 38 usages (agence). `AdminUI → <Btn>` : 38 usages (admin). `.btn-primary` : 2 usages (`HomeClient.tsx:426`, `:470`). Plus 93 classes `bg-action` et 160 `bg-ink` posées à la main sur des `<button>`/`<Link>` publics (321 `<button>` au total). |
| **Problème** | Hauteurs, rayons, graisses et états `disabled/loading` divergent d'un espace à l'autre ; aucune garantie de 44 px tactiles hors `ui/Button` (`min-h-11`). |
| **Impact** | Toute évolution de marque des CTA (couleur, forme, typo) = des centaines d'éditions ; incohérences visibles entre site, espace agence et admin. |
| **Recommandation** | Faire de `ui/Button` + `ButtonLink` la seule API ; réécrire `tokens.button` et `AdminUI.Btn` comme **alias** de `buttonClasses()` (aucun changement visuel), puis migrer les écrans publics par lots avec capture avant/après. Ajouter une règle ESLint/test qui signale `bg-action` hors `ui/`. |
| **Priorité** | **Critique** (prérequis de la refonte) |
| **Complexité** | M (alias) + L (migration) |
| **Dépendances** | Aucune pour les alias ; tests visuels (Playwright) recommandés. |

### DS-02 — Couleurs hors jetons : 172 hex + 995 classes de palette brutes

| Champ | Détail |
|---|---|
| **État actuel** | Points chauds hex : `shared/BrandMarquee.tsx` 36, `auth/UnifiedPortalLogin.tsx` 23, `lib/email/templates.ts` 14, `agency/tracking/TrackingMap.tsx` 13, `not-found/NotFoundView.tsx` 9, `agency/subscription/AgencySubscriptionPanel.tsx` 7 (bleu `#02306B` hors identité). Palette Tailwind brute : `emerald-*` 324, `red-*` 298, `amber-*` 218, `blue-*` 125 — ces rouges/verts Tailwind ne sont **pas** ceux des jetons (`danger #B42318`, `success #067647`). |
| **Problème** | Le rapport du 17/11 a converti les hex, pas les classes de palette : la « source unique » n'est vraie que pour une partie du code. |
| **Impact** | Une nouvelle palette ne s'appliquera qu'à moitié ; plusieurs rouges et verts coexistent à l'écran. |
| **Recommandation** | Codemod `red-* → danger/brand`, `emerald-* → success`, `amber-* → warning`, `blue-* → info` selon le rôle (revue manuelle des cas décoratifs) ; trancher le bleu d'abonnement ; ajouter un test qui échoue au-delà d'un seuil décroissant. |
| **Priorité** | Haute |
| **Complexité** | L |
| **Dépendances** | BR-06 (palette cible) — faire le codemod **avant** de changer les valeurs. |

### DS-03 — Champs de formulaire : 5 `Field` locaux, contrôles bruts

| Champ | Détail |
|---|---|
| **État actuel** | `function Field` redéfini dans `contact/ContactClient.tsx:450`, `agency/settings/AgencySettingsPanel.tsx:320`, `agency/tracking/ui.tsx:60`, `booking/BookingRequestModal.tsx:130`, en plus de `ui/Field.tsx:71`. La modale de réservation a sa propre classe de champ (`BookingRequestModal.tsx:128`, hauteur 48 px, `placeholder:text-slate-400` = 2,58:1). Recette agence `tokens.input` (40 px). |
| **Problème** | Trois hauteurs (40/44/48 px), deux couleurs d'indication, états d'erreur différents. |
| **Impact** | Le formulaire le plus important (demande de réservation) n'utilise pas le design system ; incohérence perçue entre étapes du parcours. |
| **Recommandation** | Étendre `ui/Field` (tailles `md/lg`, slot d'aide, compteur), puis migrer réservation → contact → agence. **Ne pas toucher à la logique de validation** (`lib/validations/*`). |
| **Priorité** | Haute |
| **Complexité** | M |
| **Dépendances** | DS-01. |

### DS-04 — Échelle typographique définie mais ignorée

| Champ | Détail |
|---|---|
| **État actuel** | `text-display/h1/h2/h3` : 0 usage. 340 `text-[Npx]` (Navbar 28, BookingRequestModal 23, SearchClient 21, about 17, détail réservation 16, fiche véhicule 14…). Titres d'accueil : `text-3xl font-black … sm:text-4xl` ; hero : `text-[28px] … lg:text-[56px]` (`HomeClient.tsx:203`). Agence : `tokens.heading.page` (`text-2xl … sm:text-[32px]`). |
| **Problème** | Hiérarchie recalculée écran par écran. |
| **Impact** | Impossible d'introduire une typographie display premium de façon homogène. |
| **Recommandation** | Composant `Heading` (niveau sémantique ≠ style) branché sur l'échelle ; migration page par page. |
| **Priorité** | Haute |
| **Complexité** | M |
| **Dépendances** | BR-07. |

### DS-05 — Système de cartes non formalisé

| Champ | Détail |
|---|---|
| **État actuel** | ≥ 12 recettes de surface (`rounded-2xl border border-slate-200 bg-white` ×59, `rounded-xl border border-slate-200` ×54, `rounded-xl … border-slate-300` ×42, `rounded-3xl …` ×14…). Ombres : jeton `shadow-card` 17 usages vs `shadow-xs` 86, `shadow-sm` 63, `shadow-2xl` 20, 36 ombres arbitraires. Rayons : `rounded-xl` 502, `rounded-full` 257, `rounded-2xl` 216, `rounded-lg` 200, `rounded-3xl` 40. Cartes métier riches et testées : `cars/VehicleCard.tsx` (660 lignes), `agencies/AgencyCard.tsx`, `booking/BookingCard.tsx`. |
| **Problème** | Pas de primitive `Card` (surface, padding, élévation, état interactif). |
| **Impact** | Rendu « patchwork » ; le luxe repose justement sur la constance des surfaces. |
| **Recommandation** | Primitive `Surface/Card` (variantes `flat`, `raised`, `interactive`, `inverse`) + 3 rayons officiels ; garder les cartes métier, les faire reposer sur la primitive. |
| **Priorité** | Moyenne |
| **Complexité** | M |
| **Dépendances** | BR-06. |

### DS-06 — Trois kits parallèles (public / agence / admin) et doublons

| Champ | Détail |
|---|---|
| **État actuel** | `EmptyState` ×3, `Pagination` ×2, `StatusBadge` ×2 (`ui/StatusBadge.tsx` et `AdminUI.tsx:158`), `ErrorBanner` ×2 (`Feedback.tsx:69`, `AdminUI.tsx:350`), squelettes ×4 (`ui/Skeleton`, `Feedback.CardSkeleton/TableSkeleton/KpiSkeleton`, `AdminUI.TableSkeletonRows`, `AnalyticsSkeleton`) + 40 `animate-pulse` manuels. |
| **Problème** | Même besoin, trois réponses. |
| **Impact** | Coût de maintenance ; la refonte devra être faite trois fois. |
| **Recommandation** | Remonter dans `components/ui/` : `EmptyState`, `ErrorBanner/Alert`, `Pagination`, `Skeleton*`, `Table` ; les kits agence/admin ré-exportent. |
| **Priorité** | Moyenne |
| **Complexité** | M |
| **Dépendances** | DS-01. |

### DS-07 — Feuilles de style embarquées hors système

| Champ | Détail |
|---|---|
| **État actuel** | `UnifiedPortalLogin.tsx:113+` injecte une chaîne CSS (`loginStyles`) avec ses propres variables `--cd-*` (dont `--cd-muted: #5B6474` hors jeton) et ~20 couleurs fixes. `NotFoundView.tsx` : SVG en hex, `text-[#FF8A93]`, `hover:bg-[#1B2433]`. |
| **Problème** | Deux écrans visibles (connexion, 404) échappent aux jetons. |
| **Impact** | Ils resteront à l'ancienne identité après la migration. |
| **Recommandation** | Réécrire en utilitaires Tailwind/jetons, ou conserver la CSS mais 100 % `var(--color-*)`. |
| **Priorité** | Moyenne |
| **Complexité** | M |
| **Dépendances** | BR-06. |

### DS-08 — Pas de thème sombre (ni de jetons pour le préparer)

| Champ | Détail |
|---|---|
| **État actuel** | `layout.tsx:36` `colorScheme: 'light'` ; aucun `@media (prefers-color-scheme: dark)` ; aucune variante `dark:`. Surfaces sombres ponctuelles codées en dur (hero, pied de page `bg-ink`, barres latérales). |
| **Problème** | Les surfaces « inverses » ne sont pas un rôle de jeton (`surface-inverse`, `text-on-inverse`…). |
| **Impact** | Une identité luxe s'exprime souvent sur fond sombre ; une app mobile est attendue en mode sombre système. |
| **Recommandation** | D'abord des jetons d'**inversion** (sections sombres cohérentes), puis, si validé, un thème sombre complet piloté par `data-theme`. |
| **Priorité** | Moyenne |
| **Complexité** | M (inverse) / XL (thème complet) |
| **Dépendances** | BR-06, DS-02. |

### DS-09 — RTL partiellement logique, typographie non adaptée à l'arabe

| Champ | Détail |
|---|---|
| **État actuel** | Bon socle : `dir` posé côté serveur (`layout.tsx`), tiroir inversé (`globals.css:278`), `tap-44` symétrique, champs tél./e-mail en LTR. Mais : marges/paddings physiques `ml/mr/pl/pr-*` 67 (vs 71 logiques), positions `left/right-*` 66 (vs 66 `start/end`), `text-left/right` 69 (vs 29 `text-start/end`), 79 variantes `rtl:` et **58 branches JS `isRTL`** pour inverser à la main. Exemple : `HomeClient.tsx:258` `lg:pl-6` avec `divide-x` → séparateurs et retraits du mauvais côté en arabe. 163 `tracking-*` et 122 `uppercase` appliqués aussi en arabe (l'espacement de lettres casse la liaison des caractères arabes). Aucune police arabe (BR-07). |
| **Problème** | L'inversion dépend de la vigilance de chaque développeur. |
| **Impact** | Défauts visuels en arabe, langue prioritaire au Maroc ; pire pour une marque premium. |
| **Recommandation** | Codemod vers propriétés logiques (`ps/pe/ms/me/start/end/text-start`) ; règle CSS `:lang(ar) { letter-spacing: 0 }` et neutralisation de `uppercase` ; police arabe dédiée ; test e2e RTL avec capture. |
| **Priorité** | Haute |
| **Complexité** | M |
| **Dépendances** | BR-07 (police arabe). |

### DS-10 — Multilingue : espaces B2B et monnaie figés

| Champ | Détail |
|---|---|
| **État actuel** | Site public : 6 langues (fr, ar, en, de, es, nl), slugs traduits, `hreflang` — **de très bon niveau**. Espaces agence (43 composants) et admin (39) : **0** appel à `useTranslation`, libellés français en dur (`agency/shell/Sidebar.tsx:61-73`, `admin/AdminShell.tsx:45-72`). Devise « DH » en dur 133 fois ; trois formateurs monétaires (`lib/analytics/insights.ts:33`, `lib/i18n/format.ts:32` avec `currency = 'DH'`, `lib/utils.ts:31`). |
| **Problème** | B2B mono-langue, mono-devise. |
| **Impact** | Bloque l'expansion internationale (agences étrangères, EUR) ; acceptable pour le Maroc francophone à court terme. |
| **Recommandation** | Un seul formateur `Intl.NumberFormat` (code ISO `MAD`, affichage « DH » localisé) ; extraction des libellés B2B dans `lib/i18n/messages` quand l'international est planifié. |
| **Priorité** | Moyenne (Haute avant l'ouverture internationale) |
| **Complexité** | M (monnaie) / L (B2B i18n) |
| **Dépendances** | Stratégie d'expansion ; aucune dépendance base de données. |

### DS-11 — Responsive : bons motifs, unités de hauteur héritées

| Champ | Détail |
|---|---|
| **État actuel** | Points de rupture Tailwind standard, conteneur `max-w-7xl` récurrent, champs 16 px sur mobile (`globals.css:554`), barre inférieure réservée sans CLS (`globals.css:564`). `h-screen`/`100vh` : 32 occurrences contre 10 `dvh/svh`. |
| **Problème** | `100vh` est faux sur mobile (barres du navigateur, clavier) et dans une WebView. |
| **Impact** | Contenus coupés ou boutons sous la barre d'outils. |
| **Recommandation** | Remplacer par `min-h-dvh`/`svh` (avec repli). |
| **Priorité** | Moyenne |
| **Complexité** | S |
| **Dépendances** | — |

### DS-12 — Restes décoratifs et transitions globales

| Champ | Détail |
|---|---|
| **État actuel** | `react-bits/ShinyText` et `SpotlightCard` non utilisés ; `Magnet` (effet aimant) sur 4 CTA ; `GsapReveal` porte un nom trompeur (CSS pur) ; 20 `transition-all`. |
| **Problème** | Effets « gadget » et nommage hérité. |
| **Impact** | Faible ; l'effet aimant contredit la sobriété premium. |
| **Recommandation** | Supprimer `ShinyText`/`SpotlightCard`, retirer `Magnet`, renommer `GsapReveal` → `Reveal`, expliciter les transitions. |
| **Priorité** | Basse |
| **Complexité** | S |
| **Dépendances** | — |

---

## 4. À préserver

1. `globals.css` : structure en couches, jetons sémantiques, commentaires de contraste.
2. Accessibilité de base : focus global, `forced-colors`, `prefers-reduced-motion`, `.tap-44`, champs 16 px.
3. `lib/a11y/useModalDialog.ts` + `agency/shell/Dialog.tsx` (testés).
4. `ui/StatusBadge` + `lib/bookings/status.ts` (15 statuts, 5 langues, frise).
5. `analytics/AnalyticsUI.tsx` (graphiques doublés de tableaux accessibles).
6. Jetons de mouvement + `lib/design/motion.ts`.
7. Moteur i18n public (slugs traduits, `dir` serveur, `hreflang`).

## 5. Ordre de travail conseillé (design system)

1. **Geler l'API** : `Button`, `Field`, `Badge`, `Card`, `Heading`, `EmptyState`, `Skeleton` dans `components/ui/` ; alias depuis les kits agence/admin (rendu inchangé).
2. **Codemods sans changement visuel** : palette brute → jetons (DS-02), propriétés physiques → logiques (DS-09), tailles arbitraires → échelle (DS-04).
3. **Seulement ensuite** : nouvelles valeurs de jetons (palette, polices) de la direction *Luxury & Exclusive*.
