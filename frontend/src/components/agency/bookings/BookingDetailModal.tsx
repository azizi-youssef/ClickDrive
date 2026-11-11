'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Car,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  RefreshCw,
  ShieldCheck,
  User,
  Wallet,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { canPerformAgencyBookingAction } from '@clickdrive/shared/booking-state-machine';
import { cn } from '@/lib/utils';
import { button } from '@/lib/design/tokens';
import { Modal } from '@/components/agency/shell/Dialog';
import {
  bookingReference,
  money,
  type AgencyBookingRow,
} from './BookingsPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';

export type BookingEvent = {
  id: string;
  event_type: string;
  actor_role: string | null;
  created_at: string;
};

export type BookingDetail = AgencyBookingRow & {
  pickup_time?: string | null;
  dropoff_time?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  total_days?: number | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  flight_number?: string | null;
  delivery_type?: string | null;
  events?: BookingEvent[];
};

export type BookingAction = 'approve' | 'reject' | 'propose_alternative';

/**
 * Transitions autorisées par la machine à états partagée.
 * Le composant ne décide jamais d'une transition : il consulte @clickdrive/shared.
 */
export function allowedActions(status: string): BookingAction[] {
  const actions: BookingAction[] = [];
  if (canPerformAgencyBookingAction(status, 'approve')) actions.push('approve');
  if (canPerformAgencyBookingAction(status, 'reject')) actions.push('reject');
  if (canPerformAgencyBookingAction(status, 'propose_alternative')) {
    actions.push('propose_alternative');
  }
  return actions;
}

/** Formate une date ISO en format français lisible (ex: "Ven. 16 oct. 2026") */
function formatPrettyDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]!, 10);
      const month = parseInt(parts[1]!, 10) - 1;
      const day = parseInt(parts[2]!, 10);
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    }
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/** Traduction et humanisation des événements de réservation */
const EVENT_LABELS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' | 'warning' | 'info' }> = {
  REQUEST_CREATED: { label: 'Demande de réservation créée par le client', tone: 'info' },
  REQUEST_SUBMITTED: { label: 'Demande transmise à l’agence', tone: 'info' },
  BOOKING_APPROVED: { label: 'Réservation approuvée par l’agence', tone: 'success' },
  APPROVED: { label: 'Réservation validée', tone: 'success' },
  BOOKING_CONFIRMED: { label: 'Réservation confirmée', tone: 'success' },
  BOOKING_REJECTED: { label: 'Demande refusée par l’agence', tone: 'danger' },
  REJECTED: { label: 'Demande refusée', tone: 'danger' },
  BOOKING_CANCELLED: { label: 'Réservation annulée', tone: 'danger' },
  CANCELLED: { label: 'Réservation annulée', tone: 'danger' },
  BOOKING_EXPIRED: { label: 'Demande expirée (délai dépassé)', tone: 'warning' },
  EXPIRED: { label: 'Demande expirée', tone: 'warning' },
  ALTERNATIVE_PROPOSED: { label: 'Véhicule alternatif proposé', tone: 'warning' },
  PDF_GENERATED: { label: 'Contrat / bon de réservation PDF généré', tone: 'neutral' },
  DEPOSIT_PAID: { label: 'Acompte ou caution enregistré', tone: 'success' },
  HANDOVER_PICKUP: { label: 'Départ et remise des clés effectués', tone: 'info' },
  HANDOVER_RETURN: { label: 'Restitution du véhicule effectuée', tone: 'success' },
  COMPLETED: { label: 'Dossier de location clôturé', tone: 'success' },
};

const ACTOR_LABELS: Record<string, string> = {
  CUSTOMER: 'Client',
  AGENCY_OWNER: 'Agence',
  AGENCY_MANAGER: 'Agence',
  AGENCY_STAFF: 'Agence',
  SUPER_ADMIN: 'Admin',
  SYSTEM: 'Système',
};

