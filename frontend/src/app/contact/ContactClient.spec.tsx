// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactClient } from './ContactClient';

async function fillAndSend() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nom complet *'), 'Karim Benali');
  await user.type(screen.getByLabelText('Email *'), 'karim@example.com');
  // Catégorie : cartes à choisir (boutons radio)
  await user.click(screen.getByRole('radio', { name: /Demande d’information sur un véhicule/ }));
  await user.type(screen.getByLabelText('Message *'), 'Bonjour, une voiture automatique est-elle libre la semaine prochaine ?');
  await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Page Contact — envoi réel', () => {
  it('envoie le message à /api/contact et affiche la référence enregistrée', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, reference: 'MSG-20261108-ABC234', acknowledged: true }), { status: 201 })
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactClient />);
    await fillAndSend();

    expect(await screen.findByText('MSG-20261108-ABC234')).toBeInTheDocument();
    expect(screen.getByText(/accusé de réception vient de vous être envoyé/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/contact');
    expect(JSON.parse(String(init.body))).toMatchObject({ name: 'Karim Benali', category: 'reservation', website: '' });
  });

  it('échec côté serveur : message d’erreur réel et repli WhatsApp, pas de faux succès', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'Envoi impossible pour le moment.' }), { status: 503 }))
    );
    render(<ContactClient />);
    await fillAndSend();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Envoi impossible pour le moment.');
    expect(screen.getByRole('link', { name: 'Écrire sur WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/'));
    expect(screen.queryByText('Message bien reçu')).not.toBeInTheDocument();
  });
});

describe('Page Contact — parcours', () => {
  it('conseil adapté à la catégorie choisie, compteur avec minimum, focus sur le premier champ en erreur', async () => {
    const user = userEvent.setup();
    render(<ContactClient />);

    // Aucune catégorie : envoi refusé, focus sur la première carte de catégorie
    await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));
    expect(screen.getByText('Veuillez choisir une catégorie')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Demande d’information sur un véhicule/ })).toHaveFocus();

    await user.click(screen.getByRole('radio', { name: /Problème technique/ }));
    expect(screen.getByText(/Précisez la page concernée/)).toBeInTheDocument();

    expect(screen.getByText('0 / 20 caractères minimum')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Message *'), 'La page ne charge pas sur mon téléphone.');
    expect(screen.queryByText(/caractères minimum/)).not.toBeInTheDocument();
  });

  it('WhatsApp et e-mail accessibles dès le haut de la page', () => {
    render(<ContactClient />);
    const whatsappLinks = screen.getAllByRole('link', { name: 'Écrivez-nous sur WhatsApp' });
    expect(whatsappLinks[0]).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/212\d{9}\?text=/));
    expect(screen.getAllByRole('link', { name: /contact@clickdrive\.ma/ })[0]).toHaveAttribute('href', 'mailto:contact@clickdrive.ma');
  });
});
