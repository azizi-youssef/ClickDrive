// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AgencySubscription } from '@/types';
import { FleetCapacityCard } from './FleetCapacityCard';

const subscription = (overrides: Partial<AgencySubscription> = {}) =>
  ({
    id: 's1',
    agency_id: 'ag-1',
    plan: { name: 'Pro' },
    status: 'ACTIVE',
    current_vehicles_count: 12,
    vehicle_capacity: 30,
    capacity_usage_pct: 40,
    is_at_capacity: false,
    can_add_vehicle: true,
    ...overrides,
  }) as AgencySubscription;

const setup = (props: Partial<React.ComponentProps<typeof FleetCapacityCard>> = {}) => {
  const onRetry = vi.fn();
  const onOpenUpgradeModal = vi.fn();
  const view = render(<FleetCapacityCard subscription={null} onRetry={onRetry} onOpenUpgradeModal={onOpenUpgradeModal} {...props} />);
  return { ...view, onRetry, onOpenUpgradeModal };
};

describe('Carte de capacité du parc — jamais de cadre d’attente indéfini', () => {
  it('lecture en cours, rien à afficher encore : un cadre d’attente annoncé, sans animation si l’utilisateur la refuse', () => {
    setup({ loading: true });
    const status = screen.getByRole('status', { name: 'Chargement de la capacité du parc' });
    expect(status.className).toMatch(/motion-reduce:animate-none/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lecture terminée en échec : le cadre disparaît, un message et « Réessayer » le remplacent', async () => {
    const user = userEvent.setup();
    const { onRetry } = setup({ loading: false, error: true });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('La capacité de votre parc n’a pas pu être chargée.');
    await user.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lecture terminée sans donnée et sans erreur : rien (ni cadre, ni message)', () => {
    const { container } = setup({ loading: false, error: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('pendant une relecture, la formule déjà connue reste affichée (pas de clignotement vers le cadre gris)', () => {
    setup({ subscription: subscription(), loading: true });
    expect(screen.getByText('Capacité du parc')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Chargement de la capacité du parc' })).not.toBeInTheDocument();
  });

  it('une formule affichée prime sur une erreur ancienne', () => {
    setup({ subscription: subscription(), error: true });
    expect(screen.getByText('Forfait Pro')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('capacité atteinte : l’action d’augmentation reste proposée', async () => {
    const user = userEvent.setup();
    const { onOpenUpgradeModal } = setup({ subscription: subscription({ is_at_capacity: true }) });
    await user.click(screen.getByRole('button', { name: /Augmenter ma capacité/ }));
    expect(onOpenUpgradeModal).toHaveBeenCalled();
  });
});
