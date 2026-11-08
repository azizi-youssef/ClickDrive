// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testVehicle } from '@/tests/fixtures/vehicle';
import { NotFoundView } from './NotFoundView';
import { pickSuggestions } from './variants';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

const fleet = [
  testVehicle({ id: 'v1', slug: 'renault-clio-2024-a1', brand: 'Renault', model: 'Clio', daily_price: 350 }),
  testVehicle({ id: 'v2', slug: 'dacia-logan-2024-b2', brand: 'Dacia', model: 'Logan', daily_price: 250 }),
  testVehicle({ id: 'v3', slug: 'renault-megane-2024-c3', brand: 'Renault', model: 'Megane', daily_price: 400, status: 'RENTED' }),
  testVehicle({ id: 'v4', slug: 'hyundai-tucson-2024-d4', brand: 'Hyundai', model: 'Tucson', daily_price: 600, featured: true }),
];

function stubFetch(response: Promise<unknown>) {
  const fetchMock = vi.fn(() => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Page 404', () => {
  it('URL inconnue : message général, adresse demandée, recherche et rubriques, sans appel au catalogue', () => {
    navigation.pathname = '/tarifs-ete';
    const fetchMock = stubFetch(Promise.resolve({ ok: true, json: async () => ({ success: true, data: fleet }) }));
    render(<NotFoundView />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cette page n’existe pas' })).toBeInTheDocument();
    expect(screen.getByText('/tarifs-ete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir les voitures/ })).toHaveAttribute('href', '/search');

    const search = screen.getByRole('search', { name: 'Rechercher une voiture' });
    expect(search).toHaveAttribute('action', '/search');
    expect(within(search).getByLabelText('Marque ou modèle')).toHaveAttribute('name', 'q');

    const destinations = screen.getByRole('region', { name: 'Où voulez-vous aller ?' });
    expect(within(destinations).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/search',
      '/motos',
      '/agencies',
      '/faq',
      '/contact',
    ]);
    expect(screen.queryByRole('heading', { name: 'Disponibles à Nador' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('agence retirée : message dédié et lien vers les agences partenaires', () => {
    navigation.pathname = '/agencies/agence-fermee';
    stubFetch(Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) }));
    render(<NotFoundView />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cette agence est introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir les agences partenaires/ })).toHaveAttribute('href', '/agencies');
  });

  it('annonce retirée : véhicules disponibles du catalogue, même marque en premier', async () => {
    navigation.pathname = '/cars/renault-kardian-2026-zz9';
    const fetchMock = stubFetch(Promise.resolve({ ok: true, json: async () => ({ success: true, data: fleet }) }));
    render(<NotFoundView />);

    expect(screen.getByRole('heading', { level: 1, name: 'Ce véhicule n’est plus en ligne' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/vehicles?limit=200', expect.anything());

    const section = await screen.findByRole('region', { name: 'Disponibles à Nador' });
    await waitFor(() => expect(within(section).queryByRole('status')).not.toBeInTheDocument());
    expect(within(section).getByText('Les Renault encore en ligne sont proposées en premier.')).toBeInTheDocument();
    const order = [
      ...new Set(
        within(section)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href'))
          .filter((href) => href?.startsWith('/cars/'))
      ),
    ];
    expect(order).toEqual(['/cars/renault-clio-2024-a1', '/cars/hyundai-tucson-2024-d4', '/cars/dacia-logan-2024-b2']);
  });

  it('catalogue injoignable : la section de propositions disparaît, le reste de la page reste utilisable', async () => {
    navigation.pathname = '/cars/vehicule-retire';
    stubFetch(Promise.reject(new Error('réseau')));
    render(<NotFoundView />);

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Disponibles à Nador' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Où voulez-vous aller ?' })).toBeInTheDocument();
  });
});

describe('pickSuggestions', () => {
  it('exclut les véhicules indisponibles et l’annonce demandée, limite à 3', () => {
    const result = pickSuggestions(fleet, '/cars/renault-clio-2024-a1');
    expect(result.vehicles.map((vehicle) => vehicle.id)).toEqual(['v4', 'v2']);
    expect(result.brand).toBeNull();
  });

  it('même type que l’annonce : voitures pour une voiture, motos pour une moto', () => {
    const scooter = testVehicle({ id: 'm1', slug: 'yamaha-nmax-2024-m', brand: 'Yamaha', model: 'NMax', vehicle_type: 'MOTORCYCLE', category: 'Scooter', daily_price: 150 });
    const trail = testVehicle({ id: 'm2', slug: 'honda-africa-2024-n', brand: 'Honda', model: 'Africa Twin', vehicle_type: 'MOTORCYCLE', category: 'Trail', daily_price: 500 });
    const all = [...fleet, scooter, trail];
    // Lien voiture : le scooter le moins cher passe après les voitures disponibles
    expect(pickSuggestions(all, '/cars/renault-kardian-2026-zz9').vehicles.map((v) => v.id)).toEqual(['v1', 'v4', 'v2']);
    // Lien moto (marque Yamaha reconnue) : les motos d'abord
    expect(pickSuggestions(all, '/cars/yamaha-tmax-2023-q').vehicles.map((v) => v.id)).toEqual(['m1', 'm2', 'v4']);
  });

  it('marque composée et accents : « Land Rover » reconnue dans le slug', () => {
    const landRover = testVehicle({ id: 'lr', slug: 'land-rover-defender-2023-x', brand: 'Land Rover', model: 'Defender', daily_price: 900 });
    const result = pickSuggestions([...fleet, landRover], '/cars/land-rover-evoque-2022-y');
    expect(result.vehicles[0].id).toBe('lr');
    expect(result.brand).toBe('Land Rover');
  });
});
