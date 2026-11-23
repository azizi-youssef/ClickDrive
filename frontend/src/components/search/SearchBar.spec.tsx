// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from '@/lib/i18n/format';
import { addDateDays, formatLocalDate } from '@/lib/utils/date-only';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

import { SearchBar } from './SearchBar';

beforeEach(() => {
  mocks.push.mockReset();
});

describe('Recherche de l’accueil (carte mobile)', () => {
  it('chaque contrôle natif garde son libellé ; les dates prennent la forme courte', () => {
    render(<SearchBar categories={['SUV', 'Luxe']} />);
    expect(screen.getByRole('combobox', { name: 'Lieu de prise en charge' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Catégorie' })).toBeInTheDocument();
    // Libellé court (« Départ ») sous 1024 px, long (« Date de départ ») au-delà : les deux restent associés au champ
    expect(screen.getByLabelText(/^Départ/)).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText(/^Retour/)).toHaveAttribute('type', 'date');
  });

  it('affiche le lieu complet et la date avec le jour de la semaine, sans les exposer en double', () => {
    render(
      <SearchBar
        initialLocation="Centre-Ville Nador (Boulevard Mohammed V)"
        initialStartDate="2099-01-05"
        initialEndDate="2099-01-08"
      />
    );
    // Résumé du rideau + valeur affichée du champ (masquée aux lecteurs d'écran, qui lisent le contrôle)
    const locations = screen.getAllByText('Centre-ville de Nador (boulevard Mohammed V)', { selector: 'span' });
    expect(locations).toHaveLength(2);
    expect(locations.some((el) => el.closest('[aria-hidden="true"]'))).toBe(true);
    expect(screen.getByText(formatDate('2099-01-05', 'fr', 'weekdayDayMonth'))).toBeInTheDocument();
    expect(screen.getAllByText(formatDate('2099-01-08', 'fr', 'dayMonth')).length).toBeGreaterThan(0);
  });

  it('s’ouvre replié en rideau, se déroule puis s’enroule', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const toggle = screen.getByRole('button', { name: /^Modifier la recherche/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Aéroport Nador Al-Aroui (NDR)');
    // Replié : bouton Rechercher compact dans la barre, en plus du bouton des champs (masqué en CSS)
    expect(screen.getAllByRole('button', { name: 'Rechercher' })).toHaveLength(2);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Réduire');
    expect(screen.getAllByRole('button', { name: 'Rechercher' })).toHaveLength(1);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('lance la recherche directement depuis la barre repliée', async () => {
    const user = userEvent.setup();
    const start = addDateDays(formatLocalDate(new Date()), 5);
    const end = addDateDays(start, 2);
    render(<SearchBar initialStartDate={start} initialEndDate={end} />);
    const bar = screen.getByRole('button', { name: /^Modifier la recherche/ }).parentElement as HTMLElement;

    await user.click(within(bar).getByRole('button', { name: 'Rechercher' }));

    const expected = new URLSearchParams({ location: 'Aeroport Nador Al-Aroui (NDR)', startDate: start, endDate: end });
    expect(mocks.push).toHaveBeenCalledWith(`/search?${expected.toString()}`, undefined);
  });

  it('soumet la même adresse qu’avant : lieu, dates et catégorie', async () => {
    const user = userEvent.setup();
    const start = addDateDays(formatLocalDate(new Date()), 10);
    const end = addDateDays(start, 4);
    render(<SearchBar categories={['SUV', 'Luxe']} initialStartDate={start} initialEndDate={end} />);

    await user.click(screen.getByRole('button', { name: /^Modifier la recherche/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lieu de prise en charge' }), 'Gare ONCF Nador Ville');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Catégorie' }), 'SUV');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    const expected = new URLSearchParams({ location: 'Gare ONCF Nador Ville', startDate: start, endDate: end, category: 'SUV' });
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith(`/search?${expected.toString()}`, undefined);
  });
});

describe('Recherche compacte (catalogue)', () => {
  it('garde ses libellés complets et sa présentation d’origine', () => {
    render(<SearchBar isCompact basePath="/motos" />);
    expect(screen.getByLabelText('Date de départ')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Date de retour')).toHaveAttribute('type', 'date');
    expect(screen.queryByText('Départ')).not.toBeInTheDocument();
  });
});
