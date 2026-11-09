import type { Messages } from './messages';

type WithVehicle = Pick<Messages, 'vehicle'>;

type MeetingPointText = { name: string; shortName: string; badgeLabel: string; instructions: string };

/**
 * Textes d'un point de rendez-vous dans la langue de la page. Sans dictionnaire de réservation
 * (page qui ne le charge pas), les textes d'origine sont gardés ; un lieu libre garde son nom.
 */
export function meetingPointText(
  t: Partial<Pick<Messages, 'booking'>>,
  point: { id: string; name: string; shortName: string; badgeLabel: string; instructions: string }
): MeetingPointText {
  const copy = t.booking?.points[point.id];
  if (!copy) return point;
  return {
    name: copy.name || point.name,
    shortName: copy.shortName || point.shortName,
    badgeLabel: copy.badgeLabel,
    instructions: copy.instructions,
  };
}

/**
 * Libellés traduits des valeurs enregistrées en base. Une valeur inconnue (saisie libre d'une agence)
 * est affichée telle quelle plutôt que masquée.
 */
export function categoryLabel(t: WithVehicle, value: string | null | undefined): string {
  if (!value) return '';
  return t.vehicle.categories[value] ?? value;
}

export function fuelLabel(t: WithVehicle, value: string | null | undefined): string {
  if (!value) return '';
  return t.vehicle.fuel[value] ?? value;
}

export function transmissionLabel(t: WithVehicle, value: string | null | undefined): string {
  if (!value) return '';
  return t.vehicle.transmission[value] ?? value;
}

/** Lieu de prise en charge : la valeur enregistrée (français) reste celle des URL et de la base */
export function locationLabel(t: WithVehicle, value: string | null | undefined): string {
  if (!value) return '';
  return t.vehicle.locations[value] ?? value;
}

export function featureLabel(t: WithVehicle, value: string): string {
  return t.vehicle.features[value] ?? value;
}

export function licenseLabel(t: WithVehicle, value: string | null | undefined): string {
  if (!value) return '';
  return t.vehicle.licenses[value] ?? value;
}
