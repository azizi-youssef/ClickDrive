import { jsPDF } from 'jspdf';
import type { Booking } from '@/types';
import { bookingStatusLabel, bookingStatusTone, bookingNextStepHint } from '@/lib/bookings/status';
import { formatEngineCc, isMotorcycle, motorcycleLicenseLabel } from '@/lib/vehicles/kind';

/* ================================================================
   Fiche « Demande de réservation » ClickDrive — une seule page A4
   Principes :
   - uniquement des données réelles du dossier : jamais de valeur inventée
     (caution, horaires, lieu, pays…) — une donnée absente est signalée comme telle ;
   - statut traduit, et une demande non confirmée n'est jamais présentée comme confirmée ;
   - tient sur une page : la mise en page se resserre si besoin, et seul un message
     client exceptionnellement long est abrégé (avec mention explicite) ;
   - aucune donnée interne (commission, marge) n'apparaît sur le document.
   ================================================================ */

type RGB = readonly [number, number, number];

const COLORS = {
  ink: [11, 18, 32],
  text: [16, 24, 40],
  secondary: [71, 84, 103],
  muted: [102, 112, 133],
  line: [228, 231, 236],
  soft: [245, 246, 248],
  action: [201, 47, 59],
  white: [255, 255, 255],
  onInk: [203, 213, 225],
} as const satisfies Record<string, RGB>;

const TONES: Record<string, { bg: RGB; fg: RGB }> = {
  success: { bg: [236, 253, 243], fg: [6, 118, 71] },
  warning: { bg: [255, 250, 235], fg: [181, 71, 8] },
  danger: { bg: [254, 243, 242], fg: [180, 35, 24] },
  info: { bg: [239, 248, 255], fg: [23, 92, 211] },
  neutral: { bg: [242, 244, 247], fg: [52, 64, 84] },
  brand: { bg: [253, 237, 238], fg: [166, 30, 42] },
};

/** Statuts où l'agence a validé la location et où la remise du véhicule reste à venir */
const CONFIRMED_BEFORE_PICKUP = new Set(['APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP']);

const CONFIRMED_NOTE =
  "Réservation confirmée par l'agence. Présentez ce document et vos pièces d'identité originales lors de la remise du véhicule.";
const PENDING_NOTE =
  "Cette demande n'est pas encore une réservation confirmée : l'agence doit valider la disponibilité et les conditions.";
const PAYMENT_NOTE =
  "La location et la caution se règlent directement auprès de l'agence, à la remise du véhicule.";
const LEGAL_NOTE =
  "ClickDrive met en relation clients et agences partenaires. Le contrat de location est signé avec l'agence, seule responsable du véhicule, du tarif et de la caution.";

const MISSING = 'Non renseigné';

const FUEL_LABELS: Record<string, string> = {
  DIESEL: 'Diesel',
  GASOLINE: 'Essence',
  PETROL: 'Essence',
  ESSENCE: 'Essence',
  HYBRID: 'Hybride',
  ELECTRIC: 'Électrique',
};

const TRANSMISSION_LABELS: Record<string, string> = {
  AUTOMATIC: 'Automatique',
  MANUAL: 'Manuelle',
};

const DELIVERY_LABELS: Record<string, string> = {
  AIRPORT: "Remise à l'aéroport",
  HOTEL: "Remise à l'hôtel",
  ADDRESS: 'Remise à une adresse',
  AGENCY_PICKUP: 'Retrait en agence',
};

/* ---------------------------------------------------------------- */
/* Utilitaires de formatage                                          */
/* ---------------------------------------------------------------- */

const SPACES_RE = new RegExp(`[${String.fromCharCode(0x00a0, 0x202f, 0x2009)}]`, 'g');
const INVISIBLE_RE = new RegExp(`[${String.fromCharCode(0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0xfeff)}]`, 'g');

/**
 * Les polices standard de jsPDF n'encodent que le jeu WinAnsi (Latin-1 étendu) :
 * la ponctuation typographique est convertie, le reste est conservé tel quel.
 */
export function pdfSafeText(value: string): string {
  return value
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/•/g, '·')
    .replace(SPACES_RE, ' ')
    .replace(INVISIBLE_RE, '')
    .trim();
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return '';
  return pdfSafeText(String(value));
}

