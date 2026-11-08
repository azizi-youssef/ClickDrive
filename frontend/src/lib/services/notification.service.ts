import { Booking } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';

export interface EmailPayload {
  to: string;
  subject: string;
  template:
    | 'booking-request-to-agency'
    | 'booking-request-confirmation-to-customer'
    | 'booking-approved'
    | 'booking-rejected'
    | 'booking-alternative';
  variables: Record<string, any>;
}

export interface WhatsAppPayload {
  phone: string;
  text: string;
  bookingRef: string;
}

export interface DashboardNotificationPayload {
  userId?: string;
  agencyId?: string;
  title: string;
  message: string;
  link: string;
  type?: 'BOOKING' | 'SYSTEM' | 'COMMISSION';
}

class NotificationService {
  /**
   * Envoi d'email via provider tiers (Resend / SendGrid).
   * TODO: brancher un provider email de production ici.
   */
  async sendEmail(
    payload: EmailPayload
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log(
      `[NotificationService] 📧 Sending email to ${payload.to} — ${payload.subject}`
    );
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  /** Construit un lien WhatsApp avec message pré-rempli */
  generateWhatsAppLink(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  /** Message WhatsApp professionnel destiné à l'agence */
  formatAgencyWhatsAppMessage(booking: Booking, appUrl?: string): string {
    const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://clickdrive.ma';
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
      (booking.flight_number
        ? `✈️ *Vol d'arrivée :* ${booking.flight_number} (${booking.flight_arrival_time || '—'})\n`
        : '') +
      `\n💰 *Montant total :* ${booking.total_price} DH\n` +
      `🔒 *Caution :* ${booking.deposit_amount || 3000} DH\n\n` +
      `📄 *Fiche PDF :*\n${pdfUrl}\n\n` +
      `💻 *Dashboard Agence :*\n${dashboardUrl}`
    );
  }

  /** Message WhatsApp destiné au client */
  formatCustomerWhatsAppMessage(booking: Booking): string {
    const vehicleName = booking.vehicle
      ? `${booking.vehicle.brand} ${booking.vehicle.model}`
      : 'Véhicule';
    const ref = booking.reference || booking.booking_ref || '';

    return (
      `✅ *Demande ClickDrive enregistrée*\n\n` +
      `Bonjour ${booking.customer_name},\n` +
      `Votre demande pour la *${vehicleName}* a bien été transmise à l'agence ${booking.agency?.name || ''}.\n\n` +
      `*Référence :* ${ref}\n` +
      `*Période :* du ${booking.start_date} au ${booking.end_date}\n` +
      `*Total estimé :* ${booking.total_price} DH\n\n` +
      `Suivez votre demande : https://clickdrive.ma/account/bookings/${encodeURIComponent(ref)}`
    );
  }

  /**
   * Persiste une notification dans la table `notifications` Supabase.
   * Silencieux si Supabase est indisponible.
   */
  async sendDashboardNotification(
    payload: DashboardNotificationPayload
  ): Promise<boolean> {
    try {
      const supabase = await createClient();
      if (supabase && payload.userId) {
        await supabase.from('notifications').insert({
          user_id: payload.userId,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          type: payload.type || 'BOOKING',
        });
        return true;
      }
    } catch (err) {
      console.warn('[NotificationService] Could not persist dashboard notification:', err);
    }

    console.log('[NotificationService] 🔔', payload.title, '—', payload.message);
    return true;
  }
}

export const notificationService = new NotificationService();
