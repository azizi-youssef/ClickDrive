'use client';

import { useState } from 'react';
import { Clock3, Loader2, MessageCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';
import type { PlanChangeRequest } from '@/types';

/**
 * Demande de changement de formule en attente : la formule actuelle reste active jusqu'à
 * la réception du paiement et la validation par l'équipe ClickDrive.
 */
export function PendingPlanChangeBanner({
  agencyId,
  request,
  onCancelled,
}: {
  agencyId: string;
  request: PlanChangeRequest;
  onCancelled: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestedOn = new Date(request.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const whatsapp = clickdriveWhatsAppUrl(
    `Bonjour, je souhaite régler le passage à la formule ${request.requested_plan.name} (${formatPrice(request.amount_due)} / mois) demandé le ${requestedOn}.`
  );

  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/agencies/${agencyId}/subscription?requestId=${encodeURIComponent(request.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'La demande n’a pas pu être annulée.');
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La demande n’a pas pu être annulée.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-amber-950">
              Passage à la formule {request.requested_plan.name} en attente de paiement
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Demandé le {requestedOn} · {formatPrice(request.amount_due)} / mois. Votre formule actuelle
              {request.current_plan_name ? ` (${request.current_plan_name})` : ''} reste active : la nouvelle
              s’appliquera dès la réception du règlement.
            </p>
            {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0B1220] px-4 text-xs font-bold text-white hover:bg-slate-800"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Régler avec l’équipe
          </a>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={cancelling}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Annuler la demande
          </button>
        </div>
      </div>
    </div>
  );
}
