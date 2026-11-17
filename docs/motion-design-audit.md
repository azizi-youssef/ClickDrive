# ClickDrive — Système de mouvement : audit et standardisation

_17 novembre 2026 — suite de [design-system-audit.md](design-system-audit.md), non commité._

Objectif : un mouvement discret, cohérent et peu coûteux, sans changer l'identité ni ajouter de bibliothèque. Framer Motion reste là où il était (fenêtre de réservation, galerie de la fiche véhicule) ; tout le reste est en CSS.

---

## 1. Audit

### Doublons et incohérences

| Constat | Détail |
|---|---|
| Durées dispersées | 75, 150, 200, 220, 250, 280, 300, 500, 560, 600, 700 ms, en classes, en valeurs arbitraires (`animate-[cd-sheet-up_280ms_…]`) et en secondes dans Framer Motion (0,22 / 0,25 / 0,28 / 0,3 / 0,35 s) |
| Quatre courbes d'entrée proches | `(0.16,1,0.3,1)`, `(0.22,1,0.36,1)`, `(0.25,1,0.5,1)`, `(0.33,1,0.68,1)` |
| **Classes d'animation inexistantes** | `animate-fade-in`, `animate-slide-up`, `animate-in fade-in zoom-in-95` (syntaxe du plugin `tailwindcss-animate`, non installé) sur 9 fenêtres et menus : **aucune animation ne se jouait** |
| Pression incohérente | `active:scale-95`, `[0.96]`, `[0.98]`, `[0.99]`, `whileTap 0.9` (fiche véhicule) et même `active:scale-110` (favori des cartes, qui grossissait au lieu de s'enfoncer) |
| Zooms d'image | 1,01 / 1,03 / 1,04 / 1,05 / 1,06, durées de 300 à 700 ms |
| Mélange CSS + Framer Motion | bouton favori de la fiche : `whileTap` (transform JavaScript) et `transition-colors` (CSS) sur le même élément |

### Mouvement excessif

- Pulsation `animate-ping` **infinie** dans la barre supérieure, sur toutes les pages (WCAG 2.2.2 : un mouvement automatique de plus de 5 s doit pouvoir s'arrêter).
- Coche de succès de la réservation en ressort (`stiffness 260, damping 18` : dépassement d'environ 12 %, effet rebond).
- Logo de l'en-tête qui zoomait au survol ; CTA de l'en-tête soulevé **et** aimanté (corrigé à l'étape précédente).

### Sorties

Menus, tiroir, panneau de filtres et fenêtres étaient rendus de façon conditionnelle (`{open && …}`) : **aucune sortie animée**, ils disparaissaient d'un coup.

### Performance

| Constat | Effet |
|---|---|
| Reflet des squelettes animé par `background-position` | repeint de chaque bloc à chaque image ; une grille de 12 cartes en chargement = des dizaines de zones repeintes en continu sur mobile |
| `backdrop-blur` sur des fonds blancs opaques à 95 % (statut, promotion, favori, flèches des cartes véhicule) | ~48 calques de flou pour 12 cartes, sans effet visible |
| `transition-all` sur l'en-tête au défilement | transitionnait aussi `backdrop-filter` (coûteux) |
| Carte véhicule : transition sur `transform` | Tailwind v4 soulève avec la propriété `translate` : le soulèvement sautait (corrigé à l'étape précédente) |
| Flèches de la galerie des cartes : transition sur `transform`, survol en `scale` | le grossissement n'était pas animé |
| `will-change` permanent | supprimé à l'étape précédente ; aucun ne subsiste |

Animations de mise en page conservées en connaissance de cause : barre de progression et liaisons d'étapes de la réservation (`width` : extrémités arrondies qu'un `scaleX` déformerait), points de la galerie (`width`, 3 éléments de 6 px), curseur du carrousel des marques (`left`, élément positionné hors flux). Coût négligeable, aucun décalage du reste de la page.

### Images clés demandées

| Image clé | Usage avant | Décision |
|---|---|---|
| `cd-dropdown` | menus de l'en-tête | conservée, distance 10 → 4 px, échelle 0,97 → 0,98, sens réglable ; ajout de `cd-dropdown-out` |
| `cd-slide-up` | barre d'outils flottante du catalogue | conservée (16 px, 240 ms), réutilisée pour fenêtres et notifications |
| `cd-fade-in` | cartes, voiles | conservée (240 ms) ; ajout de `cd-fade-out` |
| `cd-reveal` | révélation au défilement | conservée, jetons par défaut (650 ms, 24 px, cascade 60 ms) |
| `cd-shimmer` | squelettes | réécrite en `transform` sur un pseudo-élément |
| `cd-brand-rise` | carrousel des marques | conservée (500 ms, 16 px), mise à l'échelle 0,98 retirée |
| `cd-sheet-up` / `cd-drawer-in` | filtres, menu mobile | conservées (350 ms) ; ajout de `cd-sheet-down` / `cd-drawer-out` (240 ms) |
| `cd-drift`, `cd-pulse-glow`, `cd-bounce-y`, `cd-ping` | **aucun** (supprimées à l'étape précédente) | non recréées : décoratives (dérive, lueur, rebond) et contraires à la consigne « ni rebond ni lueur ». `animate-ping` / `animate-pulse` de Tailwind couvrent les indicateurs réels |
| — | — | ajout de `cd-heart-pop` (favori ajouté) |

---

## 2. Jetons de mouvement

Dans `src/app/globals.css`, § 4 (`@theme static`, donc aussi disponibles en variables CSS) :

| Jeton | Valeur | Utilitaire | Usage |
|---|---|---|---|
| `--transition-duration-instant` | 120 ms | `duration-instant` | pression, sortie d'un menu |
| `--transition-duration-fast` | 180 ms | `duration-fast` | survol, couleurs, entrée d'un menu (durée par défaut des `transition-*`) |
| `--transition-duration-base` | 240 ms | `duration-base` | fenêtre, notification, sortie d'un panneau |
| `--transition-duration-slow` | 350 ms | `duration-slow` | entrée d'un panneau, carte survolée |
| `--transition-duration-slower` | 500 ms | `duration-slower` | zoom d'image, cascade |
| `--transition-duration-slowest` | 650 ms | `duration-slowest` | révélation de section |
| `--ease-standard` | `cubic-bezier(0.16, 1, 0.3, 1)` | `ease-standard` | entrées |
| `--ease-sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | `ease-sheet` | panneaux |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | `ease-exit` | sorties |
| `--motion-distance-xs/sm/md/lg` | 4 / 8 / 16 / 24 px | — | menu / notification / fenêtre / section |
| `--motion-stagger` | 60 ms | — | cascade |
| `--motion-lift` | 2 px | `motion-lift` | carte survolée (3 px au plus) |
| `--motion-zoom` | 1,03 | `motion-zoom` | photo survolée (1,035 au plus) |
| `--motion-press` | 0,97 | `motion-press` | bouton enfoncé |
| `--motion-pop` | 1,15 | — | favori ajouté |

Les mêmes valeurs existent pour Framer Motion dans `src/lib/design/motion.ts` (`DURATION`, `EASE`, `DISTANCE`).

Règles : n'animer que `transform`, `translate`, `scale` et `opacity` ; une sortie est toujours plus courte que son entrée ; les boucles (squelette, indicateur de chargement) restent hors échelle.

---

## 3. Utilitaires et comportements

- **`motion-lift`** : transition de `translate`, ombre et bordure en 350 ms ; soulèvement de 2 px au survol, uniquement avec une souris (`hover: hover`), retiré en mouvement réduit.
- **`motion-zoom`** : zoom de la photo à 1,03 en 500 ms quand la carte (`.group`) est survolée, souris uniquement.
- **`motion-press`** : `scale: 0.97` à la pression, retiré en mouvement réduit.
- **`usePresence(open)`** (`src/lib/ui/use-presence.ts`, sans dépendance) : garde l'élément monté pendant sa sortie, le rend `inert` (ni clic ni focus), le démonte à `animationend` (avec un filet de sécurité à 400 ms). En mouvement réduit, et dans jsdom pour les tests, le démontage reste immédiat.

### Cartes véhicule et agence

Soulèvement de 2 px avec ombre et bordure progressives (`motion-lift`), zoom photo à 1,03 (`motion-zoom`). Les pastilles de statut et de promotion changent de couleur en fondu (180 ms) quand on choisit des dates. Le bouton favori s'enfonce (`motion-press`) et le cœur se gonfle une fois (350 ms), **seulement après un clic** : pas d'animation au chargement d'une liste qui contient déjà des favoris. L'état reste porté par `aria-pressed` et le remplissage du cœur ; l'animation n'est qu'un plus. Même comportement sur la fiche véhicule, désormais sans Framer Motion.

### Navigation

| Surface | Entrée | Sortie |
|---|---|---|
| Menus « Destinations » et « Compte » | `cd-dropdown` 180 ms | `cd-dropdown-out` 120 ms, inerte |
| Tiroir mobile + voile | `cd-drawer-in` 350 ms + fondu 240 ms | `cd-drawer-out` 240 ms + fondu 180 ms, inerte |
| Filtres : feuille (téléphone) / tiroir (tablette) | `cd-sheet-up` / `cd-drawer-in` 350 ms | `cd-sheet-down` / `cd-drawer-out` 240 ms ; une feuille tirée au doigt finit sa course depuis sa position |
| Sélecteur de langue | `cd-dropdown` (vers le haut dans le pied de page) | — |
| Fenêtres agence (`Modal`, `ConfirmDialog`) | voile en fondu + feuille par le bas (téléphone) ou glissement de 16 px | instantanée |
| Fenêtres admin (6), abonnement | voile en fondu + glissement (avant : classes inexistantes) | instantanée |
| Notifications (agence, admin) | glissement de 16 px + fondu, 240 ms | — |
| Visionneuse photo | fondu 240 ms | — |
| Fenêtre de réservation (Framer) | 240 ms, `EASE.standard`, étapes ±16 px, sortie d'étape 180 ms `EASE.exit` | — |
| En-tête au défilement | couleurs et ombre seulement, 240 ms (hauteur et flou non animés) | — |

Fenêtres des espaces agence et admin : pas de sortie animée. Elles sont montées et démontées par une vingtaine de composants parents, et les tests vérifient leur disparition immédiate ; une sortie demanderait de reprendre chaque parent pour un gain faible dans un outil de gestion.

Aucun décalage de mise en page : CLS mesuré à 0 pendant le survol des cartes, l'ajout aux favoris, l'ouverture et la fermeture du tiroir et des filtres.

---

## 4. Performance

- **Squelettes** : reflet déplacé par `transform` (composité par le GPU) au lieu de `background-position` (repeint).
- **Flous** : jusqu'à 4 `backdrop-blur` retirés par carte du catalogue (statut, promotion, favori, flèches, tous sur fond opaque à 95 %) ; il en reste 1 par carte (étiquette de catégorie à 75 %, où il se voit), soit 12 mesurés pour 12 cartes.
- **Transitions ciblées** : plus aucun `transition-all` dans l'en-tête ; propriétés explicites sur les cartes, flèches, boutons et pastilles.
- **Pulsation de la barre supérieure** : 3 itérations puis arrêt.
- **Framer Motion** : retiré du bouton favori de la fiche véhicule ; il ne reste que là où il apporte quelque chose (étapes `AnimatePresence`, galerie à glissement).
- **Pas de `will-change` permanent.** Le navigateur crée les calques à la demande pendant les animations.

---

## 5. Accessibilité

- `prefers-reduced-motion` global : animations et transitions ramenées à 0,01 ms (les événements de fin restent émis), défilement doux coupé, cascades et reflets supprimés, soulèvement, zoom et pression neutralisés, sorties sans délai.
- Framer Motion : chaque usage lit `useReducedMotion()`.
- Clavier : Entrée ouvre le tiroir, Échap le ferme, le focus revient sur le bouton d'origine avec son indicateur visible ; une surface qui sort est `inert`, donc jamais focalisable.
- Aucun état n'est porté par l'animation seule : favori (`aria-pressed` + remplissage), statut (pastille + texte), étapes (texte + couleur).
- WCAG 2.2.2 : plus d'animation infinie automatique hors indicateurs de chargement ; le carrousel des marques était déjà pausable, et arrêté en mouvement réduit.

---

## 6. Validation

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` (121 fichiers modifiés sur les deux étapes) | ✅ 0 erreur ; aucun avertissement dans `use-presence.ts` ni dans les lignes modifiées (3 avertissements existaient déjà) |
| `npm run test:unit` | ✅ 1 169 / 1 170 ; le seul échec est `lot2.spec.ts` (fuseau horaire du Maroc), déjà présent et sans lien |
| `npm run build` | ✅ ; jetons et utilitaires (`motion-lift`, `motion-zoom`, `motion-press`, `duration-*`, `animate-cd-*`) présents dans le CSS compilé |
| Bureau 1024 px | ✅ carte : `translate 0 -2px`, ombre et bordure de survol, photo à 1,03 ; cœur : `cd-heart-pop` 350 ms à l'ajout, rien au retrait ; menu Destinations : entrée 180 ms, sortie 120 ms, inerte pendant la sortie ; pulsation : 3 itérations |
| Tablette 768 px | ✅ filtres en tiroir latéral (côté gauche en arabe) : entrée 350 ms, sortie 240 ms ; aucun défilement horizontal |
| Mobile 375 px | ✅ tiroir : entrée 350 ms, sortie 240 ms, inerte, défilement de page rétabli ; filtres : feuille 350 / 240 ms ; focus rendu au bouton après Échap ; CLS 0 |

Limite du test : le panneau de navigateur était masqué, et un onglet masqué ne fait plus avancer ses animations (0 image en 300 ms). La présence des bonnes animations, leurs durées et l'état intermédiaire ont été vérifiés ; le démontage a été vérifié par le filet de sécurité (400 ms) et en émettant `animationend` à la main (démontage seulement sur la fin de la sortie de l'élément lui-même). **La fluidité réelle (images par seconde) n'a pas été mesurée** ; à regarder sur un vrai téléphone. La préférence « réduire les animations » n'a pas pu être activée dans le panneau : les règles ont été vérifiées dans le CSS compilé.

---

## 7. Fichiers modifiés

**Nouveaux** : `frontend/src/lib/design/motion.ts`, `frontend/src/lib/ui/use-presence.ts`, `docs/motion-design-audit.md`.

**Fondations** : `frontend/src/app/globals.css` (jetons § 4, utilitaires `motion-*`, images clés, squelette, mouvement réduit).

**Composants** :
- `components/cars/VehicleCard.tsx`, `components/agencies/AgencyCard.tsx`, `app/cars/[slug]/CarDetailsClient.tsx` ;
- `components/shared/Navbar.tsx`, `app/search/SearchClient.tsx`, `components/shared/LanguageSelector.tsx` ;
- `components/agency/shell/Dialog.tsx`, `components/agency/shell/Feedback.tsx`, `components/agency/subscription/AgencySubscriptionModal.tsx` ;
- `components/admin/agencies/{AddAgency,AgencyCredentialsSuccess,DeleteAgency,EditAgency,ResetPassword}Modal.tsx`, `components/admin/agencies/AdminAgenciesClient.tsx`, `components/admin/audit/AdminAuditClient.tsx`, `components/admin/messages/ContactAlerts.tsx` ;
- `components/booking/BookingRequestModal.tsx`, `components/cars/VehicleGallery.tsx` ;
- `components/shared/BrandMarquee.tsx`, `components/ui/react-bits/GsapReveal.tsx`, `app/HomeClient.tsx`, `app/agencies/AgenciesClient.tsx` ;
- zooms : `app/about/page.tsx`, `components/home/StyleExplorer.tsx`, `components/agency/fleet/AgencyFleetPanel.tsx`, `app/admin/settings/page.tsx`, `components/shared/ReviewModal.tsx` ;
- pression : `components/ui/Button.tsx`, `components/ui/Pagination.tsx`, `components/search/SearchBar.tsx`, `components/booking/BookingCard.tsx`, `components/auth/GoogleSignInButton.tsx`, `components/layout/BottomNav.tsx`.

**Durées ramenées sur l'échelle** (150/200 → `fast`, 250/300 → `base`, 500 → `slower`, 700 → `slowest`) : en plus des fichiers ci-dessus, `app/faq/FaqClient.tsx`, `components/admin/{AdminShell,AdminUI}.tsx`, `components/admin/finance/AdminFinanceClient.tsx`, `components/admin/overview/AdminOverviewClient.tsx`, `components/agency/overview/OverviewPanel.tsx`, `components/agency/shell/{Sidebar,Topbar}.tsx`, `components/search/CatalogFilters.tsx`, `components/shared/Footer.tsx`, `components/ui/Field.tsx`, `components/ui/react-bits/SpotlightCard.tsx`.

Aucune logique métier, aucune dépendance ajoutée, aucun test modifié dans cette étape.

---

## 8. Restes et suites possibles

1. Sorties animées des fenêtres agence et admin : nécessiteraient `usePresence` dans chaque parent et l'adaptation des tests qui vérifient une fermeture immédiate.
2. 41 squelettes `animate-pulse` écrits à la main (déjà signalés) : à remplacer par `ui/Skeleton` pour profiter du reflet composité.
3. L'effet « aimant » sur 4 CTA reste en place (désactivé au tactile et en mouvement réduit).
4. 31 `transition-all` hors de l'en-tête (surtout dans l'administration) : à restreindre au fil des modifications.
5. `ShinyText` et `SpotlightCard` restent inutilisés ; l'image clé `cdShinyText` n'est conservée que pour eux.
6. Mesurer la fluidité sur un téléphone d'entrée de gamme (onglet Performance de Chrome, ralentissement CPU ×4) sur le catalogue en chargement.
