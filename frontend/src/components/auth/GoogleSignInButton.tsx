'use client';

import React, { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface GoogleSignInButtonProps {
  next?: string;
  label?: string;
  className?: string;
  variant?: 'dark' | 'light';
}

export function GoogleSignInButton({
  next = '/account',
  label = 'Continuer avec Google',
  className = '',
  variant = 'dark',
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);

    const supabase = createClient();
    if (!supabase || !isSupabaseConfigured()) {
      // Dégradé dev si non configuré
      console.warn('Supabase non configuré pour Google OAuth');
      setLoading(false);
      return;
    }

    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Erreur Google OAuth:', error.message);
        setLoading(false);
      }
    } catch (err) {
      console.error('Erreur imprévue Google OAuth:', err);
      setLoading(false);
    }
  };

  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={loading}
      className={`group relative flex w-full items-center justify-center gap-3 rounded-xl border py-3 px-4 text-sm font-semibold transition-all duration-fast motion-press disabled:opacity-60 disabled:cursor-not-allowed ${
        isDark
          ? 'border-slate-800 bg-slate-950/80 text-white hover:bg-slate-900 hover:border-slate-700 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
      } ${className}`}
    >
      {loading ? (
        <span className="flex items-center gap-2 text-xs">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Redirection vers Google...
        </span>
      ) : (
        <>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.2 0 10.04 0 12s.45 3.8 1.25 5.42l4.03-3.13z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
