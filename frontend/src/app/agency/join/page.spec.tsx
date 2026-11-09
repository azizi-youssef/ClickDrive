// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyJoinPage from './page';

const plans = [
  { id: 'p1', name: 'Starter', slug: 'starter', min_vehicles: 5, max_vehicles: 15, price_monthly: 300, currency: 'MAD', features: ['0% de commission'], is_active: true, sort_order: 1 },
];

function stubFetch(contact: Response) {
  const fetchMock = vi.fn(async (url: string) =>
    url === '/api/subscriptions/plans' ? new Response(JSON.stringify({ success: true, data: plans })) : contact
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillAndSend() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Nom commercial de l.agence/i), 'Agence Riviera');
  await user.type(screen.getByLabelText(/Nom du responsable|Responsable/i), 'Karim Benali');
  await user.type(screen.getByLabelText(/Téléphone/), '0612345678');
  await user.type(screen.getByLabelText(/^E-mail/), 'karim@riviera.ma');
  await user.type(screen.getByLabelText(/Adresse/), 'Bd Mohammed V, Nador');
  await user.click(screen.getByRole('button', { name: /Envoyer ma demande/ }));
}

describe('Devenir partenaire — envoi réel', () => {
  it('affiche les formules réelles et transmet la demande à l’équipe', async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ success: true, reference: 'MSG-20261110-ABC234' }), { status: 201 }));
    render(<AgencyJoinPage />);
    expect(await screen.findByText('Starter')).toBeInTheDocument();

    await fillAndSend();
    expect(await screen.findByText('MSG-20261110-ABC234')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/contact') as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toMatchObject({
      name: 'Karim Benali',
      email: 'karim@riviera.ma',
      category: 'agency-partner',
      subject: 'Inscription agence : Agence Riviera',
    });
  });

  it('échec : message d’erreur réel, pas de faux succès', async () => {
    stubFetch(new Response(JSON.stringify({ success: false, error: 'Envoi impossible pour le moment.' }), { status: 503 }));
    render(<AgencyJoinPage />);
    await fillAndSend();
    expect(await screen.findByRole('alert')).toHaveTextContent('Envoi impossible pour le moment.');
    expect(screen.queryByText('Demande envoyée')).not.toBeInTheDocument();
  });
});
