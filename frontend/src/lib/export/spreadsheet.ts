/**
 * Export Excel (.xlsx) commun aux espaces agence et administration — point d'entrée léger.
 * Ce module ne contient que les types, le nom de fichier et le téléchargement : le générateur
 * (./xlsx) n'est chargé qu'au clic sur « Exporter en Excel », par import dynamique.
 */

/** Format d'affichage d'une cellule dans Excel (la valeur stockée reste un nombre ou une date) */
export type XlsxFormat =
  /** Texte tel quel, même s'il ressemble à un nombre (téléphones, références) */
  | 'text'
  /** Nombre affiché sans décimale, avec séparateur de milliers : 1 250 (la valeur exacte est conservée) */
  | 'integer'
  /** Montant à deux décimales : 1 250,00 */
  | 'money'
  /** Date (sans heure) : 01/12/2026. Accepte « AAAA-MM-JJ », un horodatage ISO ou un objet Date. */
  | 'date'
  /** Mois : déc. 2026. Accepte « AAAA-MM ». */
  | 'month';

export type XlsxValue = string | number | boolean | Date | null | undefined;
/** Valeur brute (type déduit : nombre, date, texte) ou valeur avec un format explicite */
export type XlsxCell = XlsxValue | { readonly value: XlsxValue; readonly format: XlsxFormat };
export type XlsxRow = readonly XlsxCell[];

export interface XlsxColumn {
  readonly header: string;
  readonly format?: XlsxFormat;
  /** Largeur en caractères ; calculée d'après le contenu si absente */
  readonly width?: number;
}

export type XlsxSheet =
  /** Tableau : ligne d'en-tête figée, filtres automatiques, un format par colonne */
  | { readonly kind: 'table'; readonly name: string; readonly columns: readonly XlsxColumn[]; readonly rows: readonly XlsxRow[] }
  /** Rapport en sections séparées par une ligne vide : la première ligne est le titre, la première ligne de chaque section son en-tête */
  | { readonly kind: 'report'; readonly name: string; readonly rows: readonly XlsxRow[] };

export interface XlsxColumnDef<T> extends XlsxColumn {
  readonly value: (item: T) => XlsxValue;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Feuille « tableau » à partir de définitions de colonnes (en-tête et valeur restent côte à côte) */
export function tableSheet<T>(name: string, columns: readonly XlsxColumnDef<T>[], items: readonly T[]): XlsxSheet {
  return {
    kind: 'table',
    name,
    columns: columns.map(({ header, format, width }) => ({ header, format, width })),
    rows: items.map((item) => columns.map((column) => column.value(item))),
  };
}

/** « clickdrive-reservations-2026-11-09.xlsx » */
export function xlsxFileName(prefix: string, now = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.xlsx`;
}

export function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Génère le classeur (générateur chargé à la demande) et le télécharge */
export async function downloadXlsx(fileName: string, sheet: XlsxSheet): Promise<void> {
  const { buildXlsx } = await import('./xlsx');
  const bytes = await buildXlsx(sheet);
  saveBlob(fileName, new Blob([bytes], { type: XLSX_MIME }));
}
