// @vitest-environment jsdom
import '@/tests/setup/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrackingRealtime, type PositionPatch, type RealtimeClientLike, type RealtimeStatus } from './tracking-realtime';

const AGENCY = '10000000-0000-4000-8000-00000000000a';

function setup(overrides: Partial<Parameters<typeof createTrackingRealtime>[1]> = {}) {
  const handlers: { filter: Record<string, unknown>; callback: (payload: { eventType?: string; new?: unknown }) => void }[] = [];
  let statusCallback: ((status: string) => void) | null = null;
  const channel = {
    on: vi.fn((_type: 'postgres_changes', filter: Record<string, unknown>, callback: (payload: { eventType?: string; new?: unknown }) => void) => {
      handlers.push({ filter, callback });
      return channel;
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      statusCallback = callback;
    }),
  };
  const client: RealtimeClientLike = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  const statuses: RealtimeStatus[] = [];
  const onPositions = vi.fn<(patches: PositionPatch[]) => void>();
  const onAlertChange = vi.fn();
  const onResync = vi.fn();
  const controller = createTrackingRealtime(client, {
    agencyId: AGENCY,
    onPositions,
    onAlertChange,
    onResync,
    onStatus: (status) => statuses.push(status),
    ...overrides,
  });
  const row = (id: string, recordedAt: string, extra: Record<string, unknown> = {}) => ({
    vehicle_id: id, latitude: 35.1, longitude: -2.9, speed_kmh: 30, heading_deg: 90, ignition: true, accuracy_m: 4, recorded_at: recordedAt, movement_state: 'MOVING', ...extra,
  });
  return { client, channel, handlers, controller, statuses, onPositions, onAlertChange, onResync, emitStatus: (s: string) => statusCallback!(s), row };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('temps réel du suivi GPS', () => {
  it('s’abonne uniquement aux dernières positions et aux alertes de l’agence (jamais à l’historique)', () => {
    const { client, handlers, controller } = setup();
    controller.start();
    expect(client.channel).toHaveBeenCalledWith(`tracking-${AGENCY}`);
    expect(handlers.map((h) => h.filter)).toEqual([
      { event: '*', schema: 'public', table: 'vehicle_tracking_latest', filter: `agency_id=eq.${AGENCY}` },
      { event: '*', schema: 'public', table: 'tracking_alerts', filter: `agency_id=eq.${AGENCY}` },
    ]);
  });

  it('états de connexion : connexion → direct → reconnexion → direct (avec rechargement complet après coupure seulement)', () => {
    const { controller, statuses, emitStatus, onResync } = setup();
    controller.start();
    emitStatus('SUBSCRIBED');
    expect(onResync).not.toHaveBeenCalled();
    emitStatus('CHANNEL_ERROR');
    emitStatus('SUBSCRIBED');
    expect(statuses).toEqual(['connecting', 'live', 'reconnecting', 'live']);
    expect(onResync).toHaveBeenCalledTimes(1);
    emitStatus('TIMED_OUT');
    emitStatus('CLOSED');
    emitStatus('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  it('regroupe les positions : un seul rendu par lot, la plus récente par véhicule, jamais une plus ancienne', () => {
    const { controller, handlers, onPositions, row } = setup({ batchMs: 400 });
    controller.start();
    const positions = handlers[0]!.callback;
    positions({ eventType: 'UPDATE', new: row('v1', '2026-11-14T10:00:10Z', { latitude: 35.11 }) });
    positions({ eventType: 'UPDATE', new: row('v1', '2026-11-14T10:00:20Z', { latitude: 35.12 }) });
    positions({ eventType: 'UPDATE', new: row('v1', '2026-11-14T10:00:05Z', { latitude: 35.99 }) }); // plus ancienne : ignorée
    positions({ eventType: 'INSERT', new: row('v2', '2026-11-14T10:00:15Z') });
    expect(onPositions).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(onPositions).toHaveBeenCalledTimes(1);
    const patches = onPositions.mock.calls[0]![0];
    expect(patches).toHaveLength(2);
    expect(patches.find((p) => p.vehicle_id === 'v1')).toMatchObject({ latitude: 35.12, recorded_at: '2026-11-14T10:00:20Z' });
  });

  it('ignore les lignes invalides et recharge entièrement sur une suppression (clé primaire seule)', () => {
    const { controller, handlers, onPositions, onResync, row } = setup();
    controller.start();
    handlers[0]!.callback({ eventType: 'UPDATE', new: { vehicle_id: 'v1' } });
    handlers[0]!.callback({ eventType: 'UPDATE', new: row('v1', '2026-11-14T10:00:10Z', { latitude: 'x' }) });
    handlers[0]!.callback({ eventType: 'UPDATE', new: null });
    vi.advanceTimersByTime(1000);
    expect(onPositions).not.toHaveBeenCalled();
    handlers[0]!.callback({ eventType: 'DELETE', new: {} });
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('les changements d’alertes sont signalés', () => {
    const { controller, handlers, onAlertChange } = setup();
    controller.start();
    handlers[1]!.callback({ eventType: 'INSERT', new: { id: 'a1' } });
    expect(onAlertChange).toHaveBeenCalledTimes(1);
  });

  it('interrogation de secours toutes les 15 s tant que le temps réel est indisponible, lente (60 s) quand il fonctionne', () => {
    const { controller, emitStatus, onResync } = setup({ fallbackPollMs: 15_000, heartbeatMs: 60_000 });
    controller.start();
    vi.advanceTimersByTime(15_000);
    expect(onResync).toHaveBeenCalledTimes(1); // pas encore connecté : secours
    emitStatus('SUBSCRIBED');
    onResync.mockClear();
    vi.advanceTimersByTime(59_000);
    expect(onResync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onResync).toHaveBeenCalledTimes(1);
    onResync.mockClear();
    emitStatus('CHANNEL_ERROR');
    vi.advanceTimersByTime(30_000);
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  it('onglet masqué : aucune interrogation ; retour sur l’onglet : rechargement', () => {
    const { controller, onResync } = setup({ fallbackPollMs: 15_000 });
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    controller.start();
    vi.advanceTimersByTime(60_000);
    expect(onResync).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('nettoyage : canal retiré, minuteries arrêtées, lot en attente abandonné, plus aucun rappel', () => {
    const { controller, client, channel, handlers, onPositions, onResync, row } = setup();
    controller.start();
    handlers[0]!.callback({ eventType: 'UPDATE', new: row('v1', '2026-11-14T10:00:10Z') });
    controller.stop();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
    vi.advanceTimersByTime(10 * 60_000);
    expect(onPositions).not.toHaveBeenCalled();
    expect(onResync).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResync).not.toHaveBeenCalled();
  });

  it('sans client temps réel : état « reconnexion » explicite et interrogation seule (aucune donnée simulée)', () => {
    const onResync = vi.fn();
    const statuses: RealtimeStatus[] = [];
    const controller = createTrackingRealtime(null, { agencyId: AGENCY, onPositions: vi.fn(), onResync, onStatus: (s) => statuses.push(s) });
    controller.start();
    expect(statuses).toEqual(['reconnecting']);
    vi.advanceTimersByTime(15_000);
    expect(onResync).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('un démarrage répété ne crée pas un second canal', () => {
    const { controller, client } = setup();
    controller.start();
    controller.start();
    expect(client.channel).toHaveBeenCalledTimes(1);
  });
});
