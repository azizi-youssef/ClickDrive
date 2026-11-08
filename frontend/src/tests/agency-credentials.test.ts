import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBaseAgencyEmail,
  generateCandidateAgencyEmails,
  resolveUniqueAgencyEmail,
  generateTemporaryPassword,
  normalizeAgencySlug,
} from '../lib/utils/agency-credentials';

test('1. Normalisation email - Minuscules et suppression accents', () => {
  assert.equal(
    generateBaseAgencyEmail('Élite Drive Oriental'),
    'elite.drive.oriental@clickdrive.ma'
  );
  assert.equal(
    generateBaseAgencyEmail('Location Auto Nador Aéroport'),
    'location.auto.nador.aeroport@clickdrive.ma'
  );
});

test('2. Normalisation email - Espaces, tirets, symboles et points consécutifs', () => {
  assert.equal(
    generateBaseAgencyEmail("Rif Car & Co (Nador - Al'Aroui)"),
    'rif.car.co.nador.al.aroui@clickdrive.ma'
  );
  assert.equal(
    generateBaseAgencyEmail('Agence..Auto...100%..Discount'),
    'agence.auto.100.discount@clickdrive.ma'
  );
});

test('3. Génération des candidats de collision avec suffixe', () => {
  const candidates = generateCandidateAgencyEmails('Rif Car', 4);
  assert.deepEqual(candidates, [
    'rif.car@clickdrive.ma',
    'rif.car2@clickdrive.ma',
    'rif.car3@clickdrive.ma',
    'rif.car4@clickdrive.ma',
  ]);
});

test('4. Résolution d’unicité d’email avec simulation de collision', async () => {
  const existingEmails = new Set(['rif.car@clickdrive.ma', 'rif.car2@clickdrive.ma']);
  const uniqueEmail = await resolveUniqueAgencyEmail('Rif Car', async (email) =>
    existingEmails.has(email)
  );
  assert.equal(uniqueEmail, 'rif.car3@clickdrive.ma');
});

test('5. Génération mot de passe temporaire sécurisé', () => {
  const pwd = generateTemporaryPassword(16);
  assert.equal(pwd.length, 16);
  assert.match(pwd, /[A-Z]/, 'Contient majuscule');
  assert.match(pwd, /[a-z]/, 'Contient minuscule');
  assert.match(pwd, /[0-9]/, 'Contient chiffre');
  assert.match(pwd, /[!@#$%&*_\-]/, 'Contient caractère spécial');
});

test('6. Normalisation du slug agence', () => {
  assert.equal(normalizeAgencySlug('Élite Drive (Nador)'), 'elite-drive-nador');
  assert.equal(normalizeAgencySlug('Rif Car & Co'), 'rif-car-co');
});
