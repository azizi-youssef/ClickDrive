// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/agency',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { AgencySettingsPanel } from './AgencySettingsPanel';

type Settings = Record<string, unknown>;

const baseAgency = (overrides: Settings = {}): Settings => ({
  id: 'ag-1',
  name: 'Atlas Rent',
  slug: 'atlas-rent',
  description: '',
  phone: '0536000000',
  whatsapp: '',
  email: 'a@b.test',
  city: 'Nador',
  address: '',
  opening_hours: null,
  languages: ['fr'],
  cancellation_policy: null,
  delivery_fee_airport: null,
  delivery_fee_port: null,
  logo_url: null,
  banner_url: null,
  duration_discounts: [{ min_days: 7, percent: 10 }],
  motorcycle_duration_discounts: [{ min_days: 3, percent: 15 }],
  ...overrides,
});

let saved: Settings[] = [];

function stubApi(agency: Settings) {
  saved = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url === '/api/agencies/ag-1/settings') {
        if (init?.method === 'PATCH') {
          const payload = JSON.parse(String(init.body)) as Settings;
          saved.push(payload);
          return json({ success: true, data: { ...agency, ...payload } });
        }
        return json({ success: true, data: agency });
      }
      return json({ success: true, data: {} });
    })
  );
}

beforeEach(() => stubApi(baseAgency()));
afterEach(() => vi.unstubAllGlobals());

const mount = (canManage = true) => render(<AgencySettingsPanel agencyId="ag-1" canManage={canManage} />);
const group = async (name: 'Voitures' | 'Motos') => screen.findByRole('group', { name });
const value = (el: HTMLElement) => (el as HTMLInputElement).value;

describe('Paramètres de l’agence — remises voitures et motos', () => {
  it('deux listes distinctes, chacune avec ses paliers', async () => {
    mount();
    const cars = within(await group('Voitures'));
    const motos = within(await group('Motos'));
    expect(value(cars.getByLabelText('Voitures, palier 1 : durée minimale en jours'))).toBe('7');
    expect(value(cars.getByLabelText('Voitures, palier 1 : remise en pourcentage'))).toBe('10');
    expect(value(motos.getByLabelText('Motos, palier 1 : durée minimale en jours'))).toBe('3');
    expect(value(motos.getByLabelText('Motos, palier 1 : remise en pourcentage'))).toBe('15');
  });

  it('les champs se distinguent pour un lecteur d’écran (le type fait partie du nom)', async () => {
    mount();
    await group('Motos');
    // « Palier 1 » existe deux fois : jamais sans le type
    expect(screen.queryByLabelText('Palier 1 : durée minimale en jours')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/palier 1 : durée minimale en jours/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Voitures : retirer le palier 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Motos : retirer le palier 1' })).toBeInTheDocument();
  });

  it('modifier seulement les motos n’envoie que la liste des motos', async () => {
    const user = userEvent.setup();
    mount();
    const motos = within(await group('Motos'));
    const percent = motos.getByLabelText('Motos, palier 1 : remise en pourcentage');
    await user.clear(percent);
    await user.type(percent, '20');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ motorcycle_duration_discounts: [{ min_days: 3, percent: 20 }] });
    expect(saved[0]).not.toHaveProperty('duration_discounts');
  });

  it('modifier seulement les voitures n’envoie que la liste des voitures', async () => {
    const user = userEvent.setup();
    mount();
    const cars = within(await group('Voitures'));
    const days = cars.getByLabelText('Voitures, palier 1 : durée minimale en jours');
    await user.clear(days);
    await user.type(days, '5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ duration_discounts: [{ min_days: 5, percent: 10 }] });
  });

  it('ajouter un palier aux motos n’en ajoute pas aux voitures', async () => {
    const user = userEvent.setup();
    mount();
    const motos = within(await group('Motos'));
    await user.click(motos.getByRole('button', { name: 'Ajouter un palier (motos)' }));
    expect(motos.getByLabelText('Motos, palier 2 : durée minimale en jours')).toBeInTheDocument();
    expect(within(await group('Voitures')).queryByLabelText('Voitures, palier 2 : durée minimale en jours')).not.toBeInTheDocument();
  });

  it('retirer le dernier palier des motos : « aucune remise sur les motos », les voitures gardent les leurs', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Motos : retirer le palier 1' }));
    expect(screen.getByText(/Aucune remise sur les motos pour l’instant/)).toBeInTheDocument();
    expect(screen.queryByText(/Aucune remise sur les voitures/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    // Une liste vide est enregistrée : c'est un choix, pas une absence de valeur
    expect(saved[0]).toEqual({ motorcycle_duration_discounts: [] });
  });

  it('une liste des motos invalide : l’erreur est sous « Motos » seulement, rien n’est envoyé, le focus va sur le groupe', async () => {
    const user = userEvent.setup();
    mount();
    const motos = within(await group('Motos'));
    const percent = motos.getByLabelText('Motos, palier 1 : remise en pourcentage');
    await user.clear(percent);
    await user.type(percent, '0');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await motos.findByText(/Remise d’un palier : de 1 à 50 %/)).toBeInTheDocument();
    expect(within(await group('Voitures')).queryByText(/Remise d’un palier/)).not.toBeInTheDocument();
    expect(saved).toHaveLength(0);
    expect(await group('Motos')).toHaveFocus();
  });

  it('un palier incomplet est signalé dans la bonne liste', async () => {
    const user = userEvent.setup();
    mount();
    const cars = within(await group('Voitures'));
    await user.click(cars.getByRole('button', { name: 'Ajouter un palier (voitures)' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await cars.findByText('Complétez ou retirez chaque palier.')).toBeInTheDocument();
    expect(within(await group('Motos')).queryByText('Complétez ou retirez chaque palier.')).not.toBeInTheDocument();
  });

  it('chaque liste a son aperçu, sur un prix d’exemple du bon type', async () => {
    mount();
    const cars = within(await group('Voitures'));
    const motos = within(await group('Motos'));
    expect(cars.getByText('Exemple pour une voiture à 300 DH par jour')).toBeInTheDocument();
    expect(motos.getByText('Exemple pour une moto à 150 DH par jour')).toBeInTheDocument();
    // Moto : 3 jours à 150 DH = 450 DH, −15 % → 383 DH (palier des motos)
    expect(motos.getByText(/3 jours/)).toHaveTextContent(/−15 %/);
    expect(cars.getByText(/7 jours/)).toHaveTextContent(/−10 %/);
  });

  it('base pas encore migrée (colonne des motos absente) : les motos reprennent les paliers des voitures, sans modification fantôme', async () => {
    const legacy = baseAgency();
    delete legacy.motorcycle_duration_discounts;
    stubApi(legacy);
    mount();
    const motos = within(await group('Motos'));
    expect(value(motos.getByLabelText('Motos, palier 1 : durée minimale en jours'))).toBe('7');
    expect(value(motos.getByLabelText('Motos, palier 1 : remise en pourcentage'))).toBe('10');
    // Rien n'a été modifié : pas de barre d'enregistrement
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
  });

  it('lecture seule : aucun champ modifiable, ni ajout ni retrait', async () => {
    mount(false);
    const motos = within(await group('Motos'));
    expect(motos.getByLabelText('Motos, palier 1 : durée minimale en jours')).toBeDisabled();
    expect(motos.queryByRole('button', { name: /Ajouter un palier/ })).not.toBeInTheDocument();
    expect(motos.queryByRole('button', { name: /retirer le palier/ })).not.toBeInTheDocument();
  });
});
