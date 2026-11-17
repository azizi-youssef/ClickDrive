'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { CUSTOMER_CANCEL_REASONS, type CustomerCancelReason } from '@/lib/bookings/customer-cancel';

type State = 'idle' | 'confirming' | 'sending' | 'done' | 'tooLate' | 'error';

/**
 * Annulation d'une demande en attente depuis le lien de suivi (sans compte). Deux temps : « Annuler ma
 * demande » ouvre la confirmation (motif facultatif), puis « Confirmer l'annulation ». La page est relue
 * ensuite : statut « Annulée » et suggestions de véhicules aux mêmes dates.
 */
export function CancelRequest({ reference, exp, sig, cancellable }: { reference: string; exp: string; sig: string; cancellable: boolean }) {
  const { t, fmt } = useTranslation();
  const c = t.tracking.cancel;
  const router = useRouter();
  const uid = useId();
  const [state, setState] = useState<State>('idle');
  const [reason, setReason] = useState<CustomerCancelReason | ''>('');
  const reasonRef = useRef<HTMLSelectElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state === 'confirming') reasonRef.current?.focus();
  }, [state]);

  // Après la relecture de la page, la demande n'est plus annulable : seul le résultat reste affiché
  if (!cancellable && state !== 'done' && state !== 'tooLate') return null;

  const submit = async () => {
    setState('sending');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(reference)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exp, sig, reason: reason || null }),
      });
      if (response.ok) {
        setState('done');
        router.refresh();
        return;
      }
      if (response.status === 409) {
        setState('tooLate');
        router.refresh();
        return;
      }
      setState('error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done' || state === 'tooLate') {
    const done = state === 'done';
    return (
      <div
        role="status"
        className={done ? 'flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900' : 'flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'}
      >
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
        <p>{done ? c.done : c.tooLate}</p>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id={`${uid}-title`} className="text-sm font-bold text-ink">
        {c.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{c.text}</p>

      {state === 'idle' ? (
        <button
          ref={openRef}
          type="button"
          onClick={() => setState('confirming')}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
        >
          {c.open}
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-brand-line bg-brand-soft p-4">
          <p className="text-sm font-bold text-ink">{fmt(c.confirmTitle, { reference })}</p>
          <label htmlFor={`${uid}-reason`} className="mt-3 block text-xs font-bold text-slate-600">
            {c.reasonLabel}
          </label>
          <select
            ref={reasonRef}
            id={`${uid}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as CustomerCancelReason | '')}
            disabled={state === 'sending'}
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 sm:max-w-xs"
          >
            <option value="">{c.reasonNone}</option>
            {CUSTOMER_CANCEL_REASONS.map((key) => (
              <option key={key} value={key}>
                {c.reasons[key]}
              </option>
            ))}
          </select>
          {state === 'error' && (
            <p role="alert" className="mt-3 text-sm font-semibold text-action-hover">
              {c.error}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={submit}
              disabled={state === 'sending'}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-action px-5 text-sm font-bold text-white hover:bg-action-hover disabled:opacity-60"
            >
              {state === 'sending' ? c.sending : c.confirm}
            </button>
            <button
              type="button"
              onClick={() => {
                setState('idle');
                setReason('');
                requestAnimationFrame(() => openRef.current?.focus());
              }}
              disabled={state === 'sending'}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-slate-400"
            >
              {c.keep}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
