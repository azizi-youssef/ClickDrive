// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { AgencyFleetPanel } from './AgencyFleetPanel';

let subscriptionOk = false;

beforeEach(() => {
  subscriptionOk = false;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url.pathname.endsWith('/subscription')) {
        return subscriptionOk
          ? json({
              success: true,
              data: {
                id: 's1', agency_id: 'ag-1', plan: { name: 'Pro' }, status: 'ACTIVE', current_vehicles_count: 3, vehicle_capacity: 30,
                capacity_usage_pct: 10, is_at_capacity: false, can_add_vehicle: true,
              },
            })
          : json({ success: false, error: 'indisponible' }, 500);
      }
      if (url.pathname === '/api/subscriptions/plans') return json({ success: true, data: [] });
      if (url.pathname.endsWith('/vehicles')) return json({ success: true, data: [], meta: { total: 0, totalPages: 1 } });
      return json({}, 404);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mount = () => render(<AgencyFleetPanel agencyId="ag-1" vehicleType="CAR" canManage onNotify={() => undefined} />);

describe('Flotte — carte de capacité du parc', () => {
  it('abonnement indisponible : message et « Réessayer » (plus de cadre gris permanent) ; la flotte reste consultable', async () => {
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText('La capacité de votre parc n’a pas pu être chargée.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Chargement de la capacité du parc' })).not.toBeInTheDocument();

    subscriptionOk = true;
    await user.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByText('Capacité du parc')).toBeInTheDocument();
    expect(screen.queryByText('La capacité de votre parc n’a pas pu être chargée.')).not.toBeInTheDocument();
  });
});
