import { describe, expect, it } from 'vitest';
import { protectedFieldChanges, unexpectedVehicleFields, violationResponseInit } from './protected-fields';

const current = {
  id: 'v1',
  agency_id: 'agency-a',
  slug: 'dacia-logan',
  featured: false,
  archived_at: null,
  documents: [{ url: 'carte-grise.pdf' }],
  updated_at: '2026-11-01T00:00:00.000Z',
};

describe('protectedFieldChanges (route canonique)', () => {
  it('champs protégés renvoyés inchangés par le formulaire : acceptés', () => {
    expect(protectedFieldChanges({ ...current, documents: [{ url: 'carte-grise.pdf' }], daily_price: 300 }, current)).toEqual([]);
  });

  it('horodatages et notes calculés par le serveur : ignorés', () => {
    expect(protectedFieldChanges({ updated_at: '2020-01-01', rating: 4.2, review_count: 9 }, current)).toEqual([]);
  });

  it('null, absent et false sont équivalents pour la mise en avant', () => {
    expect(protectedFieldChanges({ featured: null }, current)).toEqual([]);
  });

  it.each([
    [{ agency_id: 'agency-b' }, 'immutable'],
    [{ id: 'v2' }, 'immutable'],
    [{ featured: true }, 'platform'],
    [{ documents: [] }, 'platform'],
  ])('%j : violation %s', (body, reason) => {
    expect(protectedFieldChanges(body, current)).toEqual([{ field: Object.keys(body)[0], reason }]);
  });
});

describe('unexpectedVehicleFields (routes historiques, liste blanche stricte)', () => {
  it('champs du schéma : acceptés', () => {
    expect(unexpectedVehicleFields({ daily_price: 1, status: 'AVAILABLE', published: true })).toEqual([]);
  });

  it('agency_id seulement s’il est explicitement autorisé (cible de création)', () => {
    expect(unexpectedVehicleFields({ agency_id: 'x' }, ['agency_id'])).toEqual([]);
    expect(unexpectedVehicleFields({ agency_id: 'x' })).toEqual([{ field: 'agency_id', reason: 'immutable' }]);
  });

  it('codes HTTP : 403 pour un champ plateforme, 400 sinon', () => {
    expect(violationResponseInit([{ field: 'featured', reason: 'platform' }]).status).toBe(403);
    expect(violationResponseInit([{ field: 'agency_id', reason: 'immutable' }]).status).toBe(400);
    expect(violationResponseInit([{ field: 'foo', reason: 'unknown' }]).status).toBe(400);
  });
});
