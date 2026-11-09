/**
 * Export CSV commun aux espaces agence et administration, lisible tel quel par Excel en français :
 * point-virgule comme séparateur, marque UTF-8 en tête (accents), fins de ligne CRLF, dates
 * AAAA-MM-JJ, nombres sans séparateur de milliers.
 * Une cellule texte qui commence par = + - @ (ou une tabulation) est neutralisée par une apostrophe :
 * noms, téléphones et messages viennent des clients, et Excel exécuterait une formule.
 */
export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = readonly CsvCell[];

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly CsvRow[]): string {
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

/** Date ou horodatage → AAAA-MM-JJ (vide si absent ou invalide) */
export function csvDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/** « clickdrive-reservations-2026-11-09.csv » */
export function csvFileName(prefix: string, now = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Contenu exact du fichier : marque UTF-8 + lignes */
export function csvFileContent(rows: readonly CsvRow[]): string {
  return `﻿${toCsv(rows)}\r\n`;
}

export function downloadCsv(fileName: string, rows: readonly CsvRow[]): void {
  const blob = new Blob([csvFileContent(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
