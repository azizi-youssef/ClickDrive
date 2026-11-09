'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  Car,
  Motorbike,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CardSkeleton, EmptyState, ErrorBanner, KpiSkeleton } from '@/components/agency/shell/Feedback';

/* ─────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────── */
export type OverviewResource =
  | { loading: true; error: null; data: null }
  | { loading: false; error: string | null; data: import('@/lib/services/stats.service').AgencyDashboardStats | null };

export type AgendaResource =
  | { loading: true; error: null; data: null }
  | { loading: false; error: string | null; data: null }
  | {
      loading: false;
      error: null;
      data: {
        upcomingPickups: readonly {
          reference: string;
          customerName: string;
          startDate?: string;
          vehicleLabel: string;
        }[];
        upcomingReturns: readonly {
          reference: string;
          customerName: string;
          endDate?: string;
          vehicleLabel: string;
        }[];
        recentActivity: readonly {
          reference: string;
          customerName: string;
          status: string;
          totalPrice: number;
        }[];
      };
    };

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(11,18,32,0.04)]', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[#0B1220]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-accent-text transition-colors hover:bg-[#FFF4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  urgent,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Car;
  urgent?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-[border-color,box-shadow] sm:p-5',
        urgent ? 'border-[#E63946]/30' : 'border-slate-200/80',
        onClick && 'cursor-pointer hover:border-slate-300 hover:shadow-[0_12px_28px_-18px_rgba(11,18,32,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]'
      )}
    >
      {urgent && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#E63946]" />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            urgent ? 'bg-action text-white' : 'bg-[#F5F6F8] text-[#0B1220]'
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className={cn('mt-3 text-[28px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[32px]', urgent ? 'text-accent-text' : 'text-[#0B1220]')}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
      {onClick && (
        <ChevronRight
          className="absolute bottom-4 end-4 h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500"
          aria-hidden="true"
        />
      )}
    </Tag>
  );
}

