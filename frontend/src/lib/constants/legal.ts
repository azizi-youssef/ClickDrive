import { CLICKDRIVE_WHATSAPP_NUMBER } from './contact';

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

/** Téléphone public de la plateforme, au format lisible « +212 6 12 34 56 78 » */
export function clickdrivePhoneDisplay(number: string = CLICKDRIVE_WHATSAPP_NUMBER): string {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('212') && digits.length === 12) {
    const local = digits.slice(3);
    return `+212 ${local.charAt(0)} ${local.slice(1).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  }
  return `+${digits}`;
}
