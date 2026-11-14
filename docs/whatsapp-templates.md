# Modèles WhatsApp à faire approuver par Meta

WhatsApp n'autorise une entreprise à écrire en premier qu'avec un **modèle approuvé** : un message libre
est refusé hors de la fenêtre de 24 h ouverte par le client. ClickDrive envoie donc chaque notification
automatique avec l'un des modèles ci-dessous.

**Mise en place**

1. Meta Business Manager → WhatsApp Manager → Modèles de message → Créer un modèle.
2. Catégorie **Utilitaire**, langue **Français (fr)**, corps du message ci-dessous (les `{{n}}` sont les variables, dans cet ordre).
3. Une fois le modèle approuvé, renseigner son nom dans la variable d'environnement indiquée (Vercel, Production).
4. Sans la variable, la notification correspondante n'est pas envoyée (et rien n'est présenté comme envoyé) ; l'e-mail part quand même.

Variables déjà nécessaires : `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.

**Langues des modèles client**

Le site est traduit (fr, ar, en, de, es, nl) et chaque demande enregistre la langue du client
(`bookings.customer_locale`). Pour les quatre modèles « Client », ajoutez dans Meta une traduction du
même modèle par langue souhaitée (même nom, mêmes variables `{{n}}` dans le même ordre), puis listez
les langues approuvées dans `WHATSAPP_TEMPLATE_LANGUAGES` (ex. `fr,en,nl`). Une langue absente de la
liste reçoit la version française : un envoi dans une langue non approuvée serait refusé par Meta.
Les modèles « Agence » restent en français. Les e-mails, eux, sont déjà envoyés dans la langue du client.

| Variable d'environnement | Nom de modèle suggéré | Destinataire |
| --- | --- | --- |
| `WHATSAPP_TEMPLATE_AGENCY_NEW_REQUEST` | `clickdrive_agence_nouvelle_demande` | Agence |
| `WHATSAPP_TEMPLATE_AGENCY_REMINDER` | `clickdrive_agence_relance` | Agence |
| `WHATSAPP_TEMPLATE_REQUEST_RECEIVED` | `clickdrive_demande_recue` | Client |
| `WHATSAPP_TEMPLATE_REQUEST_CONFIRMED` | `clickdrive_demande_confirmee` | Client |
| `WHATSAPP_TEMPLATE_REQUEST_REJECTED` | `clickdrive_demande_refusee` | Client |
| `WHATSAPP_TEMPLATE_REQUEST_ALTERNATIVE` | `clickdrive_demande_alternative` | Client |
| `WHATSAPP_TEMPLATE_REVIEW_REQUEST` | `clickdrive_demande_avis` | Client |

## Textes proposés

**clickdrive_agence_nouvelle_demande** (agence)

> Nouvelle demande ClickDrive {{1}} : {{2}}, du {{3}} au {{4}}, prise en charge : {{5}}. Répondez au client depuis votre espace agence : {{6}}

Variables : référence, véhicule, date de début, date de fin, lieu, lien de l'espace agence.

**clickdrive_agence_relance** (agence)

> Rappel ClickDrive : la demande {{1}} ({{2}}) attend votre réponse depuis {{3}}. Le client attend la confirmation de disponibilité : {{4}}

Variables : référence, véhicule, durée d'attente (« 45 min »), lien de l'espace agence.

**clickdrive_demande_recue** (client)

> Bonjour {{1}}, votre demande ClickDrive {{2}} pour {{3}} a bien été transmise à l'agence {{4}}. Vous serez prévenu dès sa réponse. Suivre votre demande : {{5}}

Variables : prénom, référence, véhicule, agence, lien de suivi.

**clickdrive_demande_confirmee** (client)

> Bonne nouvelle {{1}} : l'agence {{2}} confirme votre réservation {{3}} ({{4}}, du {{5}} au {{6}}). Contrat, caution et paiement se règlent à l'agence, à la remise des clés. Détails : {{7}}

Variables : prénom, agence, référence, véhicule, date de début, date de fin, lien de suivi.

**clickdrive_demande_refusee** (client)

> Bonjour {{1}}, l'agence {{2}} ne peut pas accepter votre demande {{3}}. D'autres véhicules sont peut-être libres aux mêmes dates : {{4}}

Variables : prénom, agence, référence, lien de suivi (il propose une recherche aux mêmes dates).

**clickdrive_demande_alternative** (client)

> Bonjour {{1}}, l'agence {{2}} vous propose une alternative pour votre demande {{3}}. Voir la proposition : {{4}}

Variables : prénom, agence, référence, lien de suivi.

**clickdrive_demande_avis** (client)

> Merci {{1}} d'avoir loué {{2}} avec ClickDrive. Votre avis aide les prochains voyageurs à choisir : {{3}}

Variables : prénom, véhicule, lien d'avis (valable 60 jours).

## Notifications opérationnelles (remise du véhicule)

L'état des lieux et le rendez-vous de remise sont envoyés **en texte libre** si le client a écrit à ClickDrive
sur WhatsApp depuis moins de 23 h (fenêtre de 24 h ouverte, vérifiée dans `whatsapp_messages`). Sinon, le modèle
ci-dessous est utilisé s'il est configuré ; à défaut, le message n'est pas envoyé (statut `SKIPPED`, jamais
présenté comme envoyé) et la remise est enregistrée normalement.

| Variable d'environnement | Nom de modèle suggéré | Destinataire |
| --- | --- | --- |
| `WHATSAPP_TEMPLATE_HANDOVER_SUMMARY` | `clickdrive_etat_des_lieux` | Client |
| `WHATSAPP_TEMPLATE_DELIVERY_MEETING` | `clickdrive_rendez_vous_remise` | Client |

**clickdrive_etat_des_lieux** (client)

> Bonjour {{1}}, l'état des lieux de {{3}} de votre location ClickDrive {{2}} est enregistré : kilométrage {{4}}, carburant {{5}}. Caution : {{6}}.

Variables : nom, référence, « remise » ou « restitution », kilométrage, niveau de carburant, statut de la caution (« — » au départ).

**clickdrive_rendez_vous_remise** (client)

> Bonjour {{1}}, le rendez-vous de remise du véhicule pour votre réservation ClickDrive {{2}} est fixé : {{3}}, {{4}}. {{5}}

Variables : nom, référence, lieu, date et heure, consignes ou agent d'accueil (« — » si aucune).

## Journal et webhook

- Chaque message (envoyé ou reçu) est journalisé dans `whatsapp_messages` (migration `20261117000100`), sans son
  texte : identifiant Meta, statut (`SENT` → `DELIVERED` → `READ`, ou `FAILED`), numéro, dossier.
- Le webhook répond `200` immédiatement et traite après la réponse ; un message déjà reçu (renvoi de Meta) est
  ignoré, sans nouvelle réponse automatique. Un accusé de réception ne fait jamais reculer un statut.
