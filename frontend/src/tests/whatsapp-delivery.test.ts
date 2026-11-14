import test from 'node:test';
import assert from 'node:assert/strict';
import { whatsappService } from '../lib/services/whatsapp.service';
import { deliveryService } from '../lib/services/delivery.service';
import { getMeetingPoint } from '../lib/constants/meetingPoints';
import { Booking } from '../types';

test('1. Normalisation des numéros WhatsApp (Maroc et International)', () => {
  // Mobile Maroc
  assert.equal(whatsappService.normalizePhoneNumber('06 12 34 56 78'), '212612345678');
  assert.equal(whatsappService.normalizePhoneNumber('07-98-76-54-32'), '212798765432');
  assert.equal(whatsappService.normalizePhoneNumber('+212 612 345 678'), '212612345678');
  assert.equal(whatsappService.normalizePhoneNumber('00212612345678'), '212612345678');

  // International
  assert.equal(whatsappService.normalizePhoneNumber('+33 6 12 34 56 78'), '33612345678');
  assert.equal(whatsappService.normalizePhoneNumber('0034 600 123 456'), '34600123456');

  // Validation
  assert.equal(whatsappService.isValidPhoneNumber('0612345678'), true);
  assert.equal(whatsappService.isValidPhoneNumber('invalid'), false);
  assert.equal(whatsappService.isValidPhoneNumber('123'), false);
});

test('2. Génération de liens direct Click-to-Chat WhatsApp', () => {
  const url = whatsappService.generateDirectChatUrl('0612345678', 'Bonjour ClickDrive');
  assert.equal(url.includes('https://wa.me/212612345678'), true);
  assert.equal(url.includes('Bonjour%20ClickDrive'), true);
});

test('3. Envoi de notification WhatsApp en mode simulation & wamid', async () => {
  const dummyBooking: Partial<Booking> = {
    id: 'bk-test-123',
    reference: 'CD-2026-TEST01',
    customer_name: 'Karim Alaoui',
    customer_phone: '0612345678',
    start_date: '2026-10-20',
    end_date: '2026-10-25',
    total_days: 5,
    total_price: 1800,
    deposit_amount: 3000,
    pickup_location: 'Aéroport Nador Al-Aroui',
  };

  const res = await whatsappService.sendBookingConfirmation(dummyBooking as Booking);
  assert.equal(res.success, true);
  assert.equal(res.status, 'SIMULATED');
  assert.equal(res.recipient, '212612345678');
  assert.equal(typeof res.messageId, 'string');
  assert.equal(res.messageId!.startsWith('wamid.sim_'), true);
  // Le journal des envois est en base (whatsapp_messages) : vérifié par les tests du service et de la base
});

test('4. Résolution des points de rendez-vous pour la livraison', () => {
  const airport = getMeetingPoint('aeroport-nador');
  assert.ok(airport);
  assert.equal(airport.code, 'NDR');
  assert.equal(airport.type, 'AIRPORT');
  assert.equal(airport.name.includes('Aéroport Nador'), true);

  const port = getMeetingPoint('port-beni-ansar');
  assert.ok(port);
  assert.equal(port.code, 'BA-PORT');
  assert.equal(port.type, 'PORT');
});

test('5. DeliveryService — Validation des contrôles de sécurité kilométrique', async () => {
  // Rejet si kilométrage négatif
  const resNegative = await deliveryService.validateHandover({
    bookingId: 'bk-fake',
    agencyId: 'agency-fake',
    type: 'PICKUP',
    mileage: -50,
    fuelLevel: 'FULL',
    cleanliness: 'CLEAN',
    checklist: {
      spareTire: true,
      jack: true,
      registrationDoc: true,
      insuranceDoc: true,
      safetyKit: true,
    },
  });

  assert.equal(resNegative.success, false);
  assert.equal(resNegative.error?.includes('positif'), true);
});
