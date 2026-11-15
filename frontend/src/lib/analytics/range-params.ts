import { rangeError } from './insights';

/**
 * Lecture des paramètres `from` / `to` (AAAA-MM-JJ) des routes de statistiques. Absents : la base
 * applique ses valeurs par défaut (30 derniers jours, heure du Maroc).
 */
export type RangeParams = { ok: true; range: { from?: string; to?: string } } | { ok: false; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Date de calendrier réelle (refuse 2026-02-31) */
function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function readRangeParams(params: URLSearchParams): RangeParams {
  const from = params.get('from');
  const to = params.get('to');
  if (from !== null && !isCalendarDate(from)) return { ok: false, error: 'Date de début invalide.' };
  if (to !== null && !isCalendarDate(to)) return { ok: false, error: 'Date de fin invalide.' };
  if (from && to) {
    const error = rangeError(from, to);
    if (error) return { ok: false, error };
  }
  return { ok: true, range: { from: from ?? undefined, to: to ?? undefined } };
}
