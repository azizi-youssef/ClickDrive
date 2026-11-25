# ClickDrive — Audit de marque (Tâche 01 · A)

> **Date** : 24 novembre 2026 · **Branche auditée** : `claude/clickdrive-audit-85b668` (= `main` @ `1ca24b9 « change logo »`)
> **Direction approuvée** : *Luxury & Exclusive* · Tagline *Click. Drive. Explore.* · Maroc puis international · Marketplace B2C + B2B
> **Méthode** : lecture du code et des fichiers réellement servis (`frontend/public`, `src/app`, `src/lib`), ouverture visuelle des logos et photos, comptages `grep` sur `frontend/src` (fichiers `*.spec.*` exclus). Aucune hypothèse tirée de la documentation sans vérification.
> **Aucun fichier applicatif n'a été modifié.**

Échelle de complexité utilisée dans tous les livrables : **XS** < ½ j · **S** ≤ 1 j · **M** 2–3 j · **L** 1–2 sem. · **XL** > 2 sem.

---

## 1. Synthèse

| Axe | État | Écart avec « Luxury & Exclusive » |
|---|---|---|
| Logo / symbole | 3 symboles différents en production, raster PNG uniquement | **Critique** |
| Nom | Ancien nom « CarDrive » encore visible (photo du hero, capture README/PWA) | **Critique** |
| Couleurs | Rouge #E63946 + graphite #0B1220, jetons propres et contrastes AA vérifiés | Élevé (codes « location grand public ») |
| Typographie | Plus Jakarta Sans seule, sous-ensemble latin, graisses 800 dominantes | Élevé |
| Messages | Positionnement « simple, gratuit, comparez les prix à Nador » ; tagline absente | **Élevé** |
| Réseaux sociaux | Aucun compte relié, image de partage textuelle sans logo, en français seulement | Moyen |
| Photographie | Hero générique (badge Mercedes, plaque « CarDrive »), photo de destination erronée | Élevé |

**Constat central** : l'identité actuelle est *cohérente en interne* (jetons uniques, contrastes mesurés) mais *codée pour un comparateur de location local et grand public*. Elle n'a ni symbole unique, ni actif vectoriel, ni registre premium. Avant toute refonte visuelle, il faut **fixer un système de marque maître** (symbole, wordmark, palette, typographie, ton) : tout le reste en dépend.

---

## 2. Constats détaillés

### BR-01 — Trois symboles concurrents pour une seule marque

| Champ | Détail |
|---|---|
| **État actuel** | (1) **En-tête, pied de page, portails, PDF** : `public/logo_12.png` (819×161) — curseur rouge dans un « bouton lecture » + route + wordmark italique « ClickDrive » (`src/lib/brand/logo.ts:1`, introduit par le commit `1ca24b9`). (2) **Favicon, icône d'app, icône iOS, manifeste PWA, logo JSON-LD** : monogramme circulaire « CD » + silhouette de voiture (`public/icon_12.png`, `src/app/icon.png`, `src/app/favicon.ico`, `public/manifest.webmanifest`, `src/app/layout.tsx:127`, `src/app/apple-icon.tsx`). (3) **Capture README / PWA** : variante « CD + voiture + moto » + wordmark (`public/logo_122.png`, visible dans `public/UI.png`). (4) Fichiers hérités « CarDrive — Plateforme de location de voitures » : `Logo_CarDrive_12.png`, `logo-12.png`, `logo.jpeg`. |
| **Problème** | Le « CD » est l'initiale de **CarDrive**, pas de ClickDrive. Le logo d'en-tête et l'icône d'application ne partagent aucun élément graphique. Le commentaire `Navbar.tsx:625` (« proportions calées sur le logo 1036×241 ») décrit encore l'ancien fichier. |
| **Impact** | Reconnaissance nulle entre onglet, écran d'accueil du téléphone, résultats Google (logo JSON-LD) et site. Pour une marque « exclusive », l'incohérence est le signal inverse de la maîtrise. Bloque la future app Capacitor (icône, splash). |
| **Recommandation** | Créer **un seul système** : symbole autonome (lisible à 16 px), wordmark, lock-up horizontal et vertical. Le décliner partout depuis une source unique (`src/lib/brand/`). Archiver les anciens fichiers hors de `public/`. |
| **Priorité** | **Critique** |
| **Complexité** | L (création graphique) + S (intégration) |
| **Dépendances** | Validation du design de marque (BR-03) ; bloque BR-05, MR-07 (icônes Capacitor). |

