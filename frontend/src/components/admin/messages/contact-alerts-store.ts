'use client';

import { useSyncExternalStore } from 'react';
import {
  CONTACT_MESSAGES_ARRIVED_EVENT,
  CONTACT_MESSAGES_CHANGED_EVENT,
  contactAlertText,
  newestCreatedAt,
  unseenContactMessages,
  type ContactAlertItem,
  type ContactAlertSummary,
} from '@/lib/admin/contact-alerts';

/**
 * Surveillance des messages de contact pour tout le tableau de bord.
 * L'état vit au niveau du module : il survit aux changements de page de l'administration
 * (chaque page remonte son AdminShell), donc l'alerte affichée et le compteur ne clignotent pas.
 */

const SUMMARY_URL = '/api/admin/contact-messages/summary';
const POLL_MS = 20_000;
/** Vérification toute récente (simple changement de page) : inutile d'en relancer une au montage */
const RECENT_CHECK_MS = 5_000;
/** Date du dernier message déjà annoncé, partagée entre les onglets de ce navigateur */
const LAST_SEEN_KEY = 'clickdrive:admin-contact-last-seen';

export type ContactAlertsState = {
  /** Messages au statut « Nouveau » */
  newCount: number;
  /** Messages à annoncer dans le bandeau d'alerte (null : aucune alerte affichée) */
  pending: ContactAlertItem[] | null;
};

const SERVER_STATE: ContactAlertsState = { newCount: 0, pending: null };
let state: ContactAlertsState = SERVER_STATE;
const listeners = new Set<() => void>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastCheckedAt = 0;
let inFlight = false;
let queued = false;
/** Session expirée ou permission absente : on cesse d'interroger le serveur */
let forbidden = false;

function setState(patch: Partial<ContactAlertsState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(value: string | null) {
  if (!value) return;
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, value);
  } catch {
    /* stockage indisponible : l'alerte pourra simplement réapparaître au prochain chargement */
  }
}

/** Notification système, seulement si l'administrateur l'a autorisée et ne regarde pas déjà le tableau de bord */
function notifyBrowser(items: ContactAlertItem[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const { title, body } = contactAlertText(items);
  try {
    // Même `tag` : une nouvelle alerte remplace la précédente au lieu de s'empiler (et d'un onglet à l'autre)
    const notification = new Notification(title, { body, tag: 'clickdrive-contact-message' });
    // Un clic ramène l'onglet du tableau de bord, où le bandeau d'alerte (« Voir le message ») attend déjà
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    /* navigateurs qui n'acceptent les notifications que via un service worker (Chrome Android) */
  }
}

/** Interroge le serveur, met à jour le compteur et annonce les messages arrivés depuis la dernière alerte */
export async function refreshContactAlerts(): Promise<void> {
  if (forbidden || typeof window === 'undefined') return;
  if (inFlight) {
    queued = true;
    return;
  }
  inFlight = true;
  lastCheckedAt = Date.now();
  try {
    const res = await fetch(SUMMARY_URL, { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) {
      forbidden = true;
      setState({ newCount: 0, pending: null });
      return;
    }
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ContactAlertSummary } | null;
    if (!res.ok || !json?.success || !json.data) return;

    const { newCount, latest } = json.data;
    const fresh = unseenContactMessages(latest, readLastSeen());
    if (fresh.length === 0) {
      if (newCount !== state.newCount) setState({ newCount });
      return;
    }
    writeLastSeen(newestCreatedAt(fresh));
    // Les messages déjà affichés dans le bandeau et pas encore fermés restent annoncés
    const shown = state.pending ?? [];
    const pending = [...fresh, ...shown.filter((item) => !fresh.some((f) => f.id === item.id))];
    setState({ newCount, pending });
    window.dispatchEvent(new Event(CONTACT_MESSAGES_ARRIVED_EVENT));
    notifyBrowser(fresh);
  } catch {
    /* réseau momentanément indisponible : nouvel essai au prochain tour */
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      void refreshContactAlerts();
    }
  }
}

export function dismissContactAlert() {
  if (state.pending) setState({ pending: null });
}

function onVisible() {
  if (document.visibilityState === 'visible') void refreshContactAlerts();
}

function onChanged() {
  void refreshContactAlerts();
}

function start() {
  if (Date.now() - lastCheckedAt > RECENT_CHECK_MS) void refreshContactAlerts();
  // Le navigateur espace ces appels quand l'onglet est en arrière-plan ; ils continuent pour la notification système
  pollTimer = setInterval(() => void refreshContactAlerts(), POLL_MS);
  window.addEventListener('focus', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener(CONTACT_MESSAGES_CHANGED_EVENT, onChanged);
}

function stop() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  window.removeEventListener('focus', onVisible);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener(CONTACT_MESSAGES_CHANGED_EVENT, onChanged);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    // Plus aucun composant à l'écoute (sortie de l'administration ou changement de page) : on s'arrête.
    // L'état (compteur, alerte affichée) est conservé pour la page suivante.
    if (listeners.size === 0) stop();
  };
}

/** Compteur et alerte en cours ; la surveillance démarre au premier composant qui l'utilise */
export function useContactAlerts(): ContactAlertsState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/** À appeler après un changement de statut : le compteur se met à jour sans attendre le prochain tour */
export function notifyContactMessagesChanged() {
  window.dispatchEvent(new Event(CONTACT_MESSAGES_CHANGED_EVENT));
}

/* ── Autorisation des notifications du navigateur ─────────────────── */

export type BrowserAlertPermission = NotificationPermission | 'unsupported';

const PERMISSION_EVENT = 'clickdrive:notification-permission';

function readPermission(): BrowserAlertPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function subscribePermission(callback: () => void) {
  window.addEventListener(PERMISSION_EVENT, callback);
  window.addEventListener('focus', callback);
  return () => {
    window.removeEventListener(PERMISSION_EVENT, callback);
    window.removeEventListener('focus', callback);
  };
}

export function useBrowserAlertPermission(): BrowserAlertPermission {
  return useSyncExternalStore(subscribePermission, readPermission, () => 'unsupported');
}

/** Demande l'autorisation (doit partir d'un clic de l'administrateur) */
export async function requestBrowserAlertPermission(): Promise<BrowserAlertPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    await Notification.requestPermission();
  } finally {
    window.dispatchEvent(new Event(PERMISSION_EVENT));
  }
  return Notification.permission;
}
