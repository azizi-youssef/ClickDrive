/**
 * ClickDrive Unique Booking Reference Generator
 * Format: CD-YYYY-XXXXXX (e.g. CD-2026-001842)
 * Easily readable, memorable, clean for WhatsApp and PDF invoices.
 */

let sequenceCounter = Math.floor(Date.now() % 800000) + 100000;

export function generateBookingReference(year?: number): string {
  const currentYear = year || new Date().getFullYear();
  sequenceCounter = ((sequenceCounter + 1) % 900000) + 100000;
  return `CD-${currentYear}-${sequenceCounter}`;
}

export function isValidBookingReference(ref: string): boolean {
  if (!ref) return false;
  // CD-2026-XXXXXX ou ancien format #NRD-XXXX
  return /^CD-\d{4}-\d{6}$/i.test(ref.trim()) || /^#?NRD-\d{4,6}$/i.test(ref.trim());
}
