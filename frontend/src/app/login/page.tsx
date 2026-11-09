import type { Metadata } from 'next';
import UnifiedPortalLogin from '@/components/auth/UnifiedPortalLogin';
import { localizedPageMetadata } from '@/lib/i18n/server';
import { I18nScope } from '@/components/i18n/I18nScope';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('login', '/login', { robots: { index: false, follow: true } });
}

export default function LoginPage() {
  return (
    <I18nScope namespaces={['login']}>
      <UnifiedPortalLogin />
    </I18nScope>
  );
}
