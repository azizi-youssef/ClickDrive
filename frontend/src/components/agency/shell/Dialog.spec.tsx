// @vitest-environment jsdom
import '@/tests/setup/dom';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, Modal } from './Dialog';

describe('ConfirmDialog — confirmation des actions irréversibles', () => {
  it('action destructive : alertdialog nommé et décrit, focus sur « Annuler »', async () => {
    render(
      <ConfirmDialog
        title="Révoquer ce membre ?"
        message="Il perdra immédiatement l’accès à l’espace agence."
        confirmLabel="Révoquer"
        destructive
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Révoquer ce membre ?' });
    expect(dialog).toHaveAccessibleDescription('Il perdra immédiatement l’accès à l’espace agence.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus());
  });

  it('motif obligatoire : confirmation impossible tant que le motif est vide', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function WithReason() {
      const [reason, setReason] = useState('');
      return (
        <ConfirmDialog
          title="Suspendre l’agence ?"
          message="Ses véhicules seront retirés du catalogue."
          confirmLabel="Suspendre"
          reason={reason}
          onReasonChange={setReason}
          reasonLabel="Motif de la suspension"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      );
    }
    render(<WithReason />);
    const confirm = screen.getByRole('button', { name: 'Suspendre' });
    expect(confirm).toBeDisabled();

    const reason = screen.getByRole('textbox', { name: 'Motif de la suspension' });
    await user.type(reason, 'Documents expirés');
    // Le parent se ré-affiche à chaque frappe : le focus doit rester dans le champ
    expect(reason).toHaveFocus();
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Échap annule, sauf pendant le traitement', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog title="Supprimer ?" message="Action définitive." confirmLabel="Supprimer" busy onConfirm={() => undefined} onCancel={onCancel} />
    );
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Traitement…' })).toBeDisabled();

    rerender(
      <ConfirmDialog title="Supprimer ?" message="Action définitive." confirmLabel="Supprimer" onConfirm={() => undefined} onCancel={onCancel} />
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Modal — boîte de dialogue générique', () => {
  it('titre et description reliés, bouton de fermeture nommé, focus rendu à l’ouverture', async () => {
    const user = userEvent.setup();
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Voir la réservation
          </button>
          {open && (
            <Modal title="Réservation KD-1234" description="Demande reçue le 7 novembre" onClose={() => setOpen(false)}>
              <p>Contenu</p>
            </Modal>
          )}
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Voir la réservation' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Réservation KD-1234' });
    expect(dialog).toHaveAccessibleDescription('Demande reçue le 7 novembre');
    const close = screen.getByRole('button', { name: 'Fermer' });
    await waitFor(() => expect(close).toHaveFocus());

    await user.click(close);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('Modal — téléphone', () => {
  it('les actions du pied restent visibles : pied collé en bas de la zone qui défile, encoche comprise', () => {
    render(
      <Modal title="Dossier" onClose={() => undefined} footer={<button type="button">Approuver</button>}>
        <p>Contenu long</p>
      </Modal>
    );
    const footer = screen.getByRole('button', { name: 'Approuver' }).parentElement!;
    expect(footer.className).toMatch(/\bsticky\b/);
    expect(footer.className).toMatch(/\bbottom-0\b/);
    expect(footer.className).toContain('safe-area-inset-bottom');
  });
});
