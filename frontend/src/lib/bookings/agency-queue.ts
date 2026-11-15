/**
 * File « à traiter » de l'agence : les demandes qui attendent sa décision (valider, refuser ou proposer
 * un autre véhicule). Même ensemble que l'indicateur « À traiter » du tableau de bord (fonction SQL
 * des statistiques) et que les départs possibles de l'action « valider » de la machine à états
 * (vérifié par agency-queue.spec.ts : les trois ne peuvent pas diverger sans faire échouer un test).
 */
export const AGENCY_TO_PROCESS_STATUSES = ['PENDING', 'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW'] as const;

/**
 * Valeur du filtre de statut des listes de réservations qui désigne toute cette file.
 * Elle n'existe que dans l'adresse (`?status=TO_PROCESS`) et dans la requête de l'API.
 */
export const TO_PROCESS_FILTER = 'TO_PROCESS';
