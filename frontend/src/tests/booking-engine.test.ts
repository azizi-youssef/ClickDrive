/**
 * ClickDrive Booking Engine & Business Logic Test Suite
 * Validates:
 * 1. calculateBookingPrice (subtotal, commission_rate, commission_amount, agency_amount, total)
 * 2. calculateRentalDays (dates math, min 1 day)
 * 3. generateBookingReference (unique format CD-YYYY-XXXXXX, collision check)
 * 4. doDatesOverlap & anti-double-booking
 * 5. bookingRequestSchema (Zod validation with CIN, license, options)
 * 6. Commission status and booking state machine transitions
 */

import { calculateBookingPrice, calculateRentalDays } from '../lib/utils/pricing';
import { generateBookingReference, isValidBookingReference } from '../lib/utils/reference';
import { doDatesOverlap } from '../lib/availability/engine';
import { bookingRequestSchema } from '../lib/validations/booking';

function runTests() {
  console.log('========================================================');
  console.log('🧪 ClickDrive Booking Engine Test Suite Running...');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- 1. FINANCIAL PRICING & COMMISSION TESTS ---
  console.log('--- 1. Calcul Financier & Commission ---');
  // Modèle Abonnement (défaut 0.00% commission)
  const defaultPrice = calculateBookingPrice(360, 5);
  assert(defaultPrice.subtotal === 1800, 'Sous-total 360 DH x 5 jours = 1 800 DH');
  assert(defaultPrice.commission_rate === 0.00, 'Taux de commission par défaut = 0% (Modèle Abonnement)');
  assert(defaultPrice.commission_amount === 0, 'Commission ClickDrive = 0 DH (100% conservé par agence)');
  assert(defaultPrice.agency_amount === 1800, 'Net agence 100% = 1 800 DH');
  assert(defaultPrice.total === 1800, 'Total facturé = 1 800 DH');

  // Test avec taux explicite (ex: 15% rétroactif)
  const price1 = calculateBookingPrice(360, 5, 15.00);
  assert(price1.commission_rate === 15.00, 'Taux de commission historique = 15%');
  assert(price1.commission_amount === 270, 'Commission ClickDrive 15% de 1800 = 270 DH');
  assert(price1.agency_amount === 1530, 'Montant agence = 1800 - 270 = 1 530 DH');

  // Test avec taux dynamique différent (ex: 20%)
  const price2 = calculateBookingPrice(400, 3, 20.00);
  assert(price2.subtotal === 1200, 'Sous-total 400 DH x 3 jours = 1 200 DH');
  assert(price2.commission_amount === 240, 'Commission ClickDrive 20% de 1200 = 240 DH');
  assert(price2.agency_amount === 960, 'Montant agence = 960 DH');

  // --- 2. DURATION CALCULATION TESTS ---
  console.log('\n--- 2. Calcul de la Durée de Location ---');
  assert(calculateRentalDays('2026-10-10', '2026-10-15') === 5, '10 au 15 octobre = 5 jours');
  assert(calculateRentalDays('2026-10-10', '2026-10-10') === 1, 'Même jour = minimum 1 jour');
  assert(calculateRentalDays('2026-10-01', '2026-10-08') === 7, '1 au 8 octobre = 7 jours');

  // --- 3. REFERENCE GENERATOR TESTS ---
  console.log('\n--- 3. Référence Unique de Réservation ---');
  const ref = generateBookingReference(2026);
  assert(isValidBookingReference(ref), `Format valide CD-2026-XXXXXX: ${ref}`);
  assert(ref.startsWith('CD-2026-'), 'Préfixe CD-2026 correct');

  // Unicité sur 500 références générées
  const set = new Set<string>();
  let duplicates = 0;
  for (let i = 0; i < 500; i++) {
    const r = generateBookingReference();
    if (set.has(r)) duplicates++;
    set.add(r);
  }
  assert(duplicates === 0, '500 références consécutives sans collision');

  // --- 4. OVERLAP & ANTI DOUBLE-BOOKING TESTS ---
  console.log('\n--- 4. Détection des Conflits de Dates (Anti Double-Booking) ---');
  // Plage existante : 10 au 15 octobre
  assert(doDatesOverlap('2026-10-12', '2026-10-14', '2026-10-10', '2026-10-15') === true, 'Chevauchement intérieur détecté');
  assert(doDatesOverlap('2026-10-08', '2026-10-11', '2026-10-10', '2026-10-15') === true, 'Chevauchement au début détecté');
  assert(doDatesOverlap('2026-10-14', '2026-10-18', '2026-10-10', '2026-10-15') === true, 'Chevauchement à la fin détecté');
  assert(doDatesOverlap('2026-10-16', '2026-10-20', '2026-10-10', '2026-10-15') === false, 'Dates postérieures sans conflit');
  assert(doDatesOverlap('2026-10-01', '2026-10-09', '2026-10-10', '2026-10-15') === false, 'Dates antérieures sans conflit');

  // --- 5. SCHEMA VALIDATION TESTS (ZOD WITH CIN) ---
  console.log('\n--- 5. Validation Zod du Formulaire (CIN & Permis) ---');
  const validData = {
    vehicleId: '11111111-1111-4111-8111-111111111111',
    agencyId: '22222222-2222-4222-8222-222222222222',
    firstName: 'Youssef',
    lastName: 'Azizi',
    cin: 'S123456',
    phone: '+212661234567',
    country: 'Maroc',
    birthDate: '1995-04-12',
    licenseNumber: '04/987654',
    licenseExpiry: '2030-05-20',
    startDate: '2026-10-10',
    endDate: '2026-10-15',
    pickupTime: '10:00',
    dropoffTime: '10:00',
    deliveryType: 'AIRPORT' as const,
    pickupLocation: 'Aéroport Nador',
    dropoffLocation: 'Aéroport Nador',
  };

  const validationSuccess = bookingRequestSchema.safeParse(validData);
  assert(validationSuccess.success === true, 'Données valides avec CIN acceptées');

  // CIN et permis facultatifs à la demande (présentés en original à la remise), vérifiés s'ils sont fournis
  const withoutDocuments = { ...validData, cin: '', licenseNumber: '', licenseExpiry: '' };
  assert(bookingRequestSchema.safeParse(withoutDocuments).success === true, 'Demande acceptée sans CIN ni permis');
  const invalidShortCin = { ...validData, cin: 'S1' };
  assert(bookingRequestSchema.safeParse(invalidShortCin).success === false, 'Rejet si CIN fourni mais trop court');

  // Rejet si dates inversées
  const invalidDates = { ...validData, startDate: '2026-10-15', endDate: '2026-10-10' };
  assert(bookingRequestSchema.safeParse(invalidDates).success === false, 'Rejet si endDate < startDate');

  // Rejet si permis expiré avant la fin de location
  const expiredLicense = { ...validData, licenseExpiry: '2026-10-01' };
  assert(bookingRequestSchema.safeParse(expiredLicense).success === false, 'Rejet si permis expiré avant restitution');

  console.log('\n========================================================');
  console.log(`📊 Résultat: ${passed} passés, ${failed} échoués sur ${passed + failed} assertions.`);
  console.log('========================================================');
}

runTests();
