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

describe('VehicleCard — remises distinctes voitures / motos', () => {
  const agency = (extra: Record<string, unknown>) =>
    ({ id: '22222222-2222-4222-8222-222222222222', name: 'Agence Test', ...extra }) as Agency;
  const both = agency({
    duration_discounts: [{ min_days: 7, percent: 10 }],
    motorcycle_duration_discounts: [{ min_days: 3, percent: 15 }],
  });

  it('une voiture annonce le palier des voitures', () => {
    render(<VehicleCard vehicle={testVehicle({ daily_price: 300, vehicle_type: 'CAR', agency: both })} />);
    expect(screen.getByText('−10 % dès 7 jours')).toBeInTheDocument();
    expect(screen.queryByText('−15 % dès 3 jours')).not.toBeInTheDocument();
  });

  it('une moto annonce le palier des motos', () => {
    render(<VehicleCard vehicle={testVehicle({ daily_price: 150, vehicle_type: 'MOTORCYCLE', category: 'Scooter', agency: both })} />);
    expect(screen.getByText('−15 % dès 3 jours')).toBeInTheDocument();
    expect(screen.queryByText('−10 % dès 7 jours')).not.toBeInTheDocument();
  });

  it('période choisie : la remise appliquée à une moto est celle des motos', () => {
    // 150 DH × 3 jours = 450 DH ; −15 % → 382,5 arrondi 383 DH (3 jours : seuil des motos, pas des voitures)
    render(<VehicleCard vehicle={testVehicle({ daily_price: 150, vehicle_type: 'MOTORCYCLE', category: 'Scooter', agency: both })} selectedDays={3} />);
    expect(screen.getByText('Remise −15 % appliquée')).toBeInTheDocument();
    const car = render(<VehicleCard vehicle={testVehicle({ daily_price: 150, vehicle_type: 'CAR', agency: both })} selectedDays={3} />);
    expect(car.container.querySelector('s')).toBeNull();
  });

  it('motos sans remise alors que les voitures en ont : la moto n’affiche aucune pastille', () => {
    const carsOnly = agency({ duration_discounts: [{ min_days: 7, percent: 10 }], motorcycle_duration_discounts: [] });
    render(<VehicleCard vehicle={testVehicle({ daily_price: 150, vehicle_type: 'MOTORCYCLE', category: 'Scooter', agency: carsOnly })} selectedDays={7} />);
    expect(screen.queryByText(/dès \d+ jours/)).not.toBeInTheDocument();
    expect(screen.queryByText(/appliquée/)).not.toBeInTheDocument();
  });
});

describe('VehicleCard — présentation de la promotion', () => {
  const agency = (overrides: Partial<Agency> = {}) =>
    ({ id: '22222222-2222-4222-8222-222222222222', name: 'Agence Test', duration_discounts: [{ min_days: 3, percent: 5 }, { min_days: 7, percent: 10 }], ...overrides }) as Agency;

  it('sans dates : promotion annoncée sur la photo (pastille claire), pas de bande d’économie', () => {
    const { container } = render(<VehicleCard vehicle={testVehicle({ daily_price: 300, agency: agency() })} />);
    const badge = screen.getByText('−5 % dès 3 jours').closest('span.absolute')!;
    expect(badge.className).toMatch(/\bbg-white\/95\b/);
    expect(container.querySelector('s')).toBeNull();
    expect(screen.queryByText(/^Économie/)).not.toBeInTheDocument();
  });

  it('remise appliquée : pastille pleine sur la photo et bande « total pour N j · prix barré · économie »', () => {
    const { container } = render(<VehicleCard vehicle={testVehicle({ daily_price: 350, agency: agency() })} selectedDays={8} />);
    const badge = screen.getByText('Remise −10 % appliquée').closest('span.absolute')!;
    expect(badge.className).toMatch(/\bbg-emerald-700\b/);
    const band = container.querySelector('s')!.closest('div')!;
    expect(band).toHaveTextContent(/2\s520\sDH pour 8 j/);
    expect(band).toHaveTextContent(/Prix sans réduction :\s*2\s800\sDH/);
    expect(band).toHaveTextContent(/Économie 280\sDH/);
  });

  it('tarif semaine : traité comme une réduction (pastille, prix barré, économie)', () => {
    const { container } = render(
      <VehicleCard vehicle={testVehicle({ daily_price: 550, weekly_price: 3300, agency: agency({ duration_discounts: [] }) })} selectedDays={8} />
    );
    expect(screen.getByText('Tarif semaine appliqué')).toBeInTheDocument();
    expect(container.querySelector('s')).toHaveTextContent(/4\s400\sDH/);
    expect(screen.getByText(/Économie 629\sDH/)).toBeInTheDocument();
  });

  it('tarif semaine sans économie réelle : rien d’annoncé', () => {
    const { container } = render(
      <VehicleCard vehicle={testVehicle({ daily_price: 300, weekly_price: 2100, agency: agency({ duration_discounts: [] }) })} selectedDays={7} />
    );
    expect(screen.queryByText('Tarif semaine appliqué')).not.toBeInTheDocument();
    expect(container.querySelector('s')).toBeNull();
  });
});
