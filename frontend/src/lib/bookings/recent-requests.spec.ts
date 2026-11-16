// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECENT_REQUESTS_KEY,
  forgetRecentRequests,
  liveRecentRequests,
  recentRequestsStore,
  rememberRecentRequest,
} from './recent-requests';

const DAY = 24 * 60 * 60 * 1000;
const path = (ref: string) => `/suivi/${ref}?exp=1999999999&sig=abc_DEF-123`;
const entry = (ref: string) => ({ reference: ref, trackingPath: path(ref), vehicle: 'Dacia Logan 2025', startDate: '2026-11-20', endDate: '2026-11-23' });

beforeEach(() => {
  window.localStorage.clear();
  forgetRecentRequests();
});

describe('Demandes envoyées sans compte depuis cet appareil', () => {
  it('mémorisée avec son lien signé, la plus récente d’abord, sans doublon', () => {
    rememberRecentRequest(entry('CD-2026-000001'), 1_000);
    rememberRecentRequest(entry('CD-2026-000002'), 2_000);
    rememberRecentRequest(entry('CD-2026-000001'), 3_000);
    const items = liveRecentRequests(recentRequestsStore.read(), 3_000);
    expect(items.map((item) => item.reference)).toEqual(['CD-2026-000001', 'CD-2026-000002']);
    expect(JSON.parse(window.localStorage.getItem(RECENT_REQUESTS_KEY) ?? '[]')).toHaveLength(2);
  });

  it('cinq au plus', () => {
    for (let i = 1; i <= 7; i += 1) rememberRecentRequest(entry(`CD-2026-00000${i}`), i * 1_000);
    expect(liveRecentRequests(recentRequestsStore.read(), 8_000)).toHaveLength(5);
  });

  it('lien non signé (repli vers le compte) : rien n’est gardé', () => {
    rememberRecentRequest({ ...entry('CD-2026-000003'), trackingPath: '/account/bookings/CD-2026-000003' });
    expect(recentRequestsStore.read()).toEqual([]);
  });

  it('au-delà de la validité du lien (120 jours) : retirée de la liste', () => {
    rememberRecentRequest(entry('CD-2026-000004'), 0);
    expect(liveRecentRequests(recentRequestsStore.read(), 119 * DAY)).toHaveLength(1);
    expect(liveRecentRequests(recentRequestsStore.read(), 121 * DAY)).toHaveLength(0);
  });

  it('stockage modifié à la main ou corrompu : entrées invalides ignorées', () => {
    window.localStorage.setItem(
      RECENT_REQUESTS_KEY,
      JSON.stringify([{ reference: 'X', trackingPath: 'https://evil.example/suivi/X?exp=1&sig=a', vehicle: 'x', startDate: 'a', endDate: 'b', savedAt: 1 }, 42])
    );
    expect(recentRequestsStore.read()).toEqual([]);
    window.localStorage.setItem(RECENT_REQUESTS_KEY, '{pas du json');
    expect(recentRequestsStore.read()).toEqual([]);
  });

  it('« Effacer de cet appareil » vide la liste', () => {
    rememberRecentRequest(entry('CD-2026-000005'));
    forgetRecentRequests();
    expect(recentRequestsStore.read()).toEqual([]);
  });
});
