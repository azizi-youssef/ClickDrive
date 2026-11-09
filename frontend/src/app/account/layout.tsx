import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { I18nScope } from '@/components/i18n/I18nScope';
import { redirectLocalized } from '@/lib/i18n/server';
import { getServerAuth } from '@/lib/auth/server';
import { portalForRole, PORTAL_DEFAULT_REDIRECT, loginUrl } from '@/lib/auth/login-portals';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth) {
    return redirectLocalized(loginUrl('client', { redirect: PORTAL_DEFAULT_REDIRECT.client }));
  }

  const portal = portalForRole(auth.role);
  if (portal !== 'client') {
    if (portal) redirect(PORTAL_DEFAULT_REDIRECT[portal]);
    return redirectLocalized(loginUrl('client', { error: 'forbidden' }));
  }

  // Espace client traduit : demandes, suivi, avis, points de rendez-vous
  return <I18nScope namespaces={['account', 'tracking', 'booking']}>{children}</I18nScope>;
}
