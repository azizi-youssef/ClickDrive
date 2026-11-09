import type { Agency } from '@/types';

/**
 * Projection publique d'une agence (catalogue, liste des agences, API publique, HTML préchargé).
 * L'adresse e-mail de l'agence (souvent celle du gérant ou du compte) ne quitte jamais le serveur :
 * aucune page publique ne l'affiche, et elle servirait surtout au démarchage ou à l'hameçonnage.
 * Téléphone et WhatsApp restent publics : le site promet le contact direct avec l'agence.
 */
export function toPublicAgency<T extends Agency>(agency: T): T {
  // Le type Agency exige le champ (chaîne) : valeur vide, jamais la vraie adresse
  return { ...agency, email: '' };
}

export function toPublicAgencies<T extends Agency>(agencies: T[]): T[] {
  return agencies.map(toPublicAgency);
}
