'use client';

import React, { useId, useState } from 'react';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import { Star, X, Send, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n/LanguageContext';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ReviewModalProps {
  bookingRef: string;
  bookingId: string;
  vehicleName: string;
  agencyName: string;
  vehicleImage?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type FormState = 'idle' | 'sending' | 'success' | 'error';

/* ── Star Rating Input ──────────────────────────────────────────────────── */

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const { t, plural } = useTranslation();
  const c = t.account.review;
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          id={`star-${n}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
          aria-label={plural(n, c.starAria)}
          aria-pressed={value === n}
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              n <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-200 text-slate-200'
            }`}
          />
        </button>
      ))}
      {(hovered || value) > 0 && (
        <span className="ms-2 text-sm font-semibold text-slate-700">
          {c.ratings[hovered || value]}
        </span>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export function ReviewModal({
  bookingRef,
  bookingId,
  vehicleName,
  agencyName,
  vehicleImage,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const { t, locale, fmt } = useTranslation();
  const c = t.account.review;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const dialogRef = useModalDialog<HTMLDivElement>(true, { onClose, closeDisabled: state === 'sending' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError(c.errRating); return; }
    if (comment.trim().length < 10) { setError(c.errComment); return; }

    setState('sending');
    setError(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, rating, comment: comment.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        // Les messages du serveur sont en français : ailleurs, message générique traduit
        throw new Error((locale === 'fr' && data.error) || c.errSend);
      }

      setState('success');
      onSuccess?.();
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error && err.message ? err.message : c.errSend);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none"
      >

        {/* Header */}
        <div className="relative bg-[#0B1220] px-6 py-5">
          <button
            onClick={onClose}
            type="button"
            className="absolute end-4 top-4 rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label={c.close}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white/60">{c.verified}</p>
              <h2 id={titleId} className="text-sm font-bold text-white">{c.title}</h2>
            </div>
          </div>
        </div>

        {/* Vehicle info */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          {vehicleImage && (
            <div className="relative h-14 w-20 overflow-hidden rounded-lg bg-slate-100">
              <Image src={vehicleImage} alt={vehicleName} fill className="object-cover" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-900">{vehicleName}</p>
            <p className="text-xs text-slate-500">{agencyName} · {fmt(c.reference, { reference: bookingRef })}</p>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5">
          {state === 'success' ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-bold text-slate-900">{c.doneTitle}</p>
              <p className="mt-1 text-sm text-slate-500">
                {c.doneText}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 rounded-xl bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {c.close}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Stars */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">{c.rating}</p>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Comment */}
              <div>
                <label htmlFor="review-comment" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {c.comment}
                </label>
                <textarea
                  id="review-comment"
                  rows={4}
                  maxLength={500}
                  placeholder={c.placeholder}
                  value={comment}
                  onChange={(e) => { setComment(e.target.value); setError(null); }}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-[#E63946] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#E63946]"
                />
                <p className="mt-1 text-end text-xs text-slate-400">{comment.length} / 500</p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="review-submit"
                type="submit"
                disabled={state === 'sending'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white shadow-md shadow-red-900/20 transition hover:bg-action-hover disabled:opacity-60"
              >
                {state === 'sending' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {c.sending}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {c.publish}
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                {c.notice}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
