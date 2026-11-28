# ClickDrive — Correctifs « prêt pour la production » (27/11/2026)

Travail réalisé à partir du prompt « CarDrive production-ready », **avec les arbitrages du propriétaire** :

| Sujet | Décision |
|---|---|
| Nom de marque | **ClickDrive conservé** : pas de renommage en CarDrive (décision du 27/11, en cours de travail) |
| Logos | **Inchangés** : `public/logo_12.png`, favicon et icônes d'origine |
| Palette | Graphite `#0B1220` + rouge conservés (pas de bleu `#02306B`), désormais centralisés |
| Langues | Système i18n maison conservé (6 langues complètes, arabe en RTL) ; pas de migration next-intl |
| Données motos en production | Script SQL **à relire**, non exécuté |

Rien n'est commité. Vérifications : `tsc` OK, 1 213 tests unitaires et tous les tests historiques OK, ESLint 0 erreur (84 avertissements, tous antérieurs), axe-core WCAG 2.1 AA sans violation sur l'accueil, `/search`, `/motos`, `/contact` et une fiche véhicule, captures 375 / 768 / 1280 px sans défilement horizontal.

---

## 1. Fichiers créés

| Fichier | Rôle |
|---|---|
| `frontend/src/config/site.ts` | Source unique : nom, slogan, URL du site (`NEXT_PUBLIC_SITE_URL` → domaine Vercel → `clickdrive.ma`), domaine, zone desservie, WhatsApp, e-mails, horaires, couleurs système |
| `frontend/src/data/locations.ts` | Lieux de prise en charge normalisés (libellé, valeur d'adresse stable, alias, page SEO, photo) |
| `frontend/src/lib/catalog/footer-categories.ts` | Catégories du pied de page calculées depuis le catalogue réel (catégories vides masquées) |
| `frontend/src/components/search/SearchSummaryChips.tsx` | Résumé de recherche en pastilles [Lieu] [Dates · durée] [Catégorie] + « Modifier » |
| `frontend/src/app/manifest.ts` | Manifeste généré depuis la config (remplace `public/manifest.webmanifest`, supprimé) |
| `backend/supabase/data-fixes/20261127_motos_cylindree_permis.sql` | Correction des fiches motos (à relire puis exécuter) |
| Tests : `src/data/locations.spec.ts`, `src/lib/constants/contact.spec.ts`, `src/lib/catalog/footer-categories.spec.ts` | + cas ajoutés dans `vehicle.spec.ts` et `SearchBar.spec.tsx` |

## 2. Fichiers modifiés (77)

- **Config et SEO** : `app/layout.tsx` (métadonnées, theme-color, JSON-LD `AutoRental`, horaires), `app/robots.ts`, `app/sitemap.ts`, `app/(seo)/[seoSlug]/page.tsx`, `app/agency/join/layout.tsx`, `lib/i18n/server.ts`, `lib/seo/structured-data.ts`, `proxy.ts`, `app/opengraph-image.tsx`
- **Contacts** : `lib/constants/contact.ts` (WhatsApp unique, format international, horaires localisés), `lib/constants/legal.ts`, `components/shared/Navbar.tsx` (numéro différent supprimé), `components/shared/Footer.tsx`, `app/contact/ContactClient.tsx`, `app/cgv`, `app/confidentialite`, `app/mentions-legales`, `app/cars/[slug]/CarDetailsClient.tsx`, `app/suivi/[reference]/page.tsx`, `app/account/bookings/[reference]/page.tsx`, services `whatsapp`, `notification`, `pdf`, `email/send`
- **Recherche et prix** : `components/search/SearchBar.tsx`, `app/search/SearchClient.tsx`, `components/search/CatalogFilters.tsx` (contraste), `lib/i18n/format.ts`, `lib/utils.ts`, `components/ui/PriceDisplay.tsx`, `components/cars/SameModelAlternatives.tsx`, `lib/utils/date-only.ts`
- **Véhicules et lieux** : `lib/vehicles/kind.ts`, `lib/validations/vehicle.ts`, `lib/constants/catalog.ts`, `lib/constants/meetingPoints.ts`, `lib/catalog/search-context.ts`, `components/cars/VehicleCard.tsx`, `app/HomeClient.tsx`, `components/layout/AppShell.tsx`
- **Textes (6 langues)** : `lib/i18n/messages/{about,agencies,booking,car,contact,faq,home,meta,navbar,site-footer,vehicle}.ts`, `lib/i18n/translations/*.ts`, `lib/seo/landingPages.ts`
- **Renommages techniques** (anciennes constantes `CLICKDRIVE_WHATSAPP_NUMBER` / `clickdriveWhatsAppUrl`) : `AgencyProfile`, `api/bookings/route.ts`, `AgencySubscriptionPanel`, `PendingPlanChangeBanner`, `email/templates.ts` ; coquilles « KlickDrive » corrigées dans `BookingDetailModal`, `Pagination`, `api/validate.ts`

Le code complet est dans le diff de travail (`git diff`), trop volumineux pour être recopié ici.

---

## 3. Checklist

Légende : ✅ fait · ➖ déjà en place, vérifié · ⚠️ partiel · ⛔ écarté (décision ou raison technique)

### 1. Identité de marque
- ⛔ Renommer en « CarDrive » — **refusé par le propriétaire** ; nom ClickDrive conservé partout.
- ✅ Nom, slogan, contacts, domaine centralisés dans `config/site.ts` et importés (layout, robots, sitemap, proxy, pages légales, Contact, pied de page, en-tête, services).
- ⚠️ Slogan « Comparez. Demandez. Roulez. » : enregistré dans la config et les données structurées (`slogan`), **pas affiché** à l'écran (décision D4 du backlog de marque encore ouverte).
- ✅ Vocabulaire « réserver » → « envoyer une demande » sur les boutons (« Envoyer une demande », « Demander »), la page Agences, la FAQ, le partage, À propos, la page SEO « été » — en 6 langues. Conservé là où une réservation existe réellement (espace « Mes réservations », PDF de demande).
- ⛔ Couleur primaire `#02306B` — écartée (palette graphite + rouge conservée, cohérente avec le logo) ; `theme-color` et manifeste lus dans la config.
- ✅ `NEXT_PUBLIC_SITE_URL` prêt : canonical, sitemap, robots, Open Graph, JSON-LD et liens absolus en dépendent. Sans variable : domaine de production Vercel, puis `clickdrive.ma`. Une valeur `localhost` est ignorée en production.

### 2. Contacts
- ✅ Un seul numéro WhatsApp (`siteConfig.contact.whatsapp`) : **212634536286**, choisi le 27/11. Il était déjà dans l'en-tête ; le reste du site (pied de page, fiches, suivi, réponse automatique, JSON-LD) utilisait 212767137136.
- ✅ Adresse Gmail retirée du pied de page → `contact@clickdrive.ma` (config).
- ✅ Horaires affichés depuis la config, localisés : « lun.–ven. 9h–18h · sam. 9h–13h » (accueil, pied de page, Contact, réponse WhatsApp automatique, JSON-LD).
- ✅ Liens `https://wa.me/212…?text=…` : numéros locaux (« 0775546247 ») convertis au format international — ces liens d'agence étaient **cassés** avant. Message pré-rempli contextuel sur la fiche : véhicule, année, prix, dates, durée, lieu.

### 3. Données véhicules
- ✅ Script SQL : MT-09 → 890 cm³, permis A, catégorie Roadster ; R 1300 RS → 1300 cm³, permis A ; V-Strom 1050 → Trail, permis A. **À exécuter par vous.**
- ✅ Validation Zod : cylindrée ↔ permis (≤ 50 cm³ : AM/A1/B ; 51–125 : A1 ; > 125 : A2/A), en création et en modification. Prix > 0, caution ≥ 0, année 2000…N+1 (déjà présents, désormais testés).
- ✅ Énumération unique `VehicleCategory` (`lib/vehicles/kind.ts`, valeurs de la contrainte SQL). Les slugs proposés (`economique`, `suv`…) n'ont pas été introduits : ils exigeraient une migration de la colonne `category`.
- ✅ Catégories vides : masquées dans le pied de page (ex. « Berlines confort » ne mène plus à une page vide). ➖ Déjà en place : « Bientôt » non cliquable dans « Trouvez votre style », filtres limités aux catégories présentes.
- ➖ Prix « dès … » calculés (minimum de la catégorie) et compteurs de filtres calculés depuis les données — vérifiés.

### 4. Lieux de prise en charge
- ✅ `data/locations.ts` : Aéroport Nador Al Aroui (NDR), Nador Centre, Port de Beni Ansar, Corniche de Marchica, Al Aroui Ville, Gare ONCF Nador Ville, Selouane Centre.
- ✅ Utilisé par la recherche, l'accueil (« Louez là où votre voyage commence » : les liens `?location=Aéroport` n'étaient pas reconnus), le pied de page, les points de rendez-vous, le JSON-LD ; libellés traduits normalisés en 6 langues. Valeurs d'adresse inchangées : anciens liens et demandes enregistrées restent valides.
- ✅ « l'Oriental » retiré des textes de couverture (Agences, en-tête, pied de page, slogan des traductions, image de partage, PDF, page partenaire). Conservé dans les adresses postales légales et `addressRegion` du JSON-LD (exact).

