const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDateDays(value: string, days: number): string {
  if (!isValidDateOnly(value) || !Number.isInteger(days)) {
    throw new RangeError('Une date YYYY-MM-DD valide et un nombre entier de jours sont requis.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCDate(date.getUTCDate() + days);

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function getEffectiveRentalDates(
  startDate: string,
  endDate: string,
  today: string
): { startDate: string; endDate: string } {
  if (!isValidDateOnly(today)) {
    return { startDate, endDate };
  }

  const effectiveStartDate =
    isValidDateOnly(startDate) && startDate >= today ? startDate : today;
  const effectiveEndDate =
    isValidDateOnly(endDate) && endDate > effectiveStartDate
      ? endDate
      : addDateDays(effectiveStartDate, 3);

  return { startDate: effectiveStartDate, endDate: effectiveEndDate };
}

/** Période de location (dates AAAA-MM-JJ, retour exclu du décompte des jours) */
export type RentalPeriod = { startDate: string; endDate: string };

/**
 * Période lue dans une adresse (?startDate=…&endDate=…) : retenue seulement si les deux dates sont
 * valides et le retour postérieur au départ. La comparaison avec « aujourd'hui » reste à l'appelant
 * (getEffectiveRentalDates), qui connaît la date locale du visiteur.
 */
export function parseRentalPeriod(startDate: unknown, endDate: unknown): RentalPeriod | undefined {
  if (typeof startDate !== 'string' || typeof endDate !== 'string') return undefined;
  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate) || endDate <= startDate) return undefined;
  return { startDate, endDate };
}

/** Paramètres d'adresse d'une période (« ?startDate=…&endDate=… »), ou chaîne vide si elle est invalide */
export function rentalPeriodQuery(period: RentalPeriod | null | undefined): string {
  const valid = period ? parseRentalPeriod(period.startDate, period.endDate) : undefined;
  return valid ? `?${new URLSearchParams(valid).toString()}` : '';
}