/** Valeur d'un champ : une seule ligne logique (retours à la ligne et espaces multiples réduits) */
function oneLine(value: unknown): string {
  return clean(value).replace(/\s+/g, ' ');
}

/** Date « AAAA-MM-JJ » (ou ISO complète) → « JJ/MM/AAAA », sans décalage de fuseau */
export function formatPdfDate(value?: string | null): string {
  if (!value) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Casablanca' }).format(date);
}

function formatPdfDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Casablanca',
  }).format(value);
  return pdfSafeText(parts.replace(' ', ' à '));
}

/** « 10:00:00 » → « 10:00 » ; vide si absent ou invalide */
export function formatPdfTime(value?: string | null): string {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value.trim()) : null;
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

/** Montant en dirhams avec séparateur de milliers ; vide si non numérique */
export function formatPdfAmount(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  const [int, dec] = rounded.toFixed(Number.isInteger(rounded) ? 0 : 2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${dec ? `,${dec}` : ''} DH`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}

/* ---------------------------------------------------------------- */
/* Logo (lu une seule fois par processus)                            */
/* ---------------------------------------------------------------- */

interface LogoData {
  dataUrl: string;
  width: number;
  height: number;
}

let cachedLogo: LogoData | null | undefined;

function loadLogo(): LogoData | null {
  if (cachedLogo !== undefined) return cachedLogo;
  cachedLogo = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const candidates = [
      path.join(process.cwd(), 'frontend', 'public', 'logo_12.png'),
      path.join(process.cwd(), 'public', 'logo_12.png'),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(/*turbopackIgnore: true*/ candidate)) continue;
      const buffer: Buffer = fs.readFileSync(/*turbopackIgnore: true*/ candidate);
      // Dimensions lues dans l'en-tête PNG (IHDR) pour conserver les proportions
      const isPng = buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG';
      cachedLogo = {
        dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
        width: isPng ? buffer.readUInt32BE(16) : 851,
        height: isPng ? buffer.readUInt32BE(20) : 229,
      };
      break;
    }
  } catch {
    // Environnement sans accès au système de fichiers : en-tête textuel
  }
  return cachedLogo;
}

/* ---------------------------------------------------------------- */
/* Densités de mise en page (essayées dans l'ordre jusqu'à tenir sur une page) */
/* ---------------------------------------------------------------- */

interface Density {
  columns: number;
  /** tailles de police (pt) */
  label: number;
  value: number;
  section: number;
  small: number;
  /** espacements (mm) */
  line: number;
  labelGap: number;
  rowGap: number;
  sectionBefore: number;
  sectionAfter: number;
  /** limites de lignes (au-delà : texte abrégé avec « [...] ») */
  maxFieldLines: number;
  maxNoteLines: number;
}

const NORMAL: Density = {
  columns: 3,
  label: 6.8,
  value: 8.4,
  section: 7.6,
  small: 7.2,
  line: 3.6,
  labelGap: 3.5,
  rowGap: 5.6,
  sectionBefore: 2.2,
  sectionAfter: 4.4,
  maxFieldLines: 4,
  maxNoteLines: Number.POSITIVE_INFINITY,
};

const COMPACT: Density = {
  columns: 4,
  label: 6.3,
  value: 7.8,
  section: 7.2,
  small: 6.9,
  line: 3.3,
  labelGap: 3.2,
  rowGap: 4.8,
  sectionBefore: 1.4,
  sectionAfter: 3.8,
  maxFieldLines: 3,
  maxNoteLines: Number.POSITIVE_INFINITY,
};

const DENSITIES: Density[] = [
  NORMAL,
  COMPACT,
  { ...COMPACT, maxNoteLines: 10 },
  { ...COMPACT, maxNoteLines: 5, maxFieldLines: 2 },
  { ...COMPACT, maxNoteLines: 2, maxFieldLines: 2 },
];

/* ---------------------------------------------------------------- */
/* Moteur de mise en page                                            */
/* ---------------------------------------------------------------- */

const MARGIN_X = 15;
const MARGIN_TOP = 14;
/** Hauteur réservée au pied de page (mention légale, référence, pagination) */
const FOOTER_SPACE = 19;
const ELLIPSIS = ' [...]';

type FieldItem = { label: string; value: string; full?: boolean; emphasis?: boolean };

class Layout {
  readonly doc: jsPDF;
  readonly d: Density;
  readonly width: number;
  readonly height: number;
  readonly contentWidth: number;
  y = MARGIN_TOP;

  constructor(doc: jsPDF, density: Density) {
    this.doc = doc;
    this.d = density;
    this.width = doc.internal.pageSize.getWidth();
    this.height = doc.internal.pageSize.getHeight();
    this.contentWidth = this.width - MARGIN_X * 2;
  }

  get bottom() {
    return this.height - FOOTER_SPACE;
  }

  color(rgb: RGB, kind: 'text' | 'fill' | 'draw' = 'text') {
    if (kind === 'text') this.doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    else if (kind === 'fill') this.doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    else this.doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }

  font(style: 'normal' | 'bold' | 'italic', size: number, rgb: RGB = COLORS.text) {
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
    this.color(rgb);
  }

  /** Découpe un texte à la largeur donnée (police déjà réglée), en abrégeant au-delà de maxLines */
  wrap(text: string, width: number, maxLines = Number.POSITIVE_INFINITY): { lines: string[]; truncated: boolean } {
    const lines = this.doc.splitTextToSize(text, width) as string[];
    if (lines.length <= maxLines) return { lines, truncated: false };
    const kept = lines.slice(0, maxLines);
    let last = kept[kept.length - 1].trimEnd();
    while (last.length > 0 && this.doc.getTextWidth(last + ELLIPSIS) > width) last = last.slice(0, -1).trimEnd();
    kept[kept.length - 1] = last + ELLIPSIS;
    return { lines: kept, truncated: true };
  }

  /** Passe à la page suivante si la hauteur demandée ne tient pas (cas de repli uniquement) */
  ensure(height: number) {
    if (this.y + height <= this.bottom) return;
    this.doc.addPage();
    this.y = MARGIN_TOP;
  }

  /** Titre de section, gardé sur la même page que les `keepWith` mm de contenu qui suivent */
  section(title: string, keepWith = 10) {
    const { d } = this;
    this.ensure(d.sectionBefore + 1.6 + d.sectionAfter + keepWith);
    this.y += d.sectionBefore;
    this.font('bold', d.section, COLORS.action);
    this.doc.setCharSpace(0.35);
    this.doc.text(clean(title).toUpperCase(), MARGIN_X, this.y);
    this.doc.setCharSpace(0);
    this.y += 1.6;
    this.color(COLORS.line, 'draw');
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN_X, this.y, this.width - MARGIN_X, this.y);
    this.y += d.sectionAfter;
  }

  /** Grille de champs libellé / valeur ; les valeurs longues passent à la ligne dans leur colonne */
  fields(items: FieldItem[]) {
    const { d } = this;
    const gap = 5;
    const colWidth = (this.contentWidth - gap * (d.columns - 1)) / d.columns;
    const rows: FieldItem[][] = [];
    let current: FieldItem[] = [];
    for (const item of items) {
      if (item.full) {
        if (current.length) rows.push(current);
        rows.push([item]);
        current = [];
        continue;
      }
      current.push(item);
      if (current.length === d.columns) {
        rows.push(current);
        current = [];
      }
    }
    if (current.length) rows.push(current);

    for (const row of rows) {
      const cells = row.map((item) => {
        const width = item.full ? this.contentWidth : colWidth;
        const value = oneLine(item.value) || MISSING;
        this.font(item.emphasis ? 'bold' : 'normal', d.value);
        return { item, value, lines: this.wrap(value, width, d.maxFieldLines).lines };
      });
      const maxLines = Math.max(...cells.map((cell) => cell.lines.length));
      this.ensure(d.labelGap + (maxLines - 1) * d.line + 1.5);
      cells.forEach((cell, index) => {
        const x = MARGIN_X + index * (colWidth + gap);
        this.font('normal', d.label, COLORS.muted);
        this.doc.text(clean(cell.item.label), x, this.y);
        this.font(cell.item.emphasis ? 'bold' : 'normal', d.value, cell.value === MISSING ? COLORS.muted : COLORS.text);
        cell.lines.forEach((line, i) => this.doc.text(line, x, this.y + d.labelGap + i * d.line));
      });
      this.y += d.labelGap + (maxLines - 1) * d.line + d.rowGap;
    }
  }

  /** Paragraphe pleine largeur ; renvoie true si le texte a été abrégé */
  paragraph(
    text: string,
    options: { size: number; style?: 'normal' | 'bold' | 'italic'; rgb?: RGB; maxLines?: number; lineHeight?: number }
  ): boolean {
    const style = options.style ?? 'normal';
    const lineHeight = options.lineHeight ?? options.size * 0.43;
    this.font(style, options.size, options.rgb ?? COLORS.text);
    const { lines, truncated } = this.wrap(text, this.contentWidth, options.maxLines);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.font(style, options.size, options.rgb ?? COLORS.text);
      this.doc.text(line, MARGIN_X, this.y);
      this.y += lineHeight;
    }
    this.y += 1.2;
    return truncated;
  }
}

/* ---------------------------------------------------------------- */
/* Rendu                                                             */
/* ---------------------------------------------------------------- */

function renderBookingPdf(booking: Booking, d: Density, logo: LogoData | null, generatedAt: Date): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const layout = new Layout(doc, d);
  const right = layout.width - MARGIN_X;

  const reference = clean(booking.reference || booking.booking_ref) || 'Référence en attente';
  const status = clean(booking.status).toUpperCase();
  const statusLabel = clean(bookingStatusLabel(status, 'fr', 'customer')) || 'Statut inconnu';
  const tone = TONES[bookingStatusTone(status)] ?? TONES.neutral;

  doc.setProperties({
    title: `ClickDrive - Demande de réservation ${reference}`,
    subject: 'Demande de réservation de véhicule',
    author: 'ClickDrive',
    creator: 'ClickDrive',
    keywords: 'ClickDrive, réservation, location de voiture, Nador',
  });
  doc.setLanguage('fr');

  /* ---------- En-tête ---------- */
  const top = layout.y;
  const headerHeight = 22;
  layout.color(COLORS.ink, 'fill');
  doc.roundedRect(MARGIN_X, top, layout.contentWidth, headerHeight, 2.5, 2.5, 'F');

  let logoDrawn = false;
  if (logo) {
    try {
      const tile = { x: MARGIN_X + 4, y: top + 4, w: 40, h: 14 };
      layout.color(COLORS.white, 'fill');
      doc.roundedRect(tile.x, tile.y, tile.w, tile.h, 1.8, 1.8, 'F');
      const ratio = logo.width / logo.height;
      const drawW = Math.min(tile.w - 6, (tile.h - 4.5) * ratio);
      const drawH = drawW / ratio;
      const format = /image\/jpe?g/.test(logo.dataUrl) ? 'JPEG' : 'PNG';
      doc.addImage(logo.dataUrl, format, tile.x + (tile.w - drawW) / 2, tile.y + (tile.h - drawH) / 2, drawW, drawH, 'clickdrive-logo', 'FAST');
      logoDrawn = true;
    } catch (error) {
      console.warn('[PdfService] Logo non affiché, en-tête textuel utilisé :', error);
    }
  }

  const titleX = logoDrawn ? MARGIN_X + 50 : MARGIN_X + 6;
  if (logoDrawn) {
    layout.font('bold', 11.5, COLORS.white);
    doc.text('Demande de réservation', titleX, top + 10.5);
    layout.font('normal', 7, COLORS.onInk);
    doc.text(pdfSafeText('Agences partenaires · Nador et région de l’Oriental'), titleX, top + 16);
  } else {
    layout.font('bold', 14, COLORS.white);
    doc.text('ClickDrive', titleX, top + 10);
    layout.font('normal', 8, COLORS.onInk);
    doc.text('Demande de réservation', titleX, top + 16);
  }

  layout.font('normal', 6.3, COLORS.onInk);
  doc.text('RÉFÉRENCE', right - 5, top + 7, { align: 'right' });
  layout.font('bold', 11, COLORS.white);
  doc.text(reference, right - 5, top + 12.8, { align: 'right' });
  const requestedOn = formatPdfDate(booking.requested_at || booking.created_at);
  if (requestedOn) {
    layout.font('normal', 6.8, COLORS.onInk);
    doc.text(`Demande envoyée le ${requestedOn}`, right - 5, top + 17.6, { align: 'right' });
  }
  layout.y = top + headerHeight + 4;

  /* ---------- Statut ---------- */
  const note = CONFIRMED_BEFORE_PICKUP.has(status) ? CONFIRMED_NOTE : clean(bookingNextStepHint(status)) || PENDING_NOTE;
  layout.font('normal', d.small);
  const noteLines = layout.wrap(pdfSafeText(note), layout.contentWidth - 10, 2).lines;
  const statusTop = layout.y;
  const statusHeight = 6.6 + noteLines.length * 3.3 + 1.6;
  layout.color(tone.bg, 'fill');
  doc.roundedRect(MARGIN_X, statusTop, layout.contentWidth, statusHeight, 1.8, 1.8, 'F');
  layout.color(tone.fg, 'fill');
  doc.rect(MARGIN_X, statusTop, 1.2, statusHeight, 'F');
  layout.font('normal', 6.8, COLORS.secondary);
  const statusCaption = 'Statut de la demande :';
  doc.text(statusCaption, MARGIN_X + 5, statusTop + 5);
  const captionWidth = doc.getTextWidth(statusCaption);
  layout.font('bold', 9, tone.fg);
  doc.text(statusLabel, MARGIN_X + 5 + captionWidth + 2, statusTop + 5);
  layout.font('normal', d.small, COLORS.secondary);
  noteLines.forEach((line, i) => doc.text(line, MARGIN_X + 5, statusTop + 9.4 + i * 3.3));
  layout.y = statusTop + statusHeight + 3.5;

  if (status === 'REJECTED' && booking.rejection_reason) {
    layout.y += 2.5;
    layout.paragraph(`Motif communiqué par l'agence : ${oneLine(booking.rejection_reason)}`, {
      size: d.small,
      rgb: COLORS.secondary,
      maxLines: 2,
    });
  }

  let sectionNumber = 0;
  const section = (title: string, keepWith?: number) => layout.section(`${++sectionNumber}. ${title}`, keepWith);

  /* ---------- Client ---------- */
  section('Client et conducteur');
  const customerName = oneLine(booking.customer_name) || oneLine(`${booking.first_name ?? ''} ${booking.last_name ?? ''}`);
  const showEmail = Boolean(booking.customer_email) && !booking.customer_email.endsWith('@clickdrive.ma');
  layout.fields([
    { label: 'Nom complet', value: customerName, emphasis: true },
    { label: 'Téléphone / WhatsApp', value: oneLine(booking.customer_phone) },
    ...(showEmail ? [{ label: 'E-mail', value: oneLine(booking.customer_email) }] : []),
    { label: 'CIN / Passeport', value: oneLine(booking.cin) || 'À présenter à la remise' },
    { label: 'N° de permis de conduire', value: oneLine(booking.license_number) || 'À présenter à la remise' },
    { label: 'Validité du permis', value: formatPdfDate(booking.license_expiry) || oneLine(booking.license_expiry) },
    { label: 'Pays de résidence', value: oneLine(booking.customer_country) },
  ]);

  /* ---------- Véhicule et agence ---------- */
  const vehicle = booking.vehicle;
  const agency = booking.agency;
  const isMoto = isMotorcycle(vehicle);
  section(isMoto ? 'Moto et agence partenaire' : 'Véhicule et agence partenaire');
  const vehicleTitle = vehicle
    ? oneLine(`${vehicle.brand ?? ''} ${vehicle.model ?? ''}${vehicle.year ? ` (${vehicle.year})` : ''}`)
    : '';
  const fuelKey = oneLine(vehicle?.fuel).toUpperCase();
  const transmissionKey = oneLine(vehicle?.transmission).toUpperCase();
  layout.fields([
    { label: isMoto ? 'Moto' : 'Véhicule', value: vehicleTitle, emphasis: true },
    { label: 'Catégorie', value: isMoto ? `Moto · ${oneLine(vehicle?.category)}` : oneLine(vehicle?.category) },
    {
      label: isMoto ? 'Boîte / carburant / cylindrée' : 'Boîte / carburant',
      value: [
        TRANSMISSION_LABELS[transmissionKey] ?? oneLine(vehicle?.transmission),
        FUEL_LABELS[fuelKey] ?? oneLine(vehicle?.fuel),
        isMoto ? formatEngineCc(vehicle?.engine_cc) : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
    ...(isMoto
      ? [{ label: 'Permis exigé par l\'agence', value: motorcycleLicenseLabel(vehicle?.license_required) || "À confirmer avec l'agence", emphasis: true }]
      : []),
    { label: 'Agence', value: oneLine(agency?.name), emphasis: true },
    { label: "Adresse de l'agence", value: [oneLine(agency?.address), oneLine(agency?.city)].filter(Boolean).join(', ') },
    { label: "Contact de l'agence", value: [oneLine(agency?.phone), oneLine(agency?.email)].filter(Boolean).join(' · ') },
  ]);

  /* ---------- Dates et lieux ---------- */
  section('Dates et lieux');
  const at = (date?: string, time?: string) => {
    const day = formatPdfDate(date);
    const hour = formatPdfTime(time);
    if (!day) return '';
    return hour ? `${day} à ${hour}` : `${day} (heure à convenir avec l'agence)`;
  };
  const totalDays = Number(booking.total_days);
  const hasDays = Number.isFinite(totalDays) && totalDays > 0;
  const options = [booking.child_seat ? 'Siège enfant' : '', booking.additional_driver ? 'Conducteur additionnel' : '']
    .filter(Boolean)
    .join(' · ');
  layout.fields([
    { label: 'Prise en charge', value: at(booking.start_date, booking.pickup_time), emphasis: true },
    { label: 'Restitution', value: at(booking.end_date, booking.dropoff_time), emphasis: true },
    { label: 'Durée', value: hasDays ? plural(totalDays, 'jour') : '' },
    { label: 'Lieu de prise en charge', value: oneLine(booking.pickup_location) },
    { label: 'Lieu de restitution', value: oneLine(booking.dropoff_location) },
    { label: 'Mode de remise', value: booking.delivery_type ? DELIVERY_LABELS[booking.delivery_type] ?? '' : '' },
    ...(booking.flight_number
      ? [
          { label: "Vol d'arrivée", value: oneLine(booking.flight_number) },
          { label: "Heure d'atterrissage prévue", value: formatPdfTime(booking.flight_arrival_time) },
        ]
      : []),
    ...(options ? [{ label: 'Options demandées', value: options }] : []),
  ]);

  /* ---------- Tarification ---------- */
  const priceHeight = 17;
  section('Tarification', priceHeight);
  const priceTop = layout.y - 1.5;
  layout.color(COLORS.line, 'draw');
  layout.color(COLORS.soft, 'fill');
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X, priceTop, layout.contentWidth, priceHeight, 1.8, 1.8, 'FD');

  const daily = formatPdfAmount(booking.daily_price);
  const subtotal = Number(booking.subtotal);
  const total = Number(booking.total_price);
  const deposit = Number(booking.deposit_amount ?? vehicle?.deposit);
  const priceBlocks: Array<[string, string]> = [
    ['Tarif de la location', daily ? (hasDays ? `${daily} / jour × ${plural(totalDays, 'jour')}` : `${daily} / jour`) : MISSING],
    ["Caution (remboursable, réglée à l'agence)", Number.isFinite(deposit) && deposit > 0 ? formatPdfAmount(deposit) : "Communiquée par l'agence"],
  ];
  if (Number.isFinite(subtotal) && subtotal > 0 && Number.isFinite(total) && Math.abs(subtotal - total) >= 1) {
    priceBlocks.push(['Sous-total location', formatPdfAmount(subtotal)]);
  }
  priceBlocks.forEach(([label, value], index) => {
    const x = MARGIN_X + 5 + index * 52;
    layout.font('normal', d.label, COLORS.muted);
    doc.text(label, x, priceTop + 5.5);
    layout.font('normal', d.value, COLORS.text);
    doc.text(value, x, priceTop + 9.8);
  });
  layout.font('normal', d.label, COLORS.muted);
  doc.text('Total de la location', right - 5, priceTop + 5.5, { align: 'right' });
  layout.font('bold', 12, COLORS.ink);
  doc.text(formatPdfAmount(booking.total_price) || MISSING, right - 5, priceTop + 10.8, { align: 'right' });
  layout.font('normal', 6.6, COLORS.muted);
  doc.text(PAYMENT_NOTE, MARGIN_X + 5, priceTop + 14.6);
  layout.y = priceTop + priceHeight + 2;

  /* ---------- Message du client ---------- */
  const notes = clean(booking.customer_notes || booking.notes)
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  if (notes) {
    section('Message du client', 6);
    const truncated = layout.paragraph(`"${notes}"`, {
      size: d.value,
      style: 'italic',
      lineHeight: d.line,
      maxLines: d.maxNoteLines,
    });
    if (truncated) {
      layout.paragraph('Message abrégé : texte complet dans le dossier de réservation en ligne.', {
        size: d.label,
        rgb: COLORS.muted,
      });
    }
  }

  /* ---------- Remise du véhicule ---------- */
  const boxHeight = 40;
  section("Remise du véhicule (à compléter avec l'agence)", boxHeight);
  const boxTop = layout.y - 1.5;
  layout.color(COLORS.line, 'draw');
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X, boxTop, layout.contentWidth, boxHeight, 1.8, 1.8, 'D');

  const leftX = MARGIN_X + 5;
  const checkbox = (x: number, y: number, label: string) => {
    layout.color(COLORS.secondary, 'draw');
    doc.setLineWidth(0.25);
    doc.rect(x, y - 2.7, 2.9, 2.9, 'D');
    layout.font('normal', 7.8, COLORS.text);
    doc.text(label, x + 4.3, y);
    return x + 4.3 + doc.getTextWidth(label) + 5;
  };
  const labelled = (label: string, y: number) => {
    layout.font('normal', 7.8, COLORS.text);
    doc.text(label, leftX, y);
    return leftX + doc.getTextWidth(label) + 2.5;
  };
  const blank = (x: number, y: number, length: number) => {
    layout.color(COLORS.muted, 'draw');
    doc.setLineWidth(0.2);
    doc.line(x, y + 0.6, x + length, y + 0.6);
  };

  const rowY = (index: number) => boxTop + 6.8 + index * 7;
  checkbox(checkbox(leftX, rowY(0), 'CIN / Passeport vérifié'), rowY(0), 'Permis de conduire vérifié');
  blank(labelled('Kilométrage au départ :', rowY(1)), rowY(1), 30);
  let fuelX = labelled('Carburant :', rowY(2));
  for (const level of ['1/4', '1/2', '3/4', 'Plein']) fuelX = checkbox(fuelX, rowY(2), level);
  blank(labelled('Date et heure de remise :', rowY(3)), rowY(3), 40);
  blank(labelled('Observations :', rowY(4)), rowY(4), 58);

  const signature = { w: 36, h: 25 };
  const signatureY = boxTop + boxHeight - signature.h - 4;
  const secondX = right - 5 - signature.w;
  const firstX = secondX - signature.w - 3;
  for (const [x, label] of [
    [firstX, 'Signature du conducteur'],
    [secondX, 'Cachet et signature agence'],
  ] as const) {
    layout.font('normal', 6.6, COLORS.muted);
    doc.text(label, x, signatureY - 1.8);
    layout.color(COLORS.line, 'draw');
    layout.color(COLORS.white, 'fill');
    doc.roundedRect(x, signatureY, signature.w, signature.h, 1.4, 1.4, 'FD');
  }
  layout.y = boxTop + boxHeight + 2;

  /* ---------- Pied de page ---------- */
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const lineY = layout.height - 17;
    layout.color(COLORS.line, 'draw');
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, lineY, right, lineY);
    layout.font('normal', 6.4, COLORS.muted);
    layout
      .wrap(LEGAL_NOTE, layout.contentWidth, 2)
      .lines.forEach((line, i) => doc.text(line, MARGIN_X, lineY + 4 + i * 2.7));
    doc.text(`${reference} · Document généré le ${formatPdfDateTime(generatedAt)} · clickdrive.ma`, MARGIN_X, layout.height - 7.2);
    doc.text(`Page ${page} / ${pages}`, right, layout.height - 7.2, { align: 'right' });
  }

  return doc;
}

/* ---------------------------------------------------------------- */
/* Service                                                           */
/* ---------------------------------------------------------------- */

export class PdfService {
  /**
   * Génère la fiche PDF « ClickDrive — Demande de réservation » sur une page A4.
   * Les densités sont essayées de la plus aérée à la plus serrée ; la première
   * qui tient sur une page est retenue.
   */
  generateBookingRequestPdf(booking: Booking, customLogoDataUrl?: string): Uint8Array {
    const logo = customLogoDataUrl ? { dataUrl: customLogoDataUrl, width: 851, height: 229 } : loadLogo();
    const generatedAt = new Date();
    let doc = renderBookingPdf(booking, DENSITIES[0], logo, generatedAt);
    for (const density of DENSITIES.slice(1)) {
      if (doc.getNumberOfPages() === 1) break;
      doc = renderBookingPdf(booking, density, logo, generatedAt);
    }
    return new Uint8Array(doc.output('arraybuffer'));
  }
}

export const pdfService = new PdfService();
