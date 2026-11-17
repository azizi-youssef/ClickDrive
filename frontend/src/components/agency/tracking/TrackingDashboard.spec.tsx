// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FleetOverview, FleetVehicle } from '@/lib/tracking/types';
import type { PositionPatch, RealtimeStatus } from '@/lib/tracking/tracking-realtime';
import { TrackingApiError } from '@/lib/tracking/client';
import { TrackingAccessProvider, type TrackingAccessValue } from './TrackingAccess';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  realtime: { options: null as null | { onPositions: (p: PositionPatch[]) => void; onResync: () => void; onAlertChange?: () => void; agencyId: string | null }, setStatus: null as null | ((s: RealtimeStatus) => void) },
  mapProps: [] as Record<string, unknown>[],
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock('@/lib/tracking/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tracking/client')>()),
  trackingApi: mocks.api,
}));

vi.mock('@/lib/tracking/tracking-realtime', async (importOriginal) => {
  const React = await import('react');
  return {
    ...(await importOriginal<typeof import('@/lib/tracking/tracking-realtime')>()),
    useTrackingRealtime: (options: NonNullable<typeof mocks.realtime.options>) => {
      const [status, setStatus] = React.useState<RealtimeStatus>('connecting');
      mocks.realtime.options = options;
      mocks.realtime.setStatus = setStatus;
      return status;
    },
  };
});

// La carte (WebGL) est remplacée par un témoin qui expose ses propriétés : ce test vérifie ce que l'écran lui transmet
vi.mock('./TrackingMapLazy', () => ({
  TrackingMapLazy: (props: Record<string, unknown>) => {
    mocks.mapProps.push(props);
    const vehicles = (props.vehicles ?? []) as { id: string; state: string }[];
    return (
      <div data-testid="map" data-selected={String(props.selectedId ?? '')} data-count={vehicles.length}>
        {vehicles.map((v) => (
          <button key={v.id} type="button" data-testid={`marker-${v.id}`} data-state={v.state} onClick={() => (props.onSelect as (id: string) => void)(v.id)}>
            marqueur {v.id}
          </button>
        ))}
      </div>
    );
  },
}));

import { TrackingDashboard } from './TrackingDashboard';

const AGENCY = '10000000-0000-4000-8000-00000000000a';
const access = (overrides: Partial<TrackingAccessValue['permissions']> = {}): TrackingAccessValue => ({
  agencyId: AGENCY,
  agencyName: 'Agence Test',
  supportMode: false,
  permissions: { read: true, manage: true, alerts: true, settings: true, ...overrides },
});

const vehicle = (id: string, overrides: Partial<FleetVehicle> = {}): FleetVehicle => ({
  id,
  brand: 'Dacia',
  model: `Logan ${id}`,
  unit_number: `U-${id}`,
  license_plate: `${id}-A-50`,
  vehicle_type: 'CAR',
  state: 'STATIONARY',
  open_alerts: 0,
  booking_reference: null,
  tracker: { id: `t-${id}`, provider: 'klickdrive-gateway', label: null, status: 'ACTIVE', last_seen_at: new Date().toISOString() },
  position: { latitude: 35.17, longitude: -2.93, speed_kmh: 0, heading_deg: null, ignition: null, accuracy_m: null, recorded_at: new Date(Date.now() - 60_000).toISOString() },
  ...overrides,
});

const overview = (vehicles: FleetVehicle[], extra: Partial<FleetOverview> = {}): { data: FleetOverview; meta: Record<string, unknown> } => ({
  data: {
    summary: { total_vehicles: vehicles.length, tracked: 0, online: 0, moving: 0, stationary: 0, offline: 0, awaiting: 0, disabled: 0, untracked: 0, open_alerts: vehicles.reduce((n, v) => n + v.open_alerts, 0) },
    total: vehicles.length,
    limit: 500,
    offset: 0,
    generated_at: new Date().toISOString(),
    vehicles,
    ...extra,
  },
  meta: {},
});

function renderDashboard(perms: Partial<TrackingAccessValue['permissions']> = {}) {
  return render(
    <TrackingAccessProvider value={access(perms)}>
      <TrackingDashboard />
    </TrackingAccessProvider>
  );
}

