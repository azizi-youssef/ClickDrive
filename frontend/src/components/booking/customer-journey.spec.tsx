// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, fireEvent, render, screen, waitFor } from '@/tests/setup/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testVehicle } from '@/tests/fixtures/vehicle';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { RecentRequests } from './RecentRequests';
import { CancelRequest } from './CancelRequest';
import { forgetRecentRequests, rememberRecentRequest } from '@/lib/bookings/recent-requests';
import { FAVORITES_KEY, favoritesStore } from '@/lib/ui/use-favorites';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => router,
}));

beforeEach(() => {
  window.localStorage.clear();
  favoritesStore.write([]);
  forgetRecentRequests();
  router.refresh.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Favoris mémorisés dans le navigateur', () => {
  it('le cœur d’une carte enregistre le véhicule, partagé avec les autres cartes du même véhicule', () => {
    const vehicle = testVehicle({ id: 'veh-fav-1', brand: 'Dacia', model: 'Logan' });
    render(
      <>
        <VehicleCard vehicle={vehicle} />
        <VehicleCard vehicle={vehicle} />
      </>
    );
    const [first, second] = screen.getAllByRole('button', { name: 'Ajouter Dacia Logan aux favoris' });
    fireEvent.click(first);
    expect(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]')).toEqual(['veh-fav-1']);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirer Dacia Logan des favoris' })[0]);
    expect(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]')).toEqual([]);
  });

  it('favori enregistré avant l’affichage : le cœur est déjà plein', () => {
    favoritesStore.write(['veh-fav-2']);
    render(<VehicleCard vehicle={testVehicle({ id: 'veh-fav-2', brand: 'Kia', model: 'Picanto' })} />);
    expect(screen.getByRole('button', { name: 'Retirer Kia Picanto des favoris' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Lien de la carte : dates et lieu de la recherche transmis à la fiche', () => {
  it('période et lieu connus dans l’adresse de la fiche', () => {
    render(
      <VehicleCard
        vehicle={testVehicle({ slug: 'dacia-logan-x1', brand: 'Dacia', model: 'Logan' })}
        period={{ startDate: '2026-11-20', endDate: '2026-11-23' }}
        selectedDays={3}
        location="Selouane Centre"
      />
    );
    expect(screen.getByRole('link', { name: /Voir les détails/ })).toHaveAttribute(
      'href',
      '/cars/dacia-logan-x1?startDate=2026-11-20&endDate=2026-11-23&location=Selouane+Centre'
    );
  });
});

describe('Demandes récentes (sans compte)', () => {
  it('rien à montrer : aucun bloc', () => {
    const { container } = render(<RecentRequests />);
    expect(container).toBeEmptyDOMElement();
  });

  it('demande mémorisée : lien de suivi signé, puis effacement de l’appareil', () => {
    rememberRecentRequest({
      reference: 'CD-2026-000777',
      trackingPath: '/suivi/CD-2026-000777?exp=1999999999&sig=abc',
      vehicle: 'Dacia Logan 2025',
      startDate: '2026-11-20',
      endDate: '2026-11-23',
    });
    render(<RecentRequests />);
    expect(screen.getByRole('heading', { name: 'Vos demandes sur cet appareil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dacia Logan 2025/ })).toHaveAttribute('href', '/suivi/CD-2026-000777?exp=1999999999&sig=abc');
    fireEvent.click(screen.getByRole('button', { name: 'Effacer de cet appareil' }));
    expect(screen.queryByRole('heading', { name: 'Vos demandes sur cet appareil' })).not.toBeInTheDocument();
  });
});

describe('Annulation d’une demande depuis le suivi', () => {
  const props = { reference: 'CD-2026-123456', exp: '1999999999', sig: 'abc', cancellable: true };

  it('deux temps : confirmation avec motif facultatif, puis annulation et relecture de la page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<CancelRequest {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler ma demande' }));
    expect(screen.getByText('Annuler la demande CD-2026-123456 ?')).toBeInTheDocument();
    expect(screen.getByLabelText('Motif (facultatif)')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Motif (facultatif)'), { target: { value: 'dates_changed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/bookings/CD-2026-123456/cancel', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ exp: '1999999999', sig: 'abc', reason: 'dates_changed' });
    expect(await screen.findByRole('status')).toHaveTextContent('Votre demande est annulée');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('« Garder ma demande » : rien n’est envoyé', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<CancelRequest {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler ma demande' }));
    fireEvent.click(screen.getByRole('button', { name: 'Garder ma demande' }));
    expect(screen.getByRole('button', { name: 'Annuler ma demande' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('l’agence a répondu entre-temps (409) : message clair, page relue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 409 })));
    render(<CancelRequest {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler ma demande' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('L’agence a déjà répondu à votre demande');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('échec réseau : alerte, la demande reste à confirmer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<CancelRequest {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler ma demande' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('L’annulation n’a pas pu être enregistrée'));
    expect(screen.getByRole('button', { name: 'Confirmer l’annulation' })).toBeEnabled();
  });

  it('demande déjà close à l’ouverture de la page : aucun bouton', () => {
    const { container } = render(<CancelRequest {...props} cancellable={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
