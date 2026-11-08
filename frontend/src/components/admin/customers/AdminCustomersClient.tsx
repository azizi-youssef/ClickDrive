'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Repeat,
  FileText,
  MapPin,
  ExternalLink,
  MessageCircle,
  X,
  CreditCard,
  CheckCircle2,
  Clock,
  Shield,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  KpiCard,
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
  StatusBadge,
  ErrorBanner,
} from '@/components/admin/AdminUI';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  cin: string;
  country: string;
  bookingCount: number;
  totalSpent: number;
  lastBookingDate: string;
  lastBookingRef: string;
  lastStatus: string;
  firstBookingDate: string;
  bookings: Array<{
    id: string;
    reference: string;
    vehicleName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    status: string;
  }>;
}

const PAGE_SIZE = 15;

const COUNTRY_OPTIONS = [
  { value: 'ALL', label: 'Tous les pays' },
  { value: 'Maroc', label: 'Maroc' },
  { value: 'France', label: 'France (MRE)' },
  { value: 'Espagne', label: 'Espagne' },
  { value: 'Belgique', label: 'Belgique' },
  { value: 'Allemagne', label: 'Allemagne' },
  { value: 'Pays-Bas', label: 'Pays-Bas' },
];

export function AdminCustomersClient() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [kpis, setKpis] = useState<{
    totalCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    averageSpendPerCustomer: number;
    totalVolume: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('ALL');
  const [page, setPage] = useState(0);

  // Modal client sélectionné
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (country !== 'ALL') params.set('country', country);

      const res = await fetch(`/api/admin/customers?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur chargement clients');
      }

      setCustomers(json.data.customers || []);
      setKpis(json.data.kpis || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de récupérer la liste des clients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, country]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Rafraîchissement automatique en direct
  useRealtimeRefresh({
    tables: ['bookings'],
    onRefresh: () => loadData(false),
    pollingIntervalMs: 60_000, // Realtime pousse les changements ; le polling ne sert que de filet de sécurité
  });

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const paginatedCustomers = useMemo(() => {
    const start = page * PAGE_SIZE;
    return customers.slice(start, start + PAGE_SIZE);
  }, [customers, page]);

  const openWhatsApp = (phone: string, customerName: string) => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    const text = encodeURIComponent(`Bonjour ${customerName}, service support ClickDrive à votre écoute concernant vos réservations.`);
    window.open(`https://wa.me/${cleaned.startsWith('+') ? cleaned.slice(1) : cleaned}?text=${text}`, '_blank');
  };

  const exportCSV = () => {
    const rows = [
      ['Répertoire Clients ClickDrive'],
      ['Nom', 'Email', 'Téléphone', 'CIN/Passeport', 'Pays', 'Réservations', 'Total Dépensé (MAD)', 'Dernière Réservation'],
      ...customers.map((c) => [
        c.name,
        c.email,
        c.phone,
        c.cin,
        c.country,
        c.bookingCount,
        c.totalSpent,
        c.lastBookingRef,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clickdrive-clients-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* KPIs Clients */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          loading={loading && !kpis}
          label="Total clients uniques"
          value={kpis?.totalCustomers ?? 0}
          sub="Conducteurs enregistrés"
          icon={Users}
          tone="info"
        />
        <KpiCard
          loading={loading && !kpis}
          label="Clients fidélisés"
          value={kpis?.repeatCustomers ?? 0}
          sub={`${kpis?.repeatRate ?? 0} % reviennent louer`}
          progress={kpis?.repeatRate ?? 0}
          icon={Repeat}
          tone="success"
        />
        <KpiCard
          loading={loading && !kpis}
          label="Dépense moyenne"
          value={(kpis?.averageSpendPerCustomer ?? 0).toLocaleString('fr-FR')}
          unit="DH"
          sub="Par client"
          icon={CreditCard}
          tone="neutral"
        />
        <KpiCard
          loading={loading && !kpis}
          label="Volume total généré"
          value={(kpis?.totalVolume ?? 0).toLocaleString('fr-FR')}
          unit="DH"
          sub="Locations cumulées"
          icon={DollarSign}
          tone="neutral"
        />
      </div>

      {/* Barre d'outils (Recherche, Filtres, Export, Refresh) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(0); }}
              placeholder="Rechercher par nom, tél, email, CIN..."
            />
          </div>
          <div className="w-full sm:w-48">
            <SelectFilter
              value={country}
              onChange={(v) => { setCountry(v); setPage(0); }}
              options={COUNTRY_OPTIONS}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" onClick={exportCSV} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Exporter CSV
          </Btn>
          <Btn variant="secondary" size="sm" onClick={() => loadData(false)} disabled={refreshing} className="flex items-center gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Btn>
        </div>
      </div>

      {/* Table des clients */}
      {error && !customers.length ? (
        <ErrorBanner message={error} onRetry={() => loadData(true)} />
      ) : (
        <TableWrapper>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <Th>Client</Th>
                <Th>Contact</Th>
                <Th>Pièce Identité</Th>
                <Th>Pays</Th>
                <Th className="text-center">Locations</Th>
                <Th className="text-right">Total Dépensé</Th>
                <Th>Dernière Activité</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && !customers.length ? (
                <TableSkeletonRows cols={8} rows={6} />
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8">
                    <EmptyState
                      icon={Users}
                      title="Aucun client trouvé"
                      description="Aucun dossier client ne correspond aux critères de recherche actuels."
                    />
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((cust) => {
                  const initials = cust.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'CL';

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Identité */}
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-[#0B1220] text-xs">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{cust.name}</p>
                            <p className="text-xs text-slate-400">ID: {cust.id.slice(0, 10)}</p>
                          </div>
                        </div>
                      </Td>

                      {/* Contact */}
                      <Td>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{cust.phone}</span>
                            <button
                              onClick={() => openWhatsApp(cust.phone, cust.name)}
                              title="Ouvrir WhatsApp direct"
                              className="text-emerald-600 hover:text-emerald-700 ml-1"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {cust.email !== '—' && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span className="truncate max-w-35">{cust.email}</span>
                            </div>
                          )}
                        </div>
                      </Td>

                      {/* CIN */}
                      <Td>
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                          {cust.cin}
                        </span>
                      </Td>

                      {/* Pays */}
                      <Td>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {cust.country}
                        </span>
                      </Td>

                      {/* Nombre de réservations */}
                      <Td className="text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          cust.bookingCount > 1
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {cust.bookingCount} loc.
                        </span>
                      </Td>

                      {/* Total dépensé */}
                      <Td className="text-right">
                        <span className="font-bold text-slate-900">
                          {cust.totalSpent.toLocaleString('fr-FR')} DH
                        </span>
                      </Td>

                      {/* Dernière réservation */}
                      <Td>
                        <div className="text-xs">
                          <span className="font-mono font-medium text-blue-600 block">
                            {cust.lastBookingRef}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {cust.lastBookingDate ? cust.lastBookingDate.slice(0, 10) : '—'}
                          </span>
                        </div>
                      </Td>

                      {/* Actions */}
                      <Td className="text-right">
                        <Btn
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedCustomer(cust)}
                          className="text-xs"
                        >
                          Fiche dossier
                        </Btn>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200">
              <Pagination
                page={page}
                pageCount={totalPages}
                total={customers.length}
                pageSize={PAGE_SIZE}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              />
            </div>
          )}
        </TableWrapper>
      )}

      {/* Modal Fiche Client Détaillée */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
            {/* Header Modal */}
            <div className="bg-[#0B1220] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-sm">
                  {selectedCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base">{selectedCustomer.name}</h3>
                  <p className="text-xs text-blue-200">Dossier client & historique des contrats</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-6 space-y-6">
              {/* Synthèse coordonnées */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Téléphone :</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-slate-800">{selectedCustomer.phone}</span>
                    <button
                      onClick={() => openWhatsApp(selectedCustomer.phone, selectedCustomer.name)}
                      className="text-emerald-600 hover:text-emerald-700"
                      title="Envoyer WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block">Email :</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {selectedCustomer.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">CIN / Passeport :</span>
                  <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                    {selectedCustomer.cin}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Pays de résidence :</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {selectedCustomer.country}
                  </span>
                </div>
              </div>

              {/* Historique des réservations */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Historique des réservations ({selectedCustomer.bookingCount})
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {selectedCustomer.bookings.map((b) => (
                    <div key={b.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#0B1220]">{b.reference}</span>
                          <span className="font-medium text-slate-800">{b.vehicleName}</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          Du {b.startDate} au {b.endDate}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{b.totalPrice} DH</span>
                        <span className="text-[11px] text-slate-500 uppercase">{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Cumul total : <strong className="text-slate-900">{selectedCustomer.totalSpent.toLocaleString('fr-FR')} DH</strong>
                </div>
                <div className="flex gap-2">
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={() => openWhatsApp(selectedCustomer.phone, selectedCustomer.name)}
                    className="flex items-center gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Btn>
                  <Btn variant="primary" size="sm" onClick={() => setSelectedCustomer(null)}>
                    Fermer
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
