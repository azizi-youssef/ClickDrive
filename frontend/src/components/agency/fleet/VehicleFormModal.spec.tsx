// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VehicleFormModal, type EditableVehicle } from './VehicleFormModal';

const AGENCY_ID = '22222222-2222-4222-8222-222222222222';

/** Fiche existante enregistrée avant la correction : « Climatisation » cochée hors catalogue */
const legacyCar: EditableVehicle = {
  id: '33333333-3333-4333-8333-333333333333',
  vehicle_type: 'CAR',
  brand: 'Dacia',
  model: 'Duster',
  year: 2024,
  category: 'SUV',
  transmission: 'MANUAL',
  fuel: 'DIESEL',
  seats: 5,
  doors: 5,
  air_conditioning: true,
  mileage: 20000,
  daily_price: 400,
  deposit: 3000,
  min_rental_days: 1,
  status: 'AVAILABLE',
  published: true,
  images: [],
  features: ['Climatisation', 'GPS / Navigation'],
};

function renderForm(initialType: 'CAR' | 'MOTORCYCLE' = 'CAR') {
  const onClose = vi.fn();
  render(<VehicleFormModal agencyId={AGENCY_ID} initialType={initialType} onClose={onClose} onSuccess={() => undefined} />);
  return { onClose };
}

describe('VehicleFormModal — formulaire véhicule de l’agence', () => {
  it('dialogue modal nommé, fermeture nommée et focus initial dans le dialogue', async () => {
    renderForm();
    const dialog = screen.getByRole('dialog', { name: 'Ajouter un nouveau véhicule' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = within(dialog).getByRole('button', { name: 'Fermer' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(close).toBeInTheDocument();
  });

  it('étape 1 : chaque champ a un nom accessible', () => {
    renderForm();
    for (const label of [/Marque/, /Modèle/, /Année/, /Catégorie/, /Transmission/, /Carburant/, /Places/, /Portes/, /Kilométrage/, /Immatriculation/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('radiogroup', { name: 'Type de véhicule' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Équipements & Options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Caractéristiques/ })).toHaveAttribute('aria-current', 'step');
  });

  it('moto : cylindrée et permis exigé, sans champ « Portes »', () => {
    renderForm('MOTORCYCLE');
    expect(screen.getByRole('dialog', { name: 'Ajouter une nouvelle moto' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cylindrée/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Permis exigé/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Portes/)).not.toBeInTheDocument();
  });

  it('étapes 2 et 3 : tarifs, photos et publication accessibles au clavier', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: /Tarifs & Conditions/ }));
    // Aucun prix inventé : le champ reste vide tant que l'agence ne l'a pas saisi
    expect(screen.getByLabelText(/Prix par jour/)).toHaveValue(null);
    expect(screen.getByLabelText(/Caution exigée/)).toHaveValue(3000);
    expect(screen.getByLabelText(/Durée minimale/)).toHaveValue(1);

    await user.click(screen.getByRole('button', { name: /Photos & Publication/ }));
    const dropzone = screen.getByRole('button', { name: 'Photos du véhicule' });
    expect(dropzone).toHaveAttribute('tabindex', '0');
    const publish = screen.getByRole('switch', { name: 'Publier immédiatement sur la marketplace' });
    expect(publish).toBeChecked();
    await user.click(publish);
    expect(publish).not.toBeChecked();
  });

  it('nouvelle voiture : aucune valeur inventée (catégorie, kilométrage, équipements)', () => {
    renderForm();
    expect(screen.getByLabelText(/Catégorie/)).toHaveValue('');
    expect(screen.getByLabelText(/Kilométrage/)).toHaveValue(null);
    const features = screen.getByRole('group', { name: 'Équipements & Options' });
    expect(within(features).queryAllByRole('button', { pressed: true })).toHaveLength(0);
    // « Climatisation » n'est plus un équipement coché en coulisse : c'est un réglage visible
    expect(within(features).queryByRole('button', { name: 'Climatisation' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Climatisation')).toHaveValue('yes');
  });

  it('catégorie obligatoire pour une voiture : retour à l’étape 1 avec un message', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/Marque/), 'Dacia');
    await user.type(screen.getByLabelText(/Modèle/), 'Duster');
    await user.click(screen.getByRole('button', { name: /Photos & Publication/ }));
    await user.click(screen.getByRole('button', { name: 'Créer et enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choisissez la catégorie du véhicule');
    expect(screen.getByRole('button', { name: /Caractéristiques/ })).toHaveAttribute('aria-current', 'step');
  });

  it('fiche existante : « Climatisation » visible et retirable ; « Non » la retire des équipements', async () => {
    const user = userEvent.setup();
    render(<VehicleFormModal agencyId={AGENCY_ID} initialVehicle={legacyCar} onClose={() => undefined} onSuccess={() => undefined} />);
    const features = screen.getByRole('group', { name: 'Équipements & Options' });
    expect(within(features).getByRole('button', { name: 'Climatisation' })).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(screen.getByLabelText('Climatisation'), 'no');
    expect(within(features).queryByRole('button', { name: 'Climatisation' })).not.toBeInTheDocument();
    expect(within(features).getByRole('button', { name: 'GPS / Navigation' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Échap ferme le formulaire', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm();
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