const patch = (id: string, overrides: Partial<PositionPatch> = {}): PositionPatch => ({
  vehicle_id: id, latitude: 35.2, longitude: -2.8, speed_kmh: 42, heading_deg: 90, ignition: true, accuracy_m: 5,
  recorded_at: new Date().toISOString(), movement_state: 'MOVING', ...overrides,
});

beforeEach(() => {
  mocks.api.mockReset();
  mocks.mapProps.length = 0;
  mocks.realtime.options = null;
});

describe('TrackingDashboard — états de chargement, vide, erreur', () => {
  it('chargement : squelettes (indicateurs et liste), aucune donnée simulée', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockReturnValue(new Promise((r) => (resolve = r)));
    renderDashboard();
    expect(screen.queryByText('Véhicules suivis')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
    await act(async () => resolve(overview([vehicle('1')])));
    expect(await screen.findByText('Véhicules suivis')).toBeInTheDocument();
  });

  it('flotte vide : message explicite et lien vers la flotte', async () => {
    mocks.api.mockResolvedValue(overview([]));
    renderDashboard();
    expect(await screen.findByText('Aucun véhicule dans votre flotte')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la flotte' })).toHaveAttribute('href', '/agency');
  });

  it('aucun boîtier enregistré : invitation à en enregistrer un (bouton réservé à tracking.manage)', async () => {
    mocks.api.mockResolvedValue(overview([vehicle('1', { state: 'UNTRACKED', tracker: null, position: null })]));
    const { unmount } = renderDashboard();
    expect(await screen.findByText('Aucun boîtier GPS n’est encore enregistré')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enregistrer un boîtier' })).toHaveAttribute('href', '/agency/tracking/devices');
    unmount();

    renderDashboard({ manage: false });
    expect(await screen.findByText('Aucun boîtier GPS n’est encore enregistré')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enregistrer un boîtier' })).not.toBeInTheDocument();
  });

  it('erreur de chargement : message lisible, « Réessayer » relance la requête et rétablit l’écran', async () => {
    const user = userEvent.setup();
    mocks.api.mockRejectedValueOnce(new TrackingApiError(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.'));
    renderDashboard();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Service temporairement indisponible.');

    mocks.api.mockResolvedValue(overview([vehicle('1', { state: 'MOVING' })]));
    await user.click(within(alert).getByRole('button', { name: /Réessayer/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await screen.findByText('Dacia Logan 1')).toBeInTheDocument();
  });

  it('un échec de rafraîchissement n’efface pas les données déjà affichées', async () => {
    mocks.api.mockResolvedValueOnce(overview([vehicle('1')]));
    renderDashboard();
    expect(await screen.findByText('Dacia Logan 1')).toBeInTheDocument();
    mocks.api.mockRejectedValueOnce(new TrackingApiError(0, 'NETWORK', 'Connexion impossible.'));
    await act(async () => mocks.realtime.options!.onResync());
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible.');
    expect(screen.getByText('Dacia Logan 1')).toBeInTheDocument();
  });
});

describe('TrackingDashboard — flotte, filtres, sélection', () => {
  const fleet = () => [
    vehicle('1', { state: 'MOVING', position: { latitude: 35.1, longitude: -2.9, speed_kmh: 55, heading_deg: 180, ignition: true, accuracy_m: 4, recorded_at: new Date(Date.now() - 20_000).toISOString() }, booking_reference: 'CD-2026-000001' }),
    vehicle('2', { state: 'STATIONARY' }),
    vehicle('3', { state: 'OFFLINE', open_alerts: 2 }),
    vehicle('4', { state: 'UNTRACKED', tracker: null, position: null, brand: 'Citroën', model: 'Berlingo' }),
  ];

  it('indicateurs recalculés depuis la liste, carte alimentée par les seuls véhicules positionnés', async () => {
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');
    const kpis = screen.getByLabelText('Indicateurs de la flotte');
    expect(within(kpis).getByText('3 / 4')).toBeInTheDocument(); // suivis / total
    expect(within(kpis).getByText('Alertes ouvertes').closest('.p-4')).toHaveTextContent('2');
    expect(screen.getByTestId('map')).toHaveAttribute('data-count', '3');
    expect(screen.queryByTestId('marker-4')).not.toBeInTheDocument();
  });

  it('recherche (accents ignorés) et filtre par état ; « Aucun véhicule ne correspond » avec réinitialisation', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');

    await user.type(screen.getByRole('searchbox'), 'citroen');
    const list = screen.getByRole('list', { name: 'Véhicules de la flotte' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('map')).toHaveAttribute('data-count', '0');

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Aucun véhicule ne correspond')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(within(screen.getByRole('list', { name: 'Véhicules de la flotte' })).getAllByRole('listitem')).toHaveLength(4);

    const chips = within(screen.getByRole('group', { name: 'Filtrer par état' }));
    await user.click(chips.getByRole('button', { name: /En mouvement/ }));
    expect(within(screen.getByRole('list', { name: 'Véhicules de la flotte' })).getAllByRole('listitem')).toHaveLength(1);
    expect(chips.getByRole('button', { name: /En mouvement/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sélection : carte et fiche synchronisées (coordonnées, vitesse, direction, location en cours), fermeture', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: /Dacia Logan 1/ }));
    const card = screen.getByRole('region', { name: /Position de Dacia Logan 1/ });
    expect(within(card).getByText('35.10000, -2.90000')).toBeInTheDocument();
    expect(within(card).getByText('55 km/h')).toBeInTheDocument();
    expect(within(card).getByText(/S \(180°\)/)).toBeInTheDocument();
    expect(within(card).getByText('Mis')).toBeInTheDocument();
    expect(within(card).getByText('CD-2026-000001')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Voir le détail/ })).toHaveAttribute('href', '/agency/tracking/vehicles/1');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '1');

    await user.click(within(card).getByRole('button', { name: 'Fermer le détail' }));
    expect(screen.queryByRole('region', { name: /Position de/ })).not.toBeInTheDocument();
  });

  it('une sélection depuis la carte ouvre aussi la fiche ; un véhicule hors ligne le dit clairement', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await user.click(await screen.findByTestId('marker-3'));
    expect(screen.getByRole('region', { name: /Position de Dacia Logan 3/ })).toHaveTextContent('la position affichée est la dernière connue');
  });

  it('véhicule sans boîtier : explication au lieu de coordonnées', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: /Citroën Berlingo/ }));
    expect(screen.getByText(/Aucun boîtier GPS n’est affecté/)).toBeInTheDocument();
  });

  it('flotte tronquée à 500 : avertissement explicite', async () => {
    mocks.api.mockResolvedValue(overview(fleet(), { total: 900 }));
    renderDashboard();
    expect(await screen.findByRole('note')).toHaveTextContent('Affichage limité aux 4 premiers véhicules sur 900');
  });

  it('structure responsive : la carte passe avant la liste sur mobile, à droite de la liste sur grand écran', async () => {
    mocks.api.mockResolvedValue(overview(fleet()));
    const { container } = renderDashboard();
    await screen.findByText('Dacia Logan 1');
    const grid = container.querySelector('.lg\\:grid-cols-\\[22rem_minmax\\(0\\,1fr\\)\\]');
    expect(grid).not.toBeNull();
    const [listPanel, mapPanel] = [...grid!.children] as HTMLElement[];
    expect(listPanel!.className).toMatch(/order-2/);
    expect(listPanel!.className).toMatch(/lg:order-1/);
    expect(mapPanel!.className).toMatch(/order-1/);
    expect(mapPanel!.className).toMatch(/lg:order-2/);
    expect(container.querySelector('section[aria-label="Indicateurs de la flotte"]')!.className).toMatch(/grid-cols-2/);
    expect(container.querySelector('section[aria-label="Indicateurs de la flotte"]')!.className).toMatch(/xl:grid-cols-6/);
  });

  it('« Agrandir la carte » : la carte occupe tout l’écran sans être recréée ; Échap ou « Réduire » la ramène', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');
    const map = screen.getByTestId('map');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Agrandir la carte' }));
    const dialog = screen.getByRole('dialog', { name: 'Carte de la flotte agrandie' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.className).toMatch(/\bfixed\b/);
    expect(dialog.className).toMatch(/\binset-0\b/);
    // Même carte (aucun rechargement de MapLibre), page derrière inerte et figée
    expect(within(dialog).getByTestId('map')).toBe(map);
    expect(screen.getByText('Dacia Logan 1').closest('[inert]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    // Les commandes de la carte restent disponibles en grand
    expect(within(dialog).getByRole('button', { name: 'Afficher tous les véhicules' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('map')).toBe(map);
    expect(screen.getByText('Dacia Logan 1').closest('[inert]')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    await user.click(screen.getByRole('button', { name: 'Agrandir la carte' }));
    await user.click(screen.getByRole('button', { name: 'Réduire la carte' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agrandir la carte' })).toHaveFocus();
  });

  it('« Afficher tous les véhicules » recadre la carte sur la flotte (nouvelle clé de cadrage)', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');
    const before = mocks.mapProps.at(-1)?.fitKey;
    await user.click(screen.getByRole('button', { name: 'Afficher tous les véhicules' }));
    expect(mocks.mapProps.at(-1)?.fitKey).not.toBe(before);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('TrackingDashboard — temps réel', () => {
  const fleet = () => [vehicle('1', { state: 'STATIONARY' }), vehicle('2', { state: 'STATIONARY' })];

  it('une position reçue met à jour la carte, la liste et les compteurs sans rechargement de page', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: /Dacia Logan 1/ }));
    const callsBefore = mocks.api.mock.calls.length;
    expect(screen.getByTestId('marker-1')).toHaveAttribute('data-state', 'STATIONARY');

    await act(async () => mocks.realtime.options!.onPositions([patch('1')]));
    expect(screen.getByTestId('marker-1')).toHaveAttribute('data-state', 'MOVING');
    expect(within(screen.getByRole('region', { name: /Position de Dacia Logan 1/ })).getByText('42 km/h')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Indicateurs de la flotte')).getByText('En mouvement').closest('.p-4')).toHaveTextContent('1');
    expect(mocks.api.mock.calls.length).toBe(callsBefore); // aucune requête supplémentaire : mise à jour locale
  });

  it('une position plus ancienne que celle affichée est ignorée', async () => {
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');
    await act(async () => mocks.realtime.options!.onPositions([patch('1', { recorded_at: new Date(Date.now() - 3_600_000).toISOString() })]));
    expect(screen.getByTestId('marker-1')).toHaveAttribute('data-state', 'STATIONARY');
  });

  it('coupure puis reprise : indicateur de reconnexion (actualisation périodique), puis « Direct » et rechargement complet', async () => {
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');

    await act(async () => mocks.realtime.setStatus!('live'));
    expect(screen.getAllByText('Direct').length).toBeGreaterThan(0);

    await act(async () => mocks.realtime.setStatus!('reconnecting'));
    expect(screen.getByText(/Reconnexion — actualisation toutes les 15 s/)).toBeInTheDocument();

    // La reprise déclenche la relecture complète (événements manqués rattrapés)
    mocks.api.mockResolvedValue(overview([vehicle('1', { state: 'MOVING' }), vehicle('2')]));
    await act(async () => {
      mocks.realtime.setStatus!('live');
      mocks.realtime.options!.onResync();
    });
    await waitFor(() => expect(screen.getByTestId('marker-1')).toHaveAttribute('data-state', 'MOVING'));
    expect(screen.getAllByText('Direct').length).toBeGreaterThan(0);
  });

  it('une alerte reçue en direct recharge les compteurs', async () => {
    mocks.api.mockResolvedValueOnce(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');
    mocks.api.mockResolvedValueOnce(overview([vehicle('1', { open_alerts: 1 }), vehicle('2')]));
    await act(async () => mocks.realtime.options!.onAlertChange!());
    await waitFor(() => expect(within(screen.getByLabelText('Indicateurs de la flotte')).getByText('Alertes ouvertes').closest('.p-4')).toHaveTextContent('1'));
  });

  it('l’abonnement est lié à l’agence de la session (jamais à une valeur saisie)', async () => {
    mocks.api.mockResolvedValue(overview(fleet()));
    renderDashboard();
    await screen.findByText('Dacia Logan 1');
    expect(mocks.realtime.options!.agencyId).toBe(AGENCY);
  });
});
