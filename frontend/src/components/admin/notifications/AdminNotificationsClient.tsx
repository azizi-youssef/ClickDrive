'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  Search,
  Filter,
  Radio,
  FileText,
  Smartphone,
  ShieldCheck,
  Check,
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
  Webhook,
  Play,
  HelpCircle,
  Bot,
  Zap,
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
  ErrorBanner,
} from '@/components/admin/AdminUI';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';

interface NotificationFeedItem {
  id: string;
  channel: 'WHATSAPP';
  messageId: string;
  recipient: string;
  bookingRef: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED' | 'CONFIRMED' | 'CANCELLED' | 'RECEIVED';
  type: string;
  snippet: string;
  timestamp: string;
}

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  variables: string[];
  status: string;
}

interface WebhookIntent {
  keyword: string;
  action: string;
  description: string;
}

interface NotificationsData {
  isWhatsAppConfigured: boolean;
  kpis: {
    totalSent: number;
    deliveredCount: number;
    failedCount: number;
    activeTemplatesCount: number;
  };
  recentFeed: NotificationFeedItem[];
  templates: TemplateItem[];
  webhookInfo?: {
    endpointUrl: string;
    verifyToken: string;
    isConfigured: boolean;
    supportedIntents: WebhookIntent[];
  };
}

