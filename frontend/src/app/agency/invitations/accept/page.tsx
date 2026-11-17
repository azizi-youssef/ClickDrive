'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

type AcceptanceState =
  | { kind: 'loading'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function AcceptAgencyInvitationPage() {
  const [state, setState] = useState<AcceptanceState>({
    kind: 'loading',
    message: 'Vérification de votre invitation…',
  });

  useEffect(() => {
    const agencyId = new URLSearchParams(window.location.search).get('agencyId');
    if (!agencyId) {
      setState({ kind: 'error', message: 'Le lien d’invitation est incomplet.' });
      return;
    }

    const controller = new AbortController();
    void fetch(`/api/agencies/${encodeURIComponent(agencyId)}/members/accept`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Impossible d’accepter cette invitation.');
      }
      setState({ kind: 'success', message: 'Votre accès à l’agence est maintenant actif.' });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Impossible d’accepter cette invitation.',
      });
    });
    return () => controller.abort();
  }, []);

  const success = state.kind === 'success';
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {state.kind === 'loading' ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-ink" aria-hidden="true" />
        ) : success ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        ) : (
          <ShieldAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
        )}
        <h1 className="mt-5 text-xl font-bold text-slate-900">
          {state.kind === 'loading' ? 'Invitation agence' : success ? 'Accès confirmé' : 'Invitation non validée'}
        </h1>
        <p className="mt-2 text-sm text-slate-600" role={success ? 'status' : 'alert'}>{state.message}</p>
        {success && (
          <Link
            href="/agency"
            className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Accéder au tableau de bord
          </Link>
        )}
      </section>
    </main>
  );
}