### 5. UI / contenu
- ✅ Pied de page : un seul titre par colonne (avant : titre desktop + titre mobile dans le HTML) ; 4 colonnes Explorer / Véhicules / Partenaires / **Aide & légal** (FAQ et Contact y sont regroupés avec les pages légales) + ligne contact (WhatsApp, e-mail, horaires).
- ✅ Résumé de recherche en pastilles séparées + « Modifier » (accueil mobile et catalogue mobile).
- ✅ Prix : un seul formateur (`formatMoney`) avec espace insécable avant « DH ». Note : `Intl.NumberFormat('fr-MA')` produit « 1.700 » ; le format fr-FR existant donne bien « 1 700 DH ».
- ✅ Dates : plus de « — » ; texte « Date de départ / Date de retour » ; ➖ minimum = aujourd'hui et retour > départ déjà en place ; ✅ nombre de jours affiché (« Durée : 3 jours »), relié au champ retour.
- ➖ Remise « −5 % dès 3 jours » : total remisé déjà affiché sur les cartes quand des dates sont choisies — vérifié.
- ➖ États vides avec « Réinitialiser les filtres » — déjà en place.

### 6. Langues
- ⛔ Masquer le sélecteur : condition non remplie (6 langues complètes) ; sélecteur conservé.
- ⛔ Migration next-intl / `messages/fr.json` : écartée ; la structure actuelle couvre déjà ar (RTL), en, es, de, nl, avec tests de parité des clés.

