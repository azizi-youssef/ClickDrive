import { normalizeBookingStatus, type BookingStatus } from '@clickdrive/shared';
import type { Locale } from '@/lib/i18n/config';
import type { BadgeTone } from '@/components/ui/Badge';

/**
 * Présentation des statuts de réservation — source unique pour l'espace client, l'agence et l'admin.
 * Couvre tous les statuts de la machine à états (@clickdrive/shared), y compris les statuts historiques.
 * Aucun statut n'est inventé : les étapes du suivi correspondent à des statuts réels.
 */

type Labels = Record<Locale, string>;

interface StatusPresentation {
  /** Libellé pour le client, dans sa langue */
  customer: Labels;
  /** Libellé court pour l'agence et l'administration (français) */
  business: string;
  tone: BadgeTone;
  /** Statut final : la demande ne progressera plus */
  final?: boolean;
}

const PRESENTATION: Record<BookingStatus, StatusPresentation> = {
  REQUESTED: {
    customer: { fr: 'Demande envoyée', en: 'Request sent', ar: 'تم إرسال الطلب', es: 'Solicitud enviada', de: 'Anfrage gesendet', nl: 'Aanvraag verzonden' },
    business: 'Nouvelle demande',
    tone: 'warning',
  },
  UNDER_REVIEW: {
    customer: { fr: 'Vérification par ClickDrive', en: 'Being checked by ClickDrive', ar: 'قيد التحقق من ClickDrive', es: 'En revisión por ClickDrive', de: 'Prüfung durch ClickDrive', nl: 'Controle door ClickDrive' },
    business: 'Vérification ClickDrive',
    tone: 'warning',
  },
  SENT_TO_AGENCY: {
    customer: { fr: 'Transmise à l’agence', en: 'Sent to the agency', ar: 'أُرسل إلى الوكالة', es: 'Enviada a la agencia', de: 'An die Agentur übermittelt', nl: 'Doorgestuurd naar het verhuurbedrijf' },
    business: 'À traiter',
    tone: 'warning',
  },
  AGENCY_REVIEW: {
    customer: { fr: 'Examen par l’agence', en: 'Under agency review', ar: 'قيد المراجعة لدى الوكالة', es: 'En revisión por la agencia', de: 'Prüfung durch die Agentur', nl: 'In behandeling bij het verhuurbedrijf' },
    business: 'En examen',
    tone: 'warning',
  },
  ALTERNATIVE_PROPOSED: {
    customer: { fr: 'Alternative proposée', en: 'Alternative offered', ar: 'تم اقتراح بديل', es: 'Alternativa propuesta', de: 'Alternative vorgeschlagen', nl: 'Alternatief voorgesteld' },
    business: 'Alternative proposée',
    tone: 'info',
  },
  APPROVED: {
    customer: { fr: 'Réservation confirmée', en: 'Booking confirmed', ar: 'تم تأكيد الحجز', es: 'Reserva confirmada', de: 'Buchung bestätigt', nl: 'Reservering bevestigd' },
    business: 'Confirmée',
    tone: 'success',
  },
  READY_FOR_PICKUP: {
    customer: { fr: 'Véhicule prêt', en: 'Vehicle ready', ar: 'السيارة جاهزة', es: 'Vehículo listo', de: 'Fahrzeug bereit', nl: 'Voertuig klaar' },
    business: 'Prête à remettre',
    tone: 'success',
  },
  ACTIVE: {
    customer: { fr: 'Location en cours', en: 'Rental in progress', ar: 'الكراء جارٍ', es: 'Alquiler en curso', de: 'Miete läuft', nl: 'Huur loopt' },
    business: 'En cours',
    tone: 'info',
  },
  COMPLETED: {
    customer: { fr: 'Terminée', en: 'Completed', ar: 'منتهية', es: 'Finalizada', de: 'Abgeschlossen', nl: 'Afgerond' },
    business: 'Terminée',
    tone: 'neutral',
    final: true,
  },
  REJECTED: {
    customer: { fr: 'Refusée par l’agence', en: 'Declined by the agency', ar: 'رفضتها الوكالة', es: 'Rechazada por la agencia', de: 'Von der Agentur abgelehnt', nl: 'Afgewezen door het verhuurbedrijf' },
    business: 'Refusée',
    tone: 'danger',
    final: true,
  },
  CANCELLED: {
    customer: { fr: 'Annulée', en: 'Cancelled', ar: 'ملغاة', es: 'Cancelada', de: 'Storniert', nl: 'Geannuleerd' },
    business: 'Annulée',
    tone: 'neutral',
    final: true,
  },
  EXPIRED: {
    customer: { fr: 'Expirée sans réponse', en: 'Expired without a response', ar: 'انتهت دون رد', es: 'Caducada sin respuesta', de: 'Ohne Antwort abgelaufen', nl: 'Verlopen zonder antwoord' },
    business: 'Expirée',
    tone: 'neutral',
    final: true,
  },
  NO_SHOW: {
    customer: { fr: 'Absence au rendez-vous', en: 'No-show', ar: 'عدم الحضور', es: 'No presentado', de: 'Nicht erschienen', nl: 'Niet verschenen' },
    business: 'Non présenté',
    tone: 'danger',
    final: true,
  },
  // Statuts historiques : même présentation que leur équivalent canonique
  PENDING: {
    customer: { fr: 'Demande envoyée', en: 'Request sent', ar: 'تم إرسال الطلب', es: 'Solicitud enviada', de: 'Anfrage gesendet', nl: 'Aanvraag verzonden' },
    business: 'Nouvelle demande',
    tone: 'warning',
  },
  CONFIRMED: {
    customer: { fr: 'Réservation confirmée', en: 'Booking confirmed', ar: 'تم تأكيد الحجز', es: 'Reserva confirmada', de: 'Buchung bestätigt', nl: 'Reservering bevestigd' },
    business: 'Confirmée',
    tone: 'success',
  },
};

