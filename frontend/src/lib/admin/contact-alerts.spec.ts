import { describe, expect, it } from 'vitest';
import {
  contactAlertText,
  contactBadgeDescription,
  contactBadgeLabel,
  newestCreatedAt,
  unseenContactMessages,
  type ContactAlertItem,
} from './contact-alerts';

const message = (id: string, createdAt: string, overrides: Partial<ContactAlertItem> = {}): ContactAlertItem => ({
  id,
  reference: `MSG-20261109-${id.toUpperCase().padEnd(6, 'A')}`,
  name: `Client ${id}`,
  category: 'reservation',
  subject: null,
  created_at: createdAt,
  ...overrides,
});

const older = message('a', '2026-11-09T08:00:00.000Z');
const newer = message('b', '2026-11-09T09:30:00.000Z', { subject: 'Retard de vol' });

describe('Alerte « nouveau message de contact »', () => {
  it('premier passage sur ce navigateur : tous les messages non traités sont annoncés', () => {
    expect(unseenContactMessages([newer, older], null)).toEqual([newer, older]);
    expect(unseenContactMessages([newer, older], 'pas une date')).toEqual([newer, older]);
  });

  it('seuls les messages arrivés après le dernier annoncé déclenchent une alerte', () => {
    expect(unseenContactMessages([newer, older], older.created_at)).toEqual([newer]);
    expect(unseenContactMessages([newer, older], newer.created_at)).toEqual([]);
  });

  it('le repère mémorisé est la date du message le plus récent', () => {
    expect(newestCreatedAt([older, newer])).toBe(newer.created_at);
    expect(newestCreatedAt([])).toBeNull();
  });

  it('texte : un message (objet, sinon catégorie) ou plusieurs (le plus récent en exemple)', () => {
    expect(contactAlertText([newer])).toEqual({ title: 'Nouveau message de Client b', body: 'Retard de vol' });
    expect(contactAlertText([older])).toEqual({ title: 'Nouveau message de Client a', body: 'Information sur un véhicule ou une réservation' });
    expect(contactAlertText([older, newer])).toEqual({
      title: '2 nouveaux messages de contact',
      body: 'Le plus récent : Client b · Retard de vol',
    });
  });

  it('compteur plafonné à « 99+ » et libellé accessible accordé', () => {
    expect(contactBadgeLabel(3)).toBe('3');
    expect(contactBadgeLabel(120)).toBe('99+');
    expect(contactBadgeDescription(1)).toBe('1 nouveau message');
    expect(contactBadgeDescription(4)).toBe('4 nouveaux messages');
  });
});
