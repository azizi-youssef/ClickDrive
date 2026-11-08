'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AgencyMemberRole } from '@clickdrive/shared';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Shield, UserPlus, Users, X } from 'lucide-react';
import type { ClientAuthProfile } from '@/lib/auth/client';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';
import { useModalDialog } from '@/lib/a11y/useModalDialog';

type Member = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: AgencyMemberRole;
  status: 'ACTIVE' | 'INVITED' | 'REVOKED';
  created_at: string;
  invited_at: string | null;
  revoked_at: string | null;
};
type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  result: string;
};
type Customer = {
  id: string;
  booking_ref: string | null;
  reference: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  created_at: string;
  vehicle: { brand: string; model: string } | null;
};
type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
type Notice = { kind: 'success' | 'error'; message: string } | null;
type PanelSection = 'members' | 'customers';
type CustomerDossier = { dossier: Customer; history: Customer[]; meta: PageMeta };

const roles: Record<AgencyMemberRole, string> = {
  agency_admin: 'Administrateur agence',
  agency_manager: 'Gestionnaire',
  agency_agent: 'Agent',
  viewer: 'Lecteur',
};
const roleLabels: Record<string, string> = {
  'agency.created': 'Agence créée',
  'agency.archived': 'Agence archivée',
  'agency.status_changed': 'Statut modifié',
  'agency.updated': 'Agence modifiée',
  'member.invited': 'Invitation envoyée',
  'member.added': 'Membre ajouté',
  'member.revoked': 'Accès révoqué',
  'member.role_changed': 'Rôle modifié',
  'member.status_changed': 'Statut d’accès modifié',
};
const statuses = [
  'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'APPROVED',
  'REJECTED', 'ALTERNATIVE_PROPOSED', 'READY_FOR_PICKUP', 'ACTIVE', 'COMPLETED',
  'CANCELLED', 'EXPIRED', 'PENDING', 'CONFIRMED', 'NO_SHOW',
] as const;
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B1220] focus:ring-2 focus:ring-blue-100';
const pageSize = 10;

