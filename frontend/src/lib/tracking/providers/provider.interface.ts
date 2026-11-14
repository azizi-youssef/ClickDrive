import type { NormalizedTrackingEvent } from '../types';

/**
 * Abstraction des fournisseurs GPS.
 *
 * Un adaptateur sait : vérifier l'authenticité d'une livraison (signature + horodatage), en extraire des
 * événements, les normaliser et identifier l'appareil émetteur. Il ne connaît NI l'agence NI le véhicule :
 * c'est la base (tracking_ingest_event) qui résout l'appareil enregistré, vérifie son rattachement,
 * dédoublonne et ordonne les événements.
 *
 * Statut d'intégration :
 *  - `available` : l'adaptateur est implémenté et testé contre un contrat DOCUMENTÉ (voir docs/gps-tracking.md) ;
 *  - `pending`   : l'intégration n'est PAS faite (pas de documentation validée, pas d'identifiants ni de matériel).
 *                  La route répond 501 ; aucune connectivité n'est simulée.
 */

export type ProviderStatus = 'available' | 'pending';

export interface ProviderCapabilities {
  /** Contact (allumage) fourni par le matériel */
  ignition: boolean;
  /** Alerte de sabotage fournie par le matériel */
  tamper: boolean;
  /** Coupure d'alimentation / débranchement fourni par le matériel */
  powerStatus: boolean;
  odometer: boolean;
  accuracy: boolean;
}

export type SignatureFailure =
  | 'missing_signature'
  | 'malformed_signature'
  | 'invalid_signature'
  | 'timestamp_out_of_tolerance';

export type VerificationResult = { ok: true } | { ok: false; reason: SignatureFailure };

export interface VerificationInput {
  /** Corps brut exact reçu (la signature porte sur ces octets, jamais sur un JSON reformaté) */
  rawBody: string;
  headers: Headers;
  /** Instant de référence (injectable pour les tests) */
  now: Date;
  /** Secrets valides (rotation : le courant et le précédent) ; jamais vide ici */
  secrets: readonly string[];
}

export interface ParsedEvent {
  /** Identifiant d'appareil chez le fournisseur */
  externalDeviceId: string;
  event: NormalizedTrackingEvent;
}

export type ParseOutcome =
  | { ok: true; events: ParsedEvent[]; rejected: { index: number; reason: string }[] }
  | { ok: false; reason: 'invalid_json' | 'invalid_envelope' };

/** Erreur d'un fournisseur : `retryable` indique s'il faut demander une nouvelle livraison (5xx) ou non (4xx) */
export class ProviderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = retryable;
  }
}

export class ProviderNotImplementedError extends ProviderError {
  constructor(providerId: string) {
    super(`Intégration du fournisseur « ${providerId} » non implémentée.`, false);
    this.name = 'ProviderNotImplementedError';
  }
}

export interface TrackingProviderAdapter {
  /** Identifiant technique (segment d'URL /api/webhooks/tracking/[provider] et colonne vehicle_trackers.provider) */
  readonly id: string;
  readonly displayName: string;
  readonly status: ProviderStatus;
  readonly description: string;
  readonly capabilities: ProviderCapabilities;
  /** Variable d'environnement contenant le(s) secret(s) de signature ; jamais en base ni dans le code */
  readonly secretEnvVar: string;
  /** Pour `pending` : ce qui manque pour activer l'intégration */
  readonly pendingReason?: string;

  verifyRequest(input: VerificationInput): VerificationResult;
  /** Extrait et normalise les événements ; ne lève pas pour une charge utile invalide (voir ParseOutcome) */
  parseDelivery(rawBody: string): ParseOutcome;
}
