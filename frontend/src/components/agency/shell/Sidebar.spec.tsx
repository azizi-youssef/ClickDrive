// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { AGENCY_SECTIONS, SECTION_GROUPS, Sidebar, TRACKING_SECTION } from './Sidebar';

const ALL_SECTIONS = [...AGENCY_SECTIONS, TRACKING_SECTION];

function renderSidebar(collapsed: boolean, onToggleCollapsed = vi.fn()) {
  render(
    <Sidebar
      sections={ALL_SECTIONS.map((section) => ({ ...section }))}
      active="overview"
      onNavigate={vi.fn()}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      agencyName="Atlas Rent"
      verified
    />
  );
  return within(screen.getByRole('complementary', { name: 'Navigation du portail agence' }));
}

describe('Barre latérale agence', () => {
  it('chaque section a sa place dans un groupe (sinon elle serait invisible sur ordinateur)', () => {
    const grouped = new Set(SECTION_GROUPS.flatMap((group) => group.ids));
    expect(ALL_SECTIONS.map((section) => section.id).filter((id) => !grouped.has(id))).toEqual([]);
  });

  it('dépliée : libellés et « Réduire »', async () => {
    const onToggle = vi.fn();
    const nav = renderSidebar(false, onToggle);
    expect(nav.getByRole('button', { name: 'Statistiques' })).toBeInTheDocument();
    expect(nav.getByText('Atlas Rent')).toBeInTheDocument();
    const toggle = nav.getByRole('button', { name: 'Réduire' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.setup().click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('réduite : icônes seules (nom accessible conservé), bouton « Déplier le menu »', () => {
    const nav = renderSidebar(true);
    expect(nav.queryByText('Atlas Rent')).not.toBeInTheDocument();
    expect(nav.getByRole('button', { name: 'Statistiques' })).toHaveAttribute('title', 'Statistiques');
    expect(nav.getByRole('button', { name: 'Déplier le menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
