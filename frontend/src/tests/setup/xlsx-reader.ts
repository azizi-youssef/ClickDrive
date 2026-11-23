/**
 * Lecteur minimal de classeur .xlsx pour les tests : décompresse l'archive ZIP (contrôle des CRC),
 * puis relit la première feuille (textes partagés, nombres, dates, formats d'affichage).
 * Indépendant du générateur testé : il ne réutilise aucun de ses modules.
 */
import { crc32, inflateRawSync } from 'node:zlib';

export function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('Fin de répertoire ZIP introuvable');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const files = new Map<string, string>();
  const count = view.getUint16(end + 10, true);
  if (view.getUint16(end + 8, true) !== count) throw new Error('Nombre d’entrées ZIP incohérent');
  let at = view.getUint32(end + 16, true);
  // Les lecteurs stricts (Excel, System.IO.Packaging) vérifient la taille du répertoire central
  if (view.getUint32(end + 12, true) !== end - at) throw new Error('Taille du répertoire central ZIP incorrecte');
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('Entrée du répertoire ZIP invalide');
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`En-tête local invalide : ${name}`);
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const stored = bytes.subarray(start, start + compressedSize);
    const raw = method === 8 ? new Uint8Array(inflateRawSync(stored)) : stored;
    if (raw.length !== size) throw new Error(`Taille incorrecte : ${name}`);
    if (crc32(raw) >>> 0 !== crc) throw new Error(`CRC incorrect : ${name}`);
    files.set(name, decoder.decode(raw));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const unescapeXml = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const attribute = (attributes: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];

const BUILTIN_FORMATS: Record<string, string> = { '0': 'General', '3': '#,##0', '4': '#,##0.00', '14': 'mm-dd-yy', '49': '@' };

export interface ReadCell {
  readonly ref: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly value: string | number | boolean;
  /** Code de format d'affichage (General, dd/mm/yyyy, #,##0.00…) */
  readonly format: string;
  readonly bold: boolean;
  /** Jour AAAA-MM-JJ pour un nombre au format date */
  readonly date?: string;
}

export interface ReadSheet {
  readonly files: Map<string, string>;
  readonly sheetName: string;
  readonly sheetXml: string;
  readonly cells: Map<string, ReadCell>;
  /** Valeurs ligne par ligne (dates en AAAA-MM-JJ, null pour une cellule vide), lignes absentes = [] */
  readonly values: (string | number | boolean | null)[][];
  /** Largeur déclarée de chaque colonne */
  readonly widths: number[];
}

function columnIndex(letters: string): number {
  return [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export function readXlsx(bytes: Uint8Array): ReadSheet {
  const files = unzip(bytes);
  const workbook = files.get('xl/workbook.xml') ?? '';
  const sheetXml = files.get('xl/worksheets/sheet1.xml') ?? '';
  const sharedXml = files.get('xl/sharedStrings.xml') ?? '';
  const stylesXml = files.get('xl/styles.xml') ?? '';

  const strings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, item]) =>
    [...item.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map(([, text]) => unescapeXml(text)).join('')
  );

  const customFormats = new Map([...stylesXml.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].map(([, id, code]) => [id, unescapeXml(code)]));
  const boldFonts = [...(/<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(stylesXml)?.[1] ?? '').matchAll(/<font>([\s\S]*?)<\/font>/g)].map(([, font]) => font.includes('<b/>'));
  const styles = [...(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '').matchAll(/<xf ([^>]*?)\/?>/g)].map(([, attributes]) => {
    const id = attribute(attributes, 'numFmtId') ?? '0';
    return { format: customFormats.get(id) ?? BUILTIN_FORMATS[id] ?? `#${id}`, bold: boldFonts[Number(attribute(attributes, 'fontId') ?? 0)] ?? false };
  });

  const cells = new Map<string, ReadCell>();
  const values: (string | number | boolean | null)[][] = [];
  for (const [, attributes, body] of sheetXml.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = attribute(attributes, 'r') ?? '';
    const [, letters, rowNumber] = /^([A-Z]+)(\d+)$/.exec(ref) ?? [];
    const raw = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(body ?? '')?.[1] ?? '');
    const t = attribute(attributes, 't');
    const style = styles[Number(attribute(attributes, 's') ?? 0)] ?? { format: 'General', bold: false };
    let cell: ReadCell;
    if (t === 's') cell = { ref, type: 'string', value: strings[Number(raw)], format: style.format, bold: style.bold };
    else if (t === 'b') cell = { ref, type: 'boolean', value: raw === '1', format: style.format, bold: style.bold };
    else {
      const value = Number(raw);
      const isDate = /[dy]/i.test(style.format.replace(/"[^"]*"/g, '')) && style.format !== 'General';
      const date = isDate ? new Date(Math.round((value - 25_569) * 86_400_000)).toISOString().slice(0, 10) : undefined;
      cell = { ref, type: 'number', value, format: style.format, bold: style.bold, date };
    }
    cells.set(ref, cell);
    const row = Number(rowNumber) - 1;
    const column = columnIndex(letters);
    while (values.length <= row) values.push([]);
    while (values[row].length < column) values[row].push(null);
    values[row][column] = cell.date ?? cell.value;
  }

  const widths: number[] = [];
  for (const [, min, width] of sheetXml.matchAll(/<col min="(\d+)" max="\d+" width="([\d.]+)"/g)) widths[Number(min) - 1] = Number(width);

  return {
    files,
    sheetName: unescapeXml(/<sheet name="([^"]*)"/.exec(workbook)?.[1] ?? ''),
    sheetXml,
    cells,
    values,
    widths,
  };
}

/** Contenu d'un Blob en octets (jsdom ne fournit pas toujours Blob.arrayBuffer) */
export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
