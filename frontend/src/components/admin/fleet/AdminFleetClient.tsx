'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { Car, Motorbike, RefreshCw } from 'lucide-react';
import type { Vehicle } from '@/types';
import {
  CAR_CATEGORIES,
  MOTORCYCLE_CATEGORIES,
  VEHICLE_TYPE_LABELS,
  formatEngineCc,
  vehicleTypeOf,
  type VehicleType,
} from '@/lib/vehicles/kind';
import {
  AdminCard, TableWrapper, Th, Td, TableSkeletonRows,
  EmptyState, Pagination, SearchInput, SelectFilter, Btn, ErrorBanner, StatusBadge,
} from '@/components/admin/AdminUI';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';

const PAGE_SIZE = 20;
const FLEET_PATHS: Record<VehicleType, string> = { CAR: '/admin/fleet', MOTORCYCLE: '/admin/fleet/motos' };

/** Flotte de la marketplace : voitures et motos dans deux listes distinctes */
export function AdminFleetClient({ vehicleType = 'CAR' }: { vehicleType?: VehicleType }) {
  const isMotoList = vehicleType === 'MOTORCYCLE';
  const categoryOptions = [
    { value: 'ALL', label: 'Toutes catégories' },
    ...(isMotoList ? MOTORCYCLE_CATEGORIES : CAR_CATEGORIES).map((value) => ({ value, label: value })),
  ];
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/vehicles?onlyPublished=false&limit=500', { cache: 'no-store' });
      const body = await res.json();
      if (!ctrl.signal.aborted) setVehicles(body.data ?? body.vehicles ?? []);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      if (!ctrl.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { void load('initial'); return () => abortRef.current?.abort(); }, [load]);

  // Rafraîchissement automatique en direct de la flotte
  useRealtimeRefresh({
    tables: ['vehicles'],
    onRefresh: () => load('refresh'),
    pollingIntervalMs: 60_000, // Realtime pousse les changements ; le polling ne sert que de filet de sécurité
  });

  const typeCounts = useMemo(() => {
    const counts: Record<VehicleType, number> = { CAR: 0, MOTORCYCLE: 0 };
    for (const v of vehicles) counts[vehicleTypeOf(v)] += 1;
    return counts;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (vehicleTypeOf(v) !== vehicleType) return false;
      if (category !== 'ALL' && v.category !== category) return false;
      if (!q) return true;
      return (
        `${v.brand} ${v.model}`.toLowerCase().includes(q) ||
        (v.agency?.name ?? '').toLowerCase().includes(q) ||
        (v.license_plate ?? '').toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, category, vehicleType]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  useEffect(() => setPage(0), [search, category]);

  const vehicleStatusVariant = (s: string) =>
    s === 'AVAILABLE' ? 'success' : s === 'RENTED' ? 'error' : s === 'MAINTENANCE' ? 'warning' : 'neutral';
  const vehicleStatusLabel = (s: string) =>
    s === 'AVAILABLE' ? 'Disponible' : s === 'RENTED' ? 'Loué' : s === 'MAINTENANCE' ? 'Entretien' : s === 'BLOCKED' ? 'Bloqué' : s;

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onRetry={() => void load('refresh')} retrying={refreshing} />}
      <nav aria-label="Type de véhicule" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {(['CAR', 'MOTORCYCLE'] as const).map((type) => {
          const active = type === vehicleType;
          const Icon = type === 'MOTORCYCLE' ? Motorbike : Car;
          return (
            <Link
              key={type}
              href={FLEET_PATHS[type]}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'inline-flex min-h-9 items-center gap-2 rounded-lg bg-ink px-3.5 text-sm font-semibold text-white'
                  : 'inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {VEHICLE_TYPE_LABELS[type].plural}
              {!loading && <span className={active ? 'text-slate-300' : 'text-slate-400'}>{typeCounts[type]}</span>}
            </Link>
          );
        })}
      </nav>
      <AdminCard noPadding>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 border-b border-slate-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Marque, modèle, agence, plaque…" className="flex-1" />
          <div className="flex items-center gap-2">
            <SelectFilter value={category} onChange={setCategory} options={categoryOptions} label="Filtrer par catégorie" />
            <Btn variant="secondary" size="sm" onClick={() => void load('refresh')} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Btn>
          </div>
        </div>
        <TableWrapper>
          <thead className="bg-slate-50">
            <tr>
              <Th>{isMotoList ? 'Moto' : 'Voiture'}</Th>
              <Th className="hidden sm:table-cell">Catégorie</Th>
              <Th className="hidden md:table-cell">Agence</Th>
              <Th className="hidden lg:table-cell">Prix/jour</Th>
              <Th className="hidden xl:table-cell">Plaque</Th>
              <Th>Statut</Th>
              <Th className="hidden sm:table-cell">Publié</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? <TableSkeletonRows cols={7} rows={8} /> :
              paginated.length === 0 ? (
                <tr><td colSpan={7} className="py-0">
                  <EmptyState
                    icon={isMotoList ? Motorbike : Car}
                    title={isMotoList ? 'Aucune moto' : 'Aucune voiture'}
                    description={
                      search || category !== 'ALL'
                        ? 'Aucun résultat pour ces filtres.'
                        : isMotoList
                          ? 'Aucune agence n’a encore publié de moto.'
                          : 'Aucune agence n’a encore publié de voiture.'
                    }
                  />
                </td></tr>
              ) : paginated.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <Td>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{v.brand} {v.model}</p>
                      <p className="text-xs text-slate-500">
                        {[v.year, v.transmission === 'AUTOMATIC' ? 'Auto' : 'Manuelle', isMotoList ? formatEngineCc(v.engine_cc) : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell"><span className="text-xs text-slate-600">{v.category}</span></Td>
                  <Td className="hidden md:table-cell"><span className="text-sm text-slate-700 truncate max-w-35 block">{v.agency?.name ?? '—'}</span></Td>
                  <Td className="hidden lg:table-cell"><span className="text-sm font-semibold tabular-nums text-slate-900">{v.daily_price} DH</span></Td>
                  <Td className="hidden xl:table-cell"><span className="font-mono text-xs text-slate-500">{v.license_plate ?? '—'}</span></Td>
                  <Td><StatusBadge variant={vehicleStatusVariant(v.status) as any}>{vehicleStatusLabel(v.status)}</StatusBadge></Td>
                  <Td className="hidden sm:table-cell">
                    <span className={`text-xs font-medium ${v.published ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {v.published ? '✓ Oui' : '— Non'}
                    </span>
                  </Td>
                </tr>
              ))
            }
          </tbody>
        </TableWrapper>
        <div className="px-5 pb-4 sm:px-6">
          <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </div>
      </AdminCard>
    </div>
  );
}
