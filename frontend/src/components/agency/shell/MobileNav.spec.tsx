// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { Car, ClipboardList, LayoutDashboard, CalendarDays, Settings } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: React.ReactNode; onClick?: (event: React.MouseEvent) => void } & Record<string, unknown>) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault(); // jsdom ne navigue pas
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { MobileNav } from './MobileNav';

const sections = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'bookings', label: 'Réservations', icon: ClipboardList },
  { id: 'fleet', label: 'Voitures', icon: Car },
  { id: 'calendar', label: 'Calendrier & Dispos', icon: CalendarDays },
  { id: 'settings', label: 'Paramètres agence', icon: Settings },
];

function setup() {
  const onNavigate = vi.fn();
  const view = render(<MobileNav sections={sections} activeSection="overview" onNavigate={onNavigate} pendingCount={0} />);
  return { ...view, onNavigate };
}

const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Plus' }));
  return screen.getByRole('dialog', { name: 'Toutes les sections' });
};

describe('Navigation mobile de l’espace agence — retour au site', () => {
  it('fermée, la feuille « Plus » n’expose aucun lien de retour au site', () => {
    setup();
    expect(screen.queryByRole('link', { name: /Retour au site/ })).not.toBeInTheDocument();
  });

  it('« Plus » propose « Retour au site » vers l’accueil du site, dans la feuille', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openSheet(user);
    const link = within(dialog).getByRole('link', { name: /Retour au site/ });
    expect(link).toHaveAttribute('href', '/');
    // Dit clairement qu'on quitte l'espace agence
    expect(link).toHaveTextContent('Quitter l’espace agence');
  });

  it('le lien n’est pas une section : la grille des sections est inchangée', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openSheet(user);
    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(sections.length);
    expect(within(dialog).queryByRole('button', { name: /Retour au site/ })).not.toBeInTheDocument();
  });

  it('un appui sur « Retour au site » referme la feuille', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openSheet(user);
    await user.click(within(dialog).getByRole('link', { name: /Retour au site/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('mobile et tablette seulement : la feuille est masquée dès l’écran large, où la barre latérale a déjà son lien', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openSheet(user);
    expect(dialog.parentElement!.className).toMatch(/\blg:hidden\b/);
  });

  it('les sections restent navigables', async () => {
    const user = userEvent.setup();
    const { onNavigate } = setup();
    const dialog = await openSheet(user);
    await user.click(within(dialog).getByRole('button', { name: 'Paramètres agence' }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('settings'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Navigation mobile de l’espace agence — téléphone', () => {
  it('toute la case de la barre réagit au toucher (boutons à la largeur de leur colonne)', () => {
    setup();
    const bar = screen.getByRole('navigation', { name: 'Sections du tableau de bord' });
    for (const button of within(bar).getAllByRole('button')) expect(button.className).toMatch(/\bw-full\b/);
  });

  it('« Retour » (geste Android) ferme la feuille « Plus » sans changer de section', async () => {
    const user = userEvent.setup();
    const { onNavigate } = setup();
    await openSheet(user);
    // Entrée d'historique propre au menu : « Retour » la consomme au lieu de quitter la page
    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('choisir une section : l’entrée du menu est retirée avant la navigation (pas de doublon dans l’historique)', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {
      order.push('back');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const onNavigate = vi.fn(() => {
      order.push('navigate');
    });
    render(<MobileNav sections={sections} activeSection="overview" onNavigate={onNavigate} pendingCount={0} />);
    const dialog = await openSheet(user);
    await user.click(within(dialog).getByRole('button', { name: 'Paramètres agence' }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('settings'));
    expect(order).toEqual(['back', 'navigate']);
    back.mockRestore();
  });

  it('Échap ferme aussi la feuille en retirant son entrée d’historique', async () => {
    const user = userEvent.setup();
    const back = vi.spyOn(window.history, 'back');
    setup();
    await openSheet(user);
    await user.keyboard('{Escape}');
    expect(back).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    back.mockRestore();
  });
});
