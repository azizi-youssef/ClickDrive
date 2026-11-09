// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminFinanceClient } from './AdminFinanceClient';

const plans = [
  { id: 'p1', slug: 'starter', name: 'Starter', price_monthly: 300 },
  { id: 'p2', slug: 'pro', name: 'Pro', price_monthly: 400 },
];

const subscription = {
  id: 's1',
  agency_id: 'a1',
  agency_name: 'Agence Test',
  plan: plans[0],
  status: 'PAST_DUE',
  current_vehicles_count: 3,
  vehicle_capacity: 15,
  capacity_usage_pct: 20,
  is_at_capacity: false,
  price_monthly: 300,
  billing_cycle_end: '2026-12-01',
};

function stubApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/bookings')) return new Response(JSON.stringify({ success: true, bookings: [] }), { status: 200 });
    if (url.startsWith('/api/admin/subscriptions') && init?.method === 'PATCH') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { subscriptions: [subscription], plans } }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const patchCalls = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');

afterEach(() => vi.unstubAllGlobals());

describe('Abonnements — changement de forfait et statuts réels', () => {
  it('statut réel et date lisible : un paiement en retard n’apparaît pas comme actif', async () => {
    stubApi();
    render(<AdminFinanceClient />);
    expect(await screen.findByText('Paiement en retard')).toBeInTheDocument();
    expect(screen.getByText('1 déc. 2026')).toBeInTheDocument();
    expect(screen.queryByText('PAST_DUE')).not.toBeInTheDocument();
  });

  it('changer de forfait demande une confirmation avant toute modification', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    render(<AdminFinanceClient />);

    const select = await screen.findByRole('combobox', { name: 'Changer le forfait de Agence Test' });
    await user.selectOptions(select, 'pro');

    expect(screen.getByRole('dialog', { name: 'Changer le forfait de Agence Test ?' })).toBeInTheDocument();
    expect(patchCalls(fetchMock)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(patchCalls(fetchMock)).toHaveLength(0);

    await user.selectOptions(select, 'pro');
    await user.click(screen.getByRole('button', { name: 'Changer le forfait' }));
    expect(patchCalls(fetchMock)).toHaveLength(1);
    expect(JSON.parse(String((patchCalls(fetchMock)[0]![1] as RequestInit).body))).toEqual({ agencyId: 'a1', planSlug: 'pro' });
  });
});
