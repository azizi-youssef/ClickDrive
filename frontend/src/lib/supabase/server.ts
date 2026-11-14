import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Vérifie que les variables d'environnement Supabase sont correctement configurées.
 * @deprecated Utilisez `requireSupabaseEnv()` dans les services pour un fail-fast explicite.
 * Conservé pour la compatibilité avec les route handlers existants et le middleware.
 */
export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  );
}

/**
 * Crée un client Supabase avec les cookies de session SSR.
 * Lance une erreur en production si Supabase n'est pas configuré.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !url.startsWith('http')) {
    if (process.env.NODE_ENV === 'production') {
      // Lire les cookies d'abord : au build, Next marque ainsi la page comme dynamique
      // (rendue à la requête) au lieu d'échouer au pré-rendu sans variables Supabase.
      await cookies();
      throw new Error(
        '[Supabase] Variables d\'environnement manquantes en production : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis.'
      );
    }
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignoré si appelé depuis un RSC pur
        }
      },
    },
  });
}

/**
 * Client public : clé anon, sans cookies ni session. Pour les lectures publiques soumises à la RLS
 * du rôle `anon` (catalogue publié, avis, formules). Ne donne jamais de droits élevés et reste
 * utilisable dans `unstable_cache`, où `cookies()` est interdit.
 * Lance une erreur en production si Supabase n'est pas configuré.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !url.startsWith('http')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Supabase] Variables d\'environnement manquantes en production : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis.'
      );
    }
    return null;
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Client avec droits élevés pour les opérations d'administration serveur sécurisées.
 * Nécessite SUPABASE_SERVICE_ROLE_KEY — ne jamais exposer côté client.
 * Lance une erreur en production si la clé est absente.
 */
export async function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl || !supabaseUrl.startsWith('http')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Supabase] SUPABASE_SERVICE_ROLE_KEY manquant en production. Opérations d\'administration impossibles.'
      );
    }
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
