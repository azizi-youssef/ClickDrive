// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollapsedPreference } from './use-collapsed-preference';

const KEY = 'clickdrive:test-sidebar-collapsed';

function Toggle({ name }: { name: string }) {
  const [collapsed, toggle] = useCollapsedPreference(KEY);
  return (
    <button type="button" aria-label={name} aria-pressed={collapsed} onClick={toggle}>
      {collapsed ? 'réduit' : 'déplié'}
    </button>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useCollapsedPreference', () => {
  it('déplié par défaut ; le bouton réduit puis déplie, préférence mémorisée', async () => {
    const user = userEvent.setup();
    render(<Toggle name="menu" />);
    const button = screen.getByRole('button', { name: 'menu' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(KEY)).toBe('1');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(KEY)).toBe('0');
  });

  it('préférence retrouvée au rechargement', () => {
    window.localStorage.setItem(KEY, '1');
    render(<Toggle name="menu" />);
    expect(screen.getByRole('button', { name: 'menu' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('tous les composants de la même clé suivent (et un autre onglet aussi)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Toggle name="a" />
        <Toggle name="b" />
      </>
    );
    await user.click(screen.getByRole('button', { name: 'a' }));
    expect(screen.getByRole('button', { name: 'b' })).toHaveAttribute('aria-pressed', 'true');

    // Changement fait dans un autre onglet
    act(() => {
      window.localStorage.setItem(KEY, '0');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByRole('button', { name: 'b' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('stockage bloqué (navigation privée) : le bouton fonctionne quand même', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const user = userEvent.setup();
    render(<Toggle name="menu" />);
    const button = screen.getByRole('button', { name: 'menu' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
