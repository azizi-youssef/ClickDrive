# ClickDrive — Audit et consolidation du design system

_17 novembre 2026 — travail non commité, à relire avant commit._

L'identité ne change pas : graphite `#0B1220`, rouge de marque `#E63946`, rouge d'action `#C92F3B`, canvas `#F5F6F8`, surface blanche, texte secondaire `#667085`, police Plus Jakarta Sans. Le travail a porté sur la cohérence, l'accessibilité et le mouvement, sans refonte des pages.

---

## 1. Audit de l'état initial

### Couleurs : quatre sources de vérité concurrentes

| Source | Contenu | Usage réel |
|---|---|---|
| `@theme` de `globals.css` | jetons sémantiques (`ink`, `action`, `line`…) | ~500 classes |
| `:root` de `globals.css` | `--primary`, `--accent`, `--success: #16A34A`… | **0 usage hors du fichier**, et des valeurs en conflit avec `@theme` (`--success #16A34A` contre `--color-success #067647`, `--error #DC2626` contre `--color-danger #B42318`) |
| Valeurs en dur dans les composants | `text-[#0B1220]`, `bg-[#E63946]`, `text-[#0F172A]`… | **1 022 classes** dans ~100 fichiers |
| `src/lib/design/tokens.ts` | objet `BRAND` + recettes de classes en hexadécimal | `BRAND` inutilisé ; recettes utilisées dans 31 fichiers de l'espace agence |

À cela s'ajoutait une **deuxième échelle de gris** : les jetons suivaient les gris de la marque (`#667085`, `#E4E7EC`, `#D0D5DD`), alors que les composants utilisaient le `slate` de Tailwind (2 750 classes). Résultat : `border-line` (`#E4E7EC`) et `border-slate-200` (`#E2E8F0`) se côtoyaient.

### CSS global

- Environ 40 % de `globals.css` était du code mort : `.btn-accent`, `.btn-ghost`, `.card`, `.card-hover`, `.glass-*`, `.gradient-text-*`, `.card-glow`, `.stat-number`, `.live-dot`, `.scroll-indicator`, `.section-clip-*`, `.bg-*-grid`, `.accent-line`, `.display-xl/lg`, `.eyebrow`, cinq utilitaires d'animation et leurs images clés.
- **Toutes les règles étaient hors couche CSS.** Avec Tailwind v4, une règle hors couche l'emporte sur tous les utilitaires. Conséquences :
  - `:focus-visible { outline: … }` écrasait les 182 `outline-none` : chaque élément qui dessinait son propre anneau (`ring`) affichait **deux indicateurs de focus** à la fois ;
  - `.badge` imposait 11 px même avec `text-xs`.
- `will-change: transform` permanent sur `.image-zoom` et `.image-zoom-subtle`.
- `prefers-reduced-motion` n'était respecté qu'au cas par cas (révélations, squelettes).
- Correctif RTL `.is-rtl .hover\:translate-x-0\.5:hover` hérité de Tailwind v3 : il ne ciblait aucun élément (le code utilise `group-hover:`).
- `[dir=rtl] { text-align: right }` imposait l'alignement à droite même aux îlots `dir="ltr"`.

### Typographie

Pas d'échelle : les `h1` publics allaient de `text-[26px]…lg:text-[44px]` à `text-[28px]…lg:text-[56px]`, avec `font-black` (900) alors que la police n'existe que de 200 à 800. Les titres de cartes différaient (17 px pour la carte véhicule, 18 px pour la carte agence).

### Composants

- `ui/Button` et `ui/Field` existaient mais **n'étaient importés nulle part** ; l'espace agence utilisait ses propres recettes (`tokens.ts`) avec d'autres ombres et d'autres anneaux de focus (graphite pour le bouton principal, rouge pour le secondaire, aucun pour ghost et danger).
- Deux `EmptyState` (agence, admin) et deux squelettes (`.skeleton` à reflet côté public, `animate-pulse` côté agence) de styles différents.
- Cartes véhicule et agence : ombres, soulèvement (2 px contre 4 px) et zoom d'image différents. La carte véhicule animait `transform` alors que Tailwind v4 soulève avec la propriété `translate` : **le soulèvement sautait au lieu de glisser**.
- Page de connexion : une troisième palette en variables `--cd-*` dans une balise `<style>`.

### Accessibilité (WCAG 2.2 AA)

