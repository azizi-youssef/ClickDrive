'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Database, Globe, Zap } from 'lucide-react';
import { AdminCard, SectionHeader, Btn, ErrorBanner } from '@/components/admin/AdminUI';
import { fetchHealth, type HealthReport } from '@/lib/api/admin-dashboard.api';

const SERVICE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  app: { label: 'Application Next.js', icon: Globe },
  database: { label: 'Base de données', icon: Database },
  supabase: { label: 'Supabase API', icon: Database },
  auth: { label: 'Service d\'authentification', icon: Zap },
  storage: { label: 'Stockage fichiers', icon: Database },
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'error') return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === 'ok' || status === 'configured') return <CheckCircle className="h-5 w-5 text-emerald-500" />;
  return <AlertTriangle className="h-5 w-5 text-amber-500" />;
}

export function AdminHealthClient() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
      setCheckedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de vérifier l\'état du système');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load('initial'); }, [load]);

  const allOk = health && Object.values(health.checks).every((v) => v !== 'error');

  return (
    <div className="space-y-6 max-w-3xl">
      {error && <ErrorBanner message={error} onRetry={() => void load('refresh')} retrying={refreshing} />}

      {/* Overall status */}
      {!loading && health && (
        <div className={`rounded-xl border px-6 py-5 flex items-center gap-4 ${
          allOk ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
        }`}>
          {allOk
            ? <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
            : <XCircle className="h-8 w-8 text-red-500 shrink-0" />}
          <div>
            <p className={`text-lg font-bold ${allOk ? 'text-emerald-900' : 'text-red-900'}`}>
              {allOk ? 'Tous les services sont opérationnels' : 'Certains services rencontrent des problèmes'}
            </p>
            {checkedAt && (
              <p className="text-sm text-slate-500 mt-0.5">
                Vérifié à {checkedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <Btn variant="secondary" size="sm" onClick={() => void load('refresh')} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Vérifier
            </Btn>
          </div>
        </div>
      )}

      {/* Services */}
      <AdminCard noPadding>
        <div className="px-5 py-4 border-b border-slate-100 sm:px-6">
          <SectionHeader title="Services" subtitle="État en temps réel de chaque composant système" />
        </div>
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <div className="h-5 w-5 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : health ? (
          <ul className="divide-y divide-slate-50">
            {Object.entries(health.checks).map(([key, value]) => {
              const cfg = SERVICE_LABELS[key];
              const isOk = value !== 'error';
              return (
                <li key={key} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                  <StatusIcon status={value} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{cfg?.label ?? key}</p>
                    <p className={`text-xs mt-0.5 ${isOk ? 'text-emerald-600' : 'text-red-600'}`}>
                      {value === 'ok' ? 'Opérationnel' :
                        value === 'configured' ? 'Configuré' :
                        value === 'skipped' ? 'Non configuré' :
                        value === 'error' ? 'Erreur détectée' : value}
                    </p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${isOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            Impossible de récupérer l'état du système.
          </div>
        )}
      </AdminCard>

      {/* Timestamp */}
      {health?.timestamp && (
        <p className="text-xs text-slate-400 text-center">
          Dernière vérification serveur : {new Date(health.timestamp).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
}
