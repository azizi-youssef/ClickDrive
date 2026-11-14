// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackingApiError } from '@/lib/tracking/client';
import type { AlertsPage, GeofenceRecord, TrackerRecord, TrackingAlert, TrackingSettings, TripSummary, TripsPage } from '@/lib/tracking/types';
import { TrackingAccessProvider, type TrackingAccessValue } from './TrackingAccess';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/lib/tracking/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/tracking/client')>()), trackingApi: mocks.api }));
vi.mock('@/lib/tracking/tracking-realtime', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/tracking/tracking-realtime')>()), useTrackingRealtime: () => 'live' }));
vi.mock('./TrackingMapLazy', () => ({
  TrackingMapLazy: (props: { route?: unknown[] | null; onPick?: (p: { latitude: number; longitude: number }) => void; pick?: unknown }) => (
    <div data-testid="map" data-route-points={props.route ? props.route.length : 0}>
      {props.onPick && <button type="button" onClick={() => props.onPick!({ latitude: 35.17, longitude: -2.93 })}>placer le centre</button>}
    </div>
  ),
}));

import { TrackingAlerts } from './TrackingAlerts';
import { TrackerManagement } from './TrackerManagement';
import { GeofencesPanel } from './GeofencesPanel';
import { TripHistory, rangeToIso } from './TripHistory';
import { TrackingSettingsPanel, diffSettings } from './TrackingSettingsPanel';

const AGENCY = '10000000-0000-4000-8000-00000000000a';
const perms = (overrides: Partial<TrackingAccessValue['permissions']> = {}): TrackingAccessValue => ({
  agencyId: AGENCY, agencyName: 'Agence Test', supportMode: false, permissions: { read: true, manage: true, alerts: true, settings: true, ...overrides },
});
const wrap = (ui: React.ReactElement, overrides: Partial<TrackingAccessValue['permissions']> = {}) => render(<TrackingAccessProvider value={perms(overrides)}>{ui}</TrackingAccessProvider>);

const identity = { id: 'v1', brand: 'Dacia', model: 'Logan', unit_number: 'A-1', license_plate: '11111-A-50' };

const alert = (overrides: Partial<TrackingAlert> = {}): TrackingAlert => ({
  id: 'a1', type: 'SPEED_LIMIT', severity: 'WARNING', title: 'Vitesse excessive', description: 'Le véhicule Dacia Logan (A-1) roule à 120 km/h (limite configurée : 90 km/h).',
  occurred_at: new Date(Date.now() - 120_000).toISOString(), resolved_at: null, ongoing: true, status: 'OPEN', acknowledged_at: null, vehicle: identity, geofence_name: null, booking_reference: 'CD-2026-000001', position: null, metadata: {}, ...overrides,
});
const alertsPage = (alerts: TrackingAlert[], extra: Partial<AlertsPage> = {}): { data: AlertsPage; meta: Record<string, unknown> } => ({ data: { total: alerts.length, open_total: alerts.filter((a) => a.status === 'OPEN').length, limit: 20, offset: 0, alerts, ...extra }, meta: {} });

beforeEach(() => {
  mocks.api.mockReset();
});

describe('TrackingAlerts', () => {
  it('chargement puis liste : gravité, type, description, véhicule, référence de location, « En cours »', async () => {
    let resolve!: (v: unknown) => void;
    mocks.api.mockReturnValue(new Promise((r) => (resolve = r)));
    wrap(<TrackingAlerts />);
    expect(screen.getByLabelText('Chargement des alertes')).toBeInTheDocument();
    await act(async () => resolve(alertsPage([alert(), alert({ id: 'a2', type: 'DEVICE_OFFLINE', severity: 'CRITICAL', description: 'Le boîtier ne communique plus.' })])));
    const list = await screen.findByRole('list', { name: 'Alertes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Vitesse excessive')).toBeInTheDocument();
    expect(within(list).getByText('Critique')).toBeInTheDocument();
    expect(within(list).getAllByText('En cours').length).toBe(2);
    expect(within(list).getAllByText(/Location CD-2026-000001/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Dacia Logan/ })[0]).toHaveAttribute('href', '/agency/tracking/vehicles/v1');
  });

  it('accusé de réception : PATCH {action: acknowledge}, confirmation, rechargement ; le bouton est absent sans tracking.alerts.manage', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValueOnce(alertsPage([alert()]));
    const { unmount } = wrap(<TrackingAlerts />);
    mocks.api.mockResolvedValueOnce({ data: { changed: true, status: 'ACKNOWLEDGED' }, meta: {} });
    mocks.api.mockResolvedValueOnce(alertsPage([alert({ status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString() })]));
    await user.click(await screen.findByRole('button', { name: 'Prendre en compte' }));
    expect(mocks.api).toHaveBeenCalledWith('/alerts/a1', { method: 'PATCH', body: { action: 'acknowledge' } });
    expect(await screen.findByText('Alerte prise en compte.')).toBeInTheDocument();
    expect(await screen.findByText(/Prise en compte/)).toBeInTheDocument();
    unmount();

    mocks.api.mockResolvedValueOnce(alertsPage([alert()]));
    wrap(<TrackingAlerts />, { alerts: false });
    await screen.findByRole('list', { name: 'Alertes' });
    expect(screen.queryByRole('button', { name: 'Prendre en compte' })).not.toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('échec de l’accusé : message d’erreur, l’alerte reste ouverte', async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValueOnce(alertsPage([alert()]));
    wrap(<TrackingAlerts />);
    mocks.api.mockRejectedValueOnce(new TrackingApiError(403, 'FORBIDDEN', 'Accès refusé.'));
    await user.click(await screen.findByRole('button', { name: 'Prendre en compte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé.');
    expect(screen.getByRole('button', { name: 'Prendre en compte' })).toBeEnabled();
  });

  it('état vide, état d’erreur avec relance, et filtres transmis à l’API', async () => {
    const user = userEvent.setup();
    mocks.api.mockRejectedValueOnce(new TrackingApiError(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.'));
    wrap(<TrackingAlerts />);
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Service temporairement indisponible.');
    mocks.api.mockResolvedValueOnce(alertsPage([]));
    await user.click(within(banner).getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByText('Aucune alerte ouverte')).toBeInTheDocument();

    mocks.api.mockResolvedValue(alertsPage([]));
    await user.selectOptions(screen.getByLabelText('Type'), 'GEOFENCE_EXIT');
    await user.selectOptions(screen.getByLabelText('Gravité'), 'CRITICAL');
    await user.selectOptions(screen.getByLabelText('Statut'), 'ALL');
    await waitFor(() => {
      const [, request] = mocks.api.mock.calls[mocks.api.mock.calls.length - 1]!;
      expect(request.query).toMatchObject({ type: 'GEOFENCE_EXIT', severity: 'CRITICAL', page: 1, page_size: 20 });
      expect(request.query.status).toBeUndefined();
    });
  });
});

const tracker = (overrides: Partial<TrackerRecord> = {}): TrackerRecord => ({
  id: 't1', provider: 'klickdrive-gateway', external_device_id: 'IMEI-8650', label: 'OBD Logan', device_model: null, status: 'ACTIVE', state: 'STATIONARY',
  installed_at: null, last_seen_at: new Date(Date.now() - 30_000).toISOString(), last_position_at: null, disconnected_at: null, capabilities: { ignition: true },
  vehicle: identity, history: [{ vehicle_label: 'Dacia Logan (A-1)', assigned_at: '2026-10-01T10:00:00Z', unassigned_at: null, reason: 'Enregistrement' }], ...overrides,
});
const providers = [
  { id: 'klickdrive-gateway', displayName: 'Passerelle ClickDrive', status: 'available', description: '', pendingReason: null },
  { id: 'traccar', displayName: 'Traccar', status: 'pending', description: '', pendingReason: 'À intégrer' },
];
const fleetResponse = { data: { vehicles: [{ id: 'v1', brand: 'Dacia', model: 'Logan', unit_number: 'A-1', tracker: { id: 't1' } }, { id: 'v2', brand: 'Renault', model: 'Clio', unit_number: 'A-2', tracker: null }], total: 2, summary: {} }, meta: {} };

function routeApi(handlers: Record<string, unknown>) {
  mocks.api.mockImplementation(async (path: string, request?: { method?: string }) => {
    const key = `${request?.method ?? 'GET'} ${path}`;
    const handler = handlers[key] ?? handlers[path];
    if (handler instanceof Error) throw handler;
    if (handler === undefined) throw new Error(`Appel inattendu : ${key}`);
    return typeof handler === 'function' ? (handler as () => unknown)() : handler;
  });
}

describe('TrackerManagement', () => {
  const trackersResponse = (list: TrackerRecord[]) => ({ data: { trackers: list, providers }, meta: {} });

  it('liste : état de communication, véhicule, fonctions réellement constatées, historique d’affectation', async () => {
    const user = userEvent.setup();
    routeApi({ '/trackers': trackersResponse([tracker()]), '/vehicles': fleetResponse });
    wrap(<TrackerManagement />);
    const list = await screen.findByRole('list', { name: 'Boîtiers GPS' });
    expect(within(list).getByText('OBD Logan')).toBeInTheDocument();
    expect(within(list).getByText('En ligne')).toBeInTheDocument();
    expect(within(list).getByText(/Fonctions constatées : Contact/)).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: /Historique/ }));
    expect(within(screen.getByRole('list', { name: 'Historique d’affectation' })).getByText('Dacia Logan (A-1)')).toBeInTheDocument();
  });

  it('état vide et rôle en lecture seule : aucune action de gestion proposée', async () => {
    routeApi({ '/trackers': trackersResponse([]), '/vehicles': fleetResponse });
    const { unmount } = wrap(<TrackerManagement />);
    expect(await screen.findByText('Aucun boîtier enregistré')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Enregistrer un boîtier/ }).length).toBeGreaterThan(0);
    unmount();

    routeApi({ '/trackers': trackersResponse([tracker()]), '/vehicles': fleetResponse });
    wrap(<TrackerManagement />, { manage: false });
    await screen.findByRole('list', { name: 'Boîtiers GPS' });
    for (const name of [/Réaffecter/, /Pause/, /Déconnecter/, /Enregistrer un boîtier/]) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('enregistrement : validation de l’identifiant, fournisseurs non intégrés non sélectionnables, requête POST complète', async () => {
    const user = userEvent.setup();
    routeApi({ '/trackers': trackersResponse([]), '/vehicles': fleetResponse, 'POST /trackers': { data: { id: 't9' }, meta: {} } });
    wrap(<TrackerManagement />);
    await user.click((await screen.findAllByRole('button', { name: /Enregistrer un boîtier/ }))[0]!);
    const dialog = screen.getByRole('dialog');
    const providerSelect = within(dialog).getByLabelText('Fournisseur') as HTMLSelectElement;
    expect([...providerSelect.options].map((o) => o.value)).toEqual(['klickdrive-gateway']);
    expect(within(dialog).getByText(/Intégrations à venir \(non sélectionnables\) : Traccar/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Identifiant du boîtier'), 'a b');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Identifiant requis');
    expect(mocks.api.mock.calls.some(([, r]) => r?.method === 'POST')).toBe(false);

    await user.clear(within(dialog).getByLabelText('Identifiant du boîtier'));
    await user.type(within(dialog).getByLabelText('Identifiant du boîtier'), 'IMEI-8650');
    await user.type(within(dialog).getByLabelText('Libellé (facultatif)'), 'OBD Clio');
    await user.selectOptions(within(dialog).getByLabelText('Véhicule (facultatif)'), 'v2');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/trackers', { method: 'POST', agencyId: null, body: { provider: 'klickdrive-gateway', external_device_id: 'IMEI-8650', label: 'OBD Clio', vehicle_id: 'v2' } }));
    expect(await screen.findByText('Boîtier enregistré.')).toBeInTheDocument();
  });

  it('conflit à l’enregistrement : message de l’API affiché dans la fenêtre, qui reste ouverte', async () => {
    const user = userEvent.setup();
    routeApi({ '/trackers': trackersResponse([]), '/vehicles': fleetResponse, 'POST /trackers': new TrackingApiError(409, 'DEVICE_ALREADY_REGISTERED', 'Ce boîtier est déjà enregistré.') });
    wrap(<TrackerManagement />);
    await user.click((await screen.findAllByRole('button', { name: /Enregistrer un boîtier/ }))[0]!);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Identifiant du boîtier'), 'IMEI-8650');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByText('Ce boîtier est déjà enregistré.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('déconnexion : confirmation avec motif obligatoire, puis PATCH {disconnect: true, reason}', async () => {
    const user = userEvent.setup();
    routeApi({ '/trackers': trackersResponse([tracker()]), '/vehicles': fleetResponse, 'PATCH /trackers/t1': { data: { id: 't1' }, meta: {} } });
    wrap(<TrackerManagement />);
    await user.click(await screen.findByRole('button', { name: /Déconnecter/ }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Déconnecter' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Motif de la déconnexion'), 'Fin de contrat');
    await user.click(confirm);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/trackers/t1', { method: 'PATCH', body: { disconnect: true, reason: 'Fin de contrat' }, agencyId: null }));
  });

  it('réaffectation : seuls les véhicules sans boîtier sont proposés, la validation est bloquée sans changement', async () => {
    const user = userEvent.setup();
    routeApi({ '/trackers': trackersResponse([tracker()]), '/vehicles': fleetResponse, 'PATCH /trackers/t1': { data: { id: 't1' }, meta: {} } });
    wrap(<TrackerManagement />);
    await user.click(await screen.findByRole('button', { name: /Réaffecter/ }));
    const dialog = screen.getByRole('dialog');
    const select = within(dialog).getByLabelText('Véhicule') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['', 'v1', 'v2']); // Aucun, actuel, libre
    expect(within(dialog).getByRole('button', { name: 'Valider' })).toBeDisabled();
    await user.selectOptions(select, 'v2');
    await user.click(within(dialog).getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/trackers/t1', { method: 'PATCH', body: { vehicle_id: 'v2' }, agencyId: null }));
  });
});

describe('GeofencesPanel et GeofenceEditor', () => {
  const zone = (overrides: Partial<GeofenceRecord> = {}): GeofenceRecord => ({
    id: 'g1', name: 'Aéroport Nador', shape: 'CIRCLE', center_latitude: 35.17, center_longitude: -2.93, radius_m: 500, enabled: true, alert_on_enter: true, alert_on_exit: true, created_at: '2026-11-01T10:00:00Z', vehicle_ids: ['v1'], ...overrides,
  });

  it('état vide puis validation du formulaire (nom, centre, rayon) avant tout envoi', async () => {
    const user = userEvent.setup();
    routeApi({ '/geofences': { data: { geofences: [] }, meta: {} }, '/vehicles': fleetResponse });
    wrap(<GeofencesPanel />);
    expect(await screen.findByText('Aucune zone')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /(Nouvelle zone|Créer une zone)/ })[0]!);
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Rayon (mètres)'));
    await user.type(within(dialog).getByLabelText('Rayon (mètres)'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByText('Donnez un nom à la zone.')).toBeInTheDocument();
    expect(within(dialog).getByText('Rayon entier entre 25 m et 100 000 m.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Cliquez sur la carte ou saisissez/)).toBeInTheDocument();
    expect(mocks.api.mock.calls.some(([, r]) => r?.method === 'POST')).toBe(false);
  });

  it('création : centre choisi sur la carte, véhicules cochés, POST avec la définition complète', async () => {
    const user = userEvent.setup();
    routeApi({ '/geofences': { data: { geofences: [] }, meta: {} }, '/vehicles': fleetResponse, 'POST /geofences': { data: { id: 'g9' }, meta: {} } });
    wrap(<GeofencesPanel />);
    await user.click((await screen.findAllByRole('button', { name: /(Nouvelle zone|Créer une zone)/ }))[0]!);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nom de la zone'), 'Agence centrale');
    await user.click(within(dialog).getByRole('button', { name: 'placer le centre' }));
    expect(within(dialog).getByLabelText('Latitude')).toHaveValue('35.170000');
    await user.click(within(dialog).getByRole('checkbox', { name: /Dacia Logan/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/geofences', {
      method: 'POST', agencyId: null,
      body: { name: 'Agence centrale', center_latitude: 35.17, center_longitude: -2.93, radius_m: 300, enabled: true, alert_on_enter: true, alert_on_exit: true, vehicle_ids: ['v1'] },
    }));
    expect(await screen.findByText('Zone créée.')).toBeInTheDocument();
  });

  it('erreur du serveur (nom déjà pris) : affichée dans la fenêtre, saisie conservée', async () => {
    const user = userEvent.setup();
    routeApi({ '/geofences': { data: { geofences: [] }, meta: {} }, '/vehicles': fleetResponse, 'POST /geofences': new TrackingApiError(409, 'GEOFENCE_NAME_TAKEN', 'Une zone porte déjà ce nom.') });
    wrap(<GeofencesPanel />);
    await user.click((await screen.findAllByRole('button', { name: /(Nouvelle zone|Créer une zone)/ }))[0]!);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nom de la zone'), 'Doublon');
    await user.click(within(dialog).getByRole('button', { name: 'placer le centre' }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByText('Une zone porte déjà ce nom.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nom de la zone')).toHaveValue('Doublon');
  });

  it('suppression : confirmation explicite avant DELETE ; lecture seule sans tracking.manage', async () => {
    const user = userEvent.setup();
    routeApi({ '/geofences': { data: { geofences: [zone()] }, meta: {} }, '/vehicles': fleetResponse, 'DELETE /geofences/g1': { data: { deleted: true }, meta: {} } });
    const { unmount } = wrap(<GeofencesPanel />);
    await user.click(await screen.findByRole('button', { name: 'Supprimer la zone Aéroport Nador' }));
    expect(mocks.api.mock.calls.some(([, r]) => r?.method === 'DELETE')).toBe(false);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/geofences/g1', { method: 'DELETE', agencyId: null }));
    unmount();

    wrap(<GeofencesPanel />, { manage: false });
    await screen.findByText('Aéroport Nador');
    expect(screen.queryByRole('button', { name: /Supprimer la zone/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nouvelle zone/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});

describe('TripHistory', () => {
  const trip = (id: string, overrides: Partial<TripSummary> = {}): TripSummary => ({
    id, vehicle: identity, booking_reference: 'CD-2026-000001', status: 'COMPLETED', started_at: '2026-11-13T08:00:00Z', ended_at: '2026-11-13T08:40:00Z',
    start: { latitude: 35.1, longitude: -2.9 }, end: { latitude: 35.2, longitude: -2.8 }, distance_km: 18.4, duration_seconds: 2400, max_speed_kmh: 92, closed_reason: 'IDLE', ...overrides,
  });
  const tripsResponse = (trips: TripSummary[], total = trips.length): { data: TripsPage; meta: Record<string, unknown> } => ({ data: { total, limit: 15, offset: 0, trips }, meta: {} });

  it('liste des trajets : distance, durée, vitesse max, location ; sélection charge le tracé et l’affiche sur la carte', async () => {
    const user = userEvent.setup();
    routeApi({
      '/vehicles': fleetResponse,
      '/trips': tripsResponse([trip('tr1')]),
      '/trips/tr1/route': { data: { trip_id: 'tr1', total_points: 3, points: [{ recorded_at: 'a', latitude: 35.1, longitude: -2.9, speed_kmh: 40 }, { recorded_at: 'b', latitude: 35.15, longitude: -2.85, speed_kmh: 50 }, { recorded_at: 'c', latitude: 35.2, longitude: -2.8, speed_kmh: 0 }] }, meta: {} },
    });
    wrap(<TripHistory />);
    const item = await screen.findByRole('button', { name: /18[,.]4 km/ });
    expect(item).toHaveTextContent('Durée 40 min');
    expect(item).toHaveTextContent('Max 92 km/h');
    expect(item).toHaveTextContent('Location CD-2026-000001');
    expect(screen.getByTestId('map')).toHaveAttribute('data-route-points', '0');
    await user.click(item);
    await waitFor(() => expect(screen.getByTestId('map')).toHaveAttribute('data-route-points', '3'));
    expect(item).toHaveAttribute('aria-pressed', 'true');
    expect(item).toHaveTextContent('Départ : 35.10000, -2.90000');
  });

  it('état vide, état d’erreur avec relance', async () => {
    const user = userEvent.setup();
    routeApi({ '/vehicles': fleetResponse, '/trips': tripsResponse([]) });
    const { unmount } = wrap(<TripHistory />);
    expect(await screen.findByText('Aucun trajet sur cette période')).toBeInTheDocument();
    unmount();

    let fail = true;
    routeApi({ '/vehicles': fleetResponse, '/trips': () => { if (fail) throw new TrackingApiError(500, 'INTERNAL', 'Une erreur est survenue.'); return tripsResponse([trip('tr1')]); } });
    wrap(<TripHistory />);
    const banner = await screen.findByRole('alert');
    fail = false;
    await user.click(within(banner).getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByRole('button', { name: /18[,.]4 km/ })).toBeInTheDocument();
  });

  it('pagination serveur (15 par page) et filtre véhicule transmis à l’API', async () => {
    const user = userEvent.setup();
    routeApi({ '/vehicles': fleetResponse, '/trips': tripsResponse([trip('tr1')], 40) });
    wrap(<TripHistory />);
    await screen.findByRole('button', { name: /18[,.]4 km/ });
    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    await waitFor(() => expect(mocks.api.mock.calls.some(([path, r]) => path === '/trips' && r.query.page === 2 && r.query.page_size === 15)).toBe(true));
    await user.selectOptions(screen.getByLabelText('Véhicule'), 'v2');
    await waitFor(() => expect(mocks.api.mock.calls.some(([path, r]) => path === '/trips' && r.query.vehicle_id === 'v2' && r.query.page === 1)).toBe(true));
  });

  it('période personnalisée au-delà de 93 jours : message, aucune requête de trajets envoyée', async () => {
    const user = userEvent.setup();
    routeApi({ '/vehicles': fleetResponse, '/trips': tripsResponse([]) });
    wrap(<TripHistory />);
    await screen.findByText('Aucun trajet sur cette période');
    await user.click(screen.getByRole('button', { name: 'Période' }));
    const before = mocks.api.mock.calls.filter(([p]) => p === '/trips').length;
    const from = screen.getByLabelText('Du');
    await user.clear(from);
    await user.type(from, '2025-01-01');
    expect(await screen.findByText('La période ne peut pas dépasser 93 jours.')).toBeInTheDocument();
    const after = mocks.api.mock.calls.filter(([p]) => p === '/trips' && p).length;
    expect(after).toBeLessThanOrEqual(before + 1);
    // requête suspendue : aucune période antérieure à 2026 n'a jamais été envoyée à l'API
    const sent = mocks.api.mock.calls.filter(([p]) => p === '/trips').map(([, r]) => r.query.from).filter(Boolean) as string[];
    expect(sent.some((from) => Date.parse(from) < Date.parse('2026-01-01'))).toBe(false);
  });

  it('bornes ISO : jours locaux, fin exclusive ; période inversée refusée', () => {
    const range = rangeToIso({ from: '2026-11-01', to: '2026-11-03' })!;
    expect(range.days).toBe(3);
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(3 * 86_400_000);
    expect(rangeToIso({ from: '2026-11-05', to: '2026-11-01' })).toBeNull();
    expect(rangeToIso({ from: 'x', to: 'y' })).toBeNull();
  });
});

describe('TrackingSettingsPanel', () => {
  const settings = (overrides: Partial<TrackingSettings> = {}): TrackingSettings => ({
    agency_id: AGENCY, retention_days: 90, trip_retention_days: 365, offline_after_minutes: 15, moving_speed_kmh: 5, trip_end_idle_minutes: 5,
    speed_alerts_enabled: false, speed_limit_kmh: null, unexpected_movement_enabled: false, quiet_hours_start: '22:00:00', quiet_hours_end: '06:00:00',
    legal_basis: null, cndp_reference: null, customers_informed_at: null, configured: false, ...overrides,
  });

  it('diffSettings : seules les clés modifiées sont envoyées, les valeurs hors bornes sont signalées', () => {
    const saved = settings();
    const base = { retention_days: '90', trip_retention_days: '365', offline_after_minutes: '15', moving_speed_kmh: '5', trip_end_idle_minutes: '5', speed_alerts_enabled: false, speed_limit_kmh: '', unexpected_movement_enabled: false, quiet_hours_start: '22:00', quiet_hours_end: '06:00', legal_basis: '' as const, cndp_reference: '', customers_informed: false };
    expect(diffSettings(base, saved)).toEqual({ changes: {}, errors: {} });
    expect(diffSettings({ ...base, retention_days: '30', cndp_reference: ' Dossier 12 ' }, saved).changes).toEqual({ retention_days: 30, cndp_reference: 'Dossier 12' });
    expect(diffSettings({ ...base, retention_days: '3' }, saved).errors.retention_days).toMatch(/7 à 730/);
    expect(diffSettings({ ...base, retention_days: '30.5' }, saved).errors.retention_days).toBeDefined();
    expect(diffSettings({ ...base, speed_alerts_enabled: true }, saved).errors.speed_limit_kmh).toMatch(/limite de vitesse/);
    expect(diffSettings({ ...base, speed_alerts_enabled: true, speed_limit_kmh: '90' }, saved).changes).toEqual({ speed_alerts_enabled: true, speed_limit_kmh: 90 });
    expect(diffSettings({ ...base, quiet_hours_start: '25:61' }, saved).errors.quiet_hours_start).toBeDefined();
    expect(diffSettings({ ...base, legal_basis: 'CONSENT', customers_informed: true }, saved).changes).toEqual({ legal_basis: 'CONSENT', customers_informed: true });
  });

  it('administrateur : modification enregistrée (clés modifiées seulement) ; avertissement de conformité sans aucune affirmation de conformité', async () => {
    const user = userEvent.setup();
    routeApi({ '/settings': { data: settings(), meta: {} }, '/support-grants': { data: { grants: [] }, meta: {} }, 'PATCH /settings': { data: settings({ retention_days: 30 }), meta: {} } });
    wrap(<TrackingSettingsPanel />);
    const retention = await screen.findByLabelText('Positions (jours)');
    expect(screen.getByText(/ne certifie aucune conformité/)).toBeInTheDocument();
    expect(screen.getByText(/Aucun accès de support/)).toBeInTheDocument();
    expect(screen.getByText(/Ce véhicule est équipé d’un dispositif de géolocalisation \(boîtier GPS\) installé par Agence Test/)).toBeInTheDocument();
    await user.clear(retention);
    await user.type(retention, '30');
    expect(screen.getByText('1 modification(s) non enregistrée(s)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/settings', { method: 'PATCH', body: { retention_days: 30 }, agencyId: null }));
    expect(await screen.findByText('Paramètres enregistrés.')).toBeInTheDocument();
  });

  it('valeur invalide : message affiché dès la saisie, enregistrement bloqué, aucune requête', async () => {
    const user = userEvent.setup();
    routeApi({ '/settings': { data: settings(), meta: {} }, '/support-grants': { data: { grants: [] }, meta: {} } });
    wrap(<TrackingSettingsPanel />);
    const retention = await screen.findByLabelText('Positions (jours)');
    await user.clear(retention);
    await user.type(retention, '2');
    expect(await screen.findByText('Conservation des positions : 7 à 730 jours.')).toBeInTheDocument();
    expect(retention).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(mocks.api.mock.calls.some(([, r]) => r?.method === 'PATCH')).toBe(false);
    await user.clear(retention);
    await user.type(retention, '45');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('sans tracking.settings.manage : champs en lecture seule, pas de barre d’enregistrement, pas de liste des accès de support', async () => {
    routeApi({ '/settings': { data: settings(), meta: {} } });
    wrap(<TrackingSettingsPanel />, { settings: false });
    const retention = await screen.findByLabelText('Positions (jours)');
    expect(retention).toBeDisabled();
    expect(screen.getByText(/Seul un administrateur de l’agence peut modifier/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
    expect(mocks.api.mock.calls.some(([p]) => p === '/support-grants')).toBe(false);
  });

  it('accès de support actif : visible et révocable après confirmation', async () => {
    const user = userEvent.setup();
    const grant = { id: 'gr1', reason: 'Ticket #4512 : localisation', starts_at: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 20 * 60_000).toISOString(), revoked_at: null };
    routeApi({ '/settings': { data: settings(), meta: {} }, '/support-grants': { data: { grants: [grant] }, meta: {} }, 'DELETE /support-grants/gr1': { data: { revoked: true }, meta: {} } });
    wrap(<TrackingSettingsPanel />);
    expect(await screen.findByText('Ticket #4512 : localisation')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 accès de support actif');
    await user.click(screen.getByRole('button', { name: 'Révoquer' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Révoquer' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/support-grants/gr1', { method: 'DELETE', agencyId: null }));
  });
});
