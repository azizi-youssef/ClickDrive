// @vitest-environment jsdom
import '@/tests/setup/dom';
import { cleanup, render, screen, waitFor } from '@/tests/setup/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agencyReportJson } from '@/tests/fixtures/analytics-report';

/**
 * Plan des titres de l'espace agence (lecteurs d'écran, navigation par titres) : un seul h1 par écran,
 * aucun niveau sauté, aucun titre qui répète celui de la page, et les styles de l'échelle commune
 * (jetons `heading` de lib/design/tokens).
 */

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (callback: () => void) => {
    window.addEventListener('locationchange', callback);
    window.addEventListener('popstate', callback);
    return () => {
      window.removeEventListener('locationchange', callback);
      window.removeEventListener('popstate', callback);
    };
  };
  return {
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/agency',
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search, () => '')),
  };
});
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/auth/client', () => ({ signOutEverywhere: vi.fn() }));
vi.mock('@/lib/supabase/realtime', () => ({ useRealtimeRefresh: () => undefined, notifyRealtimeChange: () => undefined }));

import { AgencyWorkspace } from './AgencyWorkspace';

const BOOKING = {
  id: 'b1', booking_ref: 'CD-2611-0041', reference: null, vehicle_id: 'v1', customer_name: 'Mohamed El Amrani', customer_phone: '+212612345678',
  customer_email: 'c@example.invalid', start_date: '2026-11-18', end_date: '2026-11-21', total_days: 3, total_price: 1200, commission_rate: 0,
  commission_amount: 0, agency_amount: 1200, status: 'REQUESTED', created_at: '2026-11-14T09:00:00Z', pickup_location: 'Aéroport Nador Al-Aroui',
  vehicle: { id: 'v1', brand: 'Dacia', model: 'Logan', category: 'Économique' },
};
const VEHICLE = {
  id: 'v1', vehicle_type: 'CAR', brand: 'Dacia', model: 'Logan', year: 2024, category: 'Économique', transmission: 'MANUAL', fuel: 'DIESEL', seats: 5,
  doors: 5, air_conditioning: true, mileage: 18500, daily_price: 350, deposit: 3000, min_rental_days: 1, status: 'AVAILABLE', published: true,
  license_plate: '12345-A-1', unit_number: 'A-1', images: [], features: [], created_at: '2026-01-01T00:00:00Z',
};
const SUBSCRIPTION = {
  id: 's1', agency_id: 'demo', plan: { name: 'Pro', slug: 'pro', price_monthly: 400, max_vehicles: 25 }, status: 'ACTIVE', current_vehicles_count: 4,
  vehicle_capacity: 25, capacity_usage_pct: 16, is_at_capacity: false, can_add_vehicle: true, price_monthly: 400, billing_cycle_end: '2026-12-01',
  billing_cycle_start: '2026-11-01', days_remaining: 16,
};

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const p = new URL(String(input), 'http://localhost').pathname;
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (p.endsWith('/analytics')) return json({ success: true, data: agencyReportJson() });
      if (p.endsWith('/dashboard')) {
        return json({ data: { stats: { totalVehicles: 4, availableVehicles: 2, reservedVehicles: 0, rentedVehicles: 2, maintenanceVehicles: 0, pendingBookings: 1, confirmedBookings: 3, completedBookings: 9, cancelledBookings: 1, grossRevenue: 24000, occupancyRate: 50 }, agenda: { upcomingPickups: [], upcomingReturns: [], recentActivity: [] } } });
      }
      if (p.endsWith('/subscription')) return json({ success: true, data: SUBSCRIPTION });
      if (/\/bookings$/.test(p)) return json({ success: true, data: [BOOKING], meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 } });
      if (/\/vehicles$/.test(p)) return json({ success: true, data: [VEHICLE], meta: { page: 1, total: 1, totalPages: 1, typeCounts: { CAR: 1, MOTORCYCLE: 0 } } });
      if (p.endsWith('/calendar')) {
        return json({ success: true, data: { vehicles: [{ id: 'v1', brand: 'Dacia', model: 'Logan', licensePlate: '12345-A-1', category: 'Économique', status: 'AVAILABLE', dailyPrice: 350, primaryImage: null }], events: [] } });
      }
      if (p.endsWith('/finances')) {
        return json({ success: true, data: { subscription: SUBSCRIPTION, kpis: { revenue: 24000, settledRevenue: 18000, pendingRevenue: 6000, totalBookingsCount: 4, completedBookingsCount: 3 }, transactions: [] } });
      }
      if (p.startsWith('/api/bookings/')) return json({ booking: { ...BOOKING, events: [] } });
      return json({ success: true, data: [] });
    })
  );
}

