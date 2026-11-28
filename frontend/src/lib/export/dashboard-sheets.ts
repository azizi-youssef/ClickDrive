/**
 * Feuilles Excel des tableaux de bord (administration et agence) : mêmes colonnes, dans le même
 * ordre que l'ancien export CSV, appliquées aux lignes déjà filtrées à l'écran.
 * Fonctions pures, sans dépendance au générateur (chargé à la demande).
 */
import type { Booking } from '@/types';
import { bookingStatusLabel } from '@/lib/bookings/status';
import { tableSheet, type XlsxSheet } from './spreadsheet';

const businessStatus = (status: string) => bookingStatusLabel(status, 'fr', 'business');
const bookingReference = (b: Booking) => b.booking_ref ?? b.reference ?? '';

/** Réservations de la plateforme (Super-Admin) */
export function adminBookingsSheet(bookings: readonly Booking[]): XlsxSheet {
  return tableSheet<Booking>(
    'Réservations',
    [
      { header: 'Dossier', format: 'text', value: bookingReference },
      { header: 'Client', value: (b) => b.customer_name },
      { header: 'E-mail', value: (b) => b.customer_email },
      { header: 'Téléphone', format: 'text', value: (b) => b.customer_phone },
      { header: 'Véhicule', value: (b) => `${b.vehicle?.brand ?? ''} ${b.vehicle?.model ?? ''}`.trim() },
      { header: 'Agence', value: (b) => b.agency?.name ?? '' },
      { header: 'Début', format: 'date', value: (b) => b.start_date },
      { header: 'Fin', format: 'date', value: (b) => b.end_date },
      { header: 'Jours', format: 'integer', value: (b) => b.total_days },
      { header: 'Montant (DH)', format: 'money', value: (b) => b.total_price },
      { header: 'Statut', value: (b) => businessStatus(b.status) },
      { header: 'Créé le', format: 'date', value: (b) => b.created_at },
    ],
    bookings
  );
}

/** Grand livre des finances de la plateforme (Super-Admin) */
export function adminFinanceSheet(bookings: readonly Booking[]): XlsxSheet {
  return tableSheet<Booking>(
    'Finances',
    [
      { header: 'Dossier', format: 'text', value: bookingReference },
      { header: 'Client', value: (b) => b.customer_name },
      { header: 'Agence', value: (b) => b.agency?.name ?? '' },
      { header: 'Début', format: 'date', value: (b) => b.start_date },
      { header: 'Fin', format: 'date', value: (b) => b.end_date },
      { header: 'Montant (DH)', format: 'money', value: (b) => b.total_price },
      { header: 'Statut', value: (b) => businessStatus(b.status) },
    ],
    bookings
  );
}

export interface CustomerExportRow {
  name: string;
  email: string;
  phone: string;
  cin: string;
  country: string;
  bookingCount: number;
  totalSpent: number;
  lastBookingRef: string;
}

/** Clients de la plateforme (Super-Admin), après recherche et filtre par pays */
export function adminCustomersSheet(customers: readonly CustomerExportRow[]): XlsxSheet {
  return tableSheet<CustomerExportRow>(
    'Clients',
    [
      { header: 'Nom', value: (c) => c.name },
      { header: 'E-mail', value: (c) => c.email },
      { header: 'Téléphone', format: 'text', value: (c) => c.phone },
      { header: 'CIN/Passeport', format: 'text', value: (c) => c.cin },
      { header: 'Pays', value: (c) => c.country },
      { header: 'Réservations', format: 'integer', value: (c) => c.bookingCount },
      { header: 'Total dépensé (DH)', format: 'money', value: (c) => c.totalSpent },
      { header: 'Dernière réservation', format: 'text', value: (c) => c.lastBookingRef },
    ],
    customers
  );
}

export interface AgencyTransactionExportRow {
  reference: string;
  date: string;
  customerName: string;
  vehicle: string;
  totalPrice: number;
  status: string;
}

/** Relevé financier d'une agence */
export function agencyFinancesSheet(transactions: readonly AgencyTransactionExportRow[]): XlsxSheet {
  return tableSheet<AgencyTransactionExportRow>(
    'Finances',
    [
      { header: 'Référence', format: 'text', value: (t) => t.reference },
      { header: 'Date', format: 'date', value: (t) => t.date },
      { header: 'Client', value: (t) => t.customerName },
      { header: 'Véhicule', value: (t) => t.vehicle },
      { header: 'Montant (DH)', format: 'money', value: (t) => t.totalPrice },
      { header: 'Statut', value: (t) => businessStatus(t.status) },
    ],
    transactions
  );
}
