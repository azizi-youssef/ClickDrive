import { describe, expect, it } from 'vitest';
import { PICKUP_LOCATIONS, findPickupLocation, pickupLocationHref } from './locations';
import { parseSearchLocation } from '@/lib/catalog/search-context';

describe('Lieux de prise en charge (source unique)', () => {
  it('libellés uniques et normalisés', () => {
    const labels = PICKUP_LOCATIONS.map((location) => location.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(
      expect.arrayContaining(['Aéroport Nador Al Aroui (NDR)', 'Nador Centre', 'Port de Beni Ansar', 'Corniche de Marchica', 'Al Aroui Ville'])
    );
  });

  it('reconnaît les anciennes valeurs, libellés et alias, sans changer la valeur d’adresse', () => {
    expect(findPickupLocation('Aeroport Nador Al-Aroui (NDR)')?.id).toBe('aeroport-nador');
    expect(findPickupLocation('aéroport')?.id).toBe('aeroport-nador');
    expect(findPickupLocation('Corniche de Marchica (Nador)')?.id).toBe('corniche-marchica');
    expect(findPickupLocation('Oujda')).toBeUndefined();
    // Liens « ?location=Aéroport » de l'accueil : ramenés à la valeur de référence
    expect(parseSearchLocation('Aéroport')).toBe('Aeroport Nador Al-Aroui (NDR)');
  });

  it('page SEO dédiée quand elle existe, sinon catalogue filtré par lieu', () => {
    expect(pickupLocationHref(findPickupLocation('aeroport-nador')!)).toBe('/location-voiture-nador-aeroport');
    expect(pickupLocationHref(findPickupLocation('selouane-centre')!)).toBe('/search?location=Selouane%20Centre');
  });
});
