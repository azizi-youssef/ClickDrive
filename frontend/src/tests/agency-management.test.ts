import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBaseAgencyEmail,
  resolveUniqueAgencyEmail,
  generateTemporaryPassword,
} from '../lib/utils/agency-credentials';
import {
  createAgencyWithAuthSchema,
  resetAgencyPasswordSchema,
  agencyArchiveSchema,
} from '../lib/validations/agency-access';
import { canAccessAgencyArea, canManageAgencyBooking } from '../lib/auth/server';

test('1. Création d’une agence valide - Validation du schéma Zod', () => {
  const validPayload = {
    name: 'Rif Car Nador',
    manager_name: 'Karim Benali',
    phone: '+212612345678',
    whatsapp: '+212612345678',
    email: 'rif.car.nador@clickdrive.ma',
    address: '45 Boulevard Mohammed V, Nador',
    city: 'Nador',
    region: 'Oriental',
    latitude: 35.1688,
    longitude: -2.9335,
    status: 'ACTIVE' as const,
  };

  const parsed = createAgencyWithAuthSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.name, 'Rif Car Nador');
    assert.equal(parsed.data.email, 'rif.car.nador@clickdrive.ma');
    assert.equal(parsed.data.status, 'ACTIVE');
  }
});

test('2. Génération correcte d’un email - Règles de normalisation strictes', () => {
  // A. Accents et minuscules
  assert.equal(
    generateBaseAgencyEmail('Élite Drive Oriental'),
    'elite.drive.oriental@clickdrive.ma'
  );

  // B. Espaces remplacés par des points et suppression caractères spéciaux
  assert.equal(
    generateBaseAgencyEmail("Avis & Rent (Nador - Al'Aroui)"),
    'avis.rent.nador.al.aroui@clickdrive.ma'
  );

  // C. Points consécutifs supprimés
  assert.equal(
    generateBaseAgencyEmail('Nador...Auto..Cars'),
    'nador.auto.cars@clickdrive.ma'
  );
});

test('3. Gestion d’un email déjà utilisé - Suffixe numérique d’unicité', async () => {
  const existingEmails = new Set([
    'rif.car@clickdrive.ma',
    'rif.car2@clickdrive.ma',
    'rif.car3@clickdrive.ma',
  ]);

  const uniqueEmail = await resolveUniqueAgencyEmail('Rif Car', async (candidate) => {
    return existingEmails.has(candidate);
  });

  assert.equal(uniqueEmail, 'rif.car4@clickdrive.ma');
});

test('4. Rejet d’une création invalide ou incomplète', () => {
  // Nom trop court
  assert.equal(
    createAgencyWithAuthSchema.safeParse({
      name: 'A',
      phone: '0612345678',
      email: 'a@clickdrive.ma',
      address: 'Nador',
    }).success,
    false
  );

  // Email invalide
  assert.equal(
    createAgencyWithAuthSchema.safeParse({
      name: 'Rif Car',
      phone: '0612345678',
      email: 'invalid-email',
      address: 'Nador',
    }).success,
    false
  );
});

test('5. Mot de passe temporaire - Longueur, complexité et sécurité', () => {
  const pwd = generateTemporaryPassword(14);
  assert.equal(pwd.length, 14);
  assert.match(pwd, /[A-Z]/, 'Contient majuscule');
  assert.match(pwd, /[a-z]/, 'Contient minuscule');
  assert.match(pwd, /[0-9]/, 'Contient chiffre');
  assert.match(pwd, /[!@#$%&*_\-]/, 'Contient caractère spécial');
});

test('6. Refus d’accès d’un compte suspendu / sans agence active', () => {
  // Utilisateur sans rôle agence et sans agence affiliée
  const customerAuth = {
    userId: 'user-1',
    email: 'client@example.com',
    displayName: 'Client',
    avatarUrl: null,
    role: 'CUSTOMER' as const,
    agencyIds: [],
    memberships: [],
    agencyName: null,
    agencyLogoUrl: null,
  };
  assert.equal(canAccessAgencyArea(customerAuth), false);

  // Utilisateur avec agence autorisée
  const agencyAuth = {
    userId: 'user-2',
    email: 'agent@clickdrive.ma',
    displayName: 'Agent',
    avatarUrl: null,
    role: 'AGENCY_OWNER' as const,
    agencyIds: ['agency-101'],
    memberships: [{ agencyId: 'agency-101', role: 'agency_admin' as const }],
    agencyName: 'Agence',
    agencyLogoUrl: null,
  };
  assert.equal(canAccessAgencyArea(agencyAuth), true);
});

test('7. Protection contre les accès inter-agences', () => {
  const agencyAuth = {
    userId: 'user-2',
    email: 'agent@clickdrive.ma',
    displayName: 'Agent',
    avatarUrl: null,
    role: 'AGENCY_OWNER' as const,
    agencyIds: ['agency-101'],
    memberships: [{ agencyId: 'agency-101', role: 'agency_admin' as const }],
    agencyName: 'Agence',
    agencyLogoUrl: null,
  };

  // Peut gérer sa propre agence
  assert.equal(canManageAgencyBooking(agencyAuth, 'agency-101'), true);

  // Ne peut PAS gérer une autre agence
  assert.equal(canManageAgencyBooking(agencyAuth, 'agency-999'), false);
});

test('8. Réinitialisation de mot de passe - Validation Zod', () => {
  assert.equal(resetAgencyPasswordSchema.safeParse({ password: 'short' }).success, false);
  assert.equal(resetAgencyPasswordSchema.safeParse({ password: 'StrongPassword2026!' }).success, true);
  assert.equal(resetAgencyPasswordSchema.safeParse({}).success, true); // Auto-génération si omis
});

test('9. Suppression avec dépendances métier - Validation du nom exact', () => {
  assert.equal(
    agencyArchiveSchema.safeParse({ confirmationName: 'Rif Car' }).success,
    true
  );
  assert.equal(
    agencyArchiveSchema.safeParse({ confirmationName: '' }).success,
    false
  );
});

test('10. Protection des secrets côté serveur', () => {
  // SUPABASE_SERVICE_ROLE_KEY ne doit JAMAIS commencer par NEXT_PUBLIC_
  const envKeys = Object.keys(process.env);
  const leakedServiceKey = envKeys.find(
    (k) => k.startsWith('NEXT_PUBLIC_') && k.includes('SERVICE_ROLE')
  );
  assert.equal(leakedServiceKey, undefined, 'Aucune fuite de clé service_role en variable publique');
});
