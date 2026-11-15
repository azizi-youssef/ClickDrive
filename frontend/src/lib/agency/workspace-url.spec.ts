import { describe, expect, it } from 'vitest';
import { sectionFromUrl, statusFromUrl, workspaceUrl } from './workspace-url';

const SECTIONS = new Set(['overview', 'bookings', 'fleet', 'finances']);

describe('Adresses de l’espace agence', () => {
  it('une adresse par section, la réservation ouverte en paramètre', () => {
    expect(workspaceUrl('overview')).toBe('/agency');
    expect(workspaceUrl('fleet')).toBe('/agency?section=fleet');
    expect(workspaceUrl('bookings', 'CD-2026-123456')).toBe('/agency?section=bookings&booking=CD-2026-123456');
    expect(workspaceUrl('overview', 'CD 1/2')).toBe('/agency?booking=CD+1%2F2');
  });

  it('le filtre de statut est dans l’adresse, avant le dossier ouvert ; sans filtre, l’adresse est inchangée', () => {
    expect(workspaceUrl('bookings', null, { status: 'TO_PROCESS' })).toBe('/agency?section=bookings&status=TO_PROCESS');
    expect(workspaceUrl('bookings', 'CD-1', { status: 'TO_PROCESS' })).toBe('/agency?section=bookings&status=TO_PROCESS&booking=CD-1');
    expect(workspaceUrl('bookings', null, { status: '' })).toBe('/agency?section=bookings');
    expect(workspaceUrl('bookings', null, {})).toBe('/agency?section=bookings');
  });

  it('un filtre de statut inconnu dans l’adresse est ignoré', () => {
    const known = new Set(['TO_PROCESS', 'APPROVED']);
    expect(statusFromUrl('TO_PROCESS', known)).toBe('TO_PROCESS');
    expect(statusFromUrl('N_IMPORTE_QUOI', known)).toBe('');
    expect(statusFromUrl('', known)).toBe('');
    expect(statusFromUrl(null, known)).toBe('');
  });

  it('le lien des notifications (?booking=REF) ouvre les réservations', () => {
    expect(sectionFromUrl(null, 'CD-2026-123456', SECTIONS)).toBe('bookings');
    expect(sectionFromUrl('fleet', null, SECTIONS)).toBe('fleet');
    expect(sectionFromUrl('inconnue', null, SECTIONS)).toBe('overview');
    expect(sectionFromUrl(null, null, SECTIONS)).toBe('overview');
  });
});
