# ClickDrive — audit et contrôle d’accès agences

## Rapport d’audit de l’architecture existante

### Architecture constatée

- Next.js App Router est le BFF de production : les écrans appellent les route handlers `frontend/src/app/api/*`, qui utilisent les services Supabase.
- `backend/` contient une API Express historique et des stores de développement ; ce n’est pas le chemin d’autorisation du nouveau module.
- Les tables de référence déjà présentes sont `agencies`, `profiles`, `agency_members`, `vehicles`, `bookings` et `audit_logs`. La migration de réservation v2 complète notamment les données et références de réservation.
- Les sessions du BFF utilisent les cookies Supabase SSR. Le compte `service_role` doit rester exclusivement côté serveur.

### Écarts relevés avant changement

1. Les rôles existants sont historiques et en majuscules (`SUPER_ADMIN`, `ADMIN`, `AGENCY_OWNER`, etc.) ; les membres ne possèdent pas de statut d’invitation/révocation.
2. Les anciens contrôles donnent des droits globaux à `ADMIN` (corrigé le 7 novembre 2026 : seul `SUPER_ADMIN` en a désormais), et certains endpoints sont permissifs lorsque Supabase n’est pas configuré. Le nouveau module ne réutilise pas ces chemins : il refuse l’accès si Supabase ou sa vérification de permission est indisponible.
3. `handle_new_user()` acceptait le rôle des métadonnées d’inscription. La migration remplace ce comportement par `CUSTOMER`; la modification directe du rôle d’un profil est interdite aux sessions utilisateur.
4. Les anciennes policies RLS accordaient un accès trop large aux réservations et aux véhicules. Les nouvelles policies se fondent sur le membre actif et la permission de l’agence ; la lecture SQL directe des colonnes d’identité des clients est retirée aux rôles `anon` et `authenticated`.
5. Les services historiques de réservation et les pages client n’étaient pas conçus pour le nouveau niveau de confidentialité. Les nouvelles listes/dossiers locataires passent par un endpoint dédié, une permission `customers.read` et une requête serveur avec clé service-role. Les autres parcours historiques de réservation sont à auditer séparément avant d’en faire un accès invité aux données personnelles.
6. Le dépôt contenait déjà de nombreux changements non commités. Ils ont été préservés ; la migration n’a pas été appliquée à une base distante et aucun secret/environnement local n’a été lu.

Cet audit porte sur les fichiers suivis du dépôt, pas sur une inspection d’un projet Supabase distant. L’absence d’identifiants de base empêche de certifier l’état du schéma réellement déployé.

## Plan de réalisation priorisé

| Priorité | Étape | État |
|---|---|---|
| P0 | RBAC canonique, authentification fail-closed du nouveau module, interdiction d’élévation par métadonnées | Implémenté dans les helpers et la migration |
| P0 | RLS tenant, accès par permission, état de révocation et protection des données personnelles | Migration écrite ; application et tests réels restent à faire |
| P1 | Liste admin paginée, recherche, filtres, tri, création, modification, suspension/réactivation, archivage et détail | Endpoints et interface ajoutés |
| P1 | Inviter un nouveau compte, accepter l’invitation, changer de rôle, révoquer, audit des accès | Endpoints et interface ajoutés |
| P1 | Liste serveur paginée des locataires, filtres, historique et dossier protégé | Endpoints et interface ajoutés |
| P2 | Tests automatisés multi-utilisateur RLS | Exécutés depuis le 7 novembre 2026 sur PostgreSQL embarqué (`npm run test:db`, voir « Validation ») ; reste à rejouer sur staging |
| P2 | Étendre l’authentification de capacité pour les clients invités aux anciens endpoints/PDF réservation | Décision à prendre avant ouverture d’un parcours invité avec données personnelles |

## Matrice des rôles

Les rôles d’agence sont conservés sur `agency_members.role`; le rôle du profil ne permet pas d’obtenir des droits d’agence. Seul `profiles.role = 'SUPER_ADMIN'` obtient les droits globaux du nouveau module.

