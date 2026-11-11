// @vitest-environment jsdom
import '@/tests/setup/dom';
import { fireEvent, render, screen } from '@/tests/setup/render';
import { describe, expect, it } from 'vitest';
import { VehicleCard } from './VehicleCard';
import { testVehicle } from '@/tests/fixtures/vehicle';

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

