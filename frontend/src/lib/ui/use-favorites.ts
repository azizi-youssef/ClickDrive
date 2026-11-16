'use client';

import { createLocalStore } from './local-store';

/**
 * Véhicules favoris du visiteur, mémorisés dans ce navigateur (sans compte) : le cœur des cartes et de
 * la fiche, et le filtre « Favoris » du catalogue lisent la même liste, tenue à jour entre onglets.
 */
export const FAVORITES_KEY = 'clickdrive:favorites';
const MAX_FAVORITES = 100;

function parse(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64);
  return [...new Set(ids)].slice(0, MAX_FAVORITES);
}

const EMPTY: string[] = [];
export const favoritesStore = createLocalStore<string[]>(FAVORITES_KEY, parse, EMPTY);

/** Ajoute ou retire un véhicule ; renvoie son nouvel état */
export function toggleFavorite(vehicleId: string): boolean {
  const current = favoritesStore.read();
  const isFavorite = current.includes(vehicleId);
  favoritesStore.write(isFavorite ? current.filter((id) => id !== vehicleId) : [vehicleId, ...current].slice(0, MAX_FAVORITES));
  return !isFavorite;
}

/** Identifiants favoris (vide au rendu serveur, puis la liste du navigateur) */
export function useFavoriteIds(): readonly string[] {
  return favoritesStore.useValue();
}
