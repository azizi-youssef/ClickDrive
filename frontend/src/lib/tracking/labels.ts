/** Libellés (français) des fonctions réellement constatées sur un boîtier (jamais supposées) */
export const TRACKING_CAPABILITY_LABELS: Record<string, string> = {
  ignition: 'Contact',
  tamper: 'Sabotage',
  power: 'Alimentation',
  odometer: 'Compteur kilométrique',
};

export const PROVIDER_STATUS_LABELS = {
  available: 'Disponible',
  pending: 'Intégration à venir',
} as const;

export const LEGAL_BASIS_LABELS: Record<string, string> = {
  CONTRACT: 'Exécution du contrat de location',
  LEGITIMATE_INTEREST: 'Intérêt légitime (protection du véhicule)',
  CONSENT: 'Consentement du locataire',
  OTHER: 'Autre (à préciser dans la référence)',
};
