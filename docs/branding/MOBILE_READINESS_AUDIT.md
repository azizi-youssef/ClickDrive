# ClickDrive — Audit de préparation mobile et Capacitor (Tâche 01 · D)

> **Date** : 24 novembre 2026 · **Référence** : `main` @ `1ca24b9`
> **Méthode** : lecture de la configuration Next.js (`next.config.ts`, `src/proxy.ts`, `layout.tsx`), du manifeste, des composants de navigation, des zones sûres et des interactions natives ; comptages `grep`. **Non fait** : aucun build Capacitor ni test sur appareil (Capacitor n'est pas installé et la mission interdit d'ajouter des dépendances à ce stade).

---

## 1. Verdict

| Axe | État | Note |
|---|---|---|
| Responsive web | Mobile-first, sans débordement mesuré de 360 à 1920 px (rapport du 17/11), barre inférieure sans CLS | 🟢 Bon |
| Navigation mobile | Barre inférieure publique + navigation agence dédiée ; bouton Retour non géré pour les modales publiques | 🟡 |
| Cibles tactiles | Socle 44 px (`.tap-44`, `Button md`), exceptions dans l'espace agence | 🟡 |
| Zones sûres | Bas : bien traité. Haut : en-têtes fixes non protégés. Côtés : non traités | 🟠 |
| Compatibilité Capacitor | **Application serveur (BFF Next.js) : export statique impossible** ; rien de configuré | 🔴 Décision d'architecture requise |
| Interactions natives | OAuth Google, téléchargements blob, liens externes, partage : à adapter | 🔴 |
| Icônes / splash | Icône non carrée, aucun splash | 🔴 |

**Constat central** : ClickDrive est une bonne application web mobile, mais **pas encore une base d'app native**. Le passage à Capacitor n'est pas un simple « empaquetage » : il demande (1) un choix d'architecture, (2) un traitement des flux d'authentification et des liens entrants, (3) des actifs de marque carrés et vectoriels.

---

## 2. Constats

### MR-01 — Architecture : l'app ne peut pas être exportée en statique

