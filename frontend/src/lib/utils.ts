import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format FR déterministe (pas d'Intl) — identique Node SSR et navigateur.
 * Ex. 3000 → « 3 000 » (espace fine insécable).
 */
export function formatNumber(value: number): string {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return '0';
  const grouped = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return n < 0 ? `-${grouped}` : grouped;
}

/** Dates courtes FR, même règle SSR/client (évite toLocaleDateString sans garde). */
export function formatDateFr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Montant en dirhams (messages WhatsApp, PDF) : « 1 700 DH », espace insécable avant DH */
export function formatPrice(price: number): string {
  return `${formatNumber(price)} DH`;
}

export function generateBookingRef(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `#NRD-${randomNum}`;
}

export function generateWhatsAppLink(params: {
  phone: string;
  vehicleName: string;
  agencyName: string;
  startDate: string;
  endDate: string;
  bookingRef?: string;
  totalPrice?: number;
}): string {
  const cleanPhone = params.phone.replace(/[^0-9]/g, '');
  const ref = params.bookingRef || generateBookingRef();
  
  const text = `Bonjour ${params.agencyName},

Je souhaite louer :

🚗 Véhicule : ${params.vehicleName}
📅 Date départ : ${params.startDate}
📅 Date retour : ${params.endDate}
${params.totalPrice ? `💰 Montant estimé : ${formatPrice(params.totalPrice)}\n` : ''}🏷️ Référence : ${ref}

Merci de me confirmer la disponibilité.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function calculateDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}
