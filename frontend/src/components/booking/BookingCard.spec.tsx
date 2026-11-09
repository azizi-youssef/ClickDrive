// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingCard } from './BookingCard';
import { testVehicle } from '@/tests/fixtures/vehicle';

type FetchResult = { status: number; body: unknown } | Error;

function availabilityResponse(status: 'AVAILABLE' | 'UNAVAILABLE'): FetchResult {
  return { status: 200, body: { success: true, data: { status } } };
}

const unknownResponse: FetchResult = {
  status: 503,
  body: { success: false, error: 'Disponibilité non vérifiable.', data: { status: 'UNKNOWN' } },
};

let fetchMock: ReturnType<typeof vi.fn>;

function queueFetch(...results: FetchResult[]) {
  const queue = [...results];
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes('/availability')) throw new Error(`Requête inattendue : ${url}`);
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
}

const bookButton = () => screen.getAllByRole('button').find((b) => b.getAttribute('type') === 'submit')!;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BookingCard — disponibilité en trois états (fail-closed)', () => {
  it('AVAILABLE : disponibilité affichée et réservation possible', async () => {
    queueFetch(availabilityResponse('AVAILABLE'));
    render(<BookingCard vehicle={testVehicle()} />);

    expect(await screen.findByText('Disponible pour ces dates')).toBeInTheDocument();
    expect(bookButton()).toHaveTextContent('Réserver ce véhicule');
    expect(bookButton()).not.toHaveAttribute('aria-disabled');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/vehicles\/11111111-1111-4111-8111-111111111111\/availability\?startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}$/),
      { cache: 'no-store' }
    );
  });

  it('UNAVAILABLE : indisponible, aucune demande possible', async () => {
    const user = userEvent.setup();
    queueFetch(availabilityResponse('UNAVAILABLE'));
    render(<BookingCard vehicle={testVehicle()} />);

    expect(await screen.findAllByText('Indisponible pour ces dates')).not.toHaveLength(0);
    expect(bookButton()).toHaveAttribute('aria-disabled', 'true');
    expect(bookButton()).toHaveTextContent('Choisir d’autres dates');

    await user.click(bookButton());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('UNKNOWN (503) : « non vérifiée », jamais « disponible », relance possible', async () => {
    const user = userEvent.setup();
    queueFetch(unknownResponse, availabilityResponse('AVAILABLE'));
    render(<BookingCard vehicle={testVehicle()} />);

    expect(await screen.findAllByText('Disponibilité non vérifiée')).not.toHaveLength(0);
    expect(screen.queryByText('Disponible pour ces dates')).not.toBeInTheDocument();
    const alert = screen.getByRole('alert');
    const retry = within(alert).getByRole('button', { name: 'Réessayer la vérification' });
    expect(bookButton()).toHaveAttribute('aria-disabled', 'true');

    await user.click(retry);
    expect(await screen.findByText('Disponible pour ces dates')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('erreur réseau : traitée comme UNKNOWN (pas de repli sur le statut de flotte)', async () => {
    queueFetch(new TypeError('Failed to fetch'));
    render(<BookingCard vehicle={testVehicle({ status: 'AVAILABLE' })} />);

    expect(await screen.findAllByText('Disponibilité non vérifiée')).not.toHaveLength(0);
    expect(screen.queryByText('Disponible pour ces dates')).not.toBeInTheDocument();
    expect(bookButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('dates incohérentes : erreur annoncée, aucune vérification envoyée', async () => {
    const user = userEvent.setup();
    queueFetch(availabilityResponse('AVAILABLE'));
    render(<BookingCard vehicle={testVehicle()} />);
    await screen.findByText('Disponible pour ces dates');
    const callsBefore = fetchMock.mock.calls.length;

    const start = screen.getByLabelText(/Départ|Date de départ|Prise en charge/i, { selector: 'input' });
    const end = screen.getAllByLabelText(/Retour|Date de retour|Restitution/i, { selector: 'input[type="date"]' })[0]!;
    await user.clear(end);
    await user.type(end, (start as HTMLInputElement).value);

    expect(await screen.findByText('La date de retour doit être postérieure à la date de départ.')).toBeInTheDocument();
    expect(end).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});

describe('BookingCard — rafraîchissement en arrière-plan', () => {
  it('retour sur l’onglet : l’état connu reste affiché pendant la vérification (bouton actif)', async () => {
    let release: () => void = () => undefined;
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls > 1) await new Promise<void>((resolve) => (release = resolve));
        return new Response(JSON.stringify({ success: true, data: { status: 'AVAILABLE' } }), { status: 200 });
      })
    );
    render(<BookingCard vehicle={testVehicle()} />);
    await screen.findByText('Disponible pour ces dates');

    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(calls).toBe(2));
    // Vérification en cours : ni « Vérification… », ni bouton désactivé
    expect(screen.getByText('Disponible pour ces dates')).toBeInTheDocument();
    expect(bookButton()).toBeEnabled();
    expect(bookButton()).toHaveTextContent('Réserver ce véhicule');
    release();
  });

  it('un rafraîchissement en échec repasse en « non vérifiée » (fail-closed)', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls > 1) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ success: true, data: { status: 'AVAILABLE' } }), { status: 200 });
      })
    );
    render(<BookingCard vehicle={testVehicle()} />);
    await screen.findByText('Disponible pour ces dates');

    window.dispatchEvent(new Event('focus'));
    expect(await screen.findAllByText('Disponibilité non vérifiée')).not.toHaveLength(0);
    expect(bookButton()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('BookingCard → modale de demande', () => {
  it('ouvre la demande avec le focus sur le premier champ ; Échap la ferme et rend le focus', async () => {
    const user = userEvent.setup();
    queueFetch(availabilityResponse('AVAILABLE'));
    render(<BookingCard vehicle={testVehicle()} />);
    await screen.findByText('Disponible pour ces dates');

    await user.click(bookButton());
    const dialog = await screen.findByRole('dialog', { name: 'Dacia Sandero 2024' });
    await waitFor(() => expect(within(dialog).getByLabelText(/Prénom/)).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bookButton()).toHaveFocus();
  });
});