/** Anneau d'occupation (part des véhicules en location) */
function OccupancyRing({ rate }: { rate: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Taux d’occupation : ${clamped} %`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#EEF0F3" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#E63946"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums text-[#0B1220]">{clamped}%</span>
        <span className="text-[11px] font-semibold text-slate-500">occupation</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────── */
export function OverviewPanel({
  stats,
  agenda,
  onRetry,
  onOpenBookings,
  onOpenFleet,
  onOpenCalendar,
  onOpenSubscription,
  onAddVehicle,
  onOpenMotos,
  fleetTypeCounts,
}: {
  stats: OverviewResource;
  agenda: AgendaResource;
  onRetry: () => void;
  onOpenBookings: () => void;
  onOpenFleet: () => void;
  onOpenCalendar: () => void;
  onOpenSubscription: () => void;
  /** Ouvre directement le formulaire d'ajout de véhicule (sinon : la flotte) */
  onAddVehicle?: () => void;
  /** Ouvre la liste des motos */
  onOpenMotos?: () => void;
  /** Répartition voitures / motos de la flotte */
  fleetTypeCounts?: { CAR: number; MOTORCYCLE: number } | null;
}) {
  const [agendaTab, setAgendaTab] = useState<'pickups' | 'returns'>('pickups');

  /* ── Chargement ── */
  if (stats.loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Chargement du tableau de bord">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <CardSkeleton rows={4} tall />
          <CardSkeleton rows={4} tall />
        </div>
      </div>
    );
  }

  /* ── Erreur ── */
  if (stats.error || !stats.data) {
    return <ErrorBanner message={stats.error ?? "Vue d'ensemble indisponible."} onRetry={onRetry} />;
  }

  const d = stats.data;
  const pickups = agenda.data?.upcomingPickups ?? [];
  const returns = agenda.data?.upcomingReturns ?? [];
  const recentActivity = agenda.data?.recentActivity ?? [];
  const totalBookings = d.pendingBookings + d.confirmedBookings + d.completedBookings + d.cancelledBookings;

  /* Alertes prioritaires */
  const alerts: { id: string; label: string; tone: 'urgent' | 'warn'; cta: string; action: () => void }[] = [];
  if (d.pendingBookings > 0) {
    alerts.push({
      id: 'pending',
      tone: 'urgent',
      label: `${d.pendingBookings} demande${d.pendingBookings > 1 ? 's' : ''} de réservation attend${d.pendingBookings > 1 ? 'ent' : ''} votre réponse`,
      cta: 'Répondre',
      action: onOpenBookings,
    });
  }
  if (d.availableVehicles === 0 && d.totalVehicles > 0) {
    alerts.push({
      id: 'no-stock',
      tone: 'warn',
      label: 'Aucun véhicule disponible à la location — vérifiez le calendrier',
      cta: 'Calendrier',
      action: onOpenCalendar,
    });
  }
  if (d.maintenanceVehicles > 0) {
    alerts.push({
      id: 'maintenance',
      tone: 'warn',
      label: `${d.maintenanceVehicles} véhicule${d.maintenanceVehicles > 1 ? 's' : ''} en maintenance`,
      cta: 'Voir la flotte',
      action: onOpenFleet,
    });
  }

  const fleetRows = [
    { label: 'Disponibles', value: d.availableVehicles, color: 'bg-emerald-500' },
    { label: 'En location', value: d.rentedVehicles, color: 'bg-[#E63946]' },
    { label: 'Réservés / bloqués', value: d.reservedVehicles, color: 'bg-amber-400' },
    { label: 'En maintenance', value: d.maintenanceVehicles, color: 'bg-slate-400' },
  ];

  const bookingSplit = [
    { label: 'En attente', value: d.pendingBookings, color: 'bg-amber-400' },
    { label: 'Confirmées', value: d.confirmedBookings, color: 'bg-emerald-500' },
    { label: 'Terminées', value: d.completedBookings, color: 'bg-[#0B1220]' },
    { label: 'Annulées', value: d.cancelledBookings, color: 'bg-slate-300' },
  ];

  const actions = [
    { label: 'Ajouter un véhicule', desc: 'Enrichir votre flotte', icon: PlusCircle, onClick: onAddVehicle ?? onOpenFleet },
    { label: 'Gérer les disponibilités', desc: 'Bloquer ou ouvrir des dates', icon: CalendarClock, onClick: onOpenCalendar },
    { label: 'Traiter les réservations', desc: 'Demandes reçues', icon: ClipboardList, onClick: onOpenBookings },
    { label: 'Mon forfait', desc: 'Capacité et formule', icon: Sparkles, onClick: onOpenSubscription },
  ];

  const agendaItems = agendaTab === 'pickups' ? pickups : returns;

  return (
    <div className="space-y-6">
      {/* ── Alertes prioritaires ── */}
      {alerts.length > 0 && (
        <ul className="space-y-2" aria-label="Actions prioritaires">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <button
                type="button"
                onClick={alert.action}
                className={cn(
                  'group flex min-h-13 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]',
                  alert.tone === 'urgent' ? 'border-[#F8C9CD] bg-[#FFF4F5]' : 'border-amber-200 bg-amber-50'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    alert.tone === 'urgent' ? 'bg-action text-white' : 'bg-amber-100 text-amber-700'
                  )}
                >
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <span className={cn('min-w-0 flex-1 text-sm font-semibold', alert.tone === 'urgent' ? 'text-[#7F1D1D]' : 'text-amber-950')}>
                  {alert.label}
                </span>
                <span
                  className={cn(
                    'hidden shrink-0 items-center gap-1 text-xs font-bold sm:inline-flex',
                    alert.tone === 'urgent' ? 'text-accent-text' : 'text-amber-800'
                  )}
                >
                  {alert.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Indicateurs clés ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="À traiter"
          value={d.pendingBookings}
          hint={d.pendingBookings > 0 ? 'Demandes en attente de réponse' : 'Aucune demande en attente'}
          icon={Clock3}
          urgent={d.pendingBookings > 0}
          onClick={onOpenBookings}
        />
        <KpiCard
          label="Disponibles"
          value={`${d.availableVehicles}/${d.totalVehicles}`}
          hint="Véhicules prêts à louer"
          icon={Car}
          onClick={onOpenFleet}
        />
        <KpiCard
          label="Confirmées"
          value={d.confirmedBookings}
          hint="Réservations confirmées ou en cours"
          icon={CheckCircle2}
          onClick={onOpenBookings}
        />
        <KpiCard
          label="Revenus"
          value={formatPrice(d.agencyNet)}
          hint="Montant agence sur la période choisie"
          icon={CircleDollarSign}
        />
      </div>

      {/* ── Agenda + État de la flotte ── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Agenda"
          subtitle="Prochains départs et retours confirmés"
          action={<PanelLink onClick={onOpenCalendar}>Calendrier</PanelLink>}
        >
          <div className="px-5">
            <div role="tablist" aria-label="Type d’événement" className="grid grid-cols-2 gap-1 rounded-xl bg-[#F5F6F8] p-1">
              {([
                { id: 'pickups', label: 'Départs', count: pickups.length },
                { id: 'returns', label: 'Retours', count: returns.length },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={agendaTab === tab.id}
                  onClick={() => setAgendaTab(tab.id)}
                  className={cn(
                    'flex min-h-9 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors',
                    agendaTab === tab.id ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-500 hover:text-[#0B1220]'
                  )}
                >
                  {tab.label}
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-600">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel" className="flex-1 pb-2 pt-2">
            {agenda.loading ? (
              <div className="space-y-2 px-5 py-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}
              </div>
            ) : agendaItems.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {agendaItems.slice(0, 5).map((entry) => {
                  const date = 'startDate' in entry ? entry.startDate : 'endDate' in entry ? entry.endDate : undefined;
                  const isPickup = agendaTab === 'pickups';
                  return (
                    <li key={entry.reference} className="flex items-center gap-3 px-5 py-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          isPickup ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F5F6F8] text-[#0B1220]'
                        )}
                      >
                        {isPickup ? <CalendarCheck className="h-4.5 w-4.5" /> : <CalendarX className="h-4.5 w-4.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0B1220]">{entry.customerName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {entry.vehicleLabel} · {entry.reference}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-[#F5F6F8] px-2.5 py-1 text-xs font-bold capitalize text-[#0B1220]">
                        {formatShortDate(date)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title={agendaTab === 'pickups' ? 'Aucun départ programmé' : 'Aucun retour programmé'}
                text={agendaTab === 'pickups' ? 'Les départs confirmés apparaîtront ici.' : 'Les retours des locations en cours apparaîtront ici.'}
              />
            )}
          </div>
        </Panel>

        <Panel
          title="État de la flotte"
          subtitle={`${d.totalVehicles} véhicule${d.totalVehicles !== 1 ? 's' : ''} au total`}
          action={<PanelLink onClick={onOpenFleet}>Flotte</PanelLink>}
        >
          <div className="flex items-center gap-5 px-5 pb-5 pt-1">
            <OccupancyRing rate={d.occupancyRate} />
            <ul className="min-w-0 flex-1 space-y-2.5">
              {fleetRows.map((row) => (
                <li key={row.label} className="flex items-center gap-2.5 text-sm">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', row.color)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-slate-600">{row.label}</span>
                  <span className="font-extrabold tabular-nums text-[#0B1220]">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
          {fleetTypeCounts && (
            <div className="mx-5 mb-4 grid grid-cols-2 gap-2">
              {([
                { key: 'CAR', label: 'Voitures', icon: Car, onClick: onOpenFleet },
                { key: 'MOTORCYCLE', label: 'Motos', icon: Motorbike, onClick: onOpenMotos ?? onOpenFleet },
              ] as const).map(({ key, label, icon: Icon, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-start text-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{label}</span>
                  <span className="font-extrabold tabular-nums text-[#0B1220]">{fleetTypeCounts[key]}</span>
                </button>
              ))}
            </div>
          )}
          {d.totalVehicles > 0 && (
            <div className="mx-5 mb-5 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              {fleetRows.map((row) =>
                row.value > 0 ? (
                  <span key={row.label} className={row.color} style={{ width: `${(row.value / d.totalVehicles) * 100}%` }} />
                ) : null
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Activité récente + Actions rapides ── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Activité récente"
          subtitle={totalBookings > 0 ? `${totalBookings} dossier${totalBookings > 1 ? 's' : ''} sur la période` : 'Aucun dossier sur la période'}
          action={<PanelLink onClick={onOpenBookings}>Tout voir</PanelLink>}
        >
          {totalBookings > 0 && (
            <div className="px-5 pb-3">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                {bookingSplit.map((part) =>
                  part.value > 0 ? (
                    <span key={part.label} className={part.color} style={{ width: `${(part.value / totalBookings) * 100}%` }} />
                  ) : null
                )}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Répartition des réservations">
                {bookingSplit.map((part) => (
                  <li key={part.label} className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', part.color)} aria-hidden="true" />
                    {part.label} <strong className="tabular-nums text-[#0B1220]">{part.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex-1 border-t border-slate-100">
            {agenda.loading ? (
              <div className="space-y-2 px-5 py-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}
              </div>
            ) : recentActivity.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {recentActivity.slice(0, 6).map((entry) => {
                  return (
                    <li key={entry.reference} className="flex items-center gap-3 px-5 py-3">
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B1220] text-sm font-bold text-white">
                        {entry.customerName.trim().slice(0, 1).toUpperCase() || '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0B1220]">{entry.customerName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {entry.reference}
                          {entry.totalPrice > 0 && ` · ${formatPrice(entry.totalPrice)}`}
                        </p>
                      </div>
                      <StatusBadge status={entry.status} audience="business" size="sm" className="shrink-0" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="Aucune activité récente" text="Les nouvelles demandes de réservation apparaîtront ici." />
            )}
          </div>
        </Panel>

        <Panel title="Actions rapides" subtitle="Accès direct aux tâches courantes">
          <ul className="grid grid-cols-2 gap-2 px-5 pb-5 xl:grid-cols-1">
            {actions.map(({ label, desc, icon: Icon, onClick }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={onClick}
                  className="group flex h-full w-full flex-col items-start gap-2 rounded-xl border border-slate-200/80 p-3 text-left transition-colors hover:border-[#0B1220]/20 hover:bg-[#F5F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946] xl:flex-row xl:items-center xl:gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B1220] text-white transition-colors group-hover:bg-action"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#0B1220]">{label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-600 xl:block" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
