// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import { LayoutDashboard } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({ default: () => null }));

import { Topbar } from './shell/Topbar';
import { Modal } from './shell/Dialog';
import { FilterChips } from './shell/Controls';
import { Toast } from './shell/Feedback';
import { MobileNav } from './shell/MobileNav';
import { AgencyFinancesPanel } from './finances/AgencyFinancesPanel';
import { AgencyCalendarPanel } from './calendar/AgencyCalendarPanel';

/**
 * Ergonomie sur téléphone (audit mobile, P2) : cibles tactiles d'au moins 44 px sous `sm`, notifications
 * au-dessus de la barre du bas, tableaux remplacés par des cartes, calendrier en semaine.
 * jsdom n'applique pas le CSS : on vérifie les classes qui portent ces règles.
 */

const TOUCH = /(^|\s)(h-11|min-h-11)(\s|$)/;

afterEach(() => vi.unstubAllGlobals());

function setMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe('Cibles tactiles sur téléphone', () => {
  it('en-tête : actualiser et notifications à 44 px (36 au-delà de sm)', () => {
    render(
      <Topbar
        agencyName="Atlas"
        userLabel="Youssef"
        avatarUrl={null}
        crumbs={[{ label: 'Vue d’ensemble' }]}
        notifications={[]}
        onRefresh={() => undefined}
        refreshing={false}
        onSignOut={() => undefined}
        onNavigate={() => undefined}
        sections={[{ id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard }]}
        activeSection="overview"
      />
    );
    const header = screen.getByRole('banner');
    const refresh = within(header).getByRole('button', { name: /Actualiser/ });
    const bell = within(header).getByRole('button', { name: /Notifications/ });
    for (const button of [refresh, bell]) {
      expect(button.className).toMatch(TOUCH);
      expect(button.className).toMatch(/\bsm:h-9\b/);
    }
  });

  it('croix des fenêtres à 44 px', () => {
    render(
      <Modal title="Dossier" onClose={() => undefined}>
        <p>Contenu</p>
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'Fermer' }).className).toMatch(TOUCH);
  });

  it('boutons de filtre à 44 px de haut', () => {
    render(<FilterChips options={[{ value: 'a', label: 'Tous' }, { value: 'b', label: 'En ligne' }]} value="a" onChange={() => undefined} label="Filtre" />);
    for (const chip of within(screen.getByRole('group', { name: 'Filtre' })).getAllByRole('button')) expect(chip.className).toMatch(TOUCH);
  });

  it('barre du bas : libellés à 12 px', () => {
    render(<MobileNav sections={[{ id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard }]} activeSection="overview" onNavigate={() => undefined} />);
    const bar = screen.getByRole('navigation', { name: 'Sections du tableau de bord' });
    for (const button of within(bar).getAllByRole('button')) expect(button.className).toMatch(/\btext-xs\b/);
  });
});

describe('Notifications sur téléphone', () => {
  it('en bas, pleine largeur, au-dessus de la barre de navigation ; en haut à droite au-delà de sm', () => {
    render(<Toast kind="success" message="Enregistré" onDismiss={() => undefined} />);
    const toast = screen.getByRole('status');
    expect(toast.className).toContain('bottom-[calc(var(--cd-fixed-nav,0px)+0.75rem)]');
    expect(toast.className).toMatch(/\binset-x-4\b/);
    expect(toast.className).toMatch(/\bsm:top-4\b/);
    expect(within(toast).getByRole('button', { name: 'Fermer la notification' }).className).toMatch(TOUCH);
  });
});

describe('Finances : opérations en cartes sur téléphone', () => {
  it('une carte par opération (client, référence, montants, statut) ; le tableau est réservé aux grands écrans', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/finances')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                kpis: { revenue: 2400, settledRevenue: 1200, pendingRevenue: 1200, totalBookingsCount: 2, completedBookingsCount: 1 },
                transactions: [
                  { id: 't1', reference: 'CD-2611-0041', date: '2026-11-14T09:00:00Z', customerName: 'Mohamed El Amrani', vehicle: 'Dacia Logan', totalPrice: 1200, status: 'COMPLETED' },
                  { id: 't2', reference: 'CD-2611-0042', date: '2026-11-14T09:00:00Z', customerName: 'Sophie Van der Berg', vehicle: 'Renault Clio', totalPrice: 1200, status: 'REQUESTED' },
                ],
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      })
    );
    render(<AgencyFinancesPanel agencyId="ag-1" />);
    const cards = await screen.findByRole('list', { name: 'Opérations' });
    expect(cards.className).toMatch(/\bsm:hidden\b/);
    const items = within(cards).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Mohamed El Amrani');
    expect(items[0]).toHaveTextContent('CD-2611-0041');
    expect(items[0]).toHaveTextContent('Clôturé');
    expect(items[1]).toHaveTextContent('En attente');
    expect(screen.getByRole('table').parentElement!.className).toMatch(/(^|\s)hidden(\s|$).*\bsm:block\b/);
  });
});

describe('Calendrier sur téléphone', () => {
  const stubCalendar = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { vehicles: [{ id: 'v1', brand: 'Dacia', model: 'Logan', licensePlate: '1234-A-50', category: 'Économique', status: 'AVAILABLE', dailyPrice: 300, primaryImage: null }], events: [] },
          }),
          { status: 200 }
        )
      )
    );

  it('vue semaine par défaut : 7 jours, colonne véhicule étroite, aucun défilement imposé', async () => {
    setMatchMedia(true);
    stubCalendar();
    render(<AgencyCalendarPanel agencyId="ag-1" canManage />);
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(1 + 7);
    expect(headers[0].className).toMatch(/\bw-24\b.*\bsm:w-56\b/);
    expect(table.className).not.toMatch(/(^|\s)min-w-200(\s|$)/);
  });

  it('grand écran : vue mois, comme avant', async () => {
    setMatchMedia(false);
    stubCalendar();
    render(<AgencyCalendarPanel agencyId="ag-1" canManage />);
    const table = await screen.findByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(1 + 28));
    expect(table.className).toMatch(/(^|\s)min-w-200(\s|$)/);
  });
});
