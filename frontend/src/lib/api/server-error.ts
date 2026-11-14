import { NextResponse } from 'next/server';
import { PrivilegedAccessUnavailableError } from '@/lib/supabase/privileged';

/**
 * Réponse 500 des routes API : le détail technique (base de données, pile d'appel…) est journalisé
 * côté serveur et n'est jamais renvoyé au navigateur, qui reçoit un message neutre.
 * Un service sécurisé non configuré (clé service-role absente) donne 503.
 */
export function serverError(
  error: unknown,
  tag: string,
  message = 'Une erreur est survenue. Réessayez dans un instant.',
  status = 500
) {
  console.error(`[API ${tag}]`, error);
  if (error instanceof PrivilegedAccessUnavailableError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 503 });
  }
  return NextResponse.json({ success: false, error: message }, { status });
}
