/**
 * Profil du compte, en français : source des traductions (messages/account.ts) et repli des espaces
 * agence et administration, qui restent en français et ne chargent pas l'espace de noms « account ».
 * Fichier séparé pour que le composant client n'embarque pas les six langues.
 */
export const ACCOUNT_PROFILE_FR = {
  title: 'Profil du compte',
  intro: 'Modifiez votre nom et la photo affichée dans votre espace ClickDrive.',
  loading: 'Chargement du profil…',
  loadError: 'Impossible de charger le profil.',
  saveError: 'Impossible d’enregistrer le profil.',
  saved: 'Votre profil a été mis à jour.',
  badType: 'Choisissez une image JPEG, PNG ou WebP.',
  tooLarge: 'La photo ne peut pas dépasser 5 Mo.',
  previewAlt: 'Aperçu de la photo de profil',
  chooseAria: 'Choisir une photo de profil',
  change: 'Changer la photo',
  add: 'Ajouter une photo',
  remove: 'Supprimer',
  cancelPhoto: 'Annuler la photo',
  formats: 'JPEG, PNG ou WebP · 5 Mo maximum.',
  name: 'Nom affiché',
  email: 'Adresse e-mail',
  emailLocked: 'L’e-mail de connexion n’est pas modifiable ici.',
  saving: 'Enregistrement…',
  save: 'Enregistrer le profil',
};

export type AccountProfileMessages = typeof ACCOUNT_PROFILE_FR;
