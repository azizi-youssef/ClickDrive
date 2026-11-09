import type { AnalyticsEvent } from './config';

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Props }) => void;
  }
}

/** Événement côté navigateur ; sans effet si la mesure est désactivée ou bloquée */
export function track(event: AnalyticsEvent, props?: Props): void {
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* la mesure ne doit jamais gêner le parcours */
  }
}
