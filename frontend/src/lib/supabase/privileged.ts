import { createAdminClient } from './server';

/**
 * Accès service-role explicite.
 *
 * Règle : une opération qui a besoin de droits élevés les demande par `requireServiceRoleClient()`.
 * Il n'existe aucun repli silencieux vers un client utilisateur (dont les résultats, filtrés par la RLS,
 * seraient différents) : sans clé service-role, l'opération échoue explicitement (réponse 503).
 * L'appelant reste responsable de la frontière d'autorisation (permission vérifiée avant l'accès).
 */

export class PrivilegedAccessUnavailableError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    // Message neutre : il peut atteindre le navigateur via les routes
    super('Service sécurisé temporairement indisponible.');
    this.name = 'PrivilegedAccessUnavailableError';
    this.operation = operation;
  }
}

type ServiceRoleClient = NonNullable<Awaited<ReturnType<typeof createAdminClient>>>;

export async function requireServiceRoleClient(operation: string): Promise<ServiceRoleClient> {
  let client: Awaited<ReturnType<typeof createAdminClient>>;
  try {
    client = await createAdminClient();
  } catch (error) {
    console.error(`[PrivilegedAccess] ${operation} : client service-role indisponible.`, error instanceof Error ? error.message : error);
    throw new PrivilegedAccessUnavailableError(operation);
  }
  if (!client) {
    console.error(`[PrivilegedAccess] ${operation} : SUPABASE_SERVICE_ROLE_KEY non configurée.`);
    throw new PrivilegedAccessUnavailableError(operation);
  }
  return client;
}
