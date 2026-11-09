'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollText,
  RefreshCw,
  X,
  Code,
  User,
  Clock,
} from 'lucide-react';
import {
  AdminCard,
  TableWrapper,
  Th,
  Td,
  TableSkeletonRows,
  EmptyState,
  Pagination,
  SearchInput,
  SelectFilter,
  Btn,
  ErrorBanner,
  StatusBadge,
} from '@/components/admin/AdminUI';
import { useModalDialog } from '@/lib/a11y/useModalDialog';

export type AuditLogItem = {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  profiles?: { email?: string; full_name?: string } | null;
};

const ENTITY_OPTIONS = [
  { value: 'ALL', label: 'Toutes entités' },
  { value: 'BOOKING', label: 'Réservations' },
  { value: 'AGENCY', label: 'Agences' },
  { value: 'VEHICLE', label: 'Véhicules' },
  { value: 'SETTINGS', label: 'Paramètres' },
  { value: 'AUTH', label: 'Authentification' },
  { value: 'SECURITY', label: 'Sécurité' },
];

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'Toutes actions' },
  { value: 'CREATE', label: 'Création' },
  { value: 'UPDATE', label: 'Mise à jour' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'STATUS_CHANGE', label: 'Changement de statut' },
  { value: 'VERIFICATION', label: 'Vérification' },
];

const PAGE_SIZE = 15;

export function AdminAuditClient() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const auditDialogRef = useModalDialog<HTMLDivElement>(Boolean(selectedLog), { onClose: () => setSelectedLog(null) });

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/audit?pageSize=100', {
        cache: 'no-store',
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }

      const body = await res.json();
      if (!ctrl.signal.aborted) {
        setLogs(body.data ?? []);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement des journaux d’audit');
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load('initial');
    return () => abortRef.current?.abort();
  }, [load]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (entityType !== 'ALL' && log.entity_type.toUpperCase() !== entityType) return false;
      if (actionFilter !== 'ALL' && !log.action.toUpperCase().includes(actionFilter)) return false;
      if (!q) return true;

      const actor = (log.profiles?.email || log.profiles?.full_name || log.user_id || '').toLowerCase();
      const action = log.action.toLowerCase();
      const entity = log.entity_type.toLowerCase();
      const entityId = log.entity_id.toLowerCase();

      return (
        actor.includes(q) ||
        action.includes(q) ||
        entity.includes(q) ||
        entityId.includes(q)
      );
    });
  }, [logs, search, entityType, actionFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(
    () => filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredLogs, page]
  );

  useEffect(() => {
    setPage(0);
  }, [search, entityType, actionFilter]);

  const getActionBadgeVariant = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REVOKE') || act.includes('REJECT')) return 'error';
    if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('CHANGE')) return 'warning';
    if (act.includes('CREATE') || act.includes('ACCEPT') || act.includes('APPROVE') || act.includes('VERIF')) return 'success';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Top filters bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Rechercher par action, entité, ID ou acteur..."
            value={search}
            onChange={setSearch}
            className="w-72"
          />
          <SelectFilter
            value={entityType}
            onChange={setEntityType}
            options={ENTITY_OPTIONS}
            className="w-44"
          />
          <SelectFilter
            value={actionFilter}
            onChange={setActionFilter}
            options={ACTION_OPTIONS}
            className="w-48"
          />
        </div>

        <Btn
          variant="secondary"
          onClick={() => void load('refresh')}
          disabled={refreshing}
          className="self-end sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Btn>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => void load('refresh')}
          retrying={refreshing}
        />
      )}

      {/* Main Table Card */}
      <AdminCard className="p-0 overflow-hidden">
        <TableWrapper>
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/75">
              <tr>
                <Th>Horodatage</Th>
                <Th>Acteur</Th>
                <Th>Action</Th>
                <Th>Entité / ID</Th>
                <Th className="text-right">Métadonnées</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableSkeletonRows cols={5} rows={8} />
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={ScrollText}
                      title="Aucun journal d'audit trouvé"
                      description={
                        search || entityType !== 'ALL' || actionFilter !== 'ALL'
                          ? 'Aucune opération ne correspond à vos filtres de recherche.'
                          : 'Aucune opération sensible enregistrée pour le moment.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const dateStr = new Date(log.created_at).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  });
                  const actorName = log.profiles?.full_name || log.profiles?.email || log.user_id || 'Système';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <Td className="whitespace-nowrap font-mono text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-slate-100 p-1 text-slate-600">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-900">{actorName}</p>
                            {log.profiles?.email && log.profiles?.full_name && (
                              <p className="text-[11px] text-slate-400">{log.profiles.email}</p>
                            )}
                          </div>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <StatusBadge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </StatusBadge>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold uppercase text-slate-700 tracking-wider">
                            {log.entity_type}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 truncate max-w-45">
                            {log.entity_id}
                          </span>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap text-right">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
                          >
                            <Code className="h-3.5 w-3.5" />
                            <span>Inspecter</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableWrapper>

        {!loading && filteredLogs.length > 0 && (
          <div className="px-5 pb-4 sm:px-6">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={filteredLogs.length}
              pageSize={PAGE_SIZE}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            />
          </div>
        )}
      </AdminCard>

      {/* JSON Metadata Inspector Modal */}
      {selectedLog && (
        <div
          ref={auditDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-log-title"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-600" />
                <h3 id="audit-log-title" className="font-semibold text-slate-900">
                  Détails de l'événement #{selectedLog.id.slice(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Action :</span>{' '}
                  <span className="font-medium text-slate-900">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-500">Entité :</span>{' '}
                  <span className="font-medium text-slate-900">{selectedLog.entity_type}</span>
                </div>
                <div>
                  <span className="text-slate-500">Identifiant :</span>{' '}
                  <span className="font-mono text-slate-700">{selectedLog.entity_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Date :</span>{' '}
                  <span className="font-medium text-slate-900">
                    {new Date(selectedLog.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Métadonnées JSON
                </p>
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-3 bg-slate-50 flex justify-end">
              <Btn variant="primary" onClick={() => setSelectedLog(null)}>
                Fermer
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
