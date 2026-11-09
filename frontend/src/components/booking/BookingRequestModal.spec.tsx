// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingRequestModal } from './BookingRequestModal';
import { testVehicle } from '@/tests/fixtures/vehicle';

function renderModal(onClose = vi.fn()) {
  render(
    <BookingRequestModal
      vehicle={testVehicle()}
      isOpen
      onClose={onClose}
      defaultStartDate="2026-12-01"
      defaultEndDate="2026-12-04"
      defaultLocation="Aéroport Nador Al-Aroui (NDR)"
      defaultPickupTime="10:00"
      defaultDropoffTime="10:00"
      defaultDropoffLocation="Aéroport Nador Al-Aroui (NDR)"
    />
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Dacia Sandero 2024' }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BookingRequestModal — accessibilité du formulaire', () => {
  it('dialogue modal nommé par le véhicule, étapes annoncées, focus sur le prénom', async () => {
    const { dialog } = renderModal();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Région polie annonçant l'étape courante aux lecteurs d'écran
    expect(screen.getByText('Étape 1 sur 4 : Vos coordonnées')).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(within(dialog).getByLabelText(/Prénom/)).toHaveFocus());
    expect(within(dialog).getByRole('button', { name: 'Fermer la demande de réservation' })).toBeInTheDocument();
  });

  it('étape incomplète : erreurs reliées aux champs et focus sur le premier champ invalide', async () => {
    const user = userEvent.setup();
    const { dialog } = renderModal();
    await waitFor(() => expect(within(dialog).getByLabelText(/Prénom/)).toHaveFocus());

    await user.click(within(dialog).getByRole('button', { name: /Continuer/ }));

    const firstName = within(dialog).getByLabelText(/Prénom/);
    await waitFor(() => expect(firstName).toHaveFocus());
    expect(firstName).toHaveAttribute('aria-invalid', 'true');
    expect(firstName).toHaveAccessibleDescription('Saisissez votre prénom (2 caractères minimum).');
    expect(within(dialog).getByText(/champs à corriger/)).toBeInTheDocument();
  });

  it('aucun envoi tant que l’étape 1 n’est pas valide', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { dialog } = renderModal();

    await user.click(within(dialog).getByRole('button', { name: /Continuer/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('heading', { name: 'Vos coordonnées et votre permis' })).toBeInTheDocument();
  });

  it('Échap appelle onClose', async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = renderModal();
    await waitFor(() => expect(within(dialog).getByLabelText(/Prénom/)).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
