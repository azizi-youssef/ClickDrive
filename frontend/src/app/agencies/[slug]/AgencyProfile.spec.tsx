// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgencyProfile } from './AgencyProfile';
import type { AgencyProfileData } from './data';
import { testVehicle } from '@/tests/fixtures/vehicle';

vi.mock('@/lib/supabase/realtime', () => ({ useRealtimeRefresh: () => undefined }));

const agency: AgencyProfileData = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'agence-test',
  name: 'Agence Test',
  description: '',
  address: 'Nador',
  city: 'Nador',
  latitude: 35.1688,
  longitude: -2.9335,
  logo_url: '',
  banner_url: undefined,
  verified: true,
  rating: 0,
  review_count: 0,
  created_at: '2026-10-05T10:00:00.000Z',
};

const fleet = [
  testVehicle({ id: 'c1', slug: 'car-1', brand: 'Renault', model: 'Clio', daily_price: 350 }),
  testVehicle({ id: 'c2', slug: 'car-2', brand: 'Hyundai', model: 'Tucson', daily_price: 600 }),
  testVehicle({ id: 'm1', slug: 'moto-1', brand: 'Suzuki', model: 'V-Strom', vehicle_type: 'MOTORCYCLE', category: 'Trail', daily_price: 300 }),
];

describe('AgencyProfile — fiche agence', () => {
  it('faits réels : flotte, prix de départ, adresse sans doublon, lien carte', () => {
    render(<AgencyProfile agency={agency} initialVehicles={fleet} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Agence Test' })).toBeInTheDocument();
    expect(screen.getByText('3 véhicules')).toBeInTheDocument();
    expect(screen.getByText('2 voitures · 1 moto')).toBeInTheDocument();
    const fromPrice = screen.getByText('À partir de').closest('div') as HTMLElement;
    expect(within(fromPrice).getByText('300')).toBeInTheDocument();
    // « Nador (Nador) » évité : la ville n'est pas répétée quand l'adresse est identique
    expect(screen.queryByText(/Nador.*\(Nador\)|Nador, Nador/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir sur la carte/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=35.1688,-2.9335'
    );
    expect(screen.getByRole('link', { name: 'Voir les 3 véhicules' })).toHaveAttribute('href', '#agency-fleet');
  });

  it('sans présentation rédigée : aucune section « À propos » vide', () => {
    render(<AgencyProfile agency={agency} initialVehicles={fleet} />);
    expect(screen.queryByRole('heading', { name: /À propos/ })).not.toBeInTheDocument();
    render(<AgencyProfile agency={{ ...agency, slug: 'autre', description: 'Agence familiale depuis 2010.' }} initialVehicles={fleet} />);
    expect(screen.getByRole('heading', { name: /À propos de Agence Test/ })).toBeInTheDocument();
  });

  it('flotte : filtre voitures / motos et tri par prix', async () => {
    const user = userEvent.setup();
    render(<AgencyProfile agency={agency} initialVehicles={fleet} />);
    const section = screen.getByRole('region', { name: 'La flotte de Agence Test' });
    const cards = () => within(section).getAllByRole('link', { name: /Voir les détails|Renault|Hyundai|Suzuki/ }).map((a) => a.getAttribute('href'));

    await user.click(within(section).getByRole('button', { name: /Motos/ }));
    expect(within(section).getByRole('button', { name: /Motos/ })).toHaveAttribute('aria-pressed', 'true');
    expect(cards().every((href) => href?.includes('moto-1'))).toBe(true);
    expect(within(section).getByText(/1 véhicule affiché/)).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: /Tout/ }));
    await user.selectOptions(within(section).getByLabelText('Trier la flotte'), 'price_desc');
    const order = [...new Set(cards())];
    expect(order[0]).toContain('car-2'); // 600 DH en premier
    expect(order[order.length - 1]).toContain('moto-1'); // 300 DH en dernier
  });

  it('infos pratiques et délai de réponse : affichés seulement quand ils existent', () => {
    render(<AgencyProfile agency={agency} initialVehicles={fleet} />);
    expect(screen.queryByRole('heading', { name: 'Infos pratiques' })).not.toBeInTheDocument();
    expect(screen.queryByText('Répond aux demandes')).not.toBeInTheDocument();

    render(
      <AgencyProfile
        agency={{
          ...agency,
          slug: 'agence-infos',
          opening_hours: 'Lun–Sam 8h–20h',
          languages: ['ar', 'rif', 'es'],
          delivery_fee_airport: 0,
          delivery_fee_port: 150,
          cancellation_policy: 'Annulation gratuite jusqu’à 48 h avant la prise en charge.',
        }}
        initialVehicles={fleet}
        responseTime={{ medianMinutes: 40, responses: 6, label: 'en moins de 1 h' }}
      />
    );
    const practical = screen.getByRole('region', { name: 'Infos pratiques' });
    expect(within(practical).getByText('Lun–Sam 8h–20h')).toBeInTheDocument();
    expect(within(practical).getByText('Arabe, Tarifit (rifain), Espagnol')).toBeInTheDocument();
    expect(within(practical).getByText('Gratuite')).toBeInTheDocument();
    expect(within(practical).getByText('150 DH, à régler à l’agence')).toBeInTheDocument();
    expect(screen.getByText('en moins de 1 h')).toBeInTheDocument();
    expect(screen.getByText('médiane sur 6 demandes')).toBeInTheDocument();
  });

  it('agence sans véhicule : message clair et lien vers le catalogue', () => {
    render(<AgencyProfile agency={agency} initialVehicles={[]} />);
    expect(screen.getByText('Agence Test n’a pas encore publié de véhicule.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir tout le catalogue/ })).toHaveAttribute('href', '/search');
  });
});
