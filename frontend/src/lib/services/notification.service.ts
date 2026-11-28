import { Booking } from '@/types';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';
import { siteConfig } from '@/config/site';

export interface WhatsAppPayload {
  phone: string;
  text: string;
  bookingRef: string;
}

class NotificationService {
  // Les e-mails transactionnels sont envoyés par lib/email (Resend), voir lib/bookings/notifications.ts.
  // Pas de notification « tableau de bord » enregistrée en base : dans l'espace agence, la cloche est
  // calculée à partir des demandes à traiter et se met à jour en direct (AgencyWorkspace).

  /** Construit un lien WhatsApp avec message pré-rempli */
  generateWhatsAppLink(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  /** Message WhatsApp professionnel destiné à l'agence */
  formatAgencyWhatsAppMessage(booking: Booking, appUrl?: string): string {
    const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;
    const ref = booking.reference || booking.booking_ref || '';
    const pdfUrl = `${baseUrl}${signedBookingPdfPath(ref)}`;
    const dashboardUrl = `${baseUrl}/agency?booking=${encodeURIComponent(ref)}`;
    const vehicleName = booking.vehicle
      ? `${booking.vehicle.brand} ${booking.vehicle.model} (${booking.vehicle.year})`
      : 'Véhicule';

    return (
      `🚗 *NOUVELLE DEMANDE DE RÉSERVATION CLICKDRIVE*\n\n` +
      `*Référence :* ${ref}\n` +
      `*Véhicule :* ${vehicleName}\n` +
      `*Client :* ${booking.customer_name}\n` +
      `*N° CIN / Passeport :* ${booking.cin || 'Présenté sur place'}\n` +
      `*Téléphone client :* ${booking.customer_phone}\n\n` +
      `📅 *Période :* du ${booking.start_date} au ${booking.end_date} (${booking.total_days} jours)\n` +
      `📍 *Point de rendez-vous :* ${booking.pickup_location}\n` +
      (booking.ferry_details ? `🚢 *Ferry :* ${booking.ferry_details}\n` : '') +
      (booking.flight_number
        ? `✈️ *Vol d'arrivée :* ${booking.flight_number} (${booking.flight_arrival_time || '—'})\n`
        : '') +
      `\n💰 *Montant total :* ${booking.total_price} DH\n` +
      `🔒 *Caution :* ${booking.deposit_amount ?? 3000} DH\n\n` +
      `📄 *Fiche PDF :*\n${pdfUrl}\n\n` +
      `💻 *Dashboard Agence :*\n${dashboardUrl}`
    );
  }
}

export const notificationService = new NotificationService();
