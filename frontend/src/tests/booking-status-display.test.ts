import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKING_STATUSES } from '@clickdrive/shared';
import { bookingStatusLabel, bookingStatusTone, bookingTimeline, bookingNextStepHint } from '../lib/bookings/status';

const LOCALES = ['fr', 'ar', 'es', 'de', 'nl'] as const;

test('Statuts — chaque statut de la machine à états a un libellé traduit, une couleur et une explication', () => {
  for (const status of BOOKING_STATUSES) {
    for (const locale of LOCALES) {
      const label = bookingStatusLabel(status, locale);
      assert.notEqual(label, status, `${status} sans libellé ${locale}`);
      assert.ok(label.length > 2);
    }
    assert.notEqual(bookingStatusLabel(status, 'fr', 'business'), status);
    assert.ok(bookingNextStepHint(status).length > 10, `${status} sans explication`);
    assert.ok(bookingStatusTone(status));
  }
});

test('Statuts — une demande n’est jamais présentée comme confirmée ou louée', () => {
  for (const status of ['REQUESTED', 'PENDING', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW']) {
    assert.equal(bookingStatusTone(status), 'warning', status);
    assert.doesNotMatch(bookingStatusLabel(status), /confirm|lou/i);
  }
  assert.equal(bookingStatusTone('APPROVED'), 'success');
  assert.equal(bookingStatusTone('CONFIRMED'), 'success');
});

test('Suivi — étapes cohérentes avec le statut', () => {
  const states = (status: string) => bookingTimeline(status).map((step) => step.state).join(',');
  assert.equal(states('REQUESTED'), 'current,upcoming,upcoming,upcoming,upcoming,upcoming');
  assert.equal(states('SENT_TO_AGENCY'), 'done,current,upcoming,upcoming,upcoming,upcoming');
  assert.equal(states('AGENCY_REVIEW'), 'done,done,current,upcoming,upcoming,upcoming');
  assert.equal(states('APPROVED'), 'done,done,done,current,upcoming,upcoming');
  assert.equal(states('CONFIRMED'), states('APPROVED'));
  assert.equal(states('REJECTED'), 'done,done,stopped,upcoming,upcoming,upcoming');
  assert.equal(states('COMPLETED'), 'done,done,done,done,done,done');
});
