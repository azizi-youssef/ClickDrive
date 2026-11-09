'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  KeyRound,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  Car,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type { Agency, AgencySubscription } from '@/types';
import {
  AdminCard,
  TableWrapper,
  Th,
  Td,
  TableSkeletonRows,
  AgencyStatusBadge,
  EmptyState,
  Pagination,
  SearchInput,
  SelectFilter,
  Btn,
  ErrorBanner,
} from '@/components/admin/AdminUI';
import {
  fetchAdminAgenciesPaged,
  patchAgencyVerification,
  type AdminAgency,
  type CreatedAgencyResponse,
} from '@/lib/api/admin-dashboard.api';
import { AddAgencyModal } from './AddAgencyModal';
import { EditAgencyModal } from './EditAgencyModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { DeleteAgencyModal } from './DeleteAgencyModal';
import { AgencyCredentialsSuccessModal } from './AgencyCredentialsSuccessModal';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actives' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'SUSPENDED', label: 'Suspendues' },
  { value: 'ARCHIVED', label: 'Archivées' },
];

const CITY_OPTIONS = [
  { value: 'ALL', label: 'Toutes les villes' },
  { value: 'Nador', label: 'Nador' },
  { value: 'Oujda', label: 'Oujda' },
  { value: 'Berkane', label: 'Berkane' },
  { value: 'Al Hoceima', label: 'Al Hoceima' },
  { value: 'Driouch', label: 'Driouch' },
  { value: 'Selouane', label: 'Selouane' },
  { value: 'Tanger', label: 'Tanger' },
  { value: 'Casablanca', label: 'Casablanca' },
];

