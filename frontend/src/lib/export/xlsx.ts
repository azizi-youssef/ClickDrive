/**
 * Générateur de classeur Excel (.xlsx, Office Open XML) sans dépendance, chargé à la demande
 * par ./spreadsheet. Un .xlsx est une archive ZIP de fichiers XML : ce module écrit ces XML
 * (classeur, feuille, styles, textes partagés) puis l'archive (deflate natif du navigateur via
 * CompressionStream, ou stockage sans compression s'il est indisponible).
 *
 * Différences utiles par rapport au CSV : les nombres et les dates sont de vrais nombres et de
 * vraies dates pour Excel, les accents ne dépendent plus de l'encodage, et un texte qui commence
 * par « = » reste un texte (une cellule texte n'est jamais interprétée comme une formule).
 */
import type { XlsxCell, XlsxFormat, XlsxSheet, XlsxValue } from './spreadsheet';

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Index des styles de cellule (cellXfs de styles.xml) */
const STYLE = { default: 0, header: 1, title: 2, date: 3, month: 4, integer: 5, money: 6 } as const;
type StyleId = (typeof STYLE)[keyof typeof STYLE];

const FORMAT_STYLE: Record<Exclude<XlsxFormat, 'text'>, StyleId> = {
  date: STYLE.date,
  month: STYLE.month,
  integer: STYLE.integer,
  money: STYLE.money,
};

const MAX_CELL_TEXT = 32_767;
const MIN_WIDTH = 8;
const MAX_WIDTH = 60;

/* ── Valeurs ─────────────────────────────────────────────────────────── */

type Resolved =
  | { readonly kind: 'empty' }
  | { readonly kind: 'string'; readonly text: string; readonly style: StyleId }
  | { readonly kind: 'number'; readonly value: number; readonly style: StyleId }
  | { readonly kind: 'bool'; readonly value: boolean; readonly style: StyleId };

const EMPTY: Resolved = { kind: 'empty' };

function isFormatted(cell: XlsxCell): cell is { readonly value: XlsxValue; readonly format: XlsxFormat } {
  return typeof cell === 'object' && cell !== null && !(cell instanceof Date);
}

/** Numéro de série Excel d'un jour (système 1900 : 25 569 = 1er janvier 1970) */
function daySerial(year: number, month: number, day: number): number | null {
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return time / 86_400_000 + 25_569;
}

/**
 * Jour d'une date : « AAAA-MM-JJ » (ou le début d'un horodatage ISO) est pris tel quel,
 * un objet Date ou un autre texte de date est lu en UTC. Null si absent ou invalide.
 */
