import { klickdriveGatewayAdapter } from './adapters/klickdrive-gateway';
import { PENDING_ADAPTERS } from './adapters/pending';
import type { TrackingProviderAdapter } from './provider.interface';

/** Registre des fournisseurs : un seul adaptateur réel aujourd'hui, les autres sont déclarés « pending ». */
const REGISTRY: readonly TrackingProviderAdapter[] = [klickdriveGatewayAdapter, ...PENDING_ADAPTERS];

const BY_ID = new Map(REGISTRY.map((adapter) => [adapter.id, adapter]));

export function getProvider(id: string): TrackingProviderAdapter | null {
  return BY_ID.get(id) ?? null;
}

export function listProviders(): readonly TrackingProviderAdapter[] {
  return REGISTRY;
}

/** Seuls les fournisseurs réellement intégrés acceptent l'enregistrement d'un boîtier */
export function isRegistrationAllowed(id: string): boolean {
  return getProvider(id)?.status === 'available';
}

export const MIN_SECRET_LENGTH = 32;

/**
 * Secrets de signature du fournisseur, lus UNIQUEMENT dans l'environnement serveur.
 * Plusieurs valeurs séparées par des virgules : rotation (secret courant puis précédent).
 * Un secret trop court est traité comme absent (fail-closed) : on n'accepte jamais de livraison non signée.
 */
export function getProviderSecrets(adapter: TrackingProviderAdapter, env: Record<string, string | undefined> = process.env): string[] {
  const raw = env[adapter.secretEnvVar];
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length >= MIN_SECRET_LENGTH)
    .slice(0, 3);
}

export interface PublicProviderInfo {
  id: string;
  displayName: string;
  status: TrackingProviderAdapter['status'];
  description: string;
  pendingReason: string | null;
}

/** Description exposable au navigateur (aucun secret, aucune variable d'environnement) */
export function publicProviders(): PublicProviderInfo[] {
  return REGISTRY.map((adapter) => ({
    id: adapter.id,
    displayName: adapter.displayName,
    status: adapter.status,
    description: adapter.description,
    pendingReason: adapter.pendingReason ?? null,
  }));
}
