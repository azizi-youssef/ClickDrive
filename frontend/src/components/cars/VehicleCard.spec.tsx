// @vitest-environment jsdom
import '@/tests/setup/dom';
import { fireEvent, render, screen } from '@/tests/setup/render';
import { describe, expect, it } from 'vitest';
import { VehicleCard } from './VehicleCard';
import { testVehicle } from '@/tests/fixtures/vehicle';
import type { Agency } from '@/types';

describe('VehicleCard — navigation fluide des images', () => {
  it('rendu d’une voiture sans images : affiche le placeholder voiture', () => {
    const car = testVehicle({
      brand: 'Renault',
      model: 'Clio',
      vehicle_type: 'CAR',
      images: [],
    });
    const { container } = render(<VehicleCard vehicle={car} />);
    expect(screen.getByText('Renault')).toBeInTheDocument();
    expect(screen.getByText('Clio')).toBeInTheDocument();
    // SVG de CarFront
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('rendu d’une moto sans images : affiche le placeholder moto', () => {
    const moto = testVehicle({
      brand: 'Yamaha',
      model: 'TMAX',
      vehicle_type: 'MOTORCYCLE',
      category: 'Scooter',
      engine_cc: 560,
      images: [],
    });
    const { container } = render(<VehicleCard vehicle={moto} />);
    expect(screen.getByText('Yamaha')).toBeInTheDocument();
    expect(screen.getByText('TMAX')).toBeInTheDocument();
    // Le badge et les spécifications moto
    expect(screen.getByText(/560/)).toBeInTheDocument();
  });

  it('voiture avec plusieurs images : track animé en translateX avec boutons et indicateurs', () => {
    const car = testVehicle({
      brand: 'Peugeot',
      model: '208',
      vehicle_type: 'CAR',
      images: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg'],
    });
    const { container } = render(<VehicleCard vehicle={car} />);

    const nextBtn = screen.getByRole('button', { name: /suivante/i });
    const prevBtn = screen.getByRole('button', { name: /précédente/i });
    expect(nextBtn).toBeInTheDocument();
    expect(prevBtn).toBeInTheDocument();

    // Track de défilement fluide
    const track = container.querySelector('[dir="ltr"]') as HTMLElement;
    expect(track).toBeInTheDocument();
    expect(track.style.transform).toBe('translateX(-0%)');

    // Clic sur image suivante
    fireEvent.click(nextBtn);
    expect(track.style.transform).toBe('translateX(-100%)');

    // Clic sur image suivante encore
    fireEvent.click(nextBtn);
    expect(track.style.transform).toBe('translateX(-200%)');

    // Clic sur image précédente
    fireEvent.click(prevBtn);
    expect(track.style.transform).toBe('translateX(-100%)');
  });

  it('moto avec plusieurs images : swipe tactile supporté', () => {
    const moto = testVehicle({
      brand: 'Honda',
      model: 'X-ADV',
      vehicle_type: 'MOTORCYCLE',
      images: ['https://example.com/m1.jpg', 'https://example.com/m2.jpg'],
    });
    const { container } = render(<VehicleCard vehicle={moto} />);
    const track = container.querySelector('[dir="ltr"]') as HTMLElement;
    const gallery = track.parentElement?.parentElement as HTMLElement;

    expect(track.style.transform).toBe('translateX(-0%)');

    // Simuler un swipe gauche (touchStart puis touchEnd avec deltaX = -50)
    fireEvent.touchStart(gallery, {
      touches: [{ clientX: 100, clientY: 50 }],
    });
    fireEvent.touchEnd(gallery, {
      changedTouches: [{ clientX: 40, clientY: 50 }],
    });

    expect(track.style.transform).toBe('translateX(-100%)');
  });
});

describe('VehicleCard — remise longue durée de l’agence', () => {
  const agency = (tiers: unknown) =>
    ({ id: '22222222-2222-4222-8222-222222222222', name: 'Agence Test', duration_discounts: tiers }) as Agency;
  const tiers = [
    { min_days: 3, percent: 5 },
    { min_days: 7, percent: 10 },
  ];

  it('sans période : pastille du premier palier annoncé', () => {
    render(<VehicleCard vehicle={testVehicle({ daily_price: 300, agency: agency(tiers) })} />);
    expect(screen.getByText('−5 % dès 3 jours')).toBeInTheDocument();
  });

  it('période choisie : remise appliquée, prix plein barré et total remisé', () => {
    const { container } = render(<VehicleCard vehicle={testVehicle({ daily_price: 300, agency: agency(tiers) })} selectedDays={7} />);
    expect(screen.getByText('Remise −10 % appliquée')).toBeInTheDocument();
    expect(container.querySelector('s')).toHaveTextContent(/2\s100\sDH/);
    expect(screen.getByText(/1\s890\sDH/)).toBeInTheDocument();
  });

  it('période sous le premier palier : pas de remise appliquée, prix non barré', () => {
    const { container } = render(<VehicleCard vehicle={testVehicle({ daily_price: 300, agency: agency(tiers) })} selectedDays={2} />);
    expect(screen.queryByText(/appliquée/)).not.toBeInTheDocument();
    expect(container.querySelector('s')).toBeNull();
    expect(screen.getByText('−5 % dès 3 jours')).toBeInTheDocument();
  });

  it('agence sans remise : aucune pastille', () => {
    render(<VehicleCard vehicle={testVehicle({ daily_price: 300, agency: agency([]) })} selectedDays={7} />);
    expect(screen.queryByText(/dès \d+ jours/)).not.toBeInTheDocument();
    expect(screen.queryByText(/appliquée/)).not.toBeInTheDocument();
  });
});