export function AdminAgenciesClient({ initialStatus = 'ALL' }: { initialStatus?: string }) {
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [subscriptionsMap, setSubscriptionsMap] = useState<Record<string, AgencySubscription>>({});
  const [totalAgencies, setTotalAgencies] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    STATUS_OPTIONS.some((option) => option.value === initialStatus) ? initialStatus : 'ALL'
  );
  const [cityFilter, setCityFilter] = useState('ALL');
  const [page, setPage] = useState(0);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [resetPwdAgency, setResetPwdAgency] = useState<Agency | null>(null);
  const [deletingAgency, setDeletingAgency] = useState<AdminAgency | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    data: {
      email: string;
      temporaryPassword: string;
      agencyName: string;
      manager_name?: string;
    } | null;
  }>({ isOpen: false, data: null });

  // Action status
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  // Agence dont la suspension attend une confirmation explicite
  const [pendingSuspension, setPendingSuspension] = useState<AdminAgency | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [res, subRes] = await Promise.all([
          fetchAdminAgenciesPaged({
            page: page + 1,
            pageSize: PAGE_SIZE,
            q: search.trim() || undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            city: cityFilter !== 'ALL' ? cityFilter : undefined,
          }),
          fetch('/api/admin/subscriptions').then((r) => r.json()).catch(() => null),
        ]);

        if (!ctrl.signal.aborted) {
          setAgencies(res.agencies);
          setTotalAgencies(res.total);
          setTotalPages(res.totalPages);

          if (subRes?.success && Array.isArray(subRes.data?.subscriptions)) {
            const map: Record<string, AgencySubscription> = {};
            for (const s of subRes.data.subscriptions) {
              map[s.agency_id] = s;
            }
            setSubscriptionsMap(map);
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erreur lors du chargement des agences.');
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, statusFilter, cityFilter]
  );

  useEffect(() => {
    void load('initial');
    return () => abortRef.current?.abort();
  }, [load]);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, cityFilter]);

  const handleToggleStatus = async (agency: AdminAgency, confirmed = false) => {
    const isActivating = agency.status !== 'ACTIVE';
    if (!isActivating && !confirmed) {
      setPendingSuspension(agency);
      return;
    }
    setPendingSuspension(null);

    setActionInProgressId(agency.id);
    try {
      await patchAgencyVerification(agency.id, {
        status: isActivating ? 'ACTIVE' : 'SUSPENDED',
        verified: isActivating,
      });

      showToast(
        isActivating
          ? `L'agence "${agency.name}" a été activée. Accès débloqué.`
          : `L'agence "${agency.name}" a été suspendue. Accès bloqué.`,
        isActivating ? 'success' : 'info'
      );
      void load('refresh');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de mise à jour.', 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleCreatedSuccess = (res: CreatedAgencyResponse) => {
    showToast(`Agence "${res.data.name}" créée avec succès !`);
    void load('refresh');
    setCredentialsModal({
      isOpen: true,
      data: {
        email: res.credentials.email,
        temporaryPassword: res.credentials.temporaryPassword,
        agencyName: res.data.name,
        manager_name: res.credentials.manager_name,
      },
    });
  };

  const handlePasswordResetSuccess = (creds: {
    email: string;
    temporaryPassword: string;
    agencyName: string;
  }) => {
    showToast(`Mot de passe réinitialisé pour "${creds.agencyName}".`);
    setCredentialsModal({
      isOpen: true,
      data: {
        email: creds.email,
        temporaryPassword: creds.temporaryPassword,
        agencyName: creds.agencyName,
      },
    });
  };

  const handleDeleteSuccess = (result: { mode: 'archived' | 'deleted'; message: string }) => {
    showToast(result.message, result.mode === 'deleted' ? 'info' : 'success');
    void load('refresh');
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 rounded-xl border px-5 py-3.5 shadow-xl text-xs font-semibold flex items-center gap-2.5 animate-slide-up ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : toast.type === 'info'
              ? 'border-blue-200 bg-blue-50 text-blue-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Banner and Quick Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Gestion des Agences Partenaires
          </h2>
          <p className="text-xs text-slate-500">
            {totalAgencies} agence{totalAgencies > 1 ? 's' : ''} enregistrée{totalAgencies > 1 ? 's' : ''} sur la plateforme
          </p>
        </div>

        <Btn
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          className="self-start sm:self-auto shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une agence
        </Btn>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => void load('refresh')}
          retrying={refreshing}
        />
      )}

      {/* Filter and Search Bar */}
      <AdminCard noPadding>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 border-b border-slate-100 bg-white">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher par nom, email, ville, téléphone..."
            className="flex-1"
          />

          <div className="flex flex-wrap items-center gap-2">
            <SelectFilter
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              className="w-full sm:w-44"
            />
            <SelectFilter
              value={cityFilter}
              onChange={setCityFilter}
              options={CITY_OPTIONS}
              className="w-full sm:w-48"
            />
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => void load('refresh')}
              disabled={refreshing}
              title="Rafraîchir"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Btn>
          </div>
        </div>

        {/* Table */}
        <TableWrapper tableClassName="min-w-[1180px]">
          <thead className="bg-slate-50/75">
            <tr>
              <Th>Agence & Compte</Th>
              <Th className="hidden sm:table-cell">Ville & Région</Th>
              <Th className="hidden md:table-cell">Contact</Th>
              <Th className="hidden lg:table-cell text-center">Flotte</Th>
              <Th className="hidden md:table-cell">Forfait</Th>
              <Th className="hidden xl:table-cell">Créée le</Th>
              <Th>Statut</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <TableSkeletonRows cols={8} rows={8} />
            ) : agencies.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-0">
                  <EmptyState
                    icon={Building2}
                    title="Aucune agence trouvée"
                    description={
                      search || statusFilter !== 'ALL' || cityFilter !== 'ALL'
                        ? 'Aucune agence ne correspond à vos filtres de recherche.'
                        : 'Aucune agence n’est encore configurée. Ajoutez votre première agence partenaire.'
                    }
                    action={
                      !search && statusFilter === 'ALL' && cityFilter === 'ALL' ? (
                        <Btn variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Ajouter la première agence
                        </Btn>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              agencies.map((agency) => {
                const initials = agency.name
                  .split(' ')
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const createdAtStr = new Date(agency.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                const isSuspended = agency.status === 'SUSPENDED';
                const isArchived = Boolean(agency.archived_at);

                return (
                  <tr
                    key={agency.id}
                    className={`hover:bg-slate-50/75 transition-colors ${
                      isArchived ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    {/* Agence & Email */}
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-linear-to-br from-red-500 to-rose-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs border border-red-400/20">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {agency.name}
                          </p>
                          <p className="text-xs font-mono text-slate-500 truncate max-w-50">
                            {agency.email}
                          </p>
                        </div>
                      </div>
                    </Td>

                    {/* Ville & Région */}
                    <Td className="hidden sm:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{agency.city}</span>
                        <span className="text-slate-400">· Oriental</span>
                      </div>
                    </Td>

                    {/* Contact */}
                    <Td className="hidden md:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{agency.phone}</span>
                      </div>
                    </Td>

                    {/* Flotte */}
                    <Td className="hidden lg:table-cell text-center whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                        title={
                          agency.vehicle_count == null
                            ? 'Le nombre de véhicules n’a pas été transmis.'
                            : `${agency.vehicle_count} véhicule(s) dans cette agence.`
                        }
                      >
                        <Car className="h-3 w-3" />
                        <span>{agency.vehicle_count == null ? 'Non transmis' : agency.vehicle_count}</span>
                      </span>
                    </Td>

                    {/* Forfait Abonnements */}
                    <Td className="hidden md:table-cell whitespace-nowrap">
                      {(() => {
                        const sub = subscriptionsMap[agency.id];
                        if (!sub) {
                          return <span className="text-xs text-slate-400">Non abonné</span>;
                        }
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0B1220] border border-blue-200">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            {sub.plan.name}
                          </span>
                        );
                      })()}
                    </Td>

                    {/* Créée le */}
                    <Td className="hidden xl:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{createdAtStr}</span>
                      </div>
                    </Td>

                    {/* Statut */}
                    <Td className="whitespace-nowrap">
                      <AgencyStatusBadge
                        status={isArchived ? 'ARCHIVED' : (agency.status as any)}
                      />
                    </Td>

                    {/* Actions */}
                    <Td className="text-right whitespace-nowrap">
                      <div className="flex flex-nowrap items-center justify-end gap-2">
                        {/* Quick Activation Toggle */}
                        {!isArchived && (
                          <button
                            type="button"
                            disabled={actionInProgressId === agency.id}
                            onClick={() => handleToggleStatus(agency)}
                            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              isSuspended
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                            title={isSuspended ? 'Réactiver l’agence' : 'Suspendre l’agence'}
                          >
                            {actionInProgressId === agency.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : isSuspended ? (
                              <>
                                <CheckCircle className="h-3 w-3 text-emerald-600" />
                                <span>Activer</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 text-slate-500" />
                                <span>Suspendre</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingAgency(agency)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Modifier
                        </button>

                        <button
                          type="button"
                          onClick={() => setResetPwdAgency(agency)}
                          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                          Réinitialiser
                        </button>

                        {!isArchived && (
                          <button
                            type="button"
                            disabled={actionInProgressId === agency.id}
                            onClick={() => setDeletingAgency(agency)}
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Supprimer / archiver
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrapper>

        {/* Distinct Table Footer & Pagination */}
        {!loading && agencies.length > 0 && (
          <div className="bg-slate-50/75 px-5 py-3.5 sm:px-6 border-t border-slate-200 flex items-center justify-between">
            <Pagination
              page={page}
              pageCount={totalPages}
              total={totalAgencies}
              pageSize={PAGE_SIZE}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </div>
        )}
      </AdminCard>

      {/* Modals */}
      <AddAgencyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleCreatedSuccess}
      />

      <EditAgencyModal
        isOpen={Boolean(editingAgency)}
        onClose={() => setEditingAgency(null)}
        agency={editingAgency}
        onSuccess={(updated) => {
          showToast(`Informations de "${updated.name}" mises à jour.`);
          void load('refresh');
        }}
      />

      <ResetPasswordModal
        isOpen={Boolean(resetPwdAgency)}
        onClose={() => setResetPwdAgency(null)}
        agency={resetPwdAgency}
        onSuccess={handlePasswordResetSuccess}
      />

      <DeleteAgencyModal
        isOpen={Boolean(deletingAgency)}
        onClose={() => setDeletingAgency(null)}
        agency={deletingAgency}
        onSuccess={handleDeleteSuccess}
      />

      <AgencyCredentialsSuccessModal
        isOpen={credentialsModal.isOpen}
        onClose={() => setCredentialsModal({ isOpen: false, data: null })}
        credentials={credentialsModal.data}
      />
      {pendingSuspension && (
        <ConfirmDialog
          title="Suspendre cette agence ?"
          message={`« ${pendingSuspension.name} » perdra l’accès à son espace et ses véhicules ne seront plus proposés. Vous pourrez la réactiver à tout moment.`}
          confirmLabel="Suspendre l’agence"
          destructive
          busy={actionInProgressId === pendingSuspension.id}
          onConfirm={() => void handleToggleStatus(pendingSuspension, true)}
          onCancel={() => setPendingSuspension(null)}
        />
      )}
    </div>
  );
}
