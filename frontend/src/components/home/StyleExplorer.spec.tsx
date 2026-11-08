// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StyleExplorer, summarizeCategories } from './StyleExplorer';
import { testVehicle } from '@/tests/fixtures/vehicle';

const catalog = [
  testVehicle({ id: 'a', category: 'Économique', daily_price: 300 }),
  testVehicle({ id: 'b', category: 'Économique', daily_price: 250 }),
  testVehicle({ id: 'c', category: 'SUV', daily_price: 600 }),
  testVehicle({ id: 'd', category: 'Trail', vehicle_type: 'MOTORCYCLE', daily_price: 450, brand: 'Suzuki', model: 'V-Strom' }),
];

describe('summarizeCategories — données réelles uniquement', () => {
  it('compte les véhicules et retient le prix de départ, catégories les plus fournies d’abord', () => {
    const { available, upcoming, total } = summarizeCategories(catalog, 'CAR');
    expect(total).toBe(3);
    expect(available.map((c) => [c.name, c.count, c.minPrice])).toEqual([
      ['Économique', 2, 250],
      ['SUV', 1, 600],
    ]);
    expect(upcoming).toContain('Berline');
    expect(upcoming).not.toContain('Économique');
  });

  it('sépare voitures et motos', () => {
    const motos = summarizeCategories(catalog, 'MOTORCYCLE');
    expect(motos.total).toBe(1);
    expect(motos.available.map((c) => c.name)).toEqual(['Trail']);
  });
});

describe('StyleExplorer', () => {
  it('cartes = vrais liens vers le catalogue filtré, avec nombre et prix visibles', () => {
    render(<StyleExplorer vehicles={catalog} loading={false} />);
    const section = screen.getByRole('region', { name: 'Trouvez votre style' });
    const economique = within(section).getByRole('link', { name: 'Économique — 2 voitures, dès 250 DH par jour' });
    expect(economique).toHaveAttribute('href', '/search?category=%C3%89conomique');
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    // Catégories sans véhicule : listées comme « Bientôt », jamais en carte cliquable
    expect(within(section).queryByRole('link', { name: /Berline/ })).not.toBeInTheDocument();
    expect(within(section).getByText('Berline')).toBeInTheDocument();
  });

  it('bascule vers les motos : catégories et liens du catalogue motos', async () => {
    const user = userEvent.setup();
    render(<StyleExplorer vehicles={catalog} loading={false} />);
    const motos = screen.getByRole('button', { name: /Motos/ });
    expect(motos).toHaveAttribute('aria-pressed', 'false');

    await user.click(motos);
    expect(motos).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Trail — 1 moto, dès 450 DH par jour' })).toHaveAttribute('href', '/motos?category=Trail');
    // Lien bureau et lien mobile (l'un des deux masqué en CSS selon l'écran) : tous deux vers /motos
    for (const link of screen.getAllByRole('link', { name: /Toutes les motos/ })) expect(link).toHaveAttribute('href', '/motos');
    expect(screen.getByText('Motos : 1 catégorie disponible')).toBeInTheDocument();
  });

  it('pendant le chargement : squelettes, aucun chiffre inventé', () => {
    const { container } = render(<StyleExplorer vehicles={[]} loading />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
