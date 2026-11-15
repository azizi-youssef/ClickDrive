// @vitest-environment jsdom
import '@/tests/setup/dom';
import { useState } from 'react';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { AdminMobileDrawer } from './AdminShell';

function Harness({ onLogout = () => undefined }: { onLogout?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <main>
        <button type="button" onClick={() => setOpen(true)}>Ouvrir le menu</button>
        <a href="#contenu">Lien de la page</a>
      </main>
      <AdminMobileDrawer open={open} onClose={() => setOpen(false)} onLogout={onLogout} loggingOut={false} messageCount={2} />
    </>
  );
}

describe('Menu mobile de l’administration — comportement des dialogues du projet', () => {
  it('à l’ouverture : dialogue nommé, focus sur « Fermer », reste de la page inerte, défilement bloqué', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu administration' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveFocus();
    expect(document.querySelector('main')).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    // Le compteur de messages reste annoncé dans le menu
    expect(screen.getByRole('link', { name: /Messages/ })).toBeInTheDocument();
  });

  it('Tab reste dans le menu (aller et retour), même depuis le dernier élément', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = screen.getByRole('dialog');
    const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    expect(focusable.length).toBeGreaterThan(10);

    focusable[focusable.length - 1]!.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  it('Échap ferme le menu, rend le focus au bouton d’ouverture, rétablit la page', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Ouvrir le menu' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.querySelector('main')).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('un clic sur le fond ferme le menu', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    await user.click(document.querySelector('[data-modal-backdrop]')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