function presentation(status: string): StatusPresentation | null {
  return (PRESENTATION as Record<string, StatusPresentation | undefined>)[status] ?? null;
}

export function bookingStatusLabel(status: string, locale: Locale = 'fr', audience: 'customer' | 'business' = 'customer') {
  const entry = presentation(status);
  if (!entry) return status;
  return audience === 'business' ? entry.business : entry.customer[locale] ?? entry.customer.fr;
}

export function bookingStatusTone(status: string): BadgeTone {
  return presentation(status)?.tone ?? 'neutral';
}

export function isFinalBookingStatus(status: string): boolean {
  return presentation(status)?.final ?? false;
}

/* ── Suivi client ───────────────────────────────────────────────────── */

export type TimelineStepKey = 'submitted' | 'sent' | 'review' | 'confirmed' | 'pickup' | 'completed';

const STEP_LABELS: Record<TimelineStepKey, Labels> = {
  submitted: { fr: 'Demande envoyée', en: 'Request sent', ar: 'إرسال الطلب', es: 'Solicitud enviada', de: 'Anfrage gesendet', nl: 'Aanvraag verzonden' },
  sent: { fr: 'Transmise à l’agence', en: 'Sent to the agency', ar: 'إرسال إلى الوكالة', es: 'Enviada a la agencia', de: 'An die Agentur übermittelt', nl: 'Naar verhuurbedrijf' },
  review: { fr: 'Examen par l’agence', en: 'Under agency review', ar: 'مراجعة الوكالة', es: 'Revisión de la agencia', de: 'Prüfung durch die Agentur', nl: 'Beoordeling verhuurbedrijf' },
  confirmed: { fr: 'Confirmée par l’agence', en: 'Confirmed by the agency', ar: 'تأكيد الوكالة', es: 'Confirmada por la agencia', de: 'Von der Agentur bestätigt', nl: 'Bevestigd door verhuurbedrijf' },
  pickup: { fr: 'Remise du véhicule', en: 'Vehicle handover', ar: 'تسليم السيارة', es: 'Entrega del vehículo', de: 'Fahrzeugübergabe', nl: 'Overdracht voertuig' },
  completed: { fr: 'Location terminée', en: 'Rental completed', ar: 'انتهاء الكراء', es: 'Alquiler finalizado', de: 'Miete abgeschlossen', nl: 'Huur afgerond' },
};

