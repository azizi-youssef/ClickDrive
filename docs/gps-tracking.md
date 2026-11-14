# ClickDrive — Suivi GPS de la flotte

Module de géolocalisation des véhicules des agences (voitures et motos) : dernière position, historique, trajets, alertes,
zones géographiques, gestion des boîtiers, avec isolation stricte entre agences.

> **État d'intégration matérielle.** Aucun identifiant fournisseur ni aucun boîtier réel n'était disponible. Le module est
> complet côté plateforme (base, sécurité, ingestion, API, interface) et reçoit des positions par un **contrat d'ingestion
> normalisé et signé** (`Clickdrive-gateway`). Les intégrations propres à un constructeur (Traccar, Flespi) sont déclarées
> **`pending`** : aucun format, aucune route ni aucune authentification n'y est supposé, la route répond `501`. Rien n'est simulé.
> Voir [§ 6](#6-fournisseurs-gps) pour ce qu'il reste à faire pour activer un boîtier physique.

## 1. Décisions produit appliquées

| Décision | Mise en œuvre |
|---|---|
| Le suivi est attaché au **véhicule** | `vehicle_trackers.vehicle_id` ; aucune condition sur le statut d'une réservation. Un véhicule est suivi hors location comme pendant une location. |
| Pendant une location | La réservation `ACTIVE` du véhicule est associée aux positions et aux trajets (`booking_id`) comme **contexte** ; seule sa référence est exposée, jamais l'identité du locataire. |
| Le client n'accède à rien | Aucune policy RLS, aucun droit de table ni de fonction pour un client ; aucune coordonnée dans les API publiques, les métadonnées SEO ni les réponses de réservation. |
| Agent / lecteur : aucun accès | Matrice de rôles ci-dessous. |
| Super Admin : accès **explicite et audité** | Pas d'accès implicite. Autorisation de support motivée, de 5 à 120 minutes, lecture seule, visible et révocable par l'agence, journalisée. |
| Jamais d'accès inter-agences | Clés composites agence↔véhicule, RLS, fonctions qui revérifient la permission, tests multi-agences. |

### Matrice des rôles

| Permission | agency_admin | agency_manager | agency_agent | viewer | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `tracking.read` | ✓ | ✓ | — | — | autorisation de support uniquement |
| `tracking.manage` (boîtiers, zones) | ✓ | ✓ | — | — | — |
| `tracking.alerts.manage` (accusé de réception) | ✓ | ✓ | — | — | — |
| `tracking.settings.manage` (conservation, seuils, conformité) | ✓ | — | — | — | — |

Le raccourci « le Super Admin a toutes les permissions » de `has_agency_permission` **ne s'applique pas** aux permissions `tracking.*`
(la fonction a été redéfinie en conséquence ; les autres permissions sont inchangées). La matrice TypeScript
(`AGENCY_ROLE_TRACKING_PERMISSIONS`, `@clickdrive/shared/roles`) n'est qu'un miroir pour l'affichage ; un test de parité la compare à la base.

## 2. Architecture

```
Boîtier OBD-II ──► fournisseur / passerelle ──► POST /api/webhooks/tracking/[provider]   (signé, borné, limité)
                                                        │  service_role (serveur uniquement)
                                                        ▼
                                          tracking_ingest_event()  ── transaction, verrou par boîtier ──►
                          vehicle_locations (historique) · vehicle_tracking_latest · vehicle_trips · tracking_alerts
                                                        │                                   ▲
                                          Supabase Realtime (RLS)                           │ cron 5 min
                                                        ▼                         /api/cron/tracking
Navigateur ◄── /api/agency/tracking/* (session + permission + RLS) ◄─ fonctions SQL de lecture ─ hors ligne, trajets
```

* **Next.js BFF = API canonique.** Les routes agence utilisent le **client Supabase de l'utilisateur** (RLS appliquée) ;
  la clé `service_role` n'est utilisée que par le webhook et la maintenance, jamais envoyée au navigateur.
* **Supabase PostgreSQL = source de vérité.** Les opérations critiques (idempotence, ordre des événements, trajets, alertes,
  affectations, audit) sont des fonctions SQL transactionnelles (`SECURITY DEFINER`, `search_path` figé).
* Code : `frontend/src/lib/tracking/` (types, schémas Zod, services, fournisseurs, webhook, temps réel), routes
  `frontend/src/app/api/agency/tracking/`, écrans `frontend/src/app/agency/tracking/` et `frontend/src/components/agency/tracking/`.

## 3. Base de données

Migrations additives (appliquer après `20261118000100_agency_duration_discounts.sql`) :

| Fichier | Contenu |
|---|---|
| `20261119000100_gps_tracking_schema.sql` | Permissions et matrice, redéfinition de `has_agency_permission`, clé `UNIQUE (id, agency_id)` sur `vehicles`, 12 tables, index, RLS, Realtime |
| `20261119000200_gps_tracking_functions.sql` | Ingestion, trajets, alertes, zones, audit, support, maintenance, purge, fonctions de lecture |

### Tables

| Table | Rôle | Points clés |
|---|---|---|
| `vehicle_trackers` | Inventaire des boîtiers | `UNIQUE (provider, external_device_id) WHERE status <> 'DISCONNECTED'` ; **un seul boîtier par véhicule** (`UNIQUE (vehicle_id)`) ; FK composite `(vehicle_id, agency_id)` → `vehicles` ; aucune donnée d'identification fournisseur secrète |
| `vehicle_tracker_assignments` | Historique des affectations (réaffectations auditées) | Une affectation ouverte par boîtier |
| `vehicle_locations` | Historique append-only | `UNIQUE (tracker_id, dedupe_key)` (idempotence) ; `quality` ∈ OK / JUMP / LOW_ACCURACY / LATE ; coordonnées bornées et (0,0) interdit ; index `(vehicle_id, recorded_at DESC, id DESC)` et `(agency_id, recorded_at)` |
| `vehicle_tracking_latest` | Dernière position par véhicule (table diffusée en Realtime) | Mise à jour gardée : `WHERE recorded_at < EXCLUDED.recorded_at` |
| `vehicle_trips` | Trajets | Un seul trajet `IN_PROGRESS` par véhicule (index unique partiel) |
| `tracking_alerts` | Alertes | Index uniques partiels : une alerte ouverte par condition durable, un enregistrement par événement ponctuel |
| `vehicle_geofences` / `vehicle_geofence_assignments` | Zones (cercles) et véhicules affectés | `shape = 'CIRCLE'` ; colonne `geometry` réservée aux polygones ; état entrée/sortie par couple zone↔véhicule |
| `tracking_settings` | Paramètres par agence | Conservation, seuils, vitesse, heures calmes, déclarations de conformité |
| `tracking_audit_log` | Audit **immuable** | `UPDATE`/`DELETE` refusés par trigger (seule la purge planifiée, après 730 jours, y est autorisée) ; sans clé étrangère pour ne jamais bloquer une suppression de compte |
| `tracking_support_grants` | Autorisations de support plateforme | Durée ≤ 2 h (contrainte), motif ≥ 10 caractères |
| `tracking_ingest_failures` | Monitoring des rejets d'ingestion | Sans coordonnées ni corps de requête ; `service_role` seul ; purge à 30 jours |

La clé composite `(id, agency_id)` sur `vehicles` permet aux clés étrangères composites de **garantir en base** qu'un boîtier, une
position, un trajet, une alerte ou une affectation ne peuvent jamais relier deux agences.

### Politiques d'accès

* Toutes les tables ont la RLS activée. `authenticated` n'a que `SELECT` (aucun `INSERT`/`UPDATE`/`DELETE`) ; `anon` n'a rien.
  Politique de lecture : `agency_id IN (SELECT tracking_agency_ids('tracking.read'))` (évalué une fois par requête, pas par ligne).
  L'audit exige `tracking.manage` ; les autorisations de support sont lisibles par les administrateurs de l'agence (transparence).
* Toutes les écritures passent par des fonctions qui lisent l'identité dans `auth.uid()` (jamais un paramètre), revérifient la permission
  sur l'agence **de l'objet ciblé**, écrivent l'audit dans la même transaction, et répondent « introuvable » pour un objet d'une autre
  agence (pas de fuite d'existence).
* Les fonctions d'ingestion, de maintenance et de purge sont réservées à `service_role` (`auth.role()` vérifié dans la fonction).

### Audit

`tracking_audit_log` enregistre : enregistrement / affectation / réaffectation / déconnexion de boîtier, création / modification /
suppression de zone, modification des paramètres, accusés de réception, autorisations de support (octroi, révocation), et les
**consultations sensibles** (historique de positions, tracé de trajet, toute lecture par un Super Admin via une autorisation de
support). Si la trace d'une lecture échoue, la donnée n'est pas servie. Aucune coordonnée, aucun secret, aucune donnée de
locataire dans les métadonnées. Les consultations de la carte en direct ne sont pas tracées (volume) ; seul l'accès de support l'est.

## 4. Ingestion et traitement

### Fonction `tracking_ingest_event(provider, external_device_id, event)`

1. **Résolution serveur** du boîtier par `(provider, external_device_id)` ; l'agence et le véhicule viennent de la base.
   `agency_id` / `vehicle_id` présents dans une charge utile sont ignorés (supprimés dès le schéma Zod, et jamais lus par la fonction).
2. Verrou de ligne sur le boîtier : les livraisons concurrentes d'un même appareil sont sérialisées.
3. **Validation** : horodatage obligatoire (≤ 2 min dans le futur, ≤ 72 h dans le passé), coordonnées finies, bornées, ≠ (0,0), cohérentes
   (latitude **et** longitude) ; vitesse, cap, précision, tension… aberrants → ignorés (jamais propagés dans une distance ou une alerte).
4. **Idempotence** : clé `event_id` du fournisseur, sinon empreinte `(horodatage, lat, lon)` ; un doublon est répondu `duplicate`.
5. **Ordre** : un événement non postérieur au dernier traité est `LATE` : conservé en historique, **sans effet** sur la position courante,
   les trajets ni les alertes (les trajets ne sont pas recalculés rétroactivement).
6. **Qualité** : précision > 100 m ou < 3 satellites → `LOW_ACCURACY` ; saut incohérent (> 250 km/h déduits et > 200 m) → `JUMP`
   (après 2 rejets consécutifs, la nouvelle position devient la référence — véhicule réellement déplacé — sans distance cumulée).
   Seules les positions `OK` alimentent position courante, trajets, vitesse et zones.
7. Association de la **réservation** active du véhicule (`booking_id`), sans condition de suivi.

### Trajets

* Mouvement : vitesse ≥ seuil de l'agence (5 km/h) ou, sans vitesse, vitesse déduite de la distance.
* Début : premier mouvement ; le lieu de départ est la dernière position à l'arrêt si elle date de moins de 3 min.
* Distance : somme des segments valides uniquement (≥ 5 m, vitesse déduite ≤ 250 km/h, jamais cumulée à l'arrêt : le bruit GPS d'un véhicule
  immobile ne crée ni distance ni trajet).
* Fin : contact coupé (si fourni par le boîtier), arrêt ≥ 5 min (configurable), interruption du signal > 15 min, rupture de données,
  boîtier retiré, ou maintenance (`STALE`). Un trajet < 100 m est écarté comme bruit.

### Alertes (sans doublon)

| Type | Déclencheur | Dédoublonnage |
|---|---|---|
| `DEVICE_OFFLINE` | aucune communication depuis le délai de l'agence (15 min par défaut) ; critique pendant une location | une alerte ouverte par boîtier ; résolue à la reprise |
| `GEOFENCE_ENTER` / `GEOFENCE_EXIT` | franchissement du cercle (marge de 5 % / 10–50 m à la sortie contre les oscillations) ; **aucune alerte au premier fix** | un enregistrement par franchissement et par horodatage |
| `SPEED_LIMIT` | vitesse > limite configurée (désactivée par défaut) | une alerte ouverte tant que dure le dépassement (pic mémorisé) ; résolue au retour sous la limite |
| `UNEXPECTED_MOVEMENT` | départ **hors réservation** pendant les heures calmes (désactivé par défaut ; fuseau Africa/Casablanca) | un par trajet |
| `TRACKER_TAMPER` / `TRACKER_DISCONNECTED` | **uniquement si le boîtier fournit** ces signaux (`tamper`, `power_disconnected`) | une alerte ouverte tant que le signal persiste |

Chaque alerte porte véhicule, type, gravité, horodatage, description, statut d'accusé de réception et horodatage d'accusé de réception.

### Maintenance (`/api/cron/tracking`, toutes les 5 minutes)

`tracking_run_maintenance()` crée les alertes « hors ligne » et ferme les trajets abandonnés ; `tracking_purge_expired()` supprime par lots les
positions (`retention_days`, 90 par défaut), les trajets et alertes résolues (`trip_retention_days`, 365), les rejets d'ingestion (30 j) et l'audit (730 j).

## 5. API

Toutes les réponses : `{ success: true, data, meta? }` ou `{ success: false, code, error }` ; `Cache-Control: private, no-store`.
Chaque route : configuration Supabase (sinon **503**, échec fermé) → session (**401**) → agence résolue depuis les appartenances actives (jamais depuis le
navigateur seul) → permission vérifiée par la base (**403**) → client de l'utilisateur sous RLS → validation Zod (**422**) → réponse validée.
`?agency_id=` n'est accepté que pour une agence dont l'utilisateur est membre (ou, pour un Super Admin, dans le cadre d'une autorisation de support).

| Méthode | Route | Permission | Notes |
|---|---|---|---|
| GET | `/api/agency/tracking/vehicles` | `tracking.read` | Flotte : compteurs, états, dernières positions ; `q`, `state`, `limit ≤ 500`, `offset` |
| GET | `/api/agency/tracking/vehicles/[id]` | `tracking.read` | Fiche : position, boîtier, réservation (référence seule), stats du jour, zones |
| GET | `/api/agency/tracking/vehicles/[id]/location` | `tracking.read` | Dernière position et état |
| GET | `/api/agency/tracking/vehicles/[id]/history` | `tracking.read` | `from`, `to` (≤ 31 j), `limit ≤ 1000`, `cursor` (keyset), `include_suspect` ; **consultation journalisée** |
| GET | `/api/agency/tracking/vehicles/[id]/trips` | `tracking.read` | `from`, `to` (≤ 93 j), `page`, `page_size ≤ 100` |
| GET | `/api/agency/tracking/trips` | `tracking.read` | Idem pour toute l'agence (`vehicle_id` optionnel) |
| GET | `/api/agency/tracking/trips/[id]/route` | `tracking.read` | Tracé rééchantillonné (≤ 1 500 points) ; consultation journalisée |
| GET | `/api/agency/tracking/alerts` | `tracking.read` | `status`, `type`, `severity`, `vehicle_id`, pagination |
| PATCH | `/api/agency/tracking/alerts/[id]` | `tracking.alerts.manage` | `{ "action": "acknowledge" }` (idempotent) |
| GET / POST | `/api/agency/tracking/trackers` | `read` / `manage` | Liste (+ fournisseurs et leur statut) / enregistrement (fournisseur `pending` refusé : 422) |
| PATCH | `/api/agency/tracking/trackers/[id]` | `tracking.manage` | Une opération par requête : champs, affectation (`vehicle_id` ou `null`), ou `disconnect` |
| GET / POST | `/api/agency/tracking/geofences` | `read` / `manage` | Zones circulaires (25 m – 100 km), 100 par agence |
| PATCH / DELETE | `/api/agency/tracking/geofences/[id]` | `tracking.manage` | |
| GET / PATCH | `/api/agency/tracking/settings` | `read` / `tracking.settings.manage` | |
| GET / DELETE | `/api/agency/tracking/support-grants[/id]` | `tracking.settings.manage` | Transparence et révocation par l'agence |
| POST / DELETE | `/api/admin/tracking/support-access` | Super Admin | Octroi (motif ≥ 10 car., 5–120 min, lecture seule) / révocation |
| POST | `/api/webhooks/tracking/[provider]` | signature HMAC | Voir § 6 |
| GET | `/api/cron/tracking` | `Authorization: Bearer CRON_SECRET` | Maintenance |

Erreurs SQL → HTTP : `42501` → 403, `P0002` → 404 (inclut « appartient à une autre agence »), `23505` → 409 (message identique que le boîtier existe chez
l'agence ou ailleurs), `23514`/`22023` → 422, schéma non migré → 503, autre → 500 neutre (détail journalisé côté serveur uniquement).

## 6. Fournisseurs GPS

### Contrat `klickdrive-gateway` (v1) — disponible

`POST /api/webhooks/tracking/klickdrive-gateway` — `Content-Type: application/json`, corps ≤ 256 Ko, ≤ 100 événements.

```
X-ClickDrive-Signature: t=<secondes Unix>,v1=<HMAC-SHA256 hex>        # HMAC(secret, `${t}.${corpsBrut}`)
{ "events": [ { "device_id": "IMEI-8650", "event_id": "a1b2", "recorded_at": "2026-11-14T10:00:00Z",
                "latitude": 35.1688, "longitude": -2.9335, "speed_kmh": 42, "heading_deg": 90,
                "ignition": true, "accuracy_m": 6, "satellites": 9, "odometer_km": 15230.4,
                "tamper": false, "power_disconnected": false, "metadata": {"fw": "1.2"} } ] }
```

```js
// Émetteur (Node) — exemple de signature
const t = Math.floor(Date.now() / 1000);
const sig = `t=${t},v1=${require('crypto').createHmac('sha256', SECRET).update(`${t}.${rawBody}`).digest('hex')}`;
```

Sécurité : fournisseur connu (404) ; corps JSON (415) ; plafond **réel** de 256 Ko (413) ; limitation de débit par fournisseur et IP, **partagée en base**
(1 200 req/min ; 429 ; limiteur indisponible en production → 503) ; secret serveur obligatoire (absent ou < 32 car. → 503, **jamais d'acceptation sans signature**) ;
signature comparée en temps constant, horodatage signé (5 min passé / 1 min futur : anti-rejeu) ; JSON strict ; un événement invalide est rejeté sans bloquer les autres ;
appareil inconnu → comptabilisé et journalisé pour le monitoring ; erreur d'infrastructure → 503 + `Retry-After` (l'ingestion est idempotente, le rejeu est sûr).
Rotation de secret : `TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY=nouveau,ancien`. La réponse ne contient ni coordonnée ni identifiant d'agence/véhicule.

Cette passerelle **n'est pas un protocole constructeur** : c'est le contrat à produire par un connecteur (à écrire pour le fournisseur choisi) ou par une
passerelle de l'agence. Sans émetteur configuré avec le secret, aucune donnée n'arrive et les boîtiers restent « en attente de position ».

### Intégrations constructeur — `pending`

`traccar` et `flespi` sont déclarés dans `lib/tracking/providers/adapters/pending.ts` ; leur route répond `501 PROVIDER_INTEGRATION_PENDING` et l'enregistrement d'un boîtier
sur ces fournisseurs est refusé. **Ce qui manque pour activer un boîtier physique :**

1. un compte fournisseur réel et au moins un boîtier OBD-II ;
2. la documentation officielle de **livraison** (webhook, flux ou API) : méthode d'authentification, format des messages et des événements, identifiant d'appareil ;
3. un adaptateur (`TrackingProviderAdapter` : `verifyRequest`, `parseDelivery`) qui produit des `NormalizedTrackingEvent`, avec ses tests contre des charges utiles **réelles** ;
4. le secret de livraison dans l'environnement serveur (`TRACKING_WEBHOOK_SECRET_<FOURNISSEUR>`) ;
5. la déclaration dans `provider.factory.ts` (passer de `pending` à `available`).

L'idempotence, l'ordre, la qualité, les trajets, les alertes, l'isolation et l'audit sont indépendants du fournisseur et n'ont pas à être refaits.

**Limite connue (risque d'usurpation d'identifiant).** Un identifiant d'appareil est unique parmi les boîtiers non déconnectés : une agence ne peut pas enregistrer
l'identifiant d'un appareil déjà enregistré ailleurs (réponse identique dans tous les cas). Mais une agence malveillante pourrait enregistrer, avant l'agence légitime, un
identifiant qu'elle devine, avec un compte fournisseur **partagé**. Mitigation recommandée : un sous-compte fournisseur (donc un secret de signature) par agence, ou une
confirmation de propriété à l'enregistrement propre au fournisseur — à définir avec le premier fournisseur réel.

## 7. Temps réel

* Tables publiées : `vehicle_tracking_latest` et `tracking_alerts` seulement (jamais l'historique). Le navigateur charge d'abord l'état par l'API autorisée, puis applique les événements.
* **Autorisation** : Realtime « Postgres Changes » applique la **RLS** de l'abonné ; le filtre `agency_id=eq.<agence>` n'est qu'une optimisation, un client qui le modifie ne reçoit rien de
  plus. Les événements `DELETE` ne portent que la clé primaire (aucune coordonnée) et ne sont pas filtrés par la RLS ; l'interface recharge sur suppression.
  Les canaux Broadcast privés (`realtime.messages`) ne sont pas utilisés.
* Regroupement des positions (400 ms), ignorance des positions plus anciennes, indicateur d'état (« Direct », « Connexion… », « Reconnexion — actualisation toutes les 15 s »),
  interrogation de secours (15 s sans connexion, 60 s en direct), rechargement complet à la reconnexion, pause quand l'onglet est masqué, nettoyage du canal au démontage.

## 8. Interface

Pages : `/agency/tracking` (carte, indicateurs, liste, détail), `/agency/tracking/vehicles/[vehicleId]`, `/agency/tracking/history`, `/agency/tracking/alerts`,
`/agency/tracking/geofences`, `/agency/tracking/devices`, `/agency/tracking/settings`. Entrée « Suivi GPS » dans la barre latérale (seulement avec `tracking.read`, vérifié côté
serveur ; la garde serveur de chaque page, l'API et la base revérifient). Carte MapLibre GL JS, chargée à la demande (jamais dans le bundle commun) ; les marqueurs sont des
couches GeoJSON (pas un nœud DOM par véhicule) ; la liste est l'alternative accessible à la carte.
Composants : `TrackingDashboard`, `TrackingMap`, `VehicleTrackingList`, `VehicleLocationCard`, `VehicleStatusBadge`, `TripHistory`, `TripTimeline`, `TrackingAlerts`,
`GeofenceEditor`, `TrackerManagement` (+ `TrackingSettingsPanel`, `VehicleTrackingDetail`, `GeofencesPanel`, `TrackingShell`).

**Fond de carte.** Aucun fournisseur ni clé codé en dur : `NEXT_PUBLIC_MAP_STYLE_URL` ou `NEXT_PUBLIC_MAP_TILES_URL` + `NEXT_PUBLIC_MAP_ATTRIBUTION`. Sans configuration :
OpenStreetMap en développement uniquement (sa politique d'usage interdit un usage applicatif intensif) ; **en production, grille neutre** et message explicite.
La CSP (`next.config.ts`) n'autorise que les origines configurées.

## 9. Vie privée et conformité

Ce module fournit des **outils** ; il **n'établit ni ne certifie aucune conformité légale** (loi 09-08 / CNDP ou autre). L'agence est responsable du traitement.

* Accès limité aux personnels habilités (rôles), aucun accès client, super-administration seulement par autorisation motivée, bornée, visible et révocable.
* Consultations sensibles et opérations de gestion journalisées dans un journal immuable.
* Durées de conservation configurables par l'agence (positions 7–730 j, défaut 90 ; trajets et alertes 30–1 825 j, défaut 365) et purge automatique. **Ces défauts sont des valeurs
  techniques, pas un avis juridique.**
* Écran « Paramètres » : base légale invoquée et référence CNDP (**déclarations de l'agence**, non vérifiées), confirmation datée que les locataires sont informés,
  modèle de texte d'information à adapter. L'intégration automatique de cette information dans le contrat de location ou le parcours de réservation **n'est pas réalisée**
  (elle touche des fichiers et des textes juridiques à faire valider) : à planifier avec le conseil juridique.
* Les positions sont protégées en transit (HTTPS) et au repos par le chiffrement du disque de Supabase ; aucun chiffrement applicatif supplémentaire n'est ajouté.
* Aucune identité de locataire n'est exposée par le suivi (seule la référence de la réservation).
* Les positions ne sont utilisées pour aucune finalité étrangère au suivi (aucun export, aucun croisement).

## 10. Capacité et performance

Estimation (hypothèses, **non mesurées**) : 1 position / 30 s en déplacement, 1 / 5 min à l'arrêt, ≈ 4 h de conduite par jour → ≈ 700 lignes par véhicule et par jour ;
2 000 véhicules → ≈ 1,4 M lignes/jour, ≈ 130 M lignes à 90 jours (≈ 40–50 Go avec index).

* **Partitionnement : non appliqué.** Table ordinaire avec index adaptés (`(vehicle_id, recorded_at DESC, id DESC)` pour l'historique et le keyset, `(agency_id, recorded_at)` pour la purge) ;
  purge par lots par agence. À reconsidérer (partitionnement mensuel sur `recorded_at`, suppression des partitions) lorsque `vehicle_locations` dépasse ≈ 50 M de lignes ou que la purge
  quotidienne dépasse la fenêtre de maintenance — à décider sur **mesure** en production.
* **PostGIS : non utilisé.** Aucune requête spatiale sur l'historique ; les zones sont des cercles évalués par Haversine sur quelques zones par véhicule, à l'ingestion.
* Une requête agrégée pour toute la flotte (jamais une requête par véhicule) ; historique borné (31 jours, 1 000 points par page) ; trajets bornés (93 jours, 100 par page) ;
  tracé rééchantillonné côté base ; temps réel limité à la dernière position ; polices RLS évaluées une fois par requête.
* Écriture par position : 1 insertion, 1 mise à jour de la dernière position, 1 mise à jour de trajet, 1 mise à jour du boîtier (sans index modifié : mises à jour « HOT »).

## 11. Variables d'environnement

| Variable | Portée | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navigateur + serveur | Existantes ; absentes en production → 503 (échec fermé) |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur uniquement** | Existante ; requise par le webhook, la maintenance et le limiteur de débit partagé |
| `TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY` | **serveur uniquement** | Secret HMAC du webhook (≥ 32 car. ; virgules = rotation) |
| `TRACKING_WEBHOOK_SECRET_<FOURNISSEUR>` | **serveur uniquement** | Pour chaque futur adaptateur |
| `CRON_SECRET` | **serveur uniquement** | Existante ; authentifie `/api/cron/tracking` (même valeur que le secret GitHub) |
| `NEXT_PUBLIC_MAP_STYLE_URL` / `NEXT_PUBLIC_MAP_TILES_URL` + `NEXT_PUBLIC_MAP_ATTRIBUTION` / `NEXT_PUBLIC_MAP_EXTRA_ORIGINS` | navigateur (public, aucune clé secrète) | Fond de carte |

## 12. Déploiement

1. Déployer d'abord le code, puis appliquer les migrations `20261119000100` et `20261119000200` (l'ordre inverse n'est pas gênant : les routes répondent 503 tant que le schéma est absent).
   Vérifier que le rôle propriétaire peut exécuter `ALTER TABLE vehicles ADD CONSTRAINT … UNIQUE (id, agency_id)` (verrou bref) et que PostgreSQL ≥ 15 est utilisé (`ON DELETE SET NULL (colonne)`).
2. Dans Supabase : vérifier que **Realtime** inclut `vehicle_tracking_latest` et `tracking_alerts` (la migration les ajoute à `supabase_realtime`).
3. Configurer les variables du § 11 chez l'hébergeur ; créer les secrets GitHub `CLICKDRIVE_APP_URL` et `CRON_SECRET` (workflow `.github/workflows/tracking-maintenance.yml`, toutes les 5 minutes).
4. Choisir et configurer un fournisseur de fond de carte (§ 8).
5. Vérifier avec un compte de test par rôle (admin, gestionnaire, agent, lecteur, client) et deux agences : refus 403 hors permission, aucun accès inter-agences.
6. Enregistrer un boîtier, l'affecter à un véhicule, envoyer un événement signé, vérifier la carte, puis rejouer le même événement (réponse `duplicate`).
7. **Retour arrière** : le module est additif. Pour l'arrêter sans perdre de données : retirer le secret du webhook (les livraisons répondent 503 et le fournisseur rejoue) et désactiver le workflow
   de maintenance. Ne pas supprimer les tables sans décision de conservation ; les permissions `tracking.*` peuvent être retirées de `role_permissions` pour fermer l'accès.
8. Rejouer sur Supabase local/staging les tests de base (§ 13) : ils ont été exécutés sur PGlite, pas sur une instance Supabase.

## 13. Tests

* `npm run test:db` — `src/tests/db/gps-tracking.spec.ts` (PGlite, vraies migrations) : permissions et parité TypeScript/base, RLS multi-agences, ingestion (valide, appareil inconnu, doublon, hors séquence,
  coordonnées/horodatage invalides, saut GPS, faible précision), trajets (création, clôture, distance, bruit, interruption), zones et alertes (entrée/sortie, hystérésis, vitesse, hors ligne, matériel,
  mouvement inattendu, accusé de réception), support plateforme, audit immuable, purge, intégrité inter-agences.
* `npm run test:unit` — fournisseurs et signature (rejeu, rotation), webhook (413/415/429/503/401/422, idempotence, aucune identité de la charge utile), API (401/403/503/404/422 sur chacune des routes),
  Zod, géométrie, temps réel (états, regroupement, secours, nettoyage), composants (chargement, vide, erreur, carte, reconnexion).
* **Limites** : PGlite n'est pas Supabase — le filtrage Realtime réel (WebSocket, JWT, PostgREST) n'est pas exercé ; la carte réelle (WebGL) n'est pas exécutée en test (remplacée par un double) ;
  aucun test avec un boîtier ou un fournisseur réels.

## 14. Dépannage

| Symptôme | Vérifications |
|---|---|
| Webhook `503 PROVIDER_NOT_CONFIGURED` | `TRACKING_WEBHOOK_SECRET_*` absent ou < 32 caractères |
| Webhook `401` | Signature calculée sur le **corps brut exact** ; horloge de l'émetteur (tolérance 5 min / 1 min) ; secret correct (journal `webhook.signature_rejected`, raison) |
| Webhook `200` mais `unknown_device` | L'identifiant envoyé ne correspond à aucun boîtier non déconnecté enregistré pour ce fournisseur ; voir `tracking_ingest_failures` |
| Boîtier « en attente de position » | Aucun événement valide reçu ; `unassigned` (non affecté) ou `disabled` (en pause) dans la réponse du webhook |
| Position « hors ligne » alors que le boîtier émet | `offline_after_minutes` de l'agence ; horodatage du boîtier trop ancien (`timestamp_too_old` > 72 h) ou dans le futur (> 2 min) |
| Pas de trajet | Vitesse sous le seuil, déplacement < 100 m, ou positions `LOW_ACCURACY`/`JUMP` |
| Carte vide / sans fond | Configuration du fond de carte ; CSP (`NEXT_PUBLIC_MAP_EXTRA_ORIGINS`) ; WebGL |
| Pas de mise à jour en direct | Tables dans la publication Realtime ; indicateur « Reconnexion » (secours à 15 s) ; RLS (l'utilisateur a-t-il `tracking.read` ?) |
| 503 sur l'API | Variables Supabase ; migrations appliquées (`PGRST202` dans les journaux) |

Journaux structurés : `{"scope":"tracking","event":"webhook.processed", …}` (compteurs, jamais de coordonnées, de signature ni de charge utile).
