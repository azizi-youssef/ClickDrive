import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBookingByReference: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/services/bookings.service', () => ({
  bookingsService: { getBookingByReference: mocks.getBookingByReference },
}));
vi.mock('@/lib/email/send', () => ({
  sendEmail: mocks.sendEmail,
  contactInbox: () => 'contact@clickdrive.ma',
}));

import { notifyBookingStatusByReference } from './notifications';

beforeEach(() => {
  mocks.getBookingByReference.mockReset();
  mocks.sendEmail.mockReset().mockResolvedValue({ status: 'sent', id: 'email_1' });
});

describe('Réponse de l’agence : notification du client', () => {
  it('relit la réservation AVEC les coordonnées du client avant d’écrire', async () => {
    mocks.getBookingByReference.mockResolvedValue({
      id: 'b1',
      reference: 'CD-2026-415048',
      status: 'CONFIRMED',
      customer_name: 'Sara Benali',
      customer_email: 'sara@example.com',
      customer_phone: '0612345678',
      start_date: '2026-12-01',
      end_date: '2026-12-04',
      total_days: 3,
      total_price: 1050,
      agency_id: 'a1',
      agency: { name: 'Agence Test' },
      vehicle: { brand: 'Renault', model: 'Clio', year: 2025 },
    });
    await notifyBookingStatusByReference('CD-2026-415048', 'CONFIRMED', 'https://clickdrive.ma');

    expect(mocks.getBookingByReference).toHaveBeenCalledWith('CD-2026-415048', true);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sara@example.com', subject: 'Réservation CD-2026-415048 : confirmée' })
    );
  });

  it('réservation introuvable : aucun envoi, aucune exception', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.getBookingByReference.mockResolvedValue(null);
    await expect(notifyBookingStatusByReference('CD-2026-000000', 'REJECTED', 'https://clickdrive.ma')).resolves.toBeUndefined();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