| Permission | super_admin | agency_admin | agency_manager | agency_agent | viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| `agencies.read` | ✓ global | ✓ sa propre agence | ✓ sa propre agence | — | — |
| `agencies.create` | ✓ | — | — | — | — |
| `agencies.update` | ✓ global | ✓ sa propre agence | — | — | — |
| `agencies.suspend` | ✓ | — | — | — | — |
| `agencies.delete` (archivage) | ✓ | — | — | — | — |
| `members.read` | ✓ | ✓ | ✓ | — | — |
| `members.invite` | ✓ | ✓ | ✓ (agent/lecteur) | — | — |
| `members.update_role` | ✓ | ✓ (hors administrateur agence) | — | — | — |
| `members.revoke` | ✓ | ✓ (hors administrateur agence) | — | — | — |
| `vehicles.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `vehicles.manage` | ✓ | ✓ | ✓ | — | — |
| `bookings.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bookings.manage` | ✓ | ✓ | ✓ | ✓ | — |
| `customers.read` | ✓ | ✓ | ✓ | ✓ | — |
| `reports.read` | ✓ | ✓ | ✓ | — | — |

Un `agency_manager` ne peut ni octroyer un rôle égal/supérieur, ni modifier ou révoquer un gestionnaire. Le dernier administrateur actif d’une agence ne peut pas être révoqué. Un administrateur ne peut pas modifier son propre rôle ni se révoquer.

## Endpoints du module

| Méthode | Route | Autorisation |
|---|---|---|
| GET / POST | `/api/admin/agencies` | `agencies.read` / `agencies.create` plateforme |
| GET / PATCH / DELETE | `/api/admin/agencies/:id` | `agencies.read` / `agencies.update` / `agencies.delete` plateforme ; les changements de statut exigent aussi `agencies.suspend` |
| GET / POST | `/api/agencies/:id/members` | `members.read` / `members.invite` sur l’agence |
| PATCH / DELETE | `/api/agencies/:id/members/:memberId` | `members.update_role` / `members.revoke` sur l’agence |
| POST | `/api/agencies/:id/members/accept` | Session Auth correspondant au compte invité |
| GET | `/api/agencies/:id/members/audit` | `members.read` sur l’agence |
| GET | `/api/agencies/:id/customers` | `customers.read`, pagination serveur |
| GET | `/api/agencies/:id/customers/:reference` | `customers.read`, dossier et historique paginés |

Les entrées sont validées par Zod. Les opérations de rôle, révocation et acceptation passent par des fonctions PostgreSQL transactionnelles qui dérivent l’acteur de `auth.uid()` ; aucun rôle fourni par le navigateur n’est considéré comme une autorité. Les erreurs de configuration du nouveau module renvoient `503`, les sessions absentes `401`, les permissions insuffisantes `403`.

## Décisions de sécurité et d’exploitation

- **Archivage plutôt que suppression physique :** `DELETE /api/admin/agencies/:id` renseigne `archived_at`. Les véhicules, réservations, membres et écritures comptables historiques restent en base. Les agences archivées sortent du catalogue et du dashboard tenant.
- **Bootstrap Super Admin :** aucun compte n’est créé ou élevé par cette migration. Un compte existant doit recevoir le rôle `SUPER_ADMIN` par une opération d’administration de confiance hors navigateur, après vérification d’identité. Le rôle historique `ADMIN` ne donne pas les permissions des nouveaux endpoints.
- **Invitations :** l’envoi utilise Supabase Auth Admin et nécessite `SUPABASE_SERVICE_ROLE_KEY` côté serveur. Les nouveaux comptes restent `INVITED` jusqu’à ce que l’utilisateur connecté accepte le lien. Une adresse déjà inscrite retourne `409` : aucun accès n’est accordé silencieusement et l’envoi à un utilisateur existant nécessite un flux e-mail/Auth dédié.
- **Confidentialité des locataires :** seules les colonnes nécessaires sont renvoyées. Les dossiers locataires exigent `customers.read` et sont paginés côté serveur. La table `bookings` ne donne plus aux rôles `anon` et `authenticated` la lecture directe des colonnes d’identité.
- **Audit :** les créations/modifications/archivages d’agence et les invitations/changements/révocations de membres créent une entrée `audit_logs` transactionnelle, sans e-mail, téléphone, jeton, mot de passe ni autre donnée personnelle dans les métadonnées.
- **Déploiement :** examiner la migration, appliquer d’abord sur une copie staging après les migrations de base et `20261005_booking_system_v2.sql`, vérifier les rôles historiques et exécuter les tests RLS avant production. La migration est additive pour l’historique métier ; elle normalise toutefois les valeurs de rôle des membres existants (`AGENCY_OWNER` → `agency_admin`, etc.).
- **Clé service-role :** l’API ne l’envoie jamais au navigateur. Si elle manque, l’envoi d’invitation et les dossiers clients échouent explicitement au lieu de basculer vers des données simulées.

## Validation

Les validations Zod du module sont exécutées par `npm run test`.

**Tests RLS automatisés (`npm run test:db -w frontend`).** `frontend/src/tests/db/harness.ts` applique `schema.sql` puis
toutes les migrations, dans l’ordre, sur un vrai PostgreSQL embarqué (PGlite) qui reproduit les rôles Supabase
(`anon`, `authenticated`, `service_role` avec `BYPASSRLS`), `auth.uid()` / `auth.jwt()` et les privilèges par défaut.
Chaque test s’exécute dans une transaction annulée, sous le rôle et l’identité voulus. `rls.spec.ts` couvre :

- deux clients : chacun ne voit que ses réservations, ni par identifiant ni par référence celles de l’autre ;
- colonnes sensibles (`cin`, `license_number`, `birth_date`, `customer_notes`, `flight_number`, `customer_phone`, `customer_email`) refusées aux clients comme aux membres d’agence ;
- trois agences (dont une suspendue) : isolation, membre révoqué ou agence suspendue sans aucun accès, pas d’élévation de rôle, agent sans droit sur la flotte ;
- `SUPER_ADMIN` voit tout ; `ADMIN` historique ne voit rien ;
- fonctions sensibles refusées sans session ; aucune politique d’écriture `WITH CHECK (true)` ;
- contrainte d’exclusion : deux réservations confirmées qui se chevauchent sont refusées.

Résultat au 7 novembre 2026 : 39 tests sur 39 (migrations + RLS). Ces tests prouvent le comportement **des migrations du dépôt** ;
l’état de la base Supabase déployée doit être vérifié séparément (rejouer `backend/supabase/tests/*.sql` sur staging).

**Migration `20261107000100_security_hardening.sql` (additive) :** suppression des politiques d’insertion permissives
sur `bookings` et `booking_events` (inertes car les privilèges étaient déjà retirés), retrait de `EXECUTE` à `anon`
sur les fonctions d’invitation, de rôle, de révocation, de statistiques et sur `expire_completed_bookings()`,
et `is_admin()` aligné sur `SUPER_ADMIN`. Côté application, `isPlatformAdminRole` ne reconnaît plus `ADMIN`
(`@clickdrive/shared`), et le middleware protège désormais aussi `/account/*`.

## Remédiations de sécurité additionnelles

La migration additive `20261011000500_security_remediation.sql` complète le socle RBAC :

- Les statistiques agence exigent `reports.read` et sont calculées en base par agrégats, sans transférer toutes les réservations au serveur d’application.
- Les statistiques plateforme exigent `agencies.read` (réservé à `SUPER_ADMIN` par la fonction de permission).
- L’écriture d’avis requiert un compte client authentifié, une réservation terminée appartenant à ce compte, un seul avis par réservation et une validation de contenu. Le service d’écriture n’utilise pas la clé service-role.
- Les paramètres de commission ne sont modifiables que par `SUPER_ADMIN`.
- `consume_api_rate_limit` fournit une limitation de débit partagée en base pour les créations de réservations et les avis. La table et la fonction sont réservées au serveur avec `SUPABASE_SERVICE_ROLE_KEY`.
- La clé service-role utilise désormais un client Supabase serveur sans cookies de session utilisateur.
- Les endpoints de lecture réservation sélectionnent des colonnes explicites. Les champs client détaillés et les métadonnées d’historique ne sont chargés avec le client privilégié qu’après contrôle d’accès.
- Les mutations de flotte vérifient `vehicles.manage`. Le backend Express legacy refuse de démarrer en `NODE_ENV=production`.

Cette migration, comme la migration RBAC, reste à appliquer et tester sur Supabase local/staging avant déploiement. En production, configurer la clé service-role et vérifier que le proxy d’hébergement remplace les en-têtes `x-forwarded-for` entrants avant de s’appuyer sur l’IP pour les limites de débit.

À effectuer sur Supabase local/staging après application de la migration :

1. Tester avec deux agences et au moins un Super Admin, un administrateur agence, un gestionnaire, un agent, un lecteur et un client.
2. Vérifier qu’un membre agence ne lit ni ne modifie aucun identifiant d’une autre agence et qu’une révocation est immédiate.
3. Vérifier les permissions par rôle, l’impossibilité de s’attribuer un rôle, la protection du dernier administrateur et le blocage des colonnes PII dans PostgREST.
4. Vérifier l’acceptation d’une invitation Auth, les refus `401/403`, les pages/compteurs et l’archivage avec réservations historiques conservées.