### BR-02 — L'ancien nom « CarDrive » reste visible

| Champ | Détail |
|---|---|
| **État actuel** | `public/hero-nador.webp` — **image LCP de la page d'accueil** — montre une plaque « CarDrive » sur la berline. `public/UI.png` (capture du README et `screenshots` du manifeste PWA) montre la même plaque et l'ancien logo. `public/vehicle-placeholder.svg:11` contient le texte « CarDrive » (fichier non référencé aujourd'hui, mais prêt à être réutilisé). `scripts/create-admin.mjs` et `scripts/rebuild-database.mjs` affichent « CarDrive ». `components/ui/Pagination.tsx:144` écrit « KlickDrive ». Dépôt GitHub nommé `CarDrive` (`docs/remediation-2026-11.md:12`). |
| **Problème** | Le visiteur voit deux noms de marque dans le premier écran. |
| **Impact** | Confusion, doute sur l'authenticité (« est-ce le bon site ? »), incompatible avec une promesse premium. Risque juridique si « CarDrive » est une marque tierce. |
| **Recommandation** | Remplacer immédiatement la photo du hero (ou retoucher la plaque) et `UI.png` ; corriger les chaînes « CarDrive »/« KlickDrive » restantes dans les scripts et commentaires. Garder la redirection `klickdrive.ma → clickdrive.ma` (`src/proxy.ts:7`), qui est voulue. |
| **Priorité** | **Critique** |
| **Complexité** | S |
| **Dépendances** | Aucune pour la retouche ; nouvelle direction photo (BR-10) pour le remplacement définitif. |

### BR-03 — Le style du logo contredit « Luxury & Exclusive »

| Champ | Détail |
|---|---|
| **État actuel** | Wordmark italique très gras, dégradés rouge/noir, reflets 3D et biseaux (`logo_12.png`, `logo_122.png`) ; symbole « curseur + route » au registre « appli / clic ». Fichiers **raster uniquement** (aucun SVG, aucune source vectorielle dans le dépôt). |
| **Problème** | Codes visuels « sport / discount / tuning » : italique = vitesse, reflets = effet générique. Le raster interdit les déclinaisons nettes (Retina, impression, broderie, gravure). |
| **Impact** | Le premier élément perçu ne porte pas le positionnement approuvé. Coût de chaque déclinaison (agences partenaires, plaques, goodies, kit presse). |
| **Recommandation** | Wordmark droit, dessin sobre (capitales espacées ou bas de casse raffiné), symbole monoligne ou monogramme « C » géométrique ; **livraison en SVG** + guide (zones de protection, tailles minimales, interdits). |
| **Priorité** | Haute |
| **Complexité** | L |
| **Dépendances** | Arbitrage de la direction de marque par le propriétaire. |

### BR-04 — Aucune déclinaison du logo (inversé, monochrome, symbole seul)

| Champ | Détail |
|---|---|
| **État actuel** | Pied de page sombre : le logo couleur est forcé en blanc par filtre CSS `brightness-0 invert` (`Footer.tsx:240`). Barre latérale admin repliée : le wordmark 5:1 est rendu dans un carré de 32 px (`AdminShell.tsx:100-109`) ; même principe dans l'espace agence (`agency/shell/Sidebar.tsx:127`, `Topbar.tsx:234`). Modale de réservation : wordmark posé sur une pastille blanche dans un en-tête graphite (`BookingRequestModal.tsx:503-504`). |
| **Problème** | Le filtre CSS aplatit le dégradé et le rouge ; le wordmark réduit en carré devient illisible (≈ 6 px de haut). |
| **Impact** | Logo dégradé dans les espaces B2B (agence, admin) — précisément là où ClickDrive vend son sérieux aux partenaires. |
| **Recommandation** | Livrer au minimum : couleur sur clair, blanc sur sombre, noir monochrome, symbole seul (carré), favicon simplifié. Exposer ces variantes depuis `src/lib/brand/logo.ts`. |
| **Priorité** | Haute |
| **Complexité** | S (une fois BR-01 livré) |
| **Dépendances** | BR-01, BR-03 |

### BR-05 — Icônes d'application techniquement fausses

| Champ | Détail |
|---|---|
| **État actuel** | `icon_12.png` mesure **313×228** (non carré). Le manifeste le déclare 8 fois en 72→512 px, dont deux en `maskable`. Le JSON-LD le déclare `512×512` (`layout.tsx:127-129`). `apple-icon.tsx:18` l'étire dans un carré 148×148. `favicon.ico` pèse **401 Ko** et existe en trois copies (`src/app/favicon.ico`, `public/favicon.ico`, `public/icon_cardrive.ico`). La capture `UI.png` est déclarée `900x600` mais mesure 1897×781. |
| **Problème** | Icônes déformées ou rognées sur Android (maskable) et iOS ; métadonnées fausses pour Google. |
| **Impact** | Écran d'accueil et onglets peu professionnels ; refus possible des icônes par les stores lors du passage à Capacitor. |
| **Recommandation** | Générer un jeu d'icônes carré depuis le symbole vectoriel : 16/32/48 (ICO < 20 Ko), 180 (Apple), 192/512 `any` + 512 `maskable` avec zone de sécurité, 1024 (stores). Corriger dimensions JSON-LD et manifeste. |
| **Priorité** | Haute |
| **Complexité** | S |
| **Dépendances** | BR-01 ; MR-07 (icônes et splash Capacitor). |

### BR-06 — Palette « grand public », couleurs parasites

| Champ | Détail |
|---|---|
| **État actuel** | Jetons uniques et bien documentés dans `src/app/globals.css:44-84` : graphite `#0B1220`, rouge de marque `#E63946`, rouge d'action `#C92F3B` (5,31:1 avec texte blanc), gris `#667085`/`#E4E7EC`, états succès/alerte/danger/info. Hors jetons : hero `#070B12` et `#05080D` (`HomeClient.tsx:188-200`), bleu `#02306B` de l'abonnement agence (`AgencySubscriptionPanel.tsx:70-299`), coches `emerald-400` du hero, 172 valeurs hexadécimales et 48 classes `[#…]` au total. |
| **Problème** | Rouge vif + graphite = codes de la location économique et de l'automobile sportive. Aucun ton « signature » premium (neutre chaud, champagne, bronze, noir profond). Le rouge sert à la fois de marque, d'action et de danger, ce qui le banalise. |
| **Impact** | Perception de prix bas ; difficulté à présenter le segment Luxe ; la règle « pas de rouge dans les titres » (décision du 23/11) montre déjà que le rouge est vécu comme trop présent. |
| **Recommandation** | Définir une palette maître : base noir/ivoire, un accent métallique sobre, rouge réservé à l'**action** (ou remplacé), conserver l'architecture de jetons sémantiques existante — seule la valeur change. Contrôler chaque paire de contraste comme aujourd'hui. |
| **Priorité** | Haute |
| **Complexité** | M (définition) + M (migration grâce aux jetons) |
| **Dépendances** | BR-03 ; DS-02 (migration des 172 hex). Contrainte connue : le propriétaire a déjà refusé une identité « sable/lagune » le 17/11 (stashes `stash@{0}`, `stash@{1}`) — faire valider sur maquettes avant tout code. |

### BR-07 — Typographie sans registre premium, sans arabe

| Champ | Détail |
|---|---|
| **État actuel** | Une seule police : Plus Jakarta Sans variable 200–800, **sous-ensemble latin uniquement** (`src/app/fonts/plus-jakarta-sans-latin-wght-normal.woff2`, `layout.tsx:17-25`). `font-extrabold` ×132 et `font-black` ×28 dans le code. Échelle fluide `text-display…text-overline` définie (`globals.css:103-148`) mais **utilisée 0 fois** pour `display/h1/h2/h3`. 340 tailles arbitraires `text-[Npx]`. |
| **Problème** | Graisses lourdes et serrées = registre « startup tech ». L'arabe (langue officielle, RTL activé) tombe sur la police système. |
| **Impact** | Ton visuel peu raffiné ; rendu arabe hétérogène d'un appareil à l'autre, alors que l'arabe est une langue clé au Maroc. |
| **Recommandation** | Couple typographique : une display élégante (serif contrasté ou grotesque fine) pour titres + une sans lisible pour l'UI ; une police arabe appariée (même famille si possible). Appliquer l'échelle de jetons existante au lieu des tailles libres. |
| **Priorité** | Haute |
| **Complexité** | M |
| **Dépendances** | BR-03 ; DS-04 (adoption de l'échelle) ; MR-09 (arabe). |

### BR-08 — Messages : tagline absente, positionnement utilitaire et « Nador » figé

| Champ | Détail |
|---|---|
| **État actuel** | « Click. Drive. Explore. » : **0 occurrence** dans le code, les métadonnées, le manifeste, les e-mails. Accroche du hero : « Location de voitures à Nador, en toute simplicité. » (`translations/fr.ts:59-60`), surtitre identique au début du titre. Messages dominants : « Comparez », « Demande gratuite et sans engagement », « Tarifs affichés à l'avance » (`messages/home.ts`, `messages/site-footer.ts`). Taglines contradictoires : connexion FR « Votre activité. Une seule interface. » (`login.fr.ts:25`) vs EN « Your trip. One place. » (`login.ts:26`). « Nador » est inscrit dans le gabarit de titre de **toutes les pages** (`layout.tsx:48`, `:101` → « … \| ClickDrive Nador »), l'en-tête des e-mails (« ClickDrive **Nador** », `lib/email/templates.ts:59`), l'image de partage, le nom du manifeste. |
| **Problème** | Promesse de comparateur économique local, pas d'expérience exclusive. Marque liée à une ville dans des gabarits techniques. |
| **Impact** | Décalage frontal avec la direction approuvée ; l'extension internationale exigera de retoucher titres, e-mails, PWA, OG. |
| **Recommandation** | Plateforme de messages : promesse, preuves, ton (vouvoiement, sobriété, pas de superlatifs non vérifiables — la règle « affirmations vérifiables » de `site-footer.ts:4` est à conserver). Tagline « Click. Drive. Explore. » traduite ou conservée en anglais (à arbitrer) dans les 6 langues. Rendre la ville **variable** (`SITE_NAME` seul dans les gabarits ; la ville vient de la page). |
| **Priorité** | **Haute** |
| **Complexité** | M (rédaction 6 langues) |
| **Dépendances** | Validation de la plateforme de marque ; traductions (`lib/i18n/messages/*`). |

### BR-09 — Actifs réseaux sociaux inexistants

| Champ | Détail |
|---|---|
| **État actuel** | Aucun lien Instagram/Facebook/TikTok/LinkedIn dans le code. `sameAs` du JSON-LD = le site lui-même (`layout.tsx:171`). Image de partage générée (`opengraph-image.tsx`) : fond dégradé + texte « ClickDrive », **sans logo**, **en français pour toutes les langues**. `availableLanguage: ['French','Arabic']` alors que 6 langues sont servies (`layout.tsx:154`). |
| **Problème** | Pas de présence sociale déclarée ; partage de lien peu identifiable. |
| **Impact** | Le luxe se vend par l'image et la recommandation ; les partages WhatsApp/Instagram (canal principal au Maroc et chez les MRE) n'affichent pas la marque. |
| **Recommandation** | Kit social : avatar (symbole), bannières, gabarits de posts/stories, image OG par langue avec logo vectoriel ; renseigner `sameAs` quand les comptes existent. |
| **Priorité** | Moyenne |
| **Complexité** | M |
| **Dépendances** | BR-01, BR-06, BR-07. |

### BR-10 — Photographie sans direction artistique

| Champ | Détail |
|---|---|
| **État actuel** | Hero : coucher de soleil + Mercedes C300 (badge visible) + plaque « CarDrive » (`hero-nador.webp`). Destination « Port Beni Ansar » illustrée par **la frontière de Melilla** avec policier et plaques lisibles (`public/frontera melilla.jpeg`, `HomeClient.tsx:153`, `about/page.tsx:43`). Images sources lourdes : `agences.jpg` 4,6 Mo, `join.jpg` 2,8 Mo, `g_class.jpg` 1,9 Mo. Photos de véhicules hétérogènes (visuels avec texte, une seule photo — constat M6 de `docs/audit-ui-ux.md`, toujours ouvert). |
| **Problème** | Lieu mal légendé, droits d'image probablement non acquis (photo de presse), marque tierce mise en avant, aucune cohérence de lumière ni de cadrage. |
| **Impact** | Crédibilité et risque juridique ; une marque luxe vit de son image. |
| **Recommandation** | Charte photo (lumière, cadrage, retouche, plaques floutées, pas de logos constructeurs en vedette) ; shooting propriétaire ou banque sous licence ; consignes photo pour les agences dans l'espace partenaire. |
| **Priorité** | Haute (photo Melilla et plaque : immédiat) |
| **Complexité** | M à L (production) |
| **Dépendances** | BR-02 ; budget production. |

### BR-11 — Points de contact hors site peu alignés

| Champ | Détail |
|---|---|
| **État actuel** | E-mails : wordmark texte « ClickDrive Nador », Arial, gris hors jetons (`#5b6472`, `#e3e6eb`) (`lib/email/templates.ts:56-79`). PDF de réservation : Helvetica + `logo_12.png` (`lib/services/pdf.service.ts:171`, `:431`). Modèles WhatsApp : nom cohérent (`docs/whatsapp-templates.md`). |
| **Problème** | Chaque canal réinterprète la marque. |
| **Impact** | Expérience post-réservation (e-mail, PDF) en dessous du niveau attendu d'un service exclusif. |
| **Recommandation** | Gabarit e-mail et PDF alignés sur la nouvelle identité (logo SVG/PNG 2×, couleurs des jetons). |
| **Priorité** | Basse |
| **Complexité** | S |
| **Dépendances** | BR-01, BR-06. |

### BR-12 — Hygiène des actifs de marque

| Champ | Détail |
|---|---|
| **État actuel** | Non référencés dans `frontend/src` : `Logo_CarDrive_12.png`, `logo-12.png`, `logo.jpeg`, `logo_122.png`, `icon_cardrive.ico`, `luxe.jpeg`, `suv.jpeg`, `economique.jpeg`, `voiture.jpeg`, `voiture 7 places.jpeg`, `aeroport nador al aroui.jpeg`, `centre nadar.jpeg`, `next.svg`, `vercel.svg`, `globe.svg`, `window.svg`, `file.svg`, `Logo_ROKAY.png` (1,1 Mo), `Rent Car OuariaMED.png`. Noms avec espaces et fautes (« nadar »). *Réserve : certains logos d'agence peuvent être référencés en base.* |
| **Problème** | Aucune source de vérité des actifs ; risque de réutiliser un ancien logo. |
| **Impact** | Dette, poids du dépôt, erreurs d'intégration. |
| **Recommandation** | Dossier `brand/` versionné (sources SVG + exports), inventaire, suppression des fichiers obsolètes **après vérification en base** et accord du propriétaire. |
| **Priorité** | Basse |
| **Complexité** | S |
| **Dépendances** | BR-01. |

---

## 3. Ce qui est à préserver

- **Architecture de jetons** (`globals.css`, `@theme static`) : une valeur se change à un seul endroit ; c'est le levier principal de la future migration.
- **Discipline des affirmations vérifiables** (pas de « temps réel », pas de note inventée — `site-footer.ts:4`, `audit-ui-ux.md` C1–C3) : compatible et même nécessaire pour une marque premium.
- **Contrastes documentés et mesurés** (en-tête de `globals.css`).
- **Règle « pas de rouge dans les titres »** (décision du propriétaire, 23/11/2026).
- **Import statique du logo** (`src/lib/brand/logo.ts`) : bon point d'entrée unique, à étendre aux variantes.

## 4. Questions à trancher par le propriétaire avant implémentation

1. La tagline reste-t-elle en anglais dans toutes les langues, ou est-elle traduite ?
2. Le rouge reste-t-il couleur de marque, ou devient-il couleur d'action seule ?
3. Le segment « Luxe » devient-il l'offre principale, ou une gamme parmi d'autres (Économique, SUV, Motos) ?
4. Budget et calendrier pour la création du logo vectoriel et la production photo.
