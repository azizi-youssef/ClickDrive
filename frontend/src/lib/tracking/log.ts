/**
 * Journalisation structurée du suivi GPS (une ligne JSON par événement).
 * Jamais de coordonnées, de signature, de secret, de charge utile ni de donnée de locataire : seuls des
 * compteurs, des codes de raison et des identifiants techniques sont journalisés.
 */

type Level = 'info' | 'warn' | 'error';

const FORBIDDEN_KEYS = /lat|lon|coord|secret|signature|payload|body|token|password|authorization|email|phone/i;

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    clean[key] = typeof value === 'string' && value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  return clean;
}

export function trackingLog(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), scope: 'tracking', level, event, ...sanitize(fields) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