export function BookingDetailModal({
  booking,
  detail,
  loadingDetail,
  detailError,
  canAct,
  busy,
  alternatives,
  loadingAlternatives,
  onClose,
  onReload,
  onAction,
  onDownloadPdf,
}: {
  booking: BookingDetail;
  detail: BookingDetail | null;
  loadingDetail: boolean;
  detailError: string | null;
  canAct: boolean;
  busy: boolean;
  alternatives: readonly { id: string; brand: string; model: string; daily_price: number }[];
  loadingAlternatives: boolean;
  onClose: () => void;
  onReload: () => void;
  onAction: (action: BookingAction, payload: { reason?: string; alternativeVehicleId?: string }) => void;
  onDownloadPdf: () => void;
}) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [alternativeId, setAlternativeId] = useState('');
  const [pending, setPending] = useState<BookingAction | null>(null);
  const [copied, setCopied] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setReason('');
    setReasonError(null);
    setAlternativeId('');
    setPending(null);
  }, [booking.id]);

  const actions = useMemo(() => allowedActions(booking.status), [booking.status]);
  const loaded = detail ?? booking;
  const events = detail?.events ?? [];
  const refCode = bookingReference(loaded);

  const copyReference = () => {
    if (!refCode) return;
    navigator.clipboard?.writeText(refCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submit = (action: BookingAction) => {
    if (action === 'reject' && !reason.trim()) {
      setReasonError('Indiquez le motif du refus : il sera transmis au client.');
      reasonRef.current?.scrollIntoView({ block: 'center' });
      reasonRef.current?.focus({ preventScroll: true });
      return;
    }
    setPending(action);
    onAction(action, {
      reason: action === 'reject' ? reason : undefined,
      alternativeVehicleId: action === 'propose_alternative' ? alternativeId : undefined,
    });
  };

  // Initiales client
  const customerInitials = (loaded.customer_name || 'C')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  // Numéro de téléphone pour WhatsApp
  const cleanPhone = loaded.customer_phone ? loaded.customer_phone.replace(/[^0-9]/g, '') : null;
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=Bonjour%20${encodeURIComponent(loaded.customer_name)},%20concernant%20votre%20demande%20de%20r%C3%A9servation%20${encodeURIComponent(refCode)}%20sur%20KlickDrive` : null;

  return (
    <Modal
      title={`Dossier ${refCode}`}
      description={`${loaded.customer_name} • ${loaded.vehicle ? `${loaded.vehicle.brand} ${loaded.vehicle.model}` : 'Véhicule'}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={button.secondary} onClick={onClose} disabled={busy}>
            Fermer
          </button>
          <button type="button" className={button.secondary} onClick={onDownloadPdf} disabled={busy}>
            <FileText aria-hidden="true" className="h-4 w-4" />
            Télécharger le PDF
          </button>
          {canAct && actions.includes('reject') && (
            <button
              type="button"
              className={button.danger}
              onClick={() => submit('reject')}
              disabled={busy}
            >
              {busy && pending === 'reject' ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle aria-hidden="true" className="h-4 w-4" />
              )}
              Refuser
            </button>
          )}
          {canAct && actions.includes('approve') && (
            <button
              type="button"
              className={button.primary}
              onClick={() => submit('approve')}
              disabled={busy}
            >
              {busy && pending === 'approve' ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              )}
              Approuver
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {detailError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {detailError}
          </p>
        )}

        {/* ── 1. Bandeau Statut & Référence ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={loaded.status} audience="business" />
            <button
              type="button"
              onClick={copyReference}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
              title="Copier la référence"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copié</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono">{refCode}</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onReload}
            disabled={loadingDetail}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loadingDetail && 'animate-spin text-[#E63946]')} />
            <span>{loadingDetail ? 'Actualisation...' : 'Actualiser le dossier'}</span>
          </button>
        </div>

        {/* ── 2. Cartes Véhicule & Client ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Carte Véhicule */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Car className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Véhicule réservé</span>
                <h4 className="truncate text-base font-extrabold text-slate-900">
                  {loaded.vehicle ? `${loaded.vehicle.brand} ${loaded.vehicle.model}` : 'Véhicule'}
                </h4>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {loaded.vehicle?.category && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      {loaded.vehicle.category}
                    </span>
                  )}
                  {loaded.total_days && (
                    <span>• {loaded.total_days} jour{loaded.total_days > 1 ? 's' : ''} de location</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Carte Client */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-bold text-white shadow-xs">
                {customerInitials || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Client</span>
                <h4 className="truncate text-base font-extrabold text-slate-900">
                  {loaded.customer_name}
                </h4>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {loaded.customer_phone ? (
                    <>
                      <a
                        href={`tel:${loaded.customer_phone}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>{loaded.customer_phone}</span>
                      </a>
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                          title="Contacter sur WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Téléphone non renseigné</span>
                  )}

                  {loaded.customer_email && (
                    <a
                      href={`mailto:${loaded.customer_email}`}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      title={loaded.customer_email}
                    >
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span className="max-w-[120px] truncate">{loaded.customer_email}</span>
                    </a>
                  )}

                  {loaded.flight_number && (
                    <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      <Plane className="h-3 w-3" />
                      <span>Vol {loaded.flight_number}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Parcours de Location (Itinéraire Départ & Retour) ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#E63946]" />
              <span>Détails de la période et lieux</span>
            </h3>
            {typeof loaded.total_days === 'number' && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-800">
                {loaded.total_days} jour{loaded.total_days > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Prise en charge / Départ */}
            <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  1
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Prise en charge (Départ)
                </span>
              </div>
              <p className="text-base font-extrabold text-slate-900 capitalize">
                {formatPrettyDate(loaded.start_date)}
              </p>
              {loaded.pickup_time && (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Heure : {loaded.pickup_time}</span>
                </div>
              )}
              {loaded.pickup_location && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white p-2 text-xs text-slate-700 border border-slate-100">
                  <MapPin className="h-4 w-4 shrink-0 text-[#E63946] mt-0.5" />
                  <span className="font-medium">{loaded.pickup_location}</span>
                </div>
              )}
            </div>

            {/* Restitution / Retour */}
            <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                  2
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                  Restitution (Retour)
                </span>
              </div>
              <p className="text-base font-extrabold text-slate-900 capitalize">
                {formatPrettyDate(loaded.end_date)}
              </p>
              {loaded.dropoff_time && (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Heure : {loaded.dropoff_time}</span>
                </div>
              )}
              {loaded.dropoff_location && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white p-2 text-xs text-slate-700 border border-slate-100">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
                  <span className="font-medium">{loaded.dropoff_location}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 4. Synthèse Financière ── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span>Montants</span>
            </h3>
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Montants figés au moment de la demande.
            </span>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* Montant total */}
            <div className="flex flex-col gap-1 p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Montant total</span>
              <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                {money(loaded.total_price)}
              </p>
              <p className="text-xs text-slate-400">Total client pour {loaded.total_days || 1} jour(s)</p>
            </div>

            {/* Net Agence (mis en valeur) */}
            <div className="flex flex-col gap-1 bg-emerald-50/60 p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Net agence</span>
              <p className="text-2xl font-extrabold tabular-nums text-emerald-800">
                {money(loaded.agency_amount)}
              </p>
              <p className="text-xs font-medium text-emerald-600">Montant net perçu par votre agence</p>
            </div>
          </div>
        </section>

        {/* ── 5. Motif du refus (si action disponible) ── */}
        {canAct && actions.includes('reject') && (
          <section className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
            <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-bold text-slate-900">
              Motif du refus <span className="font-semibold text-[#E63946]">(obligatoire en cas de refus)</span>
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Ce message sera immédiatement communiqué au client pour expliquer pourquoi sa demande ne peut aboutir.
            </p>
            <textarea
              ref={reasonRef}
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (event.target.value.trim()) setReasonError(null);
              }}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? 'reject-reason-error' : undefined}
              placeholder="Ex : Véhicule indisponible suite à une prolongation de contrat ou révision atelier..."
              className={cn(
                'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/20',
                reasonError ? 'border-[#E63946] bg-[#FFF6F7]' : 'border-slate-300'
              )}
            />
            {reasonError && (
              <p id="reject-reason-error" role="alert" className="mt-2 text-sm font-semibold text-red-700 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 shrink-0" />
                {reasonError}
              </p>
            )}
          </section>
        )}

        {/* ── 6. Proposer une alternative ── */}
        {canAct && actions.includes('propose_alternative') && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Proposer un véhicule alternatif</h3>
            <p className="mb-3 text-xs text-slate-500">
              Sélectionnez un véhicule de remplacement disponible sur cette même période pour le soumettre au client.
            </p>
            {loadingAlternatives ? (
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ) : alternatives.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Aucun autre véhicule disponible sur ces dates dans votre flotte.
              </p>
            ) : (
              <div className="space-y-2">
                {alternatives.map((vehicle) => (
                  <label
                    key={vehicle.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
                      alternativeId === vehicle.id
                        ? 'border-[#E63946] bg-white shadow-xs ring-1 ring-[#E63946]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="alternative"
                      value={vehicle.id}
                      checked={alternativeId === vehicle.id}
                      onChange={() => setAlternativeId(vehicle.id)}
                      className="h-4 w-4 accent-[#E63946]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-900">
                        {vehicle.brand} {vehicle.model}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-[#E63946]">
                      {money(vehicle.daily_price)} <span className="text-xs font-normal text-slate-500">/ jour</span>
                    </span>
                  </label>
                ))}
                <div className="pt-2">
                  <button
                    type="button"
                    className={button.primary}
                    onClick={() => submit('propose_alternative')}
                    disabled={busy || !alternativeId}
                  >
                    {busy && pending === 'propose_alternative' ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Envoyer cette alternative au client
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 7. Historique du dossier ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-3 text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>Historique des événements</span>
          </h3>

          {events.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Aucun événement enregistré pour ce dossier.</p>
          ) : (
            <div className="relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-4">
              {events.map((event) => {
                const info = EVENT_LABELS[event.event_type] ?? {
                  label: event.event_type.replace(/_/g, ' '),
                  tone: 'neutral',
                };
                const actor = event.actor_role ? (ACTOR_LABELS[event.actor_role] ?? event.actor_role) : null;
                const dateObj = new Date(event.created_at);
                const formattedTime = !Number.isNaN(dateObj.getTime())
                  ? dateObj.toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : event.created_at;

                return (
                  <div key={event.id} className="relative flex items-start justify-between gap-4 text-xs">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white ring-2',
                        info.tone === 'success' && 'bg-emerald-500 ring-emerald-100',
                        info.tone === 'danger' && 'bg-red-500 ring-red-100',
                        info.tone === 'warning' && 'bg-amber-500 ring-amber-100',
                        info.tone === 'info' && 'bg-blue-500 ring-blue-100',
                        info.tone === 'neutral' && 'bg-slate-400 ring-slate-100'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                        {info.label}
                      </p>
                      {actor && (
                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                          Par : {actor}
                        </span>
                      )}
                    </div>
                    <time className="shrink-0 text-[11px] tabular-nums text-slate-400 font-mono">
                      {formattedTime}
                    </time>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
