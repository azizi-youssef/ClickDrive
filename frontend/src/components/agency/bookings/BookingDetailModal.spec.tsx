// @vitest-environment jsdom
import '@/tests/setup/dom';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';
import { BookingDetailModal, type BookingAction, type BookingDetail } from './BookingDetailModal';

const booking = {
  id: '31000000-0000-4000-8000-000000000001',
  booking_ref: 'CD-2026-755232',
  reference: 'CD-2026-755232',
  status: 'REQUESTED',
  customer_name: 'Client Test',
  start_date: '2026-11-08',
  end_date: '2026-11-11',
  total_price: 900,
  commission_amount: 135,
  agency_amount: 765,
  commission_rate: 15,
  vehicle: { brand: 'Dacia', model: 'Logan' },
} as unknown as BookingDetail;

/** Même composition que AgencyWorkspace : dossier + confirmation séparée pour le refus. */
function Workspace({ runAction }: { runAction: (action: BookingAction, reason?: string) => void }) {
  const [selected, setSelected] = useState<BookingDetail | null>(booking);
  const [pending, setPending] = useState<{ action: BookingAction; reason: string } | null>(null);
  return (
    <>
      <button type="button" onClick={() => setSelected(booking)}>
        Ouvrir le dossier
      </button>
      {selected && (
        <BookingDetailModal
          booking={selected}
          detail={null}
          loadingDetail={false}
          detailError={null}
          canAct
          busy={false}
          alternatives={[]}
          loadingAlternatives={false}
          onClose={() => setSelected(null)}
          onReload={() => undefined}
          onAction={(action, payload) => {
            if (action === 'approve') return runAction(action);
            setPending({ action, reason: payload.reason ?? '' });
          }}
          onDownloadPdf={() => undefined}
        />
      )}
      {pending && (
        <ConfirmDialog
          title="Refuser cette demande ?"
          message="Le client sera informé du refus et du motif saisi."
          confirmLabel="Confirmer le refus"
          destructive
          onCancel={() => setPending(null)}
          onConfirm={() => runAction(pending.action, pending.reason)}
        />
      )}
    </>
  );
}

describe('Refus d’une demande par l’agence', () => {
  it('motif saisi → « Refuser » → confirmation → action envoyée avec le motif', async () => {
    const user = userEvent.setup();
    const runAction = vi.fn();
    render(<Workspace runAction={runAction} />);

    const dossier = screen.getByRole('dialog', { name: 'Dossier CD-2026-755232' });
    await user.type(within(dossier).getByLabelText(/Motif du refus/), 'Véhicule en maintenance');
    await user.click(within(dossier).getByRole('button', { name: 'Refuser' }));

    const confirm = await screen.findByRole('alertdialog', { name: 'Refuser cette demande ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Confirmer le refus' }));
    expect(runAction).toHaveBeenCalledWith('reject', 'Véhicule en maintenance');
  });

  it('sans motif : « Refuser » reste cliquable et explique ce qui manque (focus sur le motif)', async () => {
    const user = userEvent.setup();
    const runAction = vi.fn();
    render(<Workspace runAction={runAction} />);
    const dossier = screen.getByRole('dialog', { name: 'Dossier CD-2026-755232' });

    const refuse = within(dossier).getByRole('button', { name: 'Refuser' });
    expect(refuse).toBeEnabled();
    await user.click(refuse);

    const reason = within(dossier).getByLabelText(/Motif du refus/);
    await waitFor(() => expect(reason).toHaveFocus());
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveAccessibleDescription(/Indiquez le motif du refus/);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(runAction).not.toHaveBeenCalled();
  });

  it('annuler la confirmation laisse le dossier ouvert avec le motif saisi', async () => {
    const user = userEvent.setup();
    render(<Workspace runAction={vi.fn()} />);
    const dossier = screen.getByRole('dialog', { name: 'Dossier CD-2026-755232' });
    const reason = within(dossier).getByLabelText(/Motif du refus/);
    await user.type(reason, 'Indisponible');
    await user.click(within(dossier).getByRole('button', { name: 'Refuser' }));

    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Dossier CD-2026-755232' })).toBeInTheDocument();
    expect(reason).toHaveValue('Indisponible');
  });
});

describe('Montants du dossier', () => {
  it('montant total et net agence, sans taux ni montant de commission', () => {
    render(<Workspace runAction={vi.fn()} />);
    const dossier = screen.getByRole('dialog', { name: 'Dossier CD-2026-755232' });
    expect(within(dossier).getByText('Montant total')).toBeInTheDocument();
    expect(within(dossier).getByText('Net agence')).toBeInTheDocument();
    expect(within(dossier).queryByText(/commission/i)).not.toBeInTheDocument();
    expect(within(dossier).queryByText(/15\s?%/)).not.toBeInTheDocument();
  });
});
