'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { AgencyBanner } from '@/components/agencies/AgencyBanner';
import { Badge } from '@/components/ui/Badge';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import type { Agency, Vehicle } from '@/types';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';
import { isMotorcycle } from '@/lib/vehicles/kind';
import {
  MapPin,
  MessageSquare,
  Star,
  ShieldCheck,
  Car,
  ChevronRight,
  Clock,
  Motorbike,
} from 'lucide-react';

interface AgencyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const resolvedParams = use(params);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  const loadVehicles = useCallback(async (agencyId: string) => {
    try {
      const response = await fetch(
        `/api/vehicles?agencyId=${encodeURIComponent(agencyId)}`,
        { cache: 'no-store' }
      ).then((r) => r.json());
      if (response.success && Array.isArray(response.data)) {
        setVehicles(response.data);
      }
    } catch (err) {
      console.warn('Error refreshing agency vehicles:', err);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const aRes = await fetch('/api/agencies', { cache: 'no-store' }).then((r) => r.json());
      const found = aRes.success && Array.isArray(aRes.data)
        ? aRes.data.find((a: Agency) => a.slug === resolvedParams.slug)
        : null;
      if (!found) {
        setNotFoundState(true);
        return;
      }
      setAgency(found);
      await loadVehicles(found.id);
    } catch (err) {
      console.warn('Error loading agency detail:', err);
      setNotFoundState(true);
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.slug, loadVehicles]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rafraîchissement automatique en direct
  useRealtimeRefresh({
    tables: ['vehicles', 'agencies', 'bookings'],
    onRefresh: () => {
      if (agency?.id) {
        void loadVehicles(agency.id);
      } else {
        void load();
      }
    },
    pollingIntervalMs: 20_000,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3 text-slate-600">
        <div className="w-8 h-8 border-4 border-[#0B1220] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Chargement des données de l’agence…</p>
      </div>
    );
  }

  if (notFoundState || !agency) {
    notFound();
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-16">
      
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-2 text-xs text-ink-secondary font-medium">
            <Link href="/" className="hover:text-slate-900">Accueil</Link>
            <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <Link href="/agencies" className="hover:text-slate-900">Agences</Link>
            <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span aria-current="page" className="min-w-0 truncate text-slate-900 font-semibold">{agency.name}</span>
          </nav>
        </div>
      </div>

      {/* Agency Header Banner */}
      <div className="relative h-48 sm:h-64 w-full bg-slate-900">
        <AgencyBanner
          name={agency.name}
          bannerUrl={agency.banner_url}
          priority
          sizes="100vw"
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-16 sm:-mt-20">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl shadow-blue-950/5 space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex min-w-0 items-start sm:items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border-4 border-white bg-white overflow-hidden shadow-lg relative shrink-0">
                <AgencyLogo
                  slug={agency.slug}
                  name={agency.name}
                  logoUrl={agency.logo_url}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {agency.name}
                  </h1>
                  {agency.verified && (
                    <Badge variant="verified" icon>Partenaire Vérifié</Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary mt-1">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0B1220]" />
                    <span>{agency.address} ({agency.city})</span>
                  </div>
                  <span aria-hidden="true">•</span>
                  {/* Note affichée uniquement si elle repose sur de vrais avis (la valeur par défaut en base n'en est pas une) */}
                  {agency.review_count > 0 && agency.rating > 0 ? (
                    <div className="flex items-center gap-1 text-amber-700 font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      <span>{agency.rating.toFixed(1)}</span>
                      <span className="text-slate-500 font-normal">
                        ({agency.review_count} avis)
                      </span>
                    </div>
                  ) : (
                    <span className="font-semibold text-slate-600">Nouveau partenaire · aucun avis pour le moment</span>
                  )}
                </div>
              </div>
            </div>

            {/* ClickDrive Intermediation Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="#agency-fleet"
                className="px-4 py-2.5 rounded-xl bg-[#0B1220] hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
              >
                <Car className="w-4 h-4 text-[#E63946]" />
                <span>Voir les voitures disponibles</span>
              </a>

              <a
                href={clickdriveWhatsAppUrl(`Bonjour ClickDrive, j'ai une question concernant l'agence partenaire ${agency.name} à ${agency.city}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl border border-emerald-500 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Conciergerie ClickDrive</span>
              </a>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
            {agency.description}
          </p>

          {/* Uniquement des informations vérifiables : pas d'horaires en base, pas de paiement ni de caution via ClickDrive */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-slate-600">
            {agency.verified && (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Agence vérifiée par ClickDrive avant sa mise en ligne</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Horaires et disponibilités confirmés par l’agence lors de votre demande</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Car className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Aucun paiement en ligne : contrat et caution réglés directement à l’agence</span>
            </div>
          </div>

        </div>

        {/* Agency Fleet Section — voitures et motos présentées séparément */}
        <div id="agency-fleet" className="mt-12 scroll-mt-24 space-y-10">
          {vehicles.length === 0 ? (
            <div>
              <h2 className="mb-6 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Véhicules proposés par l’agence
              </h2>
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                Aucun véhicule disponible pour le moment chez cette agence.
              </div>
            </div>
          ) : (
            [
              { key: 'cars', title: 'Voitures', noun: 'voiture', icon: Car, list: vehicles.filter((v) => !isMotorcycle(v)) },
              { key: 'motos', title: 'Motos et scooters', noun: 'moto', icon: Motorbike, list: vehicles.filter((v) => isMotorcycle(v)) },
            ]
              .filter((group) => group.list.length > 0)
              .map(({ key, title, noun, icon: Icon, list }) => (
                <section key={key} aria-labelledby={`agency-${key}-title`}>
                  <div className="mb-6 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id={`agency-${key}-title`} className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                        {title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        {list.length} {noun}{list.length > 1 ? 's' : ''} proposée{list.length > 1 ? 's' : ''} par l’agence
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {list.map((v) => (
                      <VehicleCard key={v.id} vehicle={v} />
                    ))}
                  </div>
                </section>
              ))
          )}
        </div>

      </div>

    </div>
  );
}
