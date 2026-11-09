import { CONTACT_CATEGORY_LABELS } from '@/lib/email/templates';

/** Message de contact non traité, tel que le résume /api/admin/contact-messages/summary */
export type ContactAlertItem = {
  id: string;
  reference: string;
  name: string;
  category: string;
  subject: string | null;
  created_at: string;
};

export type ContactAlertSummary = {
  /** Messages au statut « Nouveau » (ni pris en charge, ni traités) */
  newCount: number;
  /** Les plus récents d'entre eux, du plus récent au plus ancien */
  latest: ContactAlertItem[];
};

/** Nombre de messages récents renvoyés par le résumé */
export const CONTACT_ALERT_LATEST_LIMIT = 10;

/** La page Messages a changé un statut : le compteur doit se mettre à jour tout de suite */
export const CONTACT_MESSAGES_CHANGED_EVENT = 'clickdrive:contact-messages-changed';
/** De nouveaux messages viennent d'arriver : la page Messages recharge sa liste */
export const CONTACT_MESSAGES_ARRIVED_EVENT = 'clickdrive:contact-messages-arrived';

/**
 * Messages arrivés après le dernier déjà annoncé (`lastSeen` = date de création de ce message).
 * Sans repère valide (premier passage sur ce navigateur), tous les messages non traités sont annoncés.
 */
export function unseenContactMessages(latest: ContactAlertItem[], lastSeen: string | null): ContactAlertItem[] {
  const seenAt = lastSeen ? Date.parse(lastSeen) : Number.NaN;
  if (Number.isNaN(seenAt)) return latest;
  return latest.filter((item) => Date.parse(item.created_at) > seenAt);
}

/** Date de création du message le plus récent (repère à mémoriser une fois l'alerte affichée) */
export function newestCreatedAt(items: ContactAlertItem[]): string | null {
  let newest: string | null = null;
  for (const item of items) {
    if (!newest || Date.parse(item.created_at) > Date.parse(newest)) newest = item.created_at;
  }
  return newest;
}

function topic(item: ContactAlertItem): string {
  return item.subject?.trim() || CONTACT_CATEGORY_LABELS[item.category] || item.category;
}

/** Titre et texte de l'alerte (bandeau du tableau de bord et notification du navigateur) */
export function contactAlertText(items: ContactAlertItem[]): { title: string; body: string } {
  const [latest] = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!latest) return { title: 'Nouveau message de contact', body: '' };
  if (items.length === 1) return { title: `Nouveau message de ${latest.name}`, body: topic(latest) };
  return { title: `${items.length} nouveaux messages de contact`, body: `Le plus récent : ${latest.name} · ${topic(latest)}` };
}

/** Texte du compteur : au-delà de 99, « 99+ » */
export function contactBadgeLabel(count: number): string {
  return count > 99 ? '99+' : String(Math.max(0, count));
}

/** Libellé accessible du compteur */
export function contactBadgeDescription(count: number): string {
  return count === 1 ? '1 nouveau message' : `${count} nouveaux messages`;
}
