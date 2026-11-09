import { describe, expect, it } from 'vitest';
import { sectionFromUrl, workspaceUrl } from './workspace-url';

const SECTIONS = new Set(['overview', 'bookings', 'fleet', 'finances']);

describe('Adresses de l’espace agence', () => {
  it('une adresse par section, la réservation ouverte en paramètre', () => {
    expect(workspaceUrl('overview')).toBe('/agency');
    expect(workspaceUrl('fleet')).toBe('/agency?section=fleet');
    expect(workspaceUrl('bookings', 'CD-2026-123456')).toBe('/agency?section=bookings&booking=CD-2026-123456');
    expect(workspaceUrl('overview', 'CD 1/2')).toBe('/agency?booking=CD+1%2F2');
  });

  it('le lien des notifications (?booking=REF) ouvre les réservations', () => {
    expect(sectionFromUrl(null, 'CD-2026-123456', SECTIONS)).toBe('bookings');
    expect(sectionFromUrl('fleet', null, SECTIONS)).toBe('fleet');
    expect(sectionFromUrl('inconnue', null, SECTIONS)).toBe('overview');
    expect(sectionFromUrl(null, null, SECTIONS)).toBe('overview');
  });
});
