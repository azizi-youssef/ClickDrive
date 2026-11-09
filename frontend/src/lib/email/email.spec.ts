import { afterEach, describe, expect, it, vi } from 'vitest';
import { contactInbox, sendEmail } from './send';
import {
  bookingNewAgencyEmail,
  bookingReceivedCustomerEmail,
  bookingStatusCustomerEmail,
  contactAcknowledgementEmail,
  contactTeamAlertEmail,
  escapeHtml,
  type BookingEmailInput,
} from './templates';
import { templateLanguage } from '@/lib/bookings/whatsapp-templates';

const message = { to: 'client@example.com', subject: 'Test', html: '<p>Test</p>', text: 'Test' };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('sendEmail — jamais de faux succès', () => {
  it('sans configuration : « skipped », aucun appel réseau', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    expect(await sendEmail(message, fetchMock)).toEqual({ status: 'skipped', reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('destinataire invalide : « skipped » avant tout envoi', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'ClickDrive <notifications@clickdrive.ma>');
    const fetchMock = vi.fn();
    expect(await sendEmail({ ...message, to: 'pas-une-adresse' }, fetchMock)).toEqual({
      status: 'skipped',
      reason: 'invalid_recipient',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('destinataire absent (champ non chargé) : « skipped », jamais d’exception', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'ClickDrive <notifications@clickdrive.ma>');
    const fetchMock = vi.fn();
    for (const to of [undefined, null, ['', null]]) {
      expect(await sendEmail({ ...message, to: to as unknown as string }, fetchMock)).toEqual({
        status: 'skipped',
        reason: 'invalid_recipient',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoi accepté par le fournisseur : « sent » avec son identifiant', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'ClickDrive <notifications@clickdrive.ma>');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));
    const result = await sendEmail({ ...message, replyTo: 'contact@clickdrive.ma' }, fetchMock);
    expect(result).toEqual({ status: 'sent', id: 'email_123' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: ['client@example.com'],
      from: 'ClickDrive <notifications@clickdrive.ma>',
      reply_to: 'contact@clickdrive.ma',
    });
  });

  it('refus du fournisseur ou panne réseau : « failed », sans exception', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'ClickDrive <notifications@clickdrive.ma>');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const refused = vi.fn(async () => new Response(JSON.stringify({ message: 'Domaine non vérifié' }), { status: 403 }));
    expect(await sendEmail(message, refused)).toEqual({ status: 'failed', error: 'Domaine non vérifié' });
    const offline = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    expect(await sendEmail(message, offline)).toEqual({ status: 'failed', error: 'fetch failed' });
  });

  it('boîte de l’équipe : variable d’environnement valide, sinon contact@clickdrive.ma', () => {
    vi.stubEnv('CONTACT_INBOX_EMAIL', 'support@clickdrive.ma');
    expect(contactInbox()).toBe('support@clickdrive.ma');
    vi.stubEnv('CONTACT_INBOX_EMAIL', 'invalide');
    expect(contactInbox()).toBe('contact@clickdrive.ma');
  });
});

describe('Gabarits d’e-mails', () => {
  const contact = {
    reference: 'MSG-20261108-ABC234',
    name: '<script>alert(1)</script> Karim',
    email: 'karim@example.com',
    phone: null,
    category: 'reservation',
    subject: 'Ligne 1\r\nBcc: pirate@example.com',
    message: 'Bonjour <b>équipe</b>, je voudrais une voiture pour le mois d’août.',
  };

  it('échappe toute donnée saisie par le visiteur dans le HTML', () => {
    const ack = contactAcknowledgementEmail(contact);
    expect(ack.html).not.toContain('<script>');
    expect(ack.html).toContain('&lt;script&gt;');
    expect(ack.html).not.toContain('<b>équipe</b>');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('aucun retour à la ligne dans l’objet (pas d’injection d’en-tête)', () => {
    const alert = contactTeamAlertEmail({ ...contact, name: 'Karim\nBcc: x@example.com' });
    expect(alert.subject).not.toMatch(/[\r\n]/);
    expect(alert.subject).toContain('MSG-20261108-ABC234');
  });

  const booking: BookingEmailInput = {
    reference: 'CD-2026-123456',
    status: 'REJECTED',
    customerName: 'Sara',
    vehicleLabel: 'Renault Clio 2025',
    agencyName: 'Agence Test',
    startDate: '2026-12-01',
    endDate: '2026-12-04',
    totalDays: 3,
    totalPrice: 1050,
    pickupLocation: 'Aéroport Nador-Al Aroui',
    pdfUrl: 'https://clickdrive.ma/api/bookings/CD-2026-123456/pdf?sig=abc',
    reason: 'Véhicule en maintenance',
  };

  it('refus : motif de l’agence et aucun lien de bon de réservation', () => {
    const rendered = bookingStatusCustomerEmail(booking);
    expect(rendered?.subject).toBe('Réservation CD-2026-123456 : non acceptée');
    expect(rendered?.text).toContain('Véhicule en maintenance');
    expect(rendered?.html).not.toContain('/pdf');
  });

  it('confirmation : bon de réservation joint ; statut sans e-mail : null', () => {
    const confirmed = bookingStatusCustomerEmail({ ...booking, status: 'CONFIRMED', reason: null });
    expect(confirmed?.subject).toBe('Réservation CD-2026-123456 : confirmée');
    expect(confirmed?.html).toContain('/api/bookings/CD-2026-123456/pdf');
    expect(bookingStatusCustomerEmail({ ...booking, status: 'ACTIVE' })).toBeNull();
  });

  it('client : e-mail dans la langue de sa demande ; agence : toujours en français', () => {
    const english = bookingReceivedCustomerEmail({ ...booking, status: 'PENDING', locale: 'en' });
    expect(english.subject).toBe('Request CD-2026-123456 received — Renault Clio 2025');
    expect(english.html).toContain('<html lang="en" dir="ltr">');
    expect(english.text).toContain('This is not a confirmed booking yet');
    expect(english.text).toMatch(/Tuesday,? 1 December 2026/);
    expect(english.text).toContain('3 days');

    const arabic = bookingStatusCustomerEmail({ ...booking, status: 'CONFIRMED', reason: null, locale: 'ar' });
    expect(arabic?.html).toContain('<html lang="ar" dir="rtl">');
    expect(arabic?.subject).toBe('الحجز CD-2026-123456: مؤكد');
    // Chiffres latins, comme sur le site
    expect(arabic?.text).toMatch(/1[\s ,.]?050 MAD/);

    const agency = bookingNewAgencyEmail({ ...booking, status: 'PENDING', locale: 'nl', dashboardUrl: 'https://clickdrive.ma/agency' });
    expect(agency.subject).toBe('Nouvelle demande CD-2026-123456 — Renault Clio 2025');
    expect(agency.html).toContain('<html lang="fr"');
  });

  it('accusé de contact dans la langue du formulaire ; alerte à l’équipe en français', () => {
    const ack = contactAcknowledgementEmail({ ...contact, locale: 'de' });
    expect(ack.subject).toBe('Wir haben Ihre Nachricht erhalten (MSG-20261108-ABC234)');
    expect(ack.text).toContain('Information zu einem Fahrzeug oder einer Buchung');
    const alert = contactTeamAlertEmail({ ...contact, locale: 'de' });
    expect(alert.text).toContain('Langue : DE');
    expect(alert.text).toContain('Information sur un véhicule ou une réservation');
  });
});

describe('Langue des modèles WhatsApp', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('français par défaut ; une langue seulement si sa traduction est déclarée approuvée', () => {
    vi.stubEnv('WHATSAPP_TEMPLATE_LANGUAGES', '');
    expect(templateLanguage('nl')).toBe('fr');
    vi.stubEnv('WHATSAPP_TEMPLATE_LANGUAGES', 'fr, en ,NL');
    expect(templateLanguage('nl')).toBe('nl');
    expect(templateLanguage('en')).toBe('en');
    expect(templateLanguage('ar')).toBe('fr');
    expect(templateLanguage(undefined)).toBe('fr');
  });
});
