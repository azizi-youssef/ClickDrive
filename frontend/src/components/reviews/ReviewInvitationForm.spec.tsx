// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewInvitationForm } from './ReviewInvitationForm';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Avis vérifié depuis le lien reçu après la location', () => {
  it('exige une note, envoie l’avis signé et propose Google ensuite', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReviewInvitationForm reference="CD-2026-100001" exp="1800000000" sig="signature" googleReviewUrl="https://g.page/r/clickdrive/review" />);

    await user.type(screen.getByLabelText('Votre avis'), 'Voiture propre et agence ponctuelle à l’aéroport.');
    await user.click(screen.getByRole('button', { name: 'Publier mon avis' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choisissez une note de 1 à 5 étoiles.');
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: /^5 sur 5/ }));
    await user.click(screen.getByRole('button', { name: 'Publier mon avis' }));

    expect(await screen.findByText('Merci, votre avis est publié')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ reference: 'CD-2026-100001', exp: '1800000000', sig: 'signature', rating: 5 });
    expect(screen.getByRole('link', { name: /Partager aussi votre avis sur Google/ })).toHaveAttribute('href', 'https://g.page/r/clickdrive/review');
  });

  it('erreur du serveur affichée telle quelle (lien expiré, avis déjà publié…)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'Un avis a déjà été publié pour cette location.' }), { status: 409 }))
    );
    render(<ReviewInvitationForm reference="CD-2026-100001" exp="1800000000" sig="signature" />);
    await user.click(screen.getByRole('radio', { name: /^4 sur 5/ }));
    await user.type(screen.getByLabelText('Votre avis'), 'Très bien dans l’ensemble, merci.');
    await user.click(screen.getByRole('button', { name: 'Publier mon avis' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Un avis a déjà été publié pour cette location.');
  });
});