| Constat | Ratio | Seuil |
|---|---|---|
| Texte blanc sur `#E63946` (boutons « Postuler », « Contacter », pagination, compteurs) | 4,17:1 | 4,5:1 |
| `text-slate-400` sur fond clair (libellés, légendes, compteurs) | 2,56:1 | 4,5:1 |
| `text-slate-500` (`#64748B`) sur canvas | 4,40:1 | 4,5:1 |
| `text-emerald-600` / `text-amber-600` sur blanc (montants, statuts) | 3,77 / 3,19:1 | 4,5:1 |
| Texte indicatif des champs `slate-400` | 2,58:1 | 4,5:1 |
| Mode contraste élevé (Windows) : les anneaux en `box-shadow` disparaissent, et 182 `outline-none` suppriment le contour | aucun focus visible | 2.4.7 |

Points déjà solides : cibles tactiles de 44 px (`.tap-44`, boutons d'icône), champs à 16 px sur mobile (pas de zoom iOS), navigation inférieure réservée sans décalage de mise en page, statuts doublés d'un texte (jamais la couleur seule), `motion-reduce:` sur la plupart des transitions, flèches pivotées en RTL.

---

## 2. Changements (avant → après)

### Jetons : une seule source

`src/app/globals.css` est la source unique :

1. **Palette neutre de la marque** (`@theme static`) : l'échelle `slate` de Tailwind est remplacée par les gris ClickDrive (`slate-500 = #667085`, `slate-200 = #E4E7EC`…). Les 2 750 classes `slate-*` suivent la marque sans être réécrites. Écart visuel : ΔE2000 ≤ 2,6 (à peine perceptible). Effet de bord utile : le texte secondaire passe de 4,40 à 4,60:1 sur canvas.
2. **Jetons sémantiques** (`@theme static`, donc toujours émis en variables CSS) : `ink`, `ink-hover`, `brand`, `brand-soft`, `brand-line`, `action`, `action-hover`, `accent-text`, `accent-on-dark`, `focus`, `ink-secondary`, `ink-tertiary`, `disabled`, `canvas`, `surface`, `line`, `line-strong`, `neutral-soft` et les quatre états (`success`, `warning`, `danger`, `info`, chacun en `-soft` et `-line`). Les gris sémantiques pointent vers la palette (`--color-line: var(--color-slate-200)`).
3. Variables `:root` en double supprimées (aucun consommateur).
4. **Codemod** : 975 couleurs en dur remplacées dans 98 fichiers (`text-[#0B1220]` → `text-ink`, `bg-[#E63946]` → `bg-brand`, `text-[#64748B]` → `text-ink-secondary`, teintes rouges `#FFF4F5/#FFF6F7/#FFF1F2` → `brand-soft`…). Les correspondances sont exactes, sauf `#0F172A` → `ink` (ΔE 3,3, déjà exigé par le test des titres de l'espace agence) et `#64748B` → `ink-secondary` (ΔE 2,6).
5. `tokens.ts` : `BRAND` supprimé (inutilisé, en conflit) ; recettes réécrites avec les jetons ; ajout d'un `focusRing` commun.
6. Connexion : les variables `--cd-*` deviennent des alias (`--cd-graphite: var(--color-ink)`…).

Bilan : 1 022 → 47 couleurs en dur ; ~500 → 1 435 classes de jetons.

### Typographie

Échelle fluide (rem + vw, elle suit le zoom) dans `@theme` ; chaque utilitaire porte taille, interlignage, approche et graisse :

| Utilitaire | Taille | Rôle |
|---|---|---|
| `text-display` | 32 → 56 px | accroche du hero |
| `text-h1` | 28 → 44 px | titre de page |
| `text-h2` | 24 → 36 px | titre de section |
| `text-h3` | 20 → 24 px | sous-section |
| `text-title` | 17 px / 800 | titre de carte |
| `text-body-lg` | 17 px | chapô |
| `text-body` | 15 px | texte courant |
| `text-support` | 14 px | texte d'appui |
| `text-label` | 13 px / 600 | libellé de champ |
| `text-meta` | 12 px | métadonnées |
| `text-overline` | 11 px / 700, +0,14 em | surtitre (avec `uppercase`) |

Déjà appliquée aux titres des cartes véhicule et agence, au surtitre de section, aux pastilles, à `Field` et aux états vides. **Les titres de pages n'ont pas été migrés** (voir § 4).

### Ombres, courbes, animations

`shadow-card`, `shadow-card-hover`, `shadow-raised`, `shadow-overlay`, `shadow-action`, `shadow-nav` ; `ease-standard`, `ease-sheet` ; `animate-cd-dropdown`, `animate-cd-fade-in` deviennent de vrais utilitaires Tailwind (variantes `motion-safe:` possibles).

### Architecture CSS

- `@layer base` : `body`, sélection, **focus par défaut**, barre de défilement, fil d'Ariane. Un composant qui dessine son propre indicateur n'en affiche plus deux.
- `@layer components` : `.btn-primary`, `.badge`, `.badge-accent`, `.section-header-eyebrow`, `.image-zoom-subtle`, `.skeleton`, `.tap-44`, `.cd-reveal*`. Les utilitaires restent prioritaires (`text-xs` sur `.badge` s'applique désormais).
- `@utility no-scrollbar`.
- Hors couche, volontairement : champs à 16 px sur mobile, téléphone et e-mail en LTR dans une page RTL, hauteur réservée de la navigation inférieure, contraste élevé, mouvement réduit.
- Code mort supprimé (liste au § 1) ; `globals.css` passe de 918 à 475 lignes (commentaires compris).

### Composants

| Composant | Avant | Après |
|---|---|---|
| `ui/Button` | anneau graphite + `outline-none`, ombre en dur | contour `outline-focus` (visible en contraste élevé), `shadow-action` |
| `tokens.ts` `button.*` | 3 styles de focus différents, ombre `rgba(230,57,70,.8)` | un seul `focusRing` pour les 4 variantes, `shadow-action`, `danger` sur les jetons d'état |
| `ui/Field`, `tokens.ts` `input` | texte indicatif 2,58:1 | `slate-500` (4,97:1), `text-label` / `text-body` |
| `ui/Badge` | `#344054`, `#FECDCA`, `#FFF1F2` | `slate-700`, `brand-line`, `brand-soft` |
| `ui/Pagination` | page active blanc sur `#E63946` | `bg-action` + `shadow-action` |
| **nouveau** `ui/Skeleton` | — | squelette unique (reflet, figé si mouvement réduit) ; l'espace agence le réutilise |
| **nouveau** `ui/EmptyState` | 2 versions | une version ; l'agence garde un `<p>`, l'admin garde son `<h3>` (`titleAs`) |
| `VehicleCard` / `AgencyCard` | ombres et survols différents ; transition sur `transform` | même comportement : `shadow-card` → `shadow-card-hover`, soulèvement de 2 px **animé** (`translate`), zoom photo 1,03, titre `text-title` |
| `SearchBar` | focus `ring-ink/10` presque invisible | bordure graphite + halo, comme `Field` |
| CTA de l'en-tête | aimant + soulèvement au survol (double mouvement) | aimant conservé (désactivé au tactile et en mouvement réduit), soulèvement retiré, `transition-all` remplacé |

### Mouvement

- Règle globale `prefers-reduced-motion` : animations et transitions instantanées (0,01 ms, les événements de fin restent émis), défilement doux désactivé.
- `will-change` permanents supprimés.

### Accessibilité

- Texte blanc sur rouge : `bg-brand` → `bg-action` sur 6 éléments (boutons de la page partenaires et de la fiche agence, pagination, compteurs).
- `text-slate-400` → `text-slate-500` sur 27 textes (et un compteur en `slate-600`) posés sur fond clair (récapitulatif de réservation, compte, réglages admin, sélecteur de langue, étapes de la demande…). Les textes sur fond graphite n'ont pas été touchés : `slate-400` y fait 7,3:1.
- Statuts verts et ambre : `emerald-600` → `emerald-700`, `amber-600` → `amber-700` sur 10 textes ; pastille « étape terminée » `bg-emerald-700`.
- Contraste élevé : contour système `Highlight` sur tout élément qui a le focus clavier.
- 3 contrôles qui ne devaient leur focus qu'à l'ancienne règle globale ont maintenant le leur (recherche d'agences, sélecteur de véhicule du calendrier, barre de recherche).

### RTL

- Correctif v3 inopérant et `text-align: right` supprimés ; classe `.is-rtl` retirée (le `dir` de `<html>` suffit).
- 7 flèches pivotaient mais glissaient vers la droite au survol : ajout de `rtl:group-hover:-translate-x-*`.

---

## 3. Validation

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | ✅ aucune erreur |
| `npm run lint` | ✅ 0 erreur ; aucun avertissement nouveau dans les 107 fichiers touchés (les 1 182 avertissements existants, surtout `no-explicit-any`, sont antérieurs) |
| `npm run test:unit` | ⚠️ 1 168 / 1 170 au premier passage. `TrackingDashboard.spec.tsx` cherchait `.animate-pulse` : sélecteur mis à jour vers `.skeleton` (squelette unifié), 250/250 au second passage sur agence/admin/ui. **`lot2.spec.ts` (fenêtre horaire du Maroc) échoue sans lien avec ce travail** (`src/lib/bookings` non modifié, test sensible au fuseau horaire). |
| `npm run build` | ✅ |
| Génération Tailwind v4 | ✅ variables présentes dans le CSS compilé (`--color-ink`, `--color-slate-500: #667085`, `--color-focus`, `--text-title`, `--ease-standard`…), utilitaires générés (`text-title`, `shadow-action`, `bg-brand-soft`, `focus-visible:outline-focus`…), focus dans `@layer base`, règles `forced-colors` et `prefers-reduced-motion` émises. `text-display` et `text-h1/h2/h3` ne sont émis qu'à leur premier usage (comportement normal de Tailwind v4). |
| Navigateur (build de production) | ✅ accueil, catalogue, agences, connexion : rendu identique à l'identité d'origine. Focus clavier : un seul anneau sur les cartes, contour rouge sur le bouton favori (44 × 44 px). Mobile 375 px : aucun défilement horizontal, navigation inférieure 92 × 64 px, champs à 16 px. Arabe : `dir="rtl"`, flèche pivotée qui glisse vers la gauche au survol, tiroir depuis la gauche. |

Non vérifié : espaces agence et admin dans le navigateur (connexion requise ; couverts par les tests unitaires), mode contraste élevé réel de Windows, préférence « réduire les animations » réelle (règles vérifiées dans le CSS compilé).

---

## 4. Problèmes restants et suites conseillées

1. **Titres de pages** : l'échelle `text-display/h1/h2/h3` existe mais les pages gardent leurs tailles propres. Migrer page par page, avec capture avant/après (le hero d'accueil passerait de 28 à 32 px sur mobile).
2. **239 `text-slate-400`** restants : la majorité sont des pictogrammes ou des textes sur fond graphite (conformes), mais les écrans agence et admin n'ont pas été passés un à un.
3. **47 couleurs en dur** volontairement laissées : carrousel des marques (`#17191D`, `#4E5562`, `#69707D`, palette propre et contrastes documentés), superpositions du hero (`#05080D`), **bleu `#02306B` de l'abonnement agence (hors identité, à trancher)**, quelques gris isolés.
4. **41 `animate-pulse`** dans des squelettes écrits à la main (accueil, admin…) : à remplacer par `ui/Skeleton`. `StyleExplorer.spec.tsx` vérifie encore `.animate-pulse`.
5. **Bordures de champs** `#D0D5DD` sur blanc : 1,47:1. Le critère 1.4.11 (3:1) est discuté pour les champs déjà identifiés par un libellé ; un gris `#8D96A7` le satisferait, au prix d'un changement visible.
6. `ui/Button` et `ui/Field` restent peu adoptés : l'espace agence utilise `tokens.ts` (aligné), les pages publiques écrivent leurs boutons à la main.
7. Effet « aimant » sur 4 CTA : sans danger (désactivé au tactile et en mouvement réduit), mais décoratif ; à supprimer si l'on veut un rendu plus sobre.
8. 31 `transition-all` : à remplacer par des propriétés explicites au fil des modifications.
9. `ShinyText` et `SpotlightCard` (`ui/react-bits`) ne sont plus utilisés.

---

## 5. Fichiers modifiés

- **Fondations** : `frontend/src/app/globals.css`, `frontend/src/lib/design/tokens.ts`, `frontend/src/app/layout.tsx`.
- **Nouveaux** : `frontend/src/components/ui/Skeleton.tsx`, `frontend/src/components/ui/EmptyState.tsx`.
- **Design system** : `ui/Button.tsx`, `ui/Badge.tsx`, `ui/Field.tsx`, `ui/Pagination.tsx`, `agency/shell/Feedback.tsx`, `admin/AdminUI.tsx`.
- **Composants ajustés à la main** : `cars/VehicleCard.tsx`, `agencies/AgencyCard.tsx`, `search/SearchBar.tsx`, `shared/Navbar.tsx`, `auth/UnifiedPortalLogin.tsx`, `home/StyleExplorer.tsx`, `booking/BookingRequestModal.tsx`, `shared/LanguageSelector.tsx`, `agency/calendar/AgencyCalendarPanel.tsx`, `app/agencies/AgenciesClient.tsx`, `app/agencies/[slug]/AgencyProfile.tsx`, `app/agency/join/page.tsx`, `app/HomeClient.tsx`, `app/about/page.tsx`, `app/account/page.tsx`, `app/account/bookings/[reference]/page.tsx`, `app/admin/settings/page.tsx`, `app/admin/settings/commission/page.tsx`, `admin/AdminShell.tsx`, ainsi que les couleurs de statut de 8 écrans admin/agence.
- **Test** : `agency/tracking/TrackingDashboard.spec.tsx` (sélecteur du squelette).
- **Codemod seul** (couleurs en dur → jetons, rendu identique) : le reste des 107 fichiers ; `git diff --stat` en donne la liste.

Aucune logique métier, aucune route, aucune dépendance n'a été modifiée ou ajoutée.
