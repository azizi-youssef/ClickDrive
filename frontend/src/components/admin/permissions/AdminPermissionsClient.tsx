'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Key,
  Building2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  KpiCard,
  AdminCard,
  TableWrapper,
  Th,
  Td,
  TableSkeletonRows,
  EmptyState,
  Btn,
  StatusBadge,
} from '@/components/admin/AdminUI';
import { type UserRole } from '@clickdrive/shared/roles';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';

interface PermUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  agency?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface RbacCategory {
  category: string;
  permissions: Array<{
    name: string;
    key: string;
    roles: string[];
  }>;
}

interface PermissionsData {
  users: PermUser[];
  rbacMatrix: RbacCategory[];
  kpis: {
    totalUsers: number;
    superAdmins: number;
    platformAdmins: number;
    agencyManagers: number;
    customers: number;
  };
}

const ROLES_LIST: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT',
  'AGENCY_OWNER',
  'AGENCY_MANAGER',
  'AGENCY_STAFF',
  'CUSTOMER',
];

export function AdminPermissionsClient() {
  const [data, setData] = useState<PermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'security'>('matrix');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // État de mise à jour de rôle
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/permissions', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur chargement des permissions');
      }

      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de récupérer les permissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Rafraîchissement automatique
  useRealtimeRefresh({
    tables: ['profiles'],
    onRefresh: () => loadData(false),
    pollingIntervalMs: 60_000, // Realtime pousse les changements ; le polling ne sert que de filet de sécurité
  });

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Échec de modification du rôle');
      }

      setActionSuccess(`Rôle mis à jour avec succès : ${newRole}`);
      void loadData(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erreur modification rôle');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return (data?.users || []).filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.agency?.name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.users, roleFilter, search]);

  return (
    <div className="space-y-6">
      {/* KPIs RBAC */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          loading={loading && !data}
          label="Super Administrateurs"
          value={data?.kpis.superAdmins ?? 0}
          sub="Accès global complet"
          icon={ShieldCheck}
          tone="danger"
        />
        <KpiCard
          loading={loading && !data}
          label="Admins Plateforme"
          value={data?.kpis.platformAdmins ?? 0}
          sub="Équipe opérationnelle"
          icon={Key}
          tone="info"
        />
        <KpiCard
          loading={loading && !data}
          label="Gestionnaires Agence"
          value={data?.kpis.agencyManagers ?? 0}
          sub="Propriétaires & Staff"
          icon={Building2}
          tone="neutral"
        />
        <KpiCard
          loading={loading && !data}
          label="Clients inscrits"
          value={data?.kpis.customers ?? 0}
          sub={`sur ${data?.kpis.totalUsers ?? 0} comptes au total`}
          icon={Users}
          tone="neutral"
        />
      </div>

      {/* Barre de navigation par onglets */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'matrix'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Matrice des permissions RBAC
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Utilisateurs & Gestion des rôles ({data?.users.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'security'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Architecture de sécurité & RLS
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ONGLET 1 : Matrice des permissions RBAC */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {(data?.rbacMatrix || []).map((cat, idx) => (
            <AdminCard key={idx} title={cat.category}>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                      <Th className="w-1/3 py-2.5">Fonctionnalité / Permission</Th>
                      <Th className="text-center py-2.5">Super Admin</Th>
                      <Th className="text-center py-2.5">Admin Plateforme</Th>
                      <Th className="text-center py-2.5">Owner Agence</Th>
                      <Th className="text-center py-2.5">Manager Agence</Th>
                      <Th className="text-center py-2.5">Staff Agence</Th>
                      <Th className="text-center py-2.5">Client</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {cat.permissions.map((perm) => (
                      <tr key={perm.key} className="hover:bg-slate-50/70 transition-colors">
                        <Td className="font-medium text-slate-800 py-3">
                          <div>
                            <span className="block font-semibold text-slate-900">{perm.name}</span>
                            <span className="font-mono text-[11px] text-slate-400">{perm.key}</span>
                          </div>
                        </Td>
                        {ROLES_LIST.filter((r) => r !== 'SUPPORT').map((r) => {
                          const hasAccess = perm.roles.includes(r);
                          return (
                            <Td key={r} className="text-center py-3">
                              {hasAccess ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono text-sm">—</span>
                              )}
                            </Td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* ONGLET 2 : Liste des Utilisateurs & Attribution des Rôles */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2 max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email, agence..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="ALL">Tous les rôles</option>
                {ROLES_LIST.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Btn
                variant="outline"
                size="sm"
                onClick={() => loadData(false)}
                loading={refreshing}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Actualiser
              </Btn>
            </div>
          </div>

          <TableWrapper>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  <Th>Utilisateur</Th>
                  <Th>Email</Th>
                  <Th>Téléphone</Th>
                  <Th>Agence Rattachée</Th>
                  <Th>Rôle Actuel</Th>
                  <Th className="text-right">Modifier le rôle</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && !data ? (
                  <TableSkeletonRows cols={6} rows={6} />
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={Users}
                        title="Aucun utilisateur trouvé"
                        description="Aucun compte ne correspond aux filtres sélectionnés."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSuperAdmin = u.role === 'SUPER_ADMIN';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-slate-100 text-[#0B1220] font-bold text-xs flex items-center justify-center">
                              {u.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{u.fullName}</span>
                          </div>
                        </Td>
                        <Td>
                          <span className="text-xs text-slate-600">{u.email}</span>
                        </Td>
                        <Td>
                          <span className="text-xs text-slate-600">{u.phone}</span>
                        </Td>
                        <Td>
                          {u.agency ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              <Building2 className="h-3 w-3 text-slate-500" />
                              {u.agency.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Siège ClickDrive</span>
                          )}
                        </Td>
                        <Td>
                          <StatusBadge
                            variant={
                              isSuperAdmin
                                ? 'error'
                                : u.role === 'ADMIN'
                                ? 'warning'
                                : u.role.includes('AGENCY')
                                ? 'info'
                                : 'neutral'
                            }
                          >
                            {u.role}
                          </StatusBadge>
                        </Td>
                        <Td className="text-right">
                          <select
                            disabled={updatingUserId === u.id}
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {ROLES_LIST.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableWrapper>
        </div>
      )}

      {/* ONGLET 3 : Architecture de Sécurité & RLS */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AdminCard title="Row-Level Security (RLS) PostgreSQL">
            <div className="mt-3 space-y-3 text-xs text-slate-600">
              <p>
                ClickDrive applique le principe du moindre privilège grâce aux règles RLS de PostgreSQL et Supabase :
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Isolation stricte inter-agences :</strong> Une agence partenaire ne peut sous aucun prétexte lire ou modifier les véhicules, réservations ou données financières d'une autre agence.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Protection des données sensibles clients :</strong> Seuls le numéro CIN et le permis sont exposés à l'agence détentrice du contrat pour la remise des clés.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Garantie d'idempotence :</strong> Verrouillage pessimiste anti-double réservation sur les plages temporelles de chaque véhicule.</span>
                </li>
              </ul>
            </div>
          </AdminCard>

          <AdminCard title="Audit Trail & Immutabilité">
            <div className="mt-3 space-y-3 text-xs text-slate-600">
              <p>
                Toutes les opérations sensibles sont tracées de manière inviolable :
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Table audit_logs :</strong> Journalise les connexions, modifications de commissions, suspensions d'agences et attributions de rôles.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Table booking_events :</strong> Historise le cycle de vie complet de chaque contrat (demande, validation agence, départ avec relevé kilométrique, retour).</span>
                </li>
              </ul>
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
}
