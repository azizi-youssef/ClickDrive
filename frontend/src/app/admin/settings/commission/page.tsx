import { permanentRedirect } from 'next/navigation';

/** Ancienne adresse « commission » : la page des abonnements s'appelle désormais /admin/settings/abonnements */
export default function LegacyCommissionSettingsPage() {
  permanentRedirect('/admin/settings/abonnements');
}
