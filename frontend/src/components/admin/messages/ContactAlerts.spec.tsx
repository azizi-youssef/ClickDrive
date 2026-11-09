// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, fireEvent, render, screen, waitFor, within } from '@/tests/setup/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactAlertItem } from '@/lib/admin/contact-alerts';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }));
vi.mock('@/lib/auth/client', () => ({ fetchClientAuthProfile: async () => null }));

const LAST_SEEN_KEY = 'clickdrive:admin-contact-last-seen';

const message = (id: string, name: string, createdAt: string, subject: string | null = null): ContactAlertItem => ({
  id,
  reference: `MSG-20261109-${id.toUpperCase().padEnd(6, 'X')}`,
  name,
  category: 'billing',
  subject,
  created_at: createdAt,
});

const first = message('a', 'Sara Benali', '2026-11-09T08:00:00.000Z', 'Facture de novembre');
const second = message('b', 'Karim Haddou', '2026-11-09T09:00:00.000Z', 'Retard de vol');
const third = message('c', 'Lina Amrani', '2026-11-09T10:00:00.000Z');

let summary: { status: number; body: unknown };
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  expect(String(input)).toBe('/api/admin/contact-messages/summary');
  return new Response(JSON.stringify(summary.body), { status: summary.status });
});

function respond(newCount: number, latest: ContactAlertItem[]) {
  summary = { status: 200, body: { success: true, data: { newCount, latest } } };
}

/** Module neuf à chaque test : l'état de la surveillance vit au niveau du module */
async function renderShell() {
  vi.resetModules();
  const { AdminShell } = await import('@/components/admin/AdminShell');
  const store = await import('./contact-alerts-store');
  render(
    <AdminShell title="Vue d'ensemble">
      <p>contenu</p>
    </AdminShell>
  );
  return store;
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('Rappel « nouveau message de contact » dans l’administration', () => {
  it('compteur sur « Messages » et sur le menu mobile, alerte affichée jusqu’à sa fermeture', async () => {
    respond(2, [second, first]);
    await renderShell();

    expect(await screen.findByRole('link', { name: 'Messages (2 nouveaux messages)' })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Ouvrir le menu (2 nouveaux messages)' })).toBeInTheDocument();

    const alert = screen.getByRole('status');
    expect(within(alert).getByText('2 nouveaux messages de contact')).toBeInTheDocument();
    expect(within(alert).getByText('Le plus récent : Karim Haddou · Retard de vol')).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Voir les messages' })).toHaveAttribute('href', '/admin/messages');
    // Repère mémorisé : ces messages ne seront plus annoncés sur ce navigateur
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe(second.created_at);

    fireEvent.click(within(alert).getByRole('button', { name: 'Fermer l’alerte' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    // Le compteur, lui, reste tant que les messages ne sont pas pris en charge
    expect(screen.getByRole('link', { name: 'Messages (2 nouveaux messages)' })).toBeInTheDocument();
  });

  it('messages déjà annoncés : compteur sans alerte ; un nouveau message déclenche l’alerte et prévient la page Messages', async () => {
    window.localStorage.setItem(LAST_SEEN_KEY, second.created_at);
    respond(2, [second, first]);
    const store = await renderShell();

    await screen.findByRole('link', { name: 'Messages (2 nouveaux messages)' });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    const arrived = vi.fn();
    window.addEventListener('clickdrive:contact-messages-arrived', arrived);
    respond(3, [third, second, first]);
    await act(async () => store.notifyContactMessagesChanged());

    const alert = screen.getByRole('status');
    await waitFor(() => expect(within(alert).getByText('Nouveau message de Lina Amrani')).toBeInTheDocument());
    // Sans objet : la catégorie sert de sujet
    expect(within(alert).getByText('Facturation ou abonnement')).toBeInTheDocument();
    expect(within(alert).getByText(/MSG-20261109-CXXXXX/)).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Voir le message' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Messages (3 nouveaux messages)' })).toBeInTheDocument();
    expect(arrived).toHaveBeenCalledTimes(1);
    window.removeEventListener('clickdrive:contact-messages-arrived', arrived);
  });

  it('message pris en charge : le compteur baisse aussitôt, puis disparaît à zéro', async () => {
    window.localStorage.setItem(LAST_SEEN_KEY, first.created_at);
    respond(1, [first]);
    const store = await renderShell();
    await screen.findByRole('link', { name: 'Messages (1 nouveau message)' });

    respond(0, []);
    await act(async () => store.notifyContactMessagesChanged());
    await waitFor(() => expect(screen.getByRole('link', { name: 'Messages' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toBeInTheDocument();
  });

  it('onglet en arrière-plan et alertes du navigateur autorisées : notification système', async () => {
    const shown: { title: string; options?: NotificationOptions }[] = [];
    class FakeNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = async () => 'granted' as const;
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, options });
      }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    respond(1, [second]);
    await renderShell();
    await screen.findByRole('link', { name: 'Messages (1 nouveau message)' });

    expect(shown).toEqual([
      { title: 'Nouveau message de Karim Haddou', options: { body: 'Retard de vol', tag: 'clickdrive-contact-message' } },
    ]);
    hasFocus.mockRestore();
  });

  it('sans la permission de lire les messages : ni compteur ni alerte, la surveillance s’arrête', async () => {
    summary = { status: 403, body: { success: false, error: 'Accès refusé' } };
    const store = await renderShell();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => store.notifyContactMessagesChanged());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