export const TIMELINE_STEPS: readonly TimelineStepKey[] = ['submitted', 'sent', 'review', 'confirmed', 'pickup', 'completed'];

/** Étape atteinte par chaque statut (index dans TIMELINE_STEPS). */
const STEP_REACHED: Record<BookingStatus, number> = {
  REQUESTED: 0,
  PENDING: 0,
  UNDER_REVIEW: 0,
  SENT_TO_AGENCY: 1,
  AGENCY_REVIEW: 2,
  ALTERNATIVE_PROPOSED: 2,
  REJECTED: 2,
  EXPIRED: 2,
  APPROVED: 3,
  CONFIRMED: 3,
  READY_FOR_PICKUP: 4,
  ACTIVE: 4,
  NO_SHOW: 4,
  COMPLETED: 5,
  CANCELLED: 0,
};

export type TimelineState = 'done' | 'current' | 'upcoming' | 'stopped';

/**
 * Suivi : chaque étape est « faite », « en cours », « à venir » ou « interrompue »
 * (refus, expiration, annulation, absence). Les étapes après une interruption restent à venir.
 */
export function bookingTimeline(status: string, locale: Locale = 'fr') {
  const canonical = normalizeBookingStatus(status);
  const reached = (STEP_REACHED as Record<string, number | undefined>)[canonical] ?? 0;
  const final = isFinalBookingStatus(canonical);
  const stopped = final && canonical !== 'COMPLETED';

  return TIMELINE_STEPS.map((key, index) => {
    let state: TimelineState;
    if (index < reached) state = 'done';
    else if (index === reached) state = canonical === 'COMPLETED' ? 'done' : stopped ? 'stopped' : 'current';
    else state = 'upcoming';
    return { key, label: STEP_LABELS[key][locale] ?? STEP_LABELS[key].fr, state };
  });
}

/** Ce qui se passe ensuite, en une phrase, pour le client (français, comme l'espace client). */
const NEXT_STEP_HINT: Record<BookingStatus, string> = {
  REQUESTED: 'Votre demande est enregistrée. Elle va être transmise à l’agence, qui vérifiera la disponibilité.',
  PENDING: 'Votre demande est enregistrée. Elle va être transmise à l’agence, qui vérifiera la disponibilité.',
  UNDER_REVIEW: 'ClickDrive vérifie votre demande avant de la transmettre à l’agence.',
  SENT_TO_AGENCY: 'L’agence a reçu votre demande et va vérifier la disponibilité du véhicule.',
  AGENCY_REVIEW: 'L’agence examine votre demande. Sa réponse s’affichera ici.',
  ALTERNATIVE_PROPOSED: 'L’agence vous propose une alternative. Contactez-la pour l’accepter ou la refuser.',
  APPROVED: 'L’agence a confirmé votre réservation. Contrat, caution et paiement se règlent sur place, à la remise des clés.',
  CONFIRMED: 'L’agence a confirmé votre réservation. Contrat, caution et paiement se règlent sur place, à la remise des clés.',
  READY_FOR_PICKUP: 'Le véhicule est prêt. Présentez-vous au point de rendez-vous à l’heure prévue.',
  ACTIVE: 'Votre location est en cours. Bonne route !',
  COMPLETED: 'Le véhicule a été restitué. Merci d’avoir loué avec ClickDrive.',
  REJECTED: 'L’agence n’a pas pu accepter cette demande. Vous pouvez rechercher un autre véhicule aux mêmes dates.',
  EXPIRED: 'Cette demande a expiré sans réponse de l’agence. Vous pouvez en envoyer une nouvelle.',
  CANCELLED: 'Cette réservation a été annulée.',
  NO_SHOW: 'Le véhicule n’a pas été retiré au rendez-vous prévu.',
};

export function bookingNextStepHint(status: string): string {
  return (NEXT_STEP_HINT as Record<string, string | undefined>)[status] ?? '';
}
