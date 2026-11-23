import { describe, expect, it } from 'vitest';
import type { Booking } from '@/types';
import { readXlsx } from '@/tests/setup/xlsx-reader';
import { buildXlsx } from './xlsx';
import { adminBookingsSheet, adminCustomersSheet, adminFinanceSheet, agencyFinancesSheet } from './dashboard-sheets';
import type { XlsxSheet } from './spreadsheet';

const booking = {
  id: 'b1',
  booking_ref: 'CD-2026-001842',
  customer_name: 'Hélène Dupont',
  customer_email: 'helene@example.com',
  customer_phone: '+212 661 00 00 00',
  vehicle: { brand: 'Dacia', model: 'Logan' },
  agency: { name: 'Agence Alpha' },
  start_date: '2026-12-01',
  end_date: '2026-12-04',
  total_days: 3,
  total_price: 1250,
  commission_amount: 125.5,
  agency_amount: 1124.5,
  status: 'APPROVED',
  created_at: '2026-11-09T22:30:00.000Z',
} as unknown as Booking;

const read = async (sheet: XlsxSheet) => readXlsx(await buildXlsx(sheet, { now: new Date('2026-11-09T10:00:00Z') }));

describe('Exports Excel des tableaux de bord', () => {
  it('administration — réservations : colonnes de l’ancien CSV, dates et montants typés', async () => {
    const sheet = await read(adminBookingsSheet([booking]));
    expect(sheet.sheetName).toBe('Réservations');
    expect(sheet.values[0]).toEqual(['Dossier', 'Client', 'E-mail', 'Téléphone', 'Véhicule', 'Agence', 'Début', 'Fin', 'Jours', 'Montant (DH)', 'Statut', 'Créé le']);
    expect(sheet.values[1]).toEqual([
      'CD-2026-001842',
      'Hélène Dupont',
      'helene@example.com',
      '+212 661 00 00 00',
      'Dacia Logan',
      'Agence Alpha',
      '2026-12-01',
      '2026-12-04',
      3,
      1250,
      'Confirmée',
      '2026-11-09',
    ]);
    expect(sheet.cells.get('G2')?.format).toBe('dd/mm/yyyy');
    expect(sheet.cells.get('J2')?.format).toBe('#,##0.00');
  });

  it('administration — finances : commission et net agence en nombres', async () => {
    const sheet = await read(adminFinanceSheet([booking, { ...booking, booking_ref: undefined, reference: 'CD-2', commission_amount: undefined, agency_amount: undefined } as unknown as Booking]));
    expect(sheet.values[0]).toEqual(['Dossier', 'Client', 'Agence', 'Début', 'Fin', 'Total (DH)', 'Commission (DH)', 'Net agence (DH)', 'Statut']);
    expect(sheet.values[1]).toEqual(['CD-2026-001842', 'Hélène Dupont', 'Agence Alpha', '2026-12-01', '2026-12-04', 1250, 125.5, 1124.5, 'Confirmée']);
    expect(sheet.values[2].slice(0, 1).concat(sheet.values[2].slice(5, 8))).toEqual(['CD-2', 1250, 0, 1250]);
  });

  it('administration — clients', async () => {
    const sheet = await read(
      adminCustomersSheet([
        {
          name: 'Hélène Dupont',
          email: 'helene@example.com',
          phone: '0612345678',
          cin: 'AB123456',
          country: 'Maroc',
          bookingCount: 4,
          totalSpent: 5200,
          lastBookingRef: 'CD-2026-001842',
        },
      ])
    );
    expect(sheet.sheetName).toBe('Clients');
    expect(sheet.values[0]).toEqual(['Nom', 'E-mail', 'Téléphone', 'CIN/Passeport', 'Pays', 'Réservations', 'Total dépensé (DH)', 'Dernière réservation']);
    expect(sheet.values[1]).toEqual(['Hélène Dupont', 'helene@example.com', '0612345678', 'AB123456', 'Maroc', 4, 5200, 'CD-2026-001842']);
    // Le zéro initial du téléphone est conservé : la cellule reste un texte
    expect(sheet.cells.get('C2')?.type).toBe('string');
  });

  it('agence — relevé financier', async () => {
    const sheet = await read(
      agencyFinancesSheet([
        {
          reference: 'CD-2026-001842',
          date: '2026-12-01T09:00:00.000Z',
          customerName: 'Hélène Dupont',
          vehicle: 'Dacia Logan',
          totalPrice: 1250,
          agencyAmount: 1250,
          status: 'COMPLETED',
        },
      ])
    );
    expect(sheet.values[0]).toEqual(['Référence', 'Date', 'Client', 'Véhicule', 'Montant (DH)', 'Part agence (DH)', 'Statut']);
    expect(sheet.values[1]).toEqual(['CD-2026-001842', '2026-12-01', 'Hélène Dupont', 'Dacia Logan', 1250, 1250, 'Terminée']);
  });
});
