'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  KeyRound,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Car,
  User,
  Phone,
  Search,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type RentalItem = {
  id: string;
  reference?: string;
  booking_ref?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  cin?: string;
  start_date: string;
  end_date: string;
  pickup_time?: string;
  dropoff_time?: string;
  status: string;
  total_price: number;
  deposit_amount: number;
  delivery_type?: string;
  flight_number?: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    licensePlate?: string;
    unitNumber?: string;
    currentMileage: number;
    mainImage: string | null;
  } | null;
  isPickupToday: boolean;
  isReturnToday: boolean;
  isOverdueReturn: boolean;
};

export function AgencyRentalsPanel({
  agencyId,
  canManage,
}: {
  agencyId: string;
  canManage: boolean;
}) {
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'pickups' | 'returns' | 'active'>('all');
  const [search, setSearch] = useState('');

  // Handover modal
  const [activeHandover, setActiveHandover] = useState<{
    rental: RentalItem;
    type: 'PICKUP' | 'RETURN';
  } | null>(null);

  const [handoverForm, setHandoverForm] = useState({
    mileage: 0,
    fuelLevel: 'FULL' as 'EMPTY' | '1/4' | '1/2' | '3/4' | 'FULL',
    cleanliness: 'CLEAN' as 'CLEAN' | 'NORMAL' | 'DIRTY',
    checklist: {
      spareTire: true,
      jack: true,
      registrationDoc: true,
      insuranceDoc: true,
      safetyKit: true,
    },
    notes: '',
    damagesDescription: '',
    depositReturned: true,
    depositDeduction: 0,
  });

  const [handoverBusy, setHandoverBusy] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  const loadRentals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agencies/${agencyId}/rentals?tab=${tab}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors du chargement des opérations.');
      }
      setRentals(json.data ?? []);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : '') || 'Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  }, [agencyId, tab]);

  useEffect(() => {
    void loadRentals();
  }, [loadRentals]);

  const openHandover = (rental: RentalItem, type: 'PICKUP' | 'RETURN') => {
    const baseMileage = rental.vehicle?.currentMileage ?? 0;
    setHandoverForm({
      mileage: baseMileage,
      fuelLevel: 'FULL',
      cleanliness: 'CLEAN',
      checklist: {
        spareTire: true,
        jack: true,
        registrationDoc: true,
        insuranceDoc: true,
        safetyKit: true,
      },
      notes: '',
      damagesDescription: '',
      depositReturned: true,
      depositDeduction: 0,
    });
    setHandoverError(null);
    setActiveHandover({ rental, type });
  };

  const submitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHandover) return;
    setHandoverBusy(true);
    setHandoverError(null);

    try {
      const res = await fetch(
        `/api/agencies/${agencyId}/rentals/${activeHandover.rental.id}/handover`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: activeHandover.type,
            ...handoverForm,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors de la validation');
      }

      setActiveHandover(null);
      void loadRentals();
    } catch (err: unknown) {
      setHandoverError((err instanceof Error ? err.message : '') || 'Erreur lors de la validation');
    } finally {
      setHandoverBusy(false);
    }
  };

  const filteredRentals = rentals.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const ref = (r.reference || r.booking_ref || '').toLowerCase();
    const name = (r.customer_name || '').toLowerCase();
    const phone = (r.customer_phone || '').toLowerCase();
    const car = (
      r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model} ${r.vehicle.licensePlate}` : ''
    ).toLowerCase();
    return ref.includes(q) || name.includes(q) || phone.includes(q) || car.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Title banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Gestion de la remise des clés, états des lieux de départ et restitutions avec caution.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRentals()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Actualiser
        </button>
      </div>

      {/* Tabs and search toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={cn(
              'rounded-lg px-3 py-1.5 transition',
              tab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            )}
          >
            Tous les mouvements
          </button>
          <button
            type="button"
            onClick={() => setTab('pickups')}
            className={cn(
              'rounded-lg px-3 py-1.5 transition',
              tab === 'pickups' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            )}
          >
            Départs à effectuer
          </button>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={cn(
              'rounded-lg px-3 py-1.5 transition',
              tab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            )}
          >
            En circulation (Actifs)
          </button>
          <button
            type="button"
            onClick={() => setTab('returns')}
            className={cn(
              'rounded-lg px-3 py-1.5 transition',
              tab === 'returns' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            )}
          >
            Retours attendus
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher dossier, client, plaque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-sm focus:border-[#E63946] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
        </div>
      ) : filteredRentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-xs">
          <KeyRound className="mb-2 h-10 w-10 text-slate-300" />
          <h3 className="font-semibold text-slate-800">Aucun départ ou retour dans cette catégorie</h3>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les remises de clés et restitutions sont à jour.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRentals.map((item) => {
            const isConfirmedOrReady = ['CONFIRMED', 'APPROVED', 'READY_FOR_PICKUP'].includes(
              item.status
            );
            const isActive = item.status === 'ACTIVE';
            const isCompleted = item.status === 'COMPLETED';

            return (
              <div
                key={item.id}
                className={cn(
                  'flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between',
                  item.isOverdueReturn
                    ? 'border-red-300 bg-red-50/20'
                    : item.isPickupToday
                    ? 'border-amber-200 bg-amber-50/10'
                    : 'border-slate-200'
                )}
              >
                {/* Left: Vehicle Image & Specs */}
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {item.vehicle?.mainImage ? (
                      <Image
                        src={item.vehicle.mainImage}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Car className="m-auto h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {item.reference || item.booking_ref}
                      </span>
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase',
                          isConfirmedOrReady && 'bg-amber-100 text-amber-800',
                          isActive && 'bg-blue-100 text-blue-800',
                          isCompleted && 'bg-emerald-100 text-emerald-800'
                        )}
                      >
                        {isConfirmedOrReady && 'Prêt pour départ'}
                        {isActive && 'En circulation'}
                        {isCompleted && 'Restitué'}
                      </span>
                      {item.isOverdueReturn && (
                        <span className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          Retard restitution
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 font-bold text-slate-900">
                      {item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : 'Véhicule'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Plaque : {item.vehicle?.licensePlate || item.vehicle?.unitNumber || 'N/A'} •
                      Compteur actuel : {item.vehicle?.currentMileage.toLocaleString()} km
                    </p>
                  </div>
                </div>

                {/* Middle: Customer & Dates */}
                <div className="flex flex-col gap-1 text-xs text-slate-600 sm:w-1/3">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>{item.customer_name}</span>
                    {item.cin && <span className="text-slate-400">({item.cin})</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{item.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      Du {item.start_date} ({item.pickup_time || '10:00'}) au {item.end_date} (
                      {item.dropoff_time || '10:00'})
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0">
                  {canManage && isConfirmedOrReady && (
                    <button
                      type="button"
                      onClick={() => openHandover(item, 'PICKUP')}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Effectuer le départ
                    </button>
                  )}

                  {canManage && isActive && (
                    <button
                      type="button"
                      onClick={() => openHandover(item, 'RETURN')}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Restitution du véhicule
                    </button>
                  )}

                  {isCompleted && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Dossier clôturé
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Handover Inspection Modal */}
      {activeHandover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-[#E63946] uppercase">
                  {activeHandover.type === 'PICKUP' ? 'Fiche Départ' : 'Fiche Retour'}
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {activeHandover.type === 'PICKUP'
                    ? 'Remise des clés & Contrôle départ'
                    : 'Restitution du véhicule & Caution'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveHandover(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {handoverError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {handoverError}
              </div>
            )}

            <form onSubmit={submitHandover} className="mt-4 space-y-4">
              {/* Mileage & Fuel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kilométrage au compteur *
                  </label>
                  <input
                    type="number"
                    required
                    min={activeHandover.rental.vehicle?.currentMileage ?? 0}
                    value={handoverForm.mileage}
                    onChange={(e) =>
                      setHandoverForm({ ...handoverForm, mileage: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#E63946]"
                  />
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Dernier relevé : {activeHandover.rental.vehicle?.currentMileage} km
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Niveau de carburant *
                  </label>
                  <select
                    value={handoverForm.fuelLevel}
                    onChange={(e) =>
                      setHandoverForm({
                        ...handoverForm,
                        fuelLevel: e.target.value as any,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  >
                    <option value="FULL">Plein (100%)</option>
                    <option value="3/4">3/4 de réservoir</option>
                    <option value="1/2">1/2 de réservoir</option>
                    <option value="1/4">1/4 de réservoir</option>
                    <option value="EMPTY">Réserve / Vide</option>
                  </select>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Checklist des équipements & documents
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoverForm.checklist.spareTire}
                      onChange={(e) =>
                        setHandoverForm({
                          ...handoverForm,
                          checklist: { ...handoverForm.checklist, spareTire: e.target.checked },
                        })
                      }
                      className="rounded text-accent-text"
                    />
                    <span>Roue de secours</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoverForm.checklist.jack}
                      onChange={(e) =>
                        setHandoverForm({
                          ...handoverForm,
                          checklist: { ...handoverForm.checklist, jack: e.target.checked },
                        })
                      }
                      className="rounded text-accent-text"
                    />
                    <span>Cric & manivelle</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoverForm.checklist.registrationDoc}
                      onChange={(e) =>
                        setHandoverForm({
                          ...handoverForm,
                          checklist: {
                            ...handoverForm.checklist,
                            registrationDoc: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-accent-text"
                    />
                    <span>Carte grise / Papiers</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoverForm.checklist.insuranceDoc}
                      onChange={(e) =>
                        setHandoverForm({
                          ...handoverForm,
                          checklist: { ...handoverForm.checklist, insuranceDoc: e.target.checked },
                        })
                      }
                      className="rounded text-accent-text"
                    />
                    <span>Assurance / Attestation</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoverForm.checklist.safetyKit}
                      onChange={(e) =>
                        setHandoverForm({
                          ...handoverForm,
                          checklist: { ...handoverForm.checklist, safetyKit: e.target.checked },
                        })
                      }
                      className="rounded text-accent-text"
                    />
                    <span>Gilet & Triangle</span>
                  </label>
                </div>
              </div>

              {/* Cleanliness & Damages */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Propreté du véhicule *
                  </label>
                  <select
                    value={handoverForm.cleanliness}
                    onChange={(e) =>
                      setHandoverForm({
                        ...handoverForm,
                        cleanliness: e.target.value as 'CLEAN' | 'NORMAL' | 'DIRTY',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  >
                    <option value="CLEAN">Propre</option>
                    <option value="NORMAL">Correct</option>
                    <option value="DIRTY">Sale</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Dommages constatés
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Rayures, bosses, éléments manquants..."
                    value={handoverForm.damagesDescription}
                    onChange={(e) =>
                      setHandoverForm({ ...handoverForm, damagesDescription: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                  />
                </div>
              </div>

              {/* Deposit Return if type is RETURN */}
              {activeHandover.type === 'RETURN' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-emerald-950">
                        Caution ({activeHandover.rental.deposit_amount || 3000} DH)
                      </h4>
                      <p className="text-emerald-700">
                        Restitution de la préautorisation carte bancaire
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-900">
                      <input
                        type="checkbox"
                        checked={handoverForm.depositReturned}
                        onChange={(e) =>
                          setHandoverForm({
                            ...handoverForm,
                            depositReturned: e.target.checked,
                          })
                        }
                      />
                      <span>Caution restituée</span>
                    </label>
                  </div>
                  {!handoverForm.depositReturned && (
                    <div className="mt-2 pt-2 border-t border-emerald-200">
                      <label className="block text-slate-700 font-semibold mb-1">
                        Montant de retenue (DH)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={handoverForm.depositDeduction}
                        onChange={(e) =>
                          setHandoverForm({
                            ...handoverForm,
                            depositDeduction: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 p-1.5"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Observations & État carrosserie
                </label>
                <textarea
                  rows={2}
                  placeholder="Rayures signalées, propreté ou remarques éventuelles..."
                  value={handoverForm.notes}
                  onChange={(e) => setHandoverForm({ ...handoverForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveHandover(null)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={handoverBusy}
                  className="flex items-center gap-2 rounded-xl bg-[#0B1220] px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {handoverBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {activeHandover.type === 'PICKUP'
                    ? 'Confirmer la remise des clés'
                    : 'Confirmer la restitution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
