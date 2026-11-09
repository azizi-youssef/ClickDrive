import Script from 'next/script';
import { analyticsConfig } from '@/lib/analytics/config';

/**
 * Script Plausible, chargé après l'hydratation (afterInteractive) : aucune balise <script>
 * dans l'arbre React, aucun cookie. Rien n'est chargé sans NEXT_PUBLIC_PLAUSIBLE_DOMAIN.
 */
export function Analytics() {
  const config = analyticsConfig();
  if (!config) return null;
  return <Script id="plausible" src={config.src} data-domain={config.domain} strategy="afterInteractive" />;
}