const SECTIONS = ['overview', 'bookings', 'rentals', 'calendar', 'fleet', 'subscription', 'customers', 'finances', 'analytics', 'access', 'settings'];

type Heading = { level: number; text: string; className: string };

async function outline(search: string, scopeSelector: string): Promise<Heading[]> {
  stubApi();
  window.history.replaceState(null, '', `/agency${search}`);
  render(
    <AgencyWorkspace
      agency={{ id: 'demo', name: 'Atlas Rent Nador', verified: true, logoUrl: null }}
      profile={{ role: 'AGENCY_OWNER', email: 'g@example.invalid', displayName: 'Youssef', avatarUrl: null }}
    />
  );
  await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0));
  // Les panneaux chargent leurs données après l'affichage : on laisse les requêtes simulées aboutir
  await new Promise((resolve) => setTimeout(resolve, 600));
  const scope = document.querySelector(scopeSelector) ?? document.body;
  return [...scope.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter((h) => !h.closest('.sr-only'))
    .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent ?? '').replace(/\s+/g, ' ').trim(), className: h.getAttribute('class') ?? '' }));
}

/** Niveaux sautés : un titre plus de un niveau sous le précédent */
function skips(headings: Heading[], startLevel: number): string[] {
  const problems: string[] = [];
  let previous = startLevel;
  for (const heading of headings) {
    if (heading.level > previous + 1) problems.push(`h${previous} → h${heading.level} « ${heading.text} »`);
    previous = heading.level;
  }
  return problems;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Plan des titres de l’espace agence', () => {
  it.each(SECTIONS)('%s : un seul h1, aucun niveau sauté, aucun titre qui répète celui de la page', { timeout: 30_000 }, async (section) => {
    const headings = await outline(`?section=${section}`, 'main');
    const h1 = headings.filter((h) => h.level === 1);
    expect(h1).toHaveLength(1);
    expect(skips(headings, 0)).toEqual([]);
    const pageTitle = h1[0].text.toLowerCase();
    expect(headings.filter((h) => h.level > 1 && h.text.toLowerCase() === pageTitle).map((h) => h.text)).toEqual([]);
  });

  it('les titres de page suivent l’échelle commune (jeton heading.page) et la couleur unique', { timeout: 30_000 }, async () => {
    const headings = await outline('?section=overview', 'main');
    for (const heading of headings) {
      expect(heading.className).not.toMatch(/text-\[#0F172A\]|text-slate-900|text-slate-800/);
    }
    expect(headings[0].className).toMatch(/\btext-ink\b.*\bsm:text-\[32px\]|\bsm:text-\[32px\].*\btext-ink\b/);
  });

  it('fiche de réservation : titre de fenêtre puis sous-titres, sans valeur promue en titre', { timeout: 30_000 }, async () => {
    const headings = await outline('?section=bookings&booking=CD-2611-0041', '[role=dialog]');
    expect(headings[0]).toMatchObject({ level: 2, text: 'Dossier CD-2611-0041' });
    expect(skips(headings.slice(1), 2)).toEqual([]);
    expect(headings.map((h) => h.text)).not.toContain('Mohamed El Amrani');
    expect(headings.map((h) => h.text)).not.toContain('Dacia Logan');
  });
});
