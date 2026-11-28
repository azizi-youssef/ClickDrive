import { formatPhoneDisplay } from './contact';

export { formatPhoneDisplay };

/**
 * Identité légale de l'éditeur (mentions légales, loi 31-08 sur la protection du consommateur).
 * Les identifiants administratifs sont À RENSEIGNER par le titulaire avec les valeurs de ses
 * documents officiels : une valeur vide n'est pas affichée (jamais de numéro inventé).
 */
export const LEGAL_IDENTIFIERS = {
  /** Identifiant commun de l'entreprise (15 chiffres) */
  ice: '',
  /** Registre du commerce : numéro et tribunal, ex. « 12345 — Nador » */
  rc: '',
  /** Identifiant fiscal */
  identifiantFiscal: '',
  /** Numéro de récépissé de la déclaration du traitement auprès de la CNDP */
  cndp: '',
} as const;