### 7. Accessibilité & SEO
- ✅ `alt` descriptifs : véhicules « Renault Clio 5 2025 – location Nador » (6 langues), héro décrit. Les photos de catégories et de lieux gardent un `alt` vide ou leur nom : elles sont dans un lien dont le nom est déjà le texte visible (WCAG 2.5.3).
- ➖ `next/image` partout côté public, `priority` sur le héro (seule exception : avatar de compte, URL externe).
- ✅ Contraste : compteurs des filtres corrigés (seule violation axe trouvée). ➖ Libellés de champs, focus visible, clavier : vérifiés par axe.
- ⛔ `next-size-adjust` : balise ajoutée par Next.js pour l'ajustement des polices (anti-décalage de mise en page) ; la supprimer dégraderait le CLS. Sans effet SEO.
- ✅ JSON-LD `AutoRental` (+ aéroport en `Airport` avec code IATA, horaires, contact). ➖ Métadonnées par page et pages SEO « aéroport » et « port Beni Ansar » déjà présentes, désormais sur le domaine de la config.

### 8. Qualité
- ✅ Données en dur retirées des composants touchés (contacts, URL, horaires, lieux, catégories du pied de page).
- ✅ TypeScript strict, aucun `any` ajouté.
- ⚠️ Lighthouse ≥ 90 : **non mesuré** (nécessite un build de production ; pas lancé pour ne pas perturber votre serveur de dev).
- ✅ Captures 375 / 768 / 1280 px, sans défilement horizontal.

---

## 4. Décisions métier restantes

1. **Boîte `contact@clickdrive.ma`** : le domaine `clickdrive.ma` ne répond pas aujourd'hui. Tant que la boîte n'existe pas, les e-mails envoyés à cette adresse sont perdus. Créer la boîte (ou remettre temporairement une autre adresse : une ligne dans `config/site.ts`).
2. **Ancien numéro WhatsApp 212767137136** : il n'apparaît plus sur le site. Prévenir les clients ou agences qui l'utilisent encore, et vérifier que le nouveau numéro (212634536286) est bien relié à WhatsApp Business si les réponses automatiques (webhook) doivent fonctionner dessus.
3. **Exécuter le script SQL motos** (`backend/supabase/data-fixes/…`), puis décider de la contrainte SQL facultative et de la boîte « Automatique » de la V-Strom 1050.
4. **Domaine** : définir `NEXT_PUBLIC_SITE_URL` sur Vercel quand le domaine sera branché (vérifier qu'aucune valeur `localhost` n'y est copiée).
5. **Slogan** « Comparez. Demandez. Roulez. » : l'afficher ou non (lié à la décision D4).
6. **Réservation directe** : aujourd'hui le site transmet des demandes ; activer une vraie réservation changerait le parcours, les CGV et le vocabulaire.
7. **Identifiants agences** en `@clickdrive.ma` et adresse de substitution des clients sans e-mail : inchangés (clés techniques en base).
