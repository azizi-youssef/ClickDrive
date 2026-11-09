// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CookieBanner } from './CookieBanner';

afterEach(() => {
  localStorage.clear();
});

describe('Bandeau cookies — information exacte', () => {
  it('annonce uniquement des cookies nécessaires, un seul bouton, mémorisé', async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const banner = await screen.findByRole('region');
    expect(banner).toHaveTextContent('uniquement des cookies nécessaires');
    expect(banner).not.toHaveTextContent(/Tout accepter|Refuser/);

    await user.click(screen.getByRole('button', { name: 'Compris' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(localStorage.getItem('clickdrive_cookie_consent')).toBe('acknowledged');
  });

  it('un choix enregistré par l’ancien bandeau masque aussi celui-ci', () => {
    localStorage.setItem('clickdrive_cookie_consent', 'declined');
    render(<CookieBanner />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
