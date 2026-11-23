// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, fireEvent, render, screen, waitFor } from '@/tests/setup/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientAuthProfile } from '@/lib/auth/client';

const GOOGLE_PHOTO = 'https://lh3.googleusercontent.com/a/photo-google=s96-c';
const CUSTOM_PHOTO = 'https://example.supabase.co/storage/v1/object/public/avatars/u1/photo.webp';

const mocks = vi.hoisted(() => ({
  profile: null as ClientAuthProfile | null,
  profileError: false,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/account',
}));
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'u1',
            email: 'client@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
            app_metadata: { provider: 'google' },
            user_metadata: { full_name: 'Nom Google', avatar_url: GOOGLE_PHOTO },
          },
        },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  }),
}));
vi.mock('@/lib/auth/client', () => ({
  fetchClientAuthProfile: async () => {
    if (mocks.profileError) throw new Error('indisponible');
    return mocks.profile;
  },
  signOutEverywhere: vi.fn(),
}));
vi.mock('@/lib/supabase/realtime', () => ({ useRealtimeRefresh: () => undefined }));
vi.mock('@/components/shared/AccountProfileSettings', () => ({ AccountProfileSettings: () => null }));

import AccountPage from './page';

function profile(overrides: Partial<ClientAuthProfile>): ClientAuthProfile {
  return {
    id: 'u1',
    email: 'client@example.com',
    displayName: 'Nom Google',
    avatarUrl: GOOGLE_PHOTO,
    role: 'CUSTOMER',
    roleLabel: 'Client',
    agencyIds: [],
    agencyName: null,
    agencyLogoUrl: null,
    canAccessAdmin: false,
    canAccessAgency: false,
    ...overrides,
  };
}

const headerPhoto = (container: HTMLElement) => container.querySelector('img');

beforeEach(() => {
  mocks.profile = null;
  mocks.profileError = false;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, bookings: [] }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Page compte — photo et nom de l’en-tête', () => {
  it('affiche la photo et le nom choisis dans « Mon profil » plutôt que ceux du compte Google', async () => {
    mocks.profile = profile({ avatarUrl: CUSTOM_PHOTO, displayName: 'Youssef A.' });
    const { container } = render(<AccountPage />);

    await waitFor(() => expect(headerPhoto(container)).toHaveAttribute('src', CUSTOM_PHOTO));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Youssef A.');
    // Photo demandée sans référent (Google refuse parfois les photos appelées depuis un autre site)
    expect(headerPhoto(container)).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('garde la photo Google si le profil est indisponible, puis l’initiale si la photo ne se charge pas', async () => {
    mocks.profileError = true;
    const { container } = render(<AccountPage />);

    await waitFor(() => expect(headerPhoto(container)).toHaveAttribute('src', GOOGLE_PHOTO));
    fireEvent.error(headerPhoto(container)!);

    expect(headerPhoto(container)).toBeNull();
    expect(screen.getByText('N', { selector: 'div' })).toBeInTheDocument();
  });

  it('se met à jour dès qu’une nouvelle photo est enregistrée dans « Mon profil »', async () => {
    mocks.profile = profile({});
    const { container } = render(<AccountPage />);
    await waitFor(() => expect(headerPhoto(container)).toHaveAttribute('src', GOOGLE_PHOTO));

    mocks.profile = profile({ avatarUrl: CUSTOM_PHOTO });
    await act(async () => {
      window.dispatchEvent(new CustomEvent('clickdrive:profile-updated'));
    });

    await waitFor(() => expect(headerPhoto(container)).toHaveAttribute('src', CUSTOM_PHOTO));
  });
});