async function readApi<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok || !body || typeof body !== 'object' || !('success' in body) || body.success !== true) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error : `Erreur HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Pagination({ meta, onChange }: { meta: PageMeta | null; onChange: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
      <span className="text-slate-500">{meta.total} résultat{meta.total > 1 ? 's' : ''} · page {meta.page}/{meta.totalPages}</span>
      <div className="flex gap-2">
        <button type="button" className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Page précédente" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Page suivante" disabled={meta.page >= meta.totalPages} onClick={() => onChange(meta.page + 1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function AgencyAccessPanel({
  agencyId,
  agencyName,
  profile,
}: {
  agencyId: string;
  agencyName: string;
  profile: ClientAuthProfile | null;
}) {
  const [section, setSection] = useState<PanelSection>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [customerRows, setCustomerRows] = useState<Customer[]>([]);
  const [customerMeta, setCustomerMeta] = useState<PageMeta | null>(null);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerStatus, setCustomerStatus] = useState('');
  const [customerFrom, setCustomerFrom] = useState('');
  const [customerTo, setCustomerTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<Member | null>(null);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AgencyMemberRole>('agency_agent');
  const [dossier, setDossier] = useState<CustomerDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const dossierDialogRef = useModalDialog<HTMLElement>(Boolean(dossier || dossierLoading || dossierError), {
    onClose: () => {
      setDossier(null);
      setDossierError(null);
    },
  });

  const memberRole = useMemo(
    () => profile?.agencyMemberships?.find((membership) => membership.agencyId === agencyId)?.role,
    [agencyId, profile]
  );
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  const canReadMembers = isSuperAdmin || memberRole === 'agency_admin' || memberRole === 'agency_manager';
  const canInvite = isSuperAdmin || memberRole === 'agency_admin' || memberRole === 'agency_manager';
  const canChangeRoles = isSuperAdmin || memberRole === 'agency_admin';
  const canReadCustomers = isSuperAdmin || memberRole === 'agency_admin' || memberRole === 'agency_manager' || memberRole === 'agency_agent';

  const loadMembers = useCallback(async () => {
    if (!canReadMembers) return;
    setMembersLoading(true);
    try {
      const [memberResponse, auditResponse] = await Promise.all([
        fetch(`/api/agencies/${encodeURIComponent(agencyId)}/members`, { cache: 'no-store' }),
        fetch(`/api/agencies/${encodeURIComponent(agencyId)}/members/audit?pageSize=10`, { cache: 'no-store' }),
      ]);
      const [memberBody, auditBody] = await Promise.all([
        readApi<{ data: Member[] }>(memberResponse),
        readApi<{ data: AuditEntry[] }>(auditResponse),
      ]);
      setMembers(memberBody.data);
      setAudit(auditBody.data);
    } catch (error) {
      setMembers([]);
      setAudit([]);
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'Chargement des membres impossible.' });
    } finally {
      setMembersLoading(false);
    }
  }, [agencyId, canReadMembers]);

  const loadCustomers = useCallback(async (page: number) => {
    if (!canReadCustomers || section !== 'customers') return;
    setCustomersLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      q: search,
    });
    if (customerStatus) params.set('status', customerStatus);
    if (customerFrom) params.set('from', customerFrom);
    if (customerTo) params.set('to', customerTo);
    try {
      const response = await fetch(
        `/api/agencies/${encodeURIComponent(agencyId)}/customers?${params.toString()}`,
        { cache: 'no-store' }
      );
      const body = await readApi<{ data: Customer[]; meta: PageMeta }>(response);
      setCustomerRows(body.data);
      setCustomerMeta(body.meta);
    } catch (error) {
      setCustomerRows([]);
      setCustomerMeta(null);
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'Chargement des dossiers clients impossible.' });
    } finally {
      setCustomersLoading(false);
    }
  }, [agencyId, canReadCustomers, customerFrom, customerStatus, customerTo, search, section]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);
  useEffect(() => {
    if (section === 'customers') void loadCustomers(customerPage);
  }, [customerPage, loadCustomers, section]);

  const mutateMember = async (member: Member, action: 'role' | 'revoke', role?: AgencyMemberRole, confirmed = false) => {
    if (busy) return;
    if (action === 'revoke' && !confirmed) {
      setPendingRevoke(member);
      return;
    }
    setPendingRevoke(null);
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/agencies/${encodeURIComponent(agencyId)}/members/${encodeURIComponent(member.id)}`,
        action === 'role'
          ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }
          : { method: 'DELETE' }
      );
      await readApi(response);
      setNotice({ kind: 'success', message: action === 'role' ? 'Rôle mis à jour.' : 'Accès révoqué.' });
      await loadMembers();
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'Modification impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      await readApi(response);
      setEmail('');
      setNotice({ kind: 'success', message: 'Invitation envoyée. Le membre apparaîtra comme en attente jusqu’à son acceptation.' });
      await loadMembers();
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'Envoi de l’invitation impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const applyCustomerSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomerPage(1);
    setSearch(searchInput.trim());
  };

  const openDossier = async (reference: string) => {
    setDossier(null);
    setDossierError(null);
    setDossierLoading(true);
    try {
      const response = await fetch(
        `/api/agencies/${encodeURIComponent(agencyId)}/customers/${encodeURIComponent(reference)}?page=1&pageSize=${pageSize}`,
        { cache: 'no-store' }
      );
      setDossier(await readApi<{ data: CustomerDossier }>(response).then((body) => body.data));
    } catch (error) {
      setDossierError(error instanceof Error ? error.message : 'Impossible de charger le dossier client.');
    } finally {
      setDossierLoading(false);
    }
  };

  const loadDossierPage = async (page: number) => {
    const reference = dossier?.dossier.reference || dossier?.dossier.booking_ref;
    if (!reference) return;
    setDossierLoading(true);
    setDossierError(null);
    try {
      const response = await fetch(
        `/api/agencies/${encodeURIComponent(agencyId)}/customers/${encodeURIComponent(reference)}?page=${page}&pageSize=${pageSize}`,
        { cache: 'no-store' }
      );
      const body = await readApi<{ data: CustomerDossier }>(response);
      setDossier(body.data);
    } catch (error) {
      setDossier(null);
      setDossierError(error instanceof Error ? error.message : 'Impossible de charger l’historique.');
    } finally {
      setDossierLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold">Accès et permissions</h2>
        <p className="mt-1 text-sm text-slate-500">Gérez les droits de {agencyName} et les dossiers clients autorisés.</p>
      </header>
      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          {notice.kind === 'error' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <span className="flex-1">{notice.message}</span>
          <button type="button" aria-label="Fermer la notification" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      <div role="tablist" aria-label="Accès agence" className="flex gap-2 overflow-x-auto">
        <button type="button" role="tab" aria-selected={section === 'members'} onClick={() => setSection('members')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === 'members' ? 'bg-[#0B1220] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}><Users className="mr-2 inline h-4 w-4" />Membres</button>
        <button type="button" role="tab" aria-selected={section === 'customers'} onClick={() => setSection('customers')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === 'customers' ? 'bg-[#0B1220] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}><Shield className="mr-2 inline h-4 w-4" />Locataires</button>
      </div>

      {section === 'members' && (
        <div className="space-y-5">
          {canInvite && (
            <form onSubmit={invite} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
              <div><label htmlFor="member-email" className="mb-1 block text-sm font-semibold">E-mail du collaborateur</label><input id="member-email" type="email" required maxLength={254} className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <div><label htmlFor="member-role" className="mb-1 block text-sm font-semibold">Rôle autorisé</label><select id="member-role" className={inputClass} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AgencyMemberRole)}>
                {(isSuperAdmin ? Object.keys(roles) as AgencyMemberRole[] : memberRole === 'agency_manager' ? ['agency_agent', 'viewer'] as AgencyMemberRole[] : ['agency_manager', 'agency_agent', 'viewer'] as AgencyMemberRole[]).map((role) => <option key={role} value={role}>{roles[role]}</option>)}
              </select></div>
              <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" />Inviter</button>
            </form>
          )}
          {!canReadMembers ? <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Votre rôle ne permet pas de consulter les membres de cette agence.</p> : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h3 className="font-bold">Membres et invitations</h3><p className="text-xs text-slate-500">Seuls les comptes actifs peuvent accéder à cette agence.</p></div><button type="button" onClick={() => void loadMembers()} disabled={membersLoading} className="rounded-lg border border-slate-200 p-2" aria-label="Actualiser les membres"><RefreshCw className={`h-4 w-4 ${membersLoading ? 'animate-spin' : ''}`} /></button></div>
              {membersLoading ? <p className="p-6 text-sm text-slate-500">Chargement…</p> : members.length === 0 ? <p className="p-6 text-sm text-slate-500">Aucun membre ni invitation.</p> : (
                <div className="divide-y divide-slate-100">
                  {members.map((member) => <article key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.full_name || member.email}</p><p className="truncate text-xs text-slate-500">{member.email}</p><p className="mt-1 text-xs text-slate-400">{member.status === 'INVITED' ? `Invitation · ${formatDate(member.invited_at)}` : member.status === 'REVOKED' ? `Révoqué · ${formatDate(member.revoked_at)}` : `Actif depuis ${formatDate(member.created_at)}`}</p></div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${member.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : member.status === 'INVITED' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{member.status === 'ACTIVE' ? 'Actif' : member.status === 'INVITED' ? 'En attente' : 'Révoqué'}</span>
                    {canChangeRoles && member.status !== 'REVOKED' && member.user_id !== profile?.id && <label className="sr-only" htmlFor={`role-${member.id}`}>Rôle de {member.email}</label>}
                    {canChangeRoles && member.status !== 'REVOKED' && member.user_id !== profile?.id && <select id={`role-${member.id}`} aria-label={`Rôle de ${member.email}`} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" value={member.role} onChange={(event) => void mutateMember(member, 'role', event.target.value as AgencyMemberRole)}>
                      {(isSuperAdmin ? Object.keys(roles) as AgencyMemberRole[] : ['agency_manager', 'agency_agent', 'viewer'] as AgencyMemberRole[]).map((role) => <option key={role} value={role}>{roles[role]}</option>)}
                    </select>}
                    {canChangeRoles && member.status !== 'REVOKED' && member.user_id !== profile?.id && <button type="button" disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50" onClick={() => void mutateMember(member, 'revoke')}>Révoquer</button>}
                  </article>)}
                </div>
              )}
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Les changements de rôle et révocations sont journalisés. Une invitation devient active après acceptation.</p>
            </div>
          )}
          {canReadMembers && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-bold">Historique des droits</h3>
              {audit.length === 0 ? <p className="mt-3 text-sm text-slate-500">Aucun changement enregistré.</p> : <ol className="mt-3 divide-y divide-slate-100">
                {audit.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{roleLabels[entry.action] ?? entry.action}</span><time className="text-xs text-slate-500" dateTime={entry.created_at}>{formatDate(entry.created_at)}</time></li>)}
              </ol>}
            </div>
          )}
        </div>
      )}

      {section === 'customers' && (
        !canReadCustomers ? <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Votre rôle ne permet pas de consulter les données personnelles des locataires.</p> : (
          <div className="space-y-4">
            <form onSubmit={applyCustomerSearch} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <div className="sm:col-span-2"><label htmlFor="customer-search" className="mb-1 block text-xs font-semibold">Nom, e-mail, téléphone ou référence</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input id="customer-search" className={`${inputClass} pl-9`} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={120} /></div></div>
              <div><label htmlFor="customer-status" className="mb-1 block text-xs font-semibold">Statut</label><select id="customer-status" className={inputClass} value={customerStatus} onChange={(event) => { setCustomerStatus(event.target.value); setCustomerPage(1); }}><option value="">Tous</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
              <div><label htmlFor="customer-from" className="mb-1 block text-xs font-semibold">À partir du</label><input id="customer-from" type="date" className={inputClass} value={customerFrom} onChange={(event) => { setCustomerFrom(event.target.value); setCustomerPage(1); }} /></div>
              <div><label htmlFor="customer-to" className="mb-1 block text-xs font-semibold">Jusqu’au</label><input id="customer-to" type="date" className={inputClass} value={customerTo} onChange={(event) => { setCustomerTo(event.target.value); setCustomerPage(1); }} /></div>
              <button type="submit" className="rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2 lg:col-span-5">Rechercher</button>
            </form>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {customersLoading ? <p className="p-6 text-sm text-slate-500">Chargement des dossiers…</p> : customerRows.length === 0 ? <p className="p-6 text-sm text-slate-500">Aucun dossier client correspondant.</p> : <table className="w-full min-w-[800px] text-left text-sm">
                <caption className="sr-only">Dossiers des clients ayant réservé auprès de {agencyName}</caption>
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Réservation</th><th className="px-4 py-3">Période</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{customerRows.map((customer) => {
                  const reference = customer.reference || customer.booking_ref || customer.id;
                  return <tr key={customer.id}><td className="px-4 py-3"><p className="font-semibold">{customer.customer_name}</p><p className="text-xs text-slate-500">{customer.vehicle ? `${customer.vehicle.brand} ${customer.vehicle.model}` : 'Véhicule'}</p></td><td className="px-4 py-3"><p>{customer.customer_email}</p><p className="text-xs text-slate-500">{customer.customer_phone}</p></td><td className="px-4 py-3 font-mono text-xs">{reference}</td><td className="px-4 py-3">{customer.start_date} – {customer.end_date}</td><td className="px-4 py-3">{customer.status}</td><td className="px-4 py-3"><button type="button" onClick={() => void openDossier(reference)} className="font-semibold text-[#0B1220] underline">Dossier</button></td></tr>;
                })}</tbody>
              </table>}
              <div className="p-4"><Pagination meta={customerMeta} onChange={(page) => setCustomerPage(page)} /></div>
            </div>
          </div>
        )
      )}

      {(dossier || dossierLoading || dossierError) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setDossier(null); setDossierError(null); } }}>
          <section ref={dossierDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="customer-dossier-title" className="max-h-[90vh] outline-none w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3"><div><h3 id="customer-dossier-title" className="text-lg font-bold">Dossier locataire</h3><p className="text-sm text-slate-500">Consultation limitée à l’agence autorisée.</p></div><button type="button" aria-label="Fermer" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => { setDossier(null); setDossierError(null); }}><X className="h-5 w-5" /></button></div>
            {dossierLoading && <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>}
            {dossierError && <p role="alert" className="py-5 text-sm text-red-700">{dossierError}</p>}
            {dossier && !dossierLoading && <><div className="mt-5 rounded-xl bg-slate-50 p-4"><h4 className="font-semibold">{dossier.dossier.customer_name}</h4><p className="text-sm">{dossier.dossier.customer_email} · {dossier.dossier.customer_phone}</p><p className="mt-1 text-xs text-slate-500">Dossier {dossier.dossier.reference || dossier.dossier.booking_ref || dossier.dossier.id}</p></div><h4 className="mt-5 font-semibold">Historique des locations</h4><ul className="mt-2 divide-y divide-slate-100">{dossier.history.map((booking) => <li key={booking.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{booking.reference || booking.booking_ref} · {booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : 'Véhicule'} · {booking.status}</span><span className="text-slate-500">{booking.start_date} – {booking.end_date}</span></li>)}</ul><Pagination meta={dossier.meta} onChange={(page) => void loadDossierPage(page)} /></>}
          </section>
        </div>
      )}
      {pendingRevoke && (
        <ConfirmDialog
          title="Révoquer cet accès ?"
          message={`${pendingRevoke.email} ne pourra plus accéder à l’espace de ${agencyName}.`}
          confirmLabel="Révoquer l’accès"
          destructive
          busy={busy}
          onConfirm={() => void mutateMember(pendingRevoke, 'revoke', undefined, true)}
          onCancel={() => setPendingRevoke(null)}
        />
      )}
    </section>
  );
}