export function AdminNotificationsClient() {
  const [data, setData] = useState<NotificationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'feed' | 'broadcast' | 'templates' | 'webhook'>('feed');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Formulaire de broadcast
  const [targetPhone, setTargetPhone] = useState('');
  const [targetRef, setTargetRef] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Simulateur Webhook Inbound
  const [simPhone, setSimPhone] = useState('0661234567');
  const [simBookingRef, setSimBookingRef] = useState('');
  const [simText, setSimText] = useState('OUI');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<{
    intent: string;
    actionTaken: string;
    replySent?: string;
    bookingRef?: string;
  } | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur chargement notifications');
      }

      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de récupérer les notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Rafraîchissement automatique en direct
  useRealtimeRefresh({
    tables: ['bookings'],
    onRefresh: () => loadData(false),
    pollingIntervalMs: 60_000, // Realtime pousse les changements ; le polling ne sert que de filet de sécurité
  });

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPhone.trim() || !messageContent.trim()) {
      setSendError('Veuillez renseigner un numéro et un message.');
      return;
    }

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: targetPhone.trim(),
          bookingRef: targetRef.trim() || undefined,
          message: messageContent.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Échec de transmission WhatsApp');
      }

      setSendSuccess(`Notification transmise avec succès ! (Identifiant: ${json.data?.messageId || 'wamid'})`);
      setMessageContent('');
      setTargetRef('');
      void loadData(false);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Erreur inconnue lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleSimulateInbound = async (textToUse?: string) => {
    const text = textToUse || simText;
    if (!simPhone.trim() || !text.trim()) {
      setSimError('Veuillez indiquer un numéro expéditeur et un mot-clé.');
      return;
    }

    setSimLoading(true);
    setSimError(null);
    setSimResult(null);

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_inbound',
          senderPhone: simPhone.trim(),
          messageText: text.trim(),
          bookingRef: simBookingRef.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Échec de simulation du webhook');
      }

      setSimResult(json.data);
      void loadData(false);
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Erreur de simulation webhook');
    } finally {
      setSimLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'token') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    }
  };

  const filteredFeed = (data?.recentFeed || []).filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.recipient.toLowerCase().includes(q) ||
        item.bookingRef.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPIs Notifications */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          loading={loading && !data}
          label="Messages traités"
          value={data?.kpis.totalSent ?? 0}
          sub="Entrants & Sortants"
          icon={MessageSquare}
          tone="info"
        />
        <KpiCard
          loading={loading && !data}
          label="Livrées & Validées"
          value={data?.kpis.deliveredCount ?? 0}
          sub="Statut confirmé"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          loading={loading && !data}
          label="Échecs d'envoi"
          value={data?.kpis.failedCount ?? 0}
          sub="Numéros invalides"
          icon={AlertCircle}
          tone="danger"
        />
        <KpiCard
          loading={loading && !data}
          label="API WhatsApp Business"
          value={data?.isWhatsAppConfigured ? 'Connecté' : 'Mode Simulé'}
          sub={data?.isWhatsAppConfigured ? 'API Meta Cloud connectée' : 'Messages simulés en local'}
          icon={Smartphone}
          tone={data?.isWhatsAppConfigured ? 'success' : 'warning'}
        />
      </div>

      {/* Barre de navigation par onglets */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('feed')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'feed'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="h-4 w-4" />
          Journal en direct ({data?.recentFeed.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'broadcast'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="h-4 w-4" />
          Envoyer une notification directe
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          Modèles officiels ({data?.templates.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('webhook')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'webhook'
              ? 'border-[#0B1220] text-[#0B1220]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Webhook className="h-4 w-4" />
          Webhook & Réception auto (Bi-directionnel)
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[11px] font-bold text-emerald-800">
            Nouveau
          </span>
        </button>
      </div>

      {/* ONGLET 1 : Journal en direct */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2 max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer par destinataire, dossier..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="SENT">Envoyé</option>
                <option value="CONFIRMED">Confirmé (OUI)</option>
                <option value="CANCELLED">Annulé (NON)</option>
                <option value="RECEIVED">Reçu (Client)</option>
                <option value="SIMULATED">Simulé (Dev)</option>
                <option value="FAILED">Échoué</option>
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
                  <Th>Flux</Th>
                  <Th>Contact</Th>
                  <Th>Dossier</Th>
                  <Th>Contenu / Action</Th>
                  <Th>Identifiant</Th>
                  <Th>Horodatage</Th>
                  <Th className="text-right">Statut</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && !data ? (
                  <TableSkeletonRows cols={7} rows={6} />
                ) : filteredFeed.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8">
                      <EmptyState
                        icon={Bell}
                        title="Aucun message dans l'historique"
                        description="Les notifications et réponses WhatsApp apparaîtront automatiquement ici en direct."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredFeed.map((item) => {
                    const isInbound = item.type === 'INBOUND';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <Td>
                          {isInbound ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                              <ArrowDownLeft className="h-3 w-3 text-blue-600" />
                              Entrant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                              Sortant
                            </span>
                          )}
                        </Td>
                        <Td>
                          <span className="font-semibold text-slate-800 font-mono text-xs">
                            {item.recipient}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-mono text-xs font-medium text-blue-600">
                            {item.bookingRef}
                          </span>
                        </Td>
                        <Td>
                          <p className="text-xs text-slate-700 line-clamp-1 max-w-xs" title={item.snippet}>
                            {item.snippet}
                          </p>
                        </Td>
                        <Td>
                          <span className="font-mono text-[11px] text-slate-400 truncate max-w-27.5 block" title={item.messageId}>
                            {item.messageId}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <StatusBadge
                            variant={
                              item.status === 'CONFIRMED'
                                ? 'success'
                                : item.status === 'SENT' || item.status === 'DELIVERED'
                                ? 'success'
                                : item.status === 'RECEIVED'
                                ? 'info'
                                : item.status === 'SIMULATED'
                                ? 'warning'
                                : 'error'
                            }
                          >
                            {item.status === 'CONFIRMED'
                              ? 'Confirmé'
                              : item.status === 'CANCELLED'
                              ? 'Annulé'
                              : item.status === 'RECEIVED'
                              ? 'Reçu'
                              : item.status === 'SENT'
                              ? 'Envoyé'
                              : item.status === 'DELIVERED'
                              ? 'Délivré'
                              : item.status === 'SIMULATED'
                              ? 'Simulé'
                              : 'Échoué'}
                          </StatusBadge>
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

      {/* ONGLET 2 : Formulaire de Broadcast / Envoi direct */}
      {activeTab === 'broadcast' && (
        <AdminCard title="Envoi direct d'une notification WhatsApp Business" className="max-w-2xl">
          <form onSubmit={handleSendBroadcast} className="mt-4 space-y-4">
            {sendSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{sendSuccess}</span>
              </div>
            )}
            {sendError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{sendError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numéro de téléphone du destinataire *
                </label>
                <input
                  type="text"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="ex: 0612345678 ou 212612345678"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Format marocain ou international accepté.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Référence réservation (optionnel)
                </label>
                <input
                  type="text"
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  placeholder="ex: CD-2026-XXXXXX"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contenu du message *
              </label>
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={5}
                placeholder="Rédigez votre message officiel ClickDrive..."
                className="w-full rounded-xl border border-slate-200 p-3.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Btn
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetPhone('');
                  setMessageContent('');
                  setTargetRef('');
                }}
              >
                Réinitialiser
              </Btn>
              <Btn type="submit" variant="primary" size="sm" loading={sending} className="flex items-center gap-1.5">
                <Send className="h-4 w-4" />
                Transmettre via WhatsApp
              </Btn>
            </div>
          </form>
        </AdminCard>
      )}

      {/* ONGLET 3 : Modèles WhatsApp officiels */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data?.templates || []).map((t) => (
            <AdminCard key={t.id} title={t.name}>
              <div className="mt-2 space-y-3">
                <p className="text-xs text-slate-600">{t.description}</p>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Paramètres dynamiques :</span>
                  <div className="flex flex-wrap gap-1">
                    {t.variables.map((v) => (
                      <span key={v} className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 font-mono text-[11px]">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t.status}
                  </span>
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveTab('broadcast');
                      setMessageContent(`[Modèle: ${t.name}]\nBonjour, ClickDrive vous informe concernant votre réservation...`);
                    }}
                    className="text-xs"
                  >
                    Tester ce modèle
                  </Btn>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* ONGLET 4 : Webhook & Réception automatique (Recommandation 2) */}
      {activeTab === 'webhook' && (
        <div className="space-y-6">
          {/* Configuration Meta Webhook */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <AdminCard title="Paramètres du Webhook WhatsApp Business (Meta Graph API)">
                <p className="text-xs text-slate-600 mt-1 mb-4">
                  Ce point de terminaison reçoit en temps réel les réponses envoyées par les clients sur WhatsApp (ex: confirmation par <code>OUI</code>, annulation par <code>ANNULER</code>, demande d&apos;assistance) et synchronise directement PostgreSQL.
                </p>

                <div className="space-y-4">
                  {/* Callback URL */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL de rappel (Callback URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof window !== 'undefined'
                            ? `${window.location.origin}/api/webhooks/whatsapp`
                            : 'https://clickdrive.ma/api/webhooks/whatsapp'
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-800"
                      />
                      <Btn
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/api/webhooks/whatsapp`
                              : 'https://clickdrive.ma/api/webhooks/whatsapp',
                            'url'
                          )
                        }
                        className="shrink-0"
                      >
                        {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedUrl ? 'Copié' : 'Copier'}
                      </Btn>
                    </div>
                  </div>

                  {/* Verify Token */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jeton de vérification (Verify Token)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={data?.webhookInfo?.verifyToken || 'klickdrive_whatsapp_secure_webhook_token_2026'}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-800"
                      />
                      <Btn
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            data?.webhookInfo?.verifyToken || 'klickdrive_whatsapp_secure_webhook_token_2026',
                            'token'
                          )
                        }
                        className="shrink-0"
                      >
                        {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedToken ? 'Copié' : 'Copier'}
                      </Btn>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Renseignez ce jeton dans le portail Meta for Developers &gt; WhatsApp &gt; Configuration &gt; Webhook.
                    </span>
                  </div>
                </div>
              </AdminCard>

              {/* Mots-clés automatiques reconnus */}
              <AdminCard title="Intents & Moteurs de décision automatique">
                <div className="mt-3 divide-y divide-slate-100">
                  {(data?.webhookInfo?.supportedIntents || []).map((intent) => (
                    <div key={intent.keyword} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                            {intent.keyword}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {intent.action}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {intent.description}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0">
                        <Zap className="h-3.5 w-3.5" />
                        Actif en temps réel
                      </span>
                    </div>
                  ))}
                </div>
              </AdminCard>
            </div>

            {/* Simulateur interactif de réception client */}
            <div>
              <AdminCard title="Simulateur de Réception Client (Test direct)">
                <p className="text-xs text-slate-600 mt-1 mb-4">
                  Testez le traitement complet sans envoyer de vrai message WhatsApp : analyse d&apos;intent, mise à jour du statut dans PostgreSQL et envoi de la réponse automatique.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Numéro client émetteur
                    </label>
                    <input
                      type="text"
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                      placeholder="0661234567"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Référence réservation (optionnel)
                    </label>
                    <input
                      type="text"
                      value={simBookingRef}
                      onChange={(e) => setSimBookingRef(e.target.value)}
                      placeholder="Ex: CD-2026-NADOR1"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Message envoyé par le client
                    </label>
                    <input
                      type="text"
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      placeholder="OUI"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Boutons d'actions rapides */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSimText('OUI');
                        void handleSimulateInbound('OUI');
                      }}
                      className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      Tester « OUI » (Confirmer)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSimText('ANNULER');
                        void handleSimulateInbound('ANNULER');
                      }}
                      className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Tester « ANNULER »
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSimText('AIDE');
                        void handleSimulateInbound('AIDE');
                      }}
                      className="rounded-lg bg-blue-50 border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      Tester « AIDE »
                    </button>
                  </div>

                  <div className="pt-2">
                    <Btn
                      variant="primary"
                      size="sm"
                      loading={simLoading}
                      onClick={() => handleSimulateInbound()}
                      className="w-full flex items-center justify-center gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Lancer la simulation
                    </Btn>
                  </div>

                  {simError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs mt-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{simError}</span>
                    </div>
                  )}

                  {simResult && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2 mt-3 text-slate-800">
                      <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                        <span className="font-semibold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Traitement webhook réussi
                        </span>
                        <span className="font-mono text-[11px] text-emerald-700 font-bold uppercase">
                          {simResult.intent}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        <strong>Action :</strong> {simResult.actionTaken}
                      </p>
                      {simResult.replySent && (
                        <div>
                          <strong className="text-slate-700 block mb-1">Réponse WhatsApp générée :</strong>
                          <pre className="p-2 bg-white rounded-lg border border-emerald-100 text-[11px] whitespace-pre-wrap font-sans text-slate-600">
                            {simResult.replySent}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AdminCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
