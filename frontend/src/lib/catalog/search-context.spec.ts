import { describe, expect, it } from 'vitest';
import { parseSearchLocation, searchContextQuery } from './search-context';
import { getMeetingPoint } from '@/lib/constants/meetingPoints';

describe('Contexte de recherche transmis de page en page', () => {
  it('lieu connu : orthographe de référence, accents et casse ignorés', () => {
    expect(parseSearchLocation('aeroport nador al-aroui (ndr)')).toBe('Aeroport Nador Al-Aroui (NDR)');
    expect(parseSearchLocation('Selouane Centre')).toBe('Selouane Centre');
    expect(parseSearchLocation('Aéroport Nador Al-Aroui (NDR)')).toBe('Aeroport Nador Al-Aroui (NDR)');
  });

  it('lieu inconnu, vide ou trop long : ignoré', () => {
    expect(parseSearchLocation('Casablanca')).toBeUndefined();
    expect(parseSearchLocation('')).toBeUndefined();
    expect(parseSearchLocation('x'.repeat(200))).toBeUndefined();
    expect(parseSearchLocation(['Selouane Centre'])).toBeUndefined();
  });

  it('dates et lieu valides : une seule adresse, dans un ordre stable', () => {
    expect(searchContextQuery({ startDate: '2026-11-20', endDate: '2026-11-23' }, 'Selouane Centre')).toBe(
      '?startDate=2026-11-20&endDate=2026-11-23&location=Selouane+Centre'
    );
    expect(searchContextQuery(null, 'Gare ONCF Nador Ville')).toBe('?location=Gare+ONCF+Nador+Ville');
    expect(searchContextQuery({ startDate: '2026-11-20', endDate: '2026-11-23' })).toBe('?startDate=2026-11-20&endDate=2026-11-23');
  });

  it('période inversée et lieu inconnu : rien n’est transmis', () => {
    expect(searchContextQuery({ startDate: '2026-11-23', endDate: '2026-11-20' }, 'Ailleurs')).toBe('');
  });
});

describe('getMeetingPoint : chaque lieu retrouve son point de rendez-vous', () => {
  it('nom exact prioritaire : la gare n’est plus confondue avec le centre-ville', () => {
    expect(getMeetingPoint('Gare ONCF Nador Ville').id).toBe('gare-oncf-nador');
    expect(getMeetingPoint('Centre-Ville Nador (Boulevard Mohammed V)').id).toBe('centre-ville-nador');
    expect(getMeetingPoint('Port de Beni Ansar (Gare Maritime)').id).toBe('port-beni-ansar');
    expect(getMeetingPoint('Aeroport Nador Al-Aroui (NDR)').id).toBe('aeroport-nador');
    expect(getMeetingPoint('aeroport-nador').id).toBe('aeroport-nador');
  });

  it('autres localités de la recherche : lieu convenu, jamais un point de Nador par erreur', () => {
    expect(getMeetingPoint('Selouane Centre')).toMatchObject({ id: 'custom-location', name: 'Selouane Centre' });
    expect(getMeetingPoint('Al-Aroui Ville')).toMatchObject({ id: 'custom-location', name: 'Al-Aroui Ville' });
  });

  it('saisies libres anciennes : mots-clés conservés', () => {
    expect(getMeetingPoint('Aéroport').id).toBe('aeroport-nador');
    expect(getMeetingPoint('gare de Nador').id).toBe('gare-oncf-nador');
    expect(getMeetingPoint('Nador centre').id).toBe('centre-ville-nador');
    expect(getMeetingPoint('Hôtel sur la corniche').id).toBe('corniche-marchica');
  });
});
