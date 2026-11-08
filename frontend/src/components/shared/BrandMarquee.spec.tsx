// @vitest-environment jsdom
import '@/tests/setup/dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrandMarquee, FEATURED_MOTORCYCLE_BRANDS } from './BrandMarquee';
import { BRAND_LOGO_PATHS } from '@/lib/constants/brand-logos';

describe('BrandMarquee — marques de motos', () => {
  it('section titrée, lien vers le catalogue motos', () => {
    render(<BrandMarquee kind="motorcycles" vehicleCounts={{}} />);
    const section = screen.getByRole('region', { name: 'Les marques de motos' });
    expect(within(section).getByRole('link', { name: /Toutes les motos/ })).toHaveAttribute('href', '/motos');
    expect(screen.getByRole('region', { name: 'Marques de motos disponibles, défilement horizontal' })).toBeInTheDocument();
  });

  it('chaque marque mène au catalogue motos filtré, avec le nombre réel de motos', () => {
    render(<BrandMarquee kind="motorcycles" vehicleCounts={{ yamaha: 1, suzuki: 2 }} />);
    expect(screen.getByRole('link', { name: 'Voir les motos Yamaha — 1 moto' })).toHaveAttribute('href', '/motos?brand=Yamaha');
    expect(screen.getByRole('link', { name: 'Voir les motos Suzuki — 2 motos' })).toHaveAttribute('href', '/motos?brand=Suzuki');
    // Marque sans moto au catalogue : annoncée comme bientôt disponible, jamais un nombre inventé
    expect(screen.getByRole('link', { name: 'Voir les motos Ducati — Bientôt disponible' })).toBeInTheDocument();
  });

  it('chaque marque a un logo (tracé libre de droits) ou un badge typographique', () => {
    const { container } = render(<BrandMarquee kind="motorcycles" vehicleCounts={{}} />);
    const cards = container.querySelectorAll('ul > li');
    expect(cards).toHaveLength(FEATURED_MOTORCYCLE_BRANDS.length);
    for (const card of cards) expect(card.querySelector('svg')).not.toBeNull();
    const withoutPath = FEATURED_MOTORCYCLE_BRANDS.filter((brand) => !BRAND_LOGO_PATHS[brand]);
    expect(withoutPath).toEqual(['SYM', 'Kawasaki']);
    expect(container.querySelector('svg text')?.textContent).toBe('SYM');
  });

  it('sur la page /motos : un clic applique le filtre sur place, le lien reste un vrai lien', async () => {
    const onBrandSelect = vi.fn();
    render(<BrandMarquee kind="motorcycles" vehicleCounts={{ yamaha: 1 }} onBrandSelect={onBrandSelect} />);
    const yamaha = screen.getByRole('link', { name: 'Voir les motos Yamaha — 1 moto' });
    expect(yamaha).toHaveAttribute('href', '/motos?brand=Yamaha');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    yamaha.dispatchEvent(click);
    expect(onBrandSelect).toHaveBeenCalledWith('Yamaha');
    expect(click.defaultPrevented).toBe(true);

    // Ctrl/Cmd + clic : ouverture dans un nouvel onglet, sans filtrer la page courante
    const newTab = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    yamaha.dispatchEvent(newTab);
    expect(onBrandSelect).toHaveBeenCalledTimes(1);
  });

  it('en-tête éditorial : sur-titre, titre et description traduits', () => {
    render(<BrandMarquee kind="cars" vehicleCounts={{}} />);
    const section = screen.getByRole('region', { name: 'Les grandes marques' });
    expect(within(section).getByText('Constructeurs')).toBeInTheDocument();
    expect(within(section).getByText('Les constructeurs proposés par les agences partenaires de Nador.')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /Tout le catalogue/ })).toHaveAttribute('href', '/search');
  });

  it('marque active (filtre en cours) : signalée par aria-current, sans tenir compte de la casse', () => {
    render(<BrandMarquee kind="motorcycles" vehicleCounts={{ suzuki: 1 }} activeBrand="SUZUKI" />);
    expect(screen.getByRole('link', { name: 'Voir les motos Suzuki — 1 moto' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: /Voir les motos Yamaha/ })).not.toHaveAttribute('aria-current');
  });

  it('clavier : flèches, Début et Fin déplacent le focus entre les cartes', () => {
    render(<BrandMarquee kind="cars" vehicleCounts={{}} />);
    const links = screen.getAllByRole('link', { name: /^Voir les véhicules/ });
    links[0]!.focus();
    fireEvent.keyDown(links[0]!, { key: 'ArrowRight' });
    expect(links[1]).toHaveFocus();
    fireEvent.keyDown(links[1]!, { key: 'End' });
    expect(links[links.length - 1]).toHaveFocus();
    fireEvent.keyDown(links[links.length - 1]!, { key: 'ArrowRight' });
    expect(links[links.length - 1]).toHaveFocus();
    fireEvent.keyDown(links[links.length - 1]!, { key: 'Home' });
    expect(links[0]).toHaveFocus();
  });

  it('glisser à la souris : la liste défile et le relâchement n’ouvre pas la carte', () => {
    const onBrandSelect = vi.fn();
    const { container } = render(<BrandMarquee kind="cars" vehicleCounts={{}} onBrandSelect={onBrandSelect} />);
    const list = container.querySelector('ul')!;
    const card = screen.getByRole('link', { name: /Voir les véhicules Renault/ });

    fireEvent.pointerDown(list, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300 });
    fireEvent.pointerMove(list, { pointerId: 1, pointerType: 'mouse', clientX: 200 });
    expect(list.scrollLeft).toBe(100);
    fireEvent.pointerUp(list, { pointerId: 1, pointerType: 'mouse', clientX: 200 });
    fireEvent.click(card);
    expect(onBrandSelect).not.toHaveBeenCalled();

    // Simple clic (sans déplacement) : la carte fonctionne normalement
    fireEvent.pointerDown(list, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 200 });
    fireEvent.pointerUp(list, { pointerId: 2, pointerType: 'mouse', clientX: 201 });
    fireEvent.click(card);
    expect(onBrandSelect).toHaveBeenCalledWith('Renault');
  });

  it('vitrine sans cartes : logos aux couleurs officielles, marque sans véhicule atténuée', () => {
    render(<BrandMarquee kind="cars" vehicleCounts={{ toyota: 2 }} />);
    const toyota = screen.getByRole('link', { name: 'Voir les véhicules Toyota — 2 véhicules' });
    const toyotaLogo = toyota.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(toyotaLogo.style.color).toBe('rgb(235, 10, 30)'); // #EB0A1E, rouge Toyota
    expect(toyotaLogo.className).not.toContain('opacity-55');

    // Sans véhicule : couleurs officielles gardées, simplement estompées (jamais en niveaux de gris)
    const dacia = screen.getByRole('link', { name: 'Voir les véhicules Dacia — Bientôt disponible' });
    const daciaLogo = dacia.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(daciaLogo.className).toContain('opacity-55');
    expect(daciaLogo.className).not.toContain('grayscale');
    expect(daciaLogo.style.color).toBe('rgb(100, 107, 82)'); // #646B52, Dacia
    // Aucune bordure ni fond de carte
    expect(toyota.className).not.toMatch(/\bborder\b|\bbg-white\b|shadow/);
  });

  it('les deux carrousels coexistent sur une page sans identifiant en double', () => {
    const { container } = render(
      <>
        <BrandMarquee kind="cars" vehicleCounts={{}} />
        <BrandMarquee kind="motorcycles" reverse vehicleCounts={{}} />
      </>
    );
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getByRole('region', { name: 'Les grandes marques' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les véhicules Dacia — Bientôt disponible' })).toHaveAttribute(
      'href',
      '/search?brand=Dacia'
    );
  });
});
