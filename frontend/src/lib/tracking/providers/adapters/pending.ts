import {
  ProviderNotImplementedError,
  type ParseOutcome,
  type ProviderCapabilities,
  type TrackingProviderAdapter,
  type VerificationResult,
} from '../provider.interface';

/**
 * Fournisseurs identifiés mais NON intégrés.
 *
 * Aucun format de charge utile, aucune méthode de signature ni aucun point d'accès n'est supposé : un
 * adaptateur réel ne doit être écrit qu'à partir de la documentation officielle du fournisseur, validée
 * avec des identifiants et du matériel réels. Tant que ce n'est pas fait, l'intégration reste `pending` :
 * la route répond 501, l'enregistrement d'un boîtier sur ce fournisseur est refusé et rien n'est simulé.
 */

const UNKNOWN_CAPABILITIES: ProviderCapabilities = {
  ignition: false,
  tamper: false,
  powerStatus: false,
  odometer: false,
  accuracy: false,
};

function pending(
  id: string,
  displayName: string,
  description: string,
  pendingReason: string
): TrackingProviderAdapter {
  return {
    id,
    displayName,
    status: 'pending',
    description,
    capabilities: UNKNOWN_CAPABILITIES,
    secretEnvVar: `TRACKING_WEBHOOK_SECRET_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
    pendingReason,
    verifyRequest(): VerificationResult {
      throw new ProviderNotImplementedError(id);
    },
    parseDelivery(): ParseOutcome {
      throw new ProviderNotImplementedError(id);
    },
  };
}

export const traccarAdapter = pending(
  'traccar',
  'Traccar',
  'Serveur de suivi open source compatible avec de nombreux boîtiers OBD-II.',
  'À intégrer à partir de la documentation officielle de Traccar, avec une instance réelle : méthode d’authentification de la livraison, format des positions et des événements à valider.'
);

export const flespiAdapter = pending(
  'flespi',
  'Flespi',
  'Plateforme de télématique en ligne (décodage de nombreux protocoles de boîtiers).',
  'À intégrer à partir de la documentation officielle de Flespi, avec un compte et un appareil réels : mécanisme de livraison, authentification et schéma des messages à valider.'
);

export const PENDING_ADAPTERS: readonly TrackingProviderAdapter[] = [traccarAdapter, flespiAdapter];
