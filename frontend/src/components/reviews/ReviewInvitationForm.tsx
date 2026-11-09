'use client';

import { useId, useState } from 'react';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics/track';
import { useTranslation } from '@/lib/i18n/LanguageContext';

/** Formulaire d'avis vérifié, ouvert depuis le lien signé reçu après la location */
export function ReviewInvitationForm({
  reference,
  exp,
  sig,
  googleReviewUrl,
}: {
  reference: string;
  exp: string;
  sig: string;
  googleReviewUrl?: string | null;
}) {
  const uid = useId();
  const { t, fmt, locale } = useTranslation();
  const r = t.tracking.review;
  const RATING_LABELS = r.ratings;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError(r.errRating);
      return;
    }
    if (comment.trim().length < 10) {
      setError(r.errComment);
      return;
    }
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/reviews/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, exp, sig, rating, comment: comment.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      // Message du serveur (lien expiré, avis déjà publié…) rédigé en français : traduit ailleurs
      if (!res.ok || !json?.success) throw new Error((locale === 'fr' && json?.error) || r.errPublish);
      track('Avis publié', { note: rating });
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : r.errPublish);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div role="status" className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        <p className="mt-3 text-lg font-extrabold text-[#0B1220]">{r.doneTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{r.doneText}</p>
        {googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            {r.google}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset>
        <legend className="text-sm font-bold text-[#0B1220]">{r.yourRating}</legend>
        <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label={r.ratingAria}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer rounded-lg p-1 focus-within:ring-2 focus-within:ring-[#E63946]">
              <input
                type="radio"
                name={`${uid}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => {
                  setRating(value);
                  setError(null);
                }}
                className="sr-only"
                aria-label={fmt(r.starAria, { value, label: RATING_LABELS[value] })}
              />
              <Star
                aria-hidden="true"
                className={cn('h-9 w-9 transition-colors', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')}
              />
            </label>
          ))}
          <span className="ms-2 text-sm font-semibold text-slate-600" aria-live="polite">
            {rating > 0 ? RATING_LABELS[rating] : ''}
          </span>
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${uid}-comment`} className="text-sm font-bold text-[#0B1220]">
          {r.yourReview}
        </label>
        <textarea
          id={`${uid}-comment`}
          rows={5}
          maxLength={1000}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setError(null);
          }}
          placeholder={r.placeholder}
          className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3.5 py-3 text-[15px] focus:border-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#0B1220]/15"
        />
        <p className="mt-1 text-end text-xs text-slate-500">{comment.length} / 1000</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-action px-6 text-sm font-bold text-white hover:bg-action-hover disabled:opacity-60"
      >
        {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {r.publish}
      </button>
      <p className="text-center text-xs text-slate-500">{r.anonymous}</p>
    </form>
  );
}
