import type { LucideIcon } from 'lucide-react';
import { Building2, CalendarCheck, Car, MapPin, Search, ShieldCheck, Wallet } from 'lucide-react';
import type { FaqMessages } from '@/lib/i18n/messages/faq';

export type FaqCategoryId = 'plateforme' | 'reservation' | 'tarifs' | 'prise-en-charge' | 'agences';

/** Thèmes (libellés traduits : t.faq.categories) */
export const FAQ_CATEGORIES: { id: FaqCategoryId; icon: LucideIcon }[] = [
  { id: 'plateforme', icon: Car },
  { id: 'reservation', icon: CalendarCheck },
  { id: 'tarifs', icon: Wallet },
  { id: 'prise-en-charge', icon: MapPin },
  { id: 'agences', icon: Building2 },
];

type FaqEntry = {
  /** Ancre stable pour les liens directs (#id), identique dans toutes les langues */
  id: string;
  category: FaqCategoryId;
  icon: LucideIcon;
};

/** Questions (textes traduits : t.faq.items[id]) */
export const FAQ_ENTRIES: FaqEntry[] = [
  { id: 'fonctionnement', category: 'plateforme', icon: Car },
  { id: 'rechercher', category: 'plateforme', icon: Search },
  { id: 'reserver', category: 'reservation', icon: CalendarCheck },
  { id: 'disponibilite', category: 'reservation', icon: CalendarCheck },
  { id: 'annulation', category: 'reservation', icon: CalendarCheck },
  { id: 'caution', category: 'tarifs', icon: ShieldCheck },
  { id: 'assurance', category: 'tarifs', icon: ShieldCheck },
  { id: 'aeroport', category: 'prise-en-charge', icon: MapPin },
  { id: 'mre', category: 'prise-en-charge', icon: MapPin },
  { id: 'agence-verifiee', category: 'agences', icon: ShieldCheck },
  { id: 'devenir-partenaire', category: 'agences', icon: Building2 },
];

export type FaqItem = FaqEntry & { question: string; answer: string };

/** Thèmes et questions dans la langue du dictionnaire fourni */
export function localizeFaq(copy: FaqMessages) {
  return {
    categories: FAQ_CATEGORIES.map((category) => ({ ...category, label: copy.categories[category.id] })),
    items: FAQ_ENTRIES.map((entry): FaqItem => ({ ...entry, ...copy.items[entry.id] })),
  };
}
