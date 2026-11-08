/**
 * Coordonnées et horaires du support ClickDrive : source unique, à mettre à jour ici uniquement.
 * Les horaires reprennent ceux publiés sur la page Contact.
 */

/** Numéro WhatsApp de la plateforme (format international, sans « + » ni espaces) */
export const CLICKDRIVE_WHATSAPP_NUMBER = '212661987654';

export function clickdriveWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${CLICKDRIVE_WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Horaires de réponse du support (affichage en français) */
export const SUPPORT_HOURS = [
  { day: 'Lundi – Vendredi', hours: '9h00 – 18h00' },
  { day: 'Samedi', hours: '9h00 – 13h00' },
  { day: 'Dimanche & fériés', hours: 'Fermé' },
] as const;

/** Résumé en une phrase des horaires ci-dessus */
export const SUPPORT_HOURS_SUMMARY = 'du lundi au vendredi (9h–18h) et le samedi matin (9h–13h)';