| Champ | Détail |
|---|---|
| **État actuel** | 78 *route handlers* `/api/*` (BFF), proxy de langue et de session (`src/proxy.ts`, rafraîchissement Supabase via `@supabase/ssr` et cookies), 10 routes `force-dynamic` en rendu serveur, composants serveur pour accueil/catalogue/fiches/suivi, génération de PDF et d'images OG côté serveur. Aucune dépendance `@capacitor/*`, aucun `capacitor.config.*`, aucun dossier `ios/`/`android/`. |
| **Problème** | `output: 'export'` (prérequis d'un Capacitor « tout embarqué ») casserait l'API, le proxy, l'auth par cookies et le SEO. |
| **Impact** | Toute stratégie mobile part d'un choix structurant. |
| **Recommandation** | Rédiger un ADR et retenir, sauf contre-indication, **Capacitor « coque hébergée »** (`server.url = https://clickdrive.ma`) : une seule base de code, déploiements web instantanés. Compenser par une vraie valeur native (notifications push, liens universels, partage, page hors ligne) pour respecter la règle 4.2 « fonctionnalité minimale » de l'App Store. Alternative à long terme : client mobile embarqué consommant l'API (coût XL). |
| **Priorité** | **Critique** (décision) |
| **Complexité** | S (ADR) · L (mise en place coque + plugins) |
| **Dépendances** | Comptes Apple Developer / Google Play ; BR-05/MR-07 (icônes). |

### MR-02 — Authentification Google et liens entrants

| Champ | Détail |
|---|---|
| **État actuel** | `GoogleSignInButton.tsx:34-39` : `signInWithOAuth({ provider: 'google', redirectTo: origin + '/auth/callback' })` par redirection navigateur. Réinitialisation de mot de passe et invitations agence par lien e-mail vers `/auth/callback` (`UnifiedPortalLogin.tsx:845`, `api/agencies/[id]/members/route.ts:93`). Liens personnels signés `/suivi/[reference]` et `/avis/[reference]` envoyés par e-mail/WhatsApp. Pas de `public/.well-known/` (ni `apple-app-site-association`, ni `assetlinks.json`). |
| **Problème** | Google refuse l'OAuth dans les WebView intégrées (`disallowed_useragent`) ; les liens e-mail/WhatsApp ouvriront le navigateur et non l'app. |
| **Impact** | Connexion Google impossible dans l'app ; parcours de suivi et d'avis hors app. |
| **Recommandation** | OAuth via navigateur système (`@capacitor/browser`) ou SDK Google natif + `signInWithIdToken` ; liens universels (iOS) et App Links (Android) pour `/auth/callback`, `/suivi/*`, `/avis/*`, `/agency/invitations/*`. **Sans modifier** les règles d'autorisation existantes. |
| **Priorité** | **Critique** (pour l'app) |
| **Complexité** | M |
| **Dépendances** | MR-01 ; configuration Supabase Auth (URL de redirection autorisées) ; domaine `clickdrive.ma`. |

### MR-03 — Zones sûres : le haut de l'écran n'est pas protégé

| Champ | Détail |
|---|---|
| **État actuel** | `viewportFit: 'cover'` (`layout.tsx:34`). **Bas** : traité (barre inférieure `BottomNav.tsx:76`, réserve `globals.css:566`, feuilles et pieds de modale `SearchClient.tsx:948`, `Dialog.tsx:95`, `MobileNav.tsx:133/189`, `BookingCard.tsx:447`, `BookingRequestModal.tsx:1193`, galerie, menu). **Haut** : seulement l'en-tête de la modale de réservation (`BookingRequestModal.tsx:501`) et le tiroir du menu (`Navbar.tsx:1219`). L'en-tête collant public (`Navbar.tsx:469`), la barre agence (`Topbar.tsx`) et la coque admin n'ont aucun `safe-area-inset-top`. **Côtés** (paysage, encoche) : aucun `safe-area-inset-left/right`. |
| **Problème** | Dans une WebView Capacitor iOS (contenu sous la barre d'état) et en PWA plein écran, l'en-tête passe sous l'heure et l'encoche. |
| **Impact** | Logo et boutons de compte inaccessibles ; défaut visible dès l'ouverture de l'app. |
| **Recommandation** | Jetons `--safe-top/--safe-bottom/--safe-inline` dans `globals.css`, appliqués à toutes les barres fixes et collantes ; vérifier en simulateur iOS avec encoche et Dynamic Island. |
| **Priorité** | **Haute** |
| **Complexité** | S |
| **Dépendances** | — |

### MR-04 — Bouton Retour Android et modales publiques

| Champ | Détail |
|---|---|
| **État actuel** | L'espace agence gère l'historique (sections et menu mobile : `AgencyWorkspace.tsx:130-481`, `MobileNav.tsx:69-109`). Les modales publiques — demande de réservation, menu, filtres, galerie, avis — **ne poussent aucune entrée d'historique**. |
| **Problème** | Sur Android (geste ou bouton Retour), l'utilisateur quitte la page au lieu de fermer la modale ; dans la modale de réservation, la saisie est perdue. |
| **Impact** | Frustration au moment de la conversion ; comportement attendu par tout utilisateur Android. |
| **Recommandation** | Hook partagé « modale ↔ historique » (même motif que `MobileNav`) branché sur `useModalDialog` ; dans Capacitor, écouter `backButton` (`@capacitor/app`). |
| **Priorité** | Haute |
| **Complexité** | S |
| **Dépendances** | `lib/a11y/useModalDialog.ts`. |

### MR-05 — Navigation mobile

| Champ | Détail |
|---|---|
| **État actuel** | Barre inférieure publique à 4 destinations (Accueil, Voitures, Motos, Agences — `BottomNav.tsx:22-27`), rendue côté serveur, masquée pendant la saisie au clavier virtuel, effacée sur la fiche véhicule au profit de la barre « Réserver ». Compte et menu dans l'en-tête compact. Espace agence : navigation inférieure + feuille « Plus ». |
| **Problème** | Le compte client (réservations en cours) n'est pas une destination de premier niveau ; « Motos » occupe une place égale aux voitures. |
| **Impact** | Dans une app, l'accès « Mes réservations » est l'usage n°1 après la réservation. |
| **Recommandation** | Pour l'app : Accueil · Explorer · Réservations · Compte (motos dans Explorer) — à valider avec les données d'usage. |
| **Priorité** | Moyenne |
| **Complexité** | S |
| **Dépendances** | Décision produit ; DX-06. |

### MR-06 — Cibles tactiles

| Champ | Détail |
|---|---|
| **État actuel** | ✅ `.tap-44` (9 usages), `Button md` 44 px, onglets de la barre inférieure 44 px min., favori 44×44 (rapport du 17/11). ⚠️ Actions photo de la flotte : ≈ 28 px et visibles au survol seulement (`VehicleFormModal.tsx:1027-1045`) ; recettes agence compactes à 40 px (`tokens.ts:44`, `:52`) ; ~13 commandes compactes `h-7…h-9` repérées (Navbar ×2, `agency/shell/Controls.tsx` ×2, `CatalogFilters`, `OverviewPanel`, `ContactAlerts`, `AdminBookingsClient`, `AdminShell`, `AgenciesClient`, `admin/settings`). |
| **Problème** | L'espace agence, utilisé sur le terrain au téléphone, est dimensionné « bureau ». |
| **Impact** | Erreurs de saisie, actions impossibles sur tactile. |
| **Recommandation** | Hauteur 44 px sur `pointer: coarse` pour les recettes agence ; corriger les 13 commandes ; actions photo toujours visibles au tactile. |
| **Priorité** | Haute (actions photo) / Moyenne (reste) |
| **Complexité** | S |
| **Dépendances** | DX-07. |

### MR-07 — Icônes, splash et métadonnées d'app

| Champ | Détail |
|---|---|
| **État actuel** | Icône source 313×228 non carrée, déclarée `maskable` (`manifest.webmanifest`), étirée pour iOS (`apple-icon.tsx:18`) ; aucun écran de démarrage ; `theme_color`/`background_color` `#0B1220` ; `orientation: portrait-primary` (bloque le paysage sur tablette) ; capture d'écran périmée et mal dimensionnée (`UI.png`). |
| **Problème** | Les stores exigent une icône 1024×1024 sans transparence (iOS) et une icône adaptative (Android). |
| **Impact** | Bloquant pour la soumission. |
| **Recommandation** | Générer icônes et splash depuis le futur symbole vectoriel (`@capacitor/assets`) ; captures stores à jour ; revoir l'orientation pour tablettes. |
| **Priorité** | Haute |
| **Complexité** | S |
| **Dépendances** | BR-01, BR-05. |

### MR-08 — Interactions natives à adapter

| Champ | Détail |
|---|---|
| **État actuel** | Liens `wa.me` (13) et `target="_blank"` ; `tel:` (3) ; partage `navigator.share` sur la fiche (`CarDetailsClient.tsx:197`) ; export XLSX par `URL.createObjectURL` + `download` (`lib/export/spreadsheet.ts:60-63`) ; PDF par lien signé ; aucune géolocalisation client (`Permissions-Policy: geolocation=(self)`). |
| **Problème** | Dans WKWebView, l'attribut `download` sur un blob n'enregistre rien ; les liens externes peuvent s'ouvrir dans la WebView. |
| **Impact** | Exports agence et PDF non récupérables dans l'app ; WhatsApp mal ouvert. |
| **Recommandation** | Couche d'adaptation « plateforme » : `@capacitor/share`, `@capacitor/filesystem` pour les fichiers, ouverture externe des liens WhatsApp/téléphone, détection `Capacitor.isNativePlatform()`. |
| **Priorité** | Haute |
| **Complexité** | M |
| **Dépendances** | MR-01. |

### MR-09 — Persistance et hors ligne

| Champ | Détail |
|---|---|
| **État actuel** | Aucun service worker, aucune page hors ligne. `localStorage` pour favoris, langue, consentement cookies, préférences (`lib/ui/local-store.ts`). Session Supabase en cookies (`@supabase/ssr`). |
| **Problème** | iOS peut purger le stockage d'une WebView ; sans réseau, l'app affiche une page d'erreur système. |
| **Impact** | Favoris perdus ; refus App Store possible si l'app est « vide » hors ligne. |
| **Recommandation** | Écran hors ligne de marque embarqué dans la coque ; `@capacitor/preferences` pour les préférences critiques ; synchroniser les favoris avec le compte à terme. |
| **Priorité** | Moyenne |
| **Complexité** | M |
| **Dépendances** | MR-01, DX-02. |

### MR-10 — Arabe et RTL sur mobile

| Champ | Détail |
|---|---|
| **État actuel** | Voir DS-09 et BR-07 : pas de police arabe, espacement de lettres et capitales non neutralisés, marges physiques restantes. |
| **Problème** | Rendu dépendant de la police système Android/iOS. |
| **Impact** | Qualité perçue en arabe très variable selon le téléphone. |
| **Recommandation** | Police arabe embarquée, règles `:lang(ar)`, tests visuels RTL sur mobile. |
| **Priorité** | Haute |
| **Complexité** | M |
| **Dépendances** | BR-07, DS-09. |

### MR-11 — Couverture de test mobile

| Champ | Détail |
|---|---|
| **État actuel** | Playwright : projets `desktop` (Chrome) et `mobile` (Pixel 7, **Chromium**) (`playwright.config.ts:36-37`). Aucun moteur WebKit. |
| **Problème** | L'app iOS tournera dans WKWebView (WebKit), jamais testé. |
| **Impact** | Régressions Safari/iOS découvertes en production. |
| **Recommandation** | Ajouter un projet `iPhone 15` (WebKit) aux e2e publics ; captures RTL. |
| **Priorité** | Moyenne |
| **Complexité** | S |
| **Dépendances** | — |

### MR-12 — Notifications

| Champ | Détail |
|---|---|
| **État actuel** | Notifications par e-mail (`lib/email`) et WhatsApp (`lib/services/whatsapp.service.ts`, modèles dans `docs/whatsapp-templates.md`). Pas de push. |
| **Problème** | Aucun canal natif. |
| **Impact** | C'est l'argument « valeur native » le plus fort pour l'App Store et pour les agences (nouvelle demande à traiter). |
| **Recommandation** | Push (FCM/APNs) en phase 2 de l'app ; nécessitera une table de jetons d'appareil — **à concevoir séparément, aucune migration dans cette tâche**. |
| **Priorité** | Basse (Moyenne au moment du lancement de l'app) |
| **Complexité** | L |
| **Dépendances** | MR-01 ; décision base de données. |

---

## 3. Déjà prêt (à préserver)

- `viewportFit: 'cover'`, `-webkit-text-size-adjust`, champs à 16 px (pas de zoom iOS).
- Barre inférieure sans saut de mise en page, masquée au clavier, réserve CSS `--cd-bottom-nav`.
- Zones sûres basses systématiques sur feuilles, pieds de modale, barres fixes.
- `.tap-44`, interactions `@media (hover: hover)` pour les effets de survol des cartes publiques.
- Historique géré dans l'espace agence (retour = fermer le menu / revenir à la section).
- Mouvement réduit respecté partout.

## 4. Séquence recommandée pour Capacitor

1. ADR « coque hébergée » (MR-01) et choix des plugins.
2. Correctifs web utiles **aussi** au site : zones sûres hautes (MR-03), Retour Android ↔ modales (MR-04), cibles agence (MR-06), `dvh` (DS-11).
3. Actifs de marque carrés et vectoriels (BR-01, BR-05, MR-07).
4. Auth et liens universels (MR-02), interactions natives (MR-08), écran hors ligne (MR-09).
5. Tests WebKit (MR-11), puis bêta TestFlight / test interne Play.
6. Push (MR-12) en phase 2.
