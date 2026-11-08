/**
 * Utilitaires pour la génération et la normalisation des identifiants agences ClickDrive.
 * Respecte les exigences strictes de normalisation, unicité et sécurité.
 */

const CLICKDRIVE_EMAIL_DOMAIN = 'clickdrive.ma';

/**
 * Normalise un nom d'agence en composante email locale :
 * 1. Minuscules
 * 2. Suppression des accents (décomposition Unicode NFD)
 * 3. Remplacement des espaces et séparateurs par des points
 * 4. Suppression des caractères interdits et réduction des points consécutifs
 * 5. Suppression des points de début et de fin
 */
export function normalizeAgencyLocalPart(agencyName: string): string {
  if (!agencyName || typeof agencyName !== 'string') {
    return 'agence';
  }

  const cleaned = agencyName
    // 1 & 2. Minuscules et suppression des accents
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // 3. Remplacement des espaces, tirets, apostrophes, underscores et séparateurs par des points
    .replace(/[\s\-_'’/\\+&@#~.,:;!?()\[\]{}"]+/g, '.')
    // 4. Suppression des caractères non alphanumériques restants (sauf le point)
    .replace(/[^a-z0-9.]/g, '')
    // Suppression des points consécutifs
    .replace(/\.+/g, '.')
    // 5. Suppression des points de tête et de fin
    .replace(/^\.+|\.+$/g, '');

  return cleaned || 'agence';
}

/**
 * Génère l'adresse email de base au format `nom.agence@clickdrive.ma`.
 */
export function generateBaseAgencyEmail(agencyName: string): string {
  const localPart = normalizeAgencyLocalPart(agencyName);
  return `${localPart}@${CLICKDRIVE_EMAIL_DOMAIN}`;
}

/**
 * Génère une liste de candidats d'adresses email avec suffixes numériques si collision.
 * Exemple : ['nom.agence@clickdrive.ma', 'nom.agence2@clickdrive.ma', 'nom.agence3@clickdrive.ma', ...]
 */
export function generateCandidateAgencyEmails(agencyName: string, maxCandidates = 10): string[] {
  const localPart = normalizeAgencyLocalPart(agencyName);
  const candidates: string[] = [`${localPart}@${CLICKDRIVE_EMAIL_DOMAIN}`];

  for (let i = 2; i <= maxCandidates; i++) {
    candidates.push(`${localPart}${i}@${CLICKDRIVE_EMAIL_DOMAIN}`);
  }

  return candidates;
}

/**
 * Résout une adresse email unique en vérifiant l'existence via une fonction de callback.
 */
export async function resolveUniqueAgencyEmail(
  agencyName: string,
  isTaken: (email: string) => Promise<boolean>
): Promise<string> {
  const candidates = generateCandidateAgencyEmails(agencyName, 20);

  for (const candidate of candidates) {
    const exists = await isTaken(candidate);
    if (!exists) {
      return candidate;
    }
  }

  // Fallback si 20 collisions : timestamp suffix
  const localPart = normalizeAgencyLocalPart(agencyName);
  return `${localPart}.${Date.now().toString().slice(-4)}@${CLICKDRIVE_EMAIL_DOMAIN}`;
}

/**
 * Entier uniforme dans [0, max) tiré du générateur cryptographique (Web Crypto, navigateur et Node ≥ 20).
 * Rejet des valeurs hors du plus grand multiple de `max` pour éviter le biais du modulo.
 */
function secureRandomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/**
 * Génère un mot de passe temporaire respectant les exigences de complexité :
 * - Minuscules, majuscules, chiffres, caractères spéciaux
 * - Longueur paramétrable (défaut 14)
 * Tirage cryptographique : Math.random() est prévisible et ne convient pas à un secret.
 */
export function generateTemporaryPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*_-';
  const pick = (set: string) => set[secureRandomInt(set.length)];

  // Assurer au moins un caractère de chaque groupe
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];

  const allChars = upper + lower + digits + symbols;
  while (chars.length < length) {
    chars.push(pick(allChars));
  }

  // Mélange de Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Normalise un nom d'agence en slug d'URL valide (ex: "rif-car-nador").
 */
export function normalizeAgencySlug(agencyName: string): string {
  if (!agencyName || typeof agencyName !== 'string') return 'agence';

  const slug = agencyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'agence';
}
