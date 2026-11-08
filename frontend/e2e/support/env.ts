/**
 * Configuration des parcours authentifiés : uniquement par variables d'environnement
 * (secrets CI d'un environnement de test). Aucun identifiant n'est écrit dans le dépôt.
 *
 *   E2E_BASE_URL               URL de l'environnement de test (ex. https://staging.clickdrive.ma)
 *   E2E_ALLOW_WRITES=1         autorise les parcours qui créent des données (réservation, véhicule, compte)
 *   E2E_CUSTOMER_EMAIL / _PASSWORD      compte client de test
 *   E2E_AGENCY_EMAIL / _PASSWORD        administrateur d'une agence de test
 *   E2E_SUPER_ADMIN_EMAIL / _PASSWORD   super administrateur de test
 *   E2E_SIGNUP_EMAIL_DOMAIN    domaine des adresses créées par le test d'inscription (boîte de test)
 */

export interface TestAccount {
  email: string;
  password: string;
}

function account(prefix: string): TestAccount | null {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : null;
}

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
// Nouveau domaine et ancien (klickdrive.ma, redirigé) : jamais d'écriture sur la production
const PRODUCTION_HOSTS = new Set(['clickdrive.ma', 'www.clickdrive.ma', 'klickdrive.ma', 'www.klickdrive.ma']);

/** Jamais d'écriture sur la production, même si la variable est positionnée par erreur. */
export const targetsProduction = PRODUCTION_HOSTS.has(new URL(baseURL).hostname);

export const e2eEnv = {
  baseURL,
  allowWrites: process.env.E2E_ALLOW_WRITES === '1' && !targetsProduction,
  customer: account('E2E_CUSTOMER'),
  agency: account('E2E_AGENCY'),
  superAdmin: account('E2E_SUPER_ADMIN'),
  signupDomain: process.env.E2E_SIGNUP_EMAIL_DOMAIN ?? null,
};

export const SKIP_NO_ACCOUNT = 'Compte de test non configuré (variables E2E_*_EMAIL / E2E_*_PASSWORD).';
export const SKIP_NO_WRITES =
  'Écritures désactivées : définir E2E_ALLOW_WRITES=1 sur un environnement de test (jamais la production).';
