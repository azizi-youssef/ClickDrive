import test from 'node:test';
import assert from 'node:assert/strict';
import { signedBookingPdfPath, verifyBookingPdfSignature } from '../lib/auth/booking-pdf-link';
import { isValidBookingReference } from '../lib/utils/reference';

process.env.BOOKING_LINK_SECRET = 'test_booking_link_secret';

function params(path: string) {
  const url = new URL(path, 'https://clickdrive.test');
  return { exp: url.searchParams.get('exp'), sig: url.searchParams.get('sig') };
}

test('Lien PDF signé — accepté pour sa référence, refusé sinon', () => {
  const { exp, sig } = params(signedBookingPdfPath('CD-2026-123456'));
  assert.equal(verifyBookingPdfSignature('CD-2026-123456', exp, sig), true);
  assert.equal(verifyBookingPdfSignature('CD-2026-123457', exp, sig), false, 'Autre référence refusée');
  assert.equal(verifyBookingPdfSignature('CD-2026-123456', exp, null), false, 'Signature absente refusée');
  assert.equal(verifyBookingPdfSignature('CD-2026-123456', String(Number(exp) + 1), sig), false, 'Expiration modifiée refusée');
});

test('Lien PDF signé — refusé après expiration', () => {
  const issuedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
  const { exp, sig } = params(signedBookingPdfPath('CD-2026-123456', issuedAt));
  assert.equal(verifyBookingPdfSignature('CD-2026-123456', exp, sig), false);
});

test('Référence — les filtres PostgREST injectés sont rejetés', () => {
  assert.equal(isValidBookingReference('CD-2026-123456'), true);
  assert.equal(isValidBookingReference('x,customer_phone.eq.+212600000000'), false);
  assert.equal(isValidBookingReference('CD-2026-123456,id.not.is.null'), false);
});