function dateSerial(value: XlsxValue, format: 'date' | 'month'): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : daySerial(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (format === 'month') {
    const month = /^(\d{4})-(\d{2})$/.exec(text);
    if (month) return daySerial(Number(month[1]), Number(month[2]), 1);
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (day) return daySerial(Number(day[1]), Number(day[2]), Number(day[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : daySerial(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

function textOf(value: Exclude<XlsxValue, null | undefined>): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return String(value);
}

function resolveCell(cell: XlsxCell, columnFormat: XlsxFormat | undefined): Resolved {
  const value = isFormatted(cell) ? cell.value : cell;
  const format = isFormatted(cell) ? cell.format : columnFormat;
  if (value === null || value === undefined || value === '') return EMPTY;
  if (typeof value === 'number' && !Number.isFinite(value)) return EMPTY;

  if (format === 'text') {
    const text = textOf(value);
    return text ? { kind: 'string', text, style: STYLE.default } : EMPTY;
  }
  if (format === 'date' || format === 'month') {
    const serial = dateSerial(value, format);
    return serial === null ? EMPTY : { kind: 'number', value: serial, style: FORMAT_STYLE[format] };
  }
  if (typeof value === 'number') {
    return { kind: 'number', value, style: format ? FORMAT_STYLE[format] : STYLE.default };
  }
  if (value instanceof Date) {
    const serial = dateSerial(value, 'date');
    return serial === null ? EMPTY : { kind: 'number', value: serial, style: STYLE.date };
  }
  if (typeof value === 'boolean') return { kind: 'bool', value, style: STYLE.default };
  return { kind: 'string', text: value, style: STYLE.default };
}

/** Longueur affichée approximative, pour la largeur des colonnes */
function displayLength(cell: Resolved): number {
  switch (cell.kind) {
    case 'empty':
      return 0;
    case 'bool':
      return 5;
    case 'string':
      return Math.max(...cell.text.split('\n').map((line) => line.length));
    case 'number': {
      if (cell.style === STYLE.date) return 10;
      if (cell.style === STYLE.month) return 9;
      const digits = String(Math.trunc(Math.abs(cell.value))).length;
      const sign = cell.value < 0 ? 1 : 0;
      if (cell.style === STYLE.money) return sign + digits + Math.floor((digits - 1) / 3) + 3;
      if (cell.style === STYLE.integer) return sign + digits + Math.floor((digits - 1) / 3);
      return String(cell.value).length;
    }
  }
}

/* ── XML ─────────────────────────────────────────────────────────────── */

// Caractères interdits en XML 1.0 (contrôles hors tabulation et sauts de ligne)
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xmlText(text: string): string {
  return text.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlAttr(text: string): string {
  return xmlText(text).replace(/"/g, '&quot;');
}

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** Nom d'onglet valide : 31 caractères au plus, sans : \ / ? * [ ] ni apostrophe aux extrémités */
export function sheetName(name: string): string {
  const clean = name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31).replace(/^'+|'+$/g, '').trim();
  return clean || 'Feuille1';
}

class SharedStrings {
  private readonly index = new Map<string, number>();
  readonly list: string[] = [];
  count = 0;

  add(text: string): number {
    this.count += 1;
    const known = this.index.get(text);
    if (known !== undefined) return known;
    const id = this.list.length;
    this.index.set(text, id);
    this.list.push(text);
    return id;
  }

  toXml(): string {
    const items = this.list
      .map((text) => (/^\s|\s$|\n/.test(text) ? `<si><t xml:space="preserve">${xmlText(text)}</t></si>` : `<si><t>${xmlText(text)}</t></si>`))
      .join('');
    return `${XML_HEAD}<sst xmlns="${MAIN_NS}" count="${this.count}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

function cellXml(ref: string, cell: Resolved, strings: SharedStrings, styleOverride?: StyleId): string {
  if (cell.kind === 'empty') return '';
  const style = styleOverride ?? cell.style;
  const s = style === STYLE.default ? '' : ` s="${style}"`;
  if (cell.kind === 'string') {
    const text = cell.text.replace(/\r\n?/g, '\n').slice(0, MAX_CELL_TEXT);
    return `<c r="${ref}"${s} t="s"><v>${strings.add(text)}</v></c>`;
  }
  if (cell.kind === 'bool') return `<c r="${ref}"${s} t="b"><v>${cell.value ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${s}><v>${cell.value}</v></c>`;
}

interface SheetLayout {
  readonly rows: readonly (readonly Resolved[])[];
  /** Style imposé à toute une ligne (en-tête, titre) */
  readonly rowStyles: readonly (StyleId | undefined)[];
  readonly widths: readonly number[];
  readonly table: boolean;
}

function layout(sheet: XlsxSheet): SheetLayout {
  if (sheet.kind === 'table') {
    const header = sheet.columns.map((column): Resolved => ({ kind: 'string', text: column.header, style: STYLE.header }));
    const body = sheet.rows.map((row) => sheet.columns.map((column, index) => resolveCell(row[index], column.format)));
    const rows = [header, ...body];
    const widths = sheet.columns.map((column, index) => {
      if (column.width) return column.width;
      // + 3 pour la flèche du filtre automatique de l'en-tête
      const longest = body.reduce((max, row) => Math.max(max, displayLength(row[index])), column.header.length + 3);
      return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
    });
    return { rows, rowStyles: [STYLE.header], widths, table: true };
  }

  const rows = sheet.rows.map((row) => row.map((cell) => resolveCell(cell, undefined)));
  const rowStyles = rows.map((row, index): StyleId | undefined => {
    if (index === 0) return STYLE.title;
    const previous = rows[index - 1];
    const startsSection = previous.every((cell) => cell.kind === 'empty') && row.some((cell) => cell.kind !== 'empty');
    return startsSection ? STYLE.header : undefined;
  });
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const widths = Array.from({ length: columnCount }, (_, column) => {
    // Le titre déborde sur les cellules vides voisines : il n'élargit pas la première colonne
    const longest = rows.slice(1).reduce((max, row) => Math.max(max, displayLength(row[column] ?? EMPTY)), 0);
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
  });
  return { rows, rowStyles, widths, table: false };
}

function worksheetXml(sheet: SheetLayout, strings: SharedStrings): { xml: string; range: string | null } {
  const columnCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), sheet.widths.length);
  const lastColumn = columnName(Math.max(0, columnCount - 1));
  const lastRow = Math.max(1, sheet.rows.length);
  const range = `A1:${lastColumn}${lastRow}`;

  const rowsXml = sheet.rows
    .map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, cell, strings, sheet.rowStyles[rowIndex])).join('');
      return cells ? `<row r="${rowIndex + 1}">${cells}</row>` : '';
    })
    .join('');

  const view = sheet.table
    ? '<sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>'
    : '<sheetView tabSelected="1" workbookViewId="0"/>';
  const cols = sheet.widths.length
    ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const xml =
    `${XML_HEAD}<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    `<dimension ref="${range}"/><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}` +
    `<sheetData>${rowsXml}</sheetData>` +
    (sheet.table ? `<autoFilter ref="${range}"/>` : '') +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
  return { xml, range: sheet.table ? range : null };
}

function absoluteRange(range: string): string {
  return range.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2');
}

function workbookXml(name: string, filterRange: string | null): string {
  const quoted = `'${name.replace(/'/g, "''")}'`;
  const definedNames = filterRange
    ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${xmlText(`${quoted}!${absoluteRange(filterRange)}`)}</definedName></definedNames>`
    : '';
  return (
    `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    `<bookViews><workbookView/></bookViews><sheets><sheet name="${xmlAttr(name)}" sheetId="1" r:id="rId1"/></sheets>${definedNames}</workbook>`
  );
}

const STYLES_XML =
  `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">` +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="mmm yyyy"/></numFmts>' +
  '<fonts count="3">' +
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>' +
  '</fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

const CONTENT_TYPES_XML =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId3" Type="${REL_NS}/sharedStrings" Target="sharedStrings.xml"/>` +
  '</Relationships>';

function coreXml(title: string, now: Date): string {
  const created = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return (
    `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xmlText(title)}</dc:title><dc:creator>ClickDrive</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`
  );
}

/* ── ZIP ─────────────────────────────────────────────────────────────── */

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deflate brut natif (navigateurs récents, Node 21+) ; null s'il est indisponible */
async function deflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null;
  try {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const [, compressed] = await Promise.all([
      writer.write(data).then(() => writer.close()),
      new Response(stream.readable).arrayBuffer(),
    ]);
    return new Uint8Array(compressed);
  } catch {
    return null;
  }
}

interface ZipFile {
  readonly name: Uint8Array<ArrayBuffer>;
  readonly crc: number;
  readonly size: number;
  readonly method: 0 | 8;
  readonly data: Uint8Array<ArrayBuffer>;
  readonly offset: number;
}

async function zip(entries: readonly { name: string; content: string }[], now: Date, compress: boolean): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const files: ZipFile[] = [];
  let offset = 0;
  for (const entry of entries) {
    const raw = encoder.encode(entry.content);
    const deflated = compress ? await deflateRaw(raw) : null;
    const useDeflate = deflated !== null && deflated.length < raw.length;
    const name = encoder.encode(entry.name);
    const file: ZipFile = {
      name,
      crc: crc32(raw),
      size: raw.length,
      method: useDeflate ? 8 : 0,
      data: useDeflate ? deflated : raw,
      offset,
    };
    files.push(file);
    offset += 30 + name.length + file.data.length;
  }
  const centralSize = files.reduce((sum, file) => sum + 46 + file.name.length, 0);
  const output = new Uint8Array(offset + centralSize + 22);
  const view = new DataView(output.buffer);
  let at = 0;
  const u16 = (value: number) => {
    view.setUint16(at, value, true);
    at += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(at, value >>> 0, true);
    at += 4;
  };
  const bytes = (value: Uint8Array) => {
    output.set(value, at);
    at += value.length;
  };
  // Version 2.0, bit 11 : noms en UTF-8
  const common = (file: ZipFile) => {
    u16(20);
    u16(0x0800);
    u16(file.method);
    u16(time);
    u16(date);
    u32(file.crc);
    u32(file.data.length);
    u32(file.size);
    u16(file.name.length);
    u16(0);
  };

  for (const file of files) {
    u32(0x04034b50);
    common(file);
    bytes(file.name);
    bytes(file.data);
  }
  const centralStart = at;
  for (const file of files) {
    u32(0x02014b50);
    u16(20);
    common(file);
    u16(0); // commentaire
    u16(0); // disque
    u16(0); // attributs internes
    u32(0); // attributs externes
    u32(file.offset);
    bytes(file.name);
  }
  const centralLength = at - centralStart;
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(files.length);
  u16(files.length);
  u32(centralLength);
  u32(centralStart);
  u16(0);
  return output;
}

/* ── Classeur ────────────────────────────────────────────────────────── */

export interface BuildXlsxOptions {
  /** Date de création inscrite dans le fichier */
  readonly now?: Date;
  /** Compression deflate (désactivable pour inspecter le fichier) */
  readonly compress?: boolean;
}

/** Contenu binaire du classeur .xlsx (une feuille) */
export async function buildXlsx(sheet: XlsxSheet, { now = new Date(), compress = true }: BuildXlsxOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const name = sheetName(sheet.name);
  const strings = new SharedStrings();
  const { xml: worksheet, range } = worksheetXml(layout(sheet), strings);
  return zip(
    [
      { name: '[Content_Types].xml', content: CONTENT_TYPES_XML },
      { name: '_rels/.rels', content: ROOT_RELS_XML },
      { name: 'docProps/core.xml', content: coreXml(name, now) },
      { name: 'xl/workbook.xml', content: workbookXml(name, range) },
      { name: 'xl/_rels/workbook.xml.rels', content: WORKBOOK_RELS_XML },
      { name: 'xl/styles.xml', content: STYLES_XML },
      { name: 'xl/worksheets/sheet1.xml', content: worksheet },
      { name: 'xl/sharedStrings.xml', content: strings.toXml() },
    ],
    now,
    compress
  );
}
