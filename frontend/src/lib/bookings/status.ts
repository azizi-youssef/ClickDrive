import { normalizeBookingStatus, type BookingStatus } from '@clickdrive/shared/booking-status';
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

/** Ce qui se passe ensuite, en une phrase, pour le client (suivi, espace client, e-mails). */
const NEXT_STEP_HINT: Record<BookingStatus, Labels> = {
  REQUESTED: {
    fr: 'Votre demande est enregistrée. Elle va être transmise à l’agence, qui vérifiera la disponibilité.',
    en: 'Your request has been recorded. It will be passed to the agency, which will check availability.',
    es: 'Tu solicitud está registrada. Se enviará a la agencia, que comprobará la disponibilidad.',
    de: 'Ihre Anfrage ist gespeichert. Sie wird an den Vermieter weitergeleitet, der die Verfügbarkeit prüft.',
    nl: 'Je aanvraag is geregistreerd. Hij wordt doorgestuurd naar de verhuurder, die de beschikbaarheid controleert.',
    ar: 'تم تسجيل طلبك. سيُحال إلى الوكالة التي ستتحقق من التوفر.',
  },
  PENDING: {
    fr: 'Votre demande est enregistrée. Elle va être transmise à l’agence, qui vérifiera la disponibilité.',
    en: 'Your request has been recorded. It will be passed to the agency, which will check availability.',
    es: 'Tu solicitud está registrada. Se enviará a la agencia, que comprobará la disponibilidad.',
    de: 'Ihre Anfrage ist gespeichert. Sie wird an den Vermieter weitergeleitet, der die Verfügbarkeit prüft.',
    nl: 'Je aanvraag is geregistreerd. Hij wordt doorgestuurd naar de verhuurder, die de beschikbaarheid controleert.',
    ar: 'تم تسجيل طلبك. سيُحال إلى الوكالة التي ستتحقق من التوفر.',
  },
  UNDER_REVIEW: {
    fr: 'ClickDrive vérifie votre demande avant de la transmettre à l’agence.',
    en: 'ClickDrive is checking your request before passing it to the agency.',
    es: 'ClickDrive revisa tu solicitud antes de enviarla a la agencia.',
    de: 'ClickDrive prüft Ihre Anfrage, bevor sie an den Vermieter geht.',
    nl: 'ClickDrive controleert je aanvraag voordat hij naar de verhuurder gaat.',
    ar: 'يتحقق ClickDrive من طلبك قبل إحالته إلى الوكالة.',
  },
  SENT_TO_AGENCY: {
    fr: 'L’agence a reçu votre demande et va vérifier la disponibilité du véhicule.',
    en: 'The agency has received your request and will check the vehicle’s availability.',
    es: 'La agencia ha recibido tu solicitud y comprobará la disponibilidad del vehículo.',
    de: 'Der Vermieter hat Ihre Anfrage erhalten und prüft die Verfügbarkeit des Fahrzeugs.',
    nl: 'De verhuurder heeft je aanvraag ontvangen en controleert de beschikbaarheid van het voertuig.',
    ar: 'توصلت الوكالة بطلبك وستتحقق من توفر المركبة.',
  },
  AGENCY_REVIEW: {
    fr: 'L’agence examine votre demande. Sa réponse s’affichera ici.',
    en: 'The agency is reviewing your request. Its answer will appear here.',
    es: 'La agencia está revisando tu solicitud. Su respuesta aparecerá aquí.',
    de: 'Der Vermieter prüft Ihre Anfrage. Seine Antwort erscheint hier.',
    nl: 'De verhuurder bekijkt je aanvraag. Het antwoord verschijnt hier.',
    ar: 'تدرس الوكالة طلبك. سيظهر ردها هنا.',
  },
  ALTERNATIVE_PROPOSED: {
    fr: 'L’agence vous propose une alternative. Contactez-la pour l’accepter ou la refuser.',
    en: 'The agency is offering an alternative. Contact it to accept or decline it.',
    es: 'La agencia te propone una alternativa. Contacta con ella para aceptarla o rechazarla.',
    de: 'Der Vermieter schlägt Ihnen eine Alternative vor. Kontaktieren Sie ihn, um sie anzunehmen oder abzulehnen.',
    nl: 'De verhuurder stelt een alternatief voor. Neem contact op om het te accepteren of te weigeren.',
    ar: 'تقترح عليك الوكالة بديلاً. تواصل معها لقبوله أو رفضه.',
  },
  APPROVED: {
    fr: 'L’agence a confirmé votre réservation. Contrat, caution et paiement se règlent sur place, à la remise des clés.',
    en: 'The agency has confirmed your booking. Contract, deposit and payment are settled on site at the key handover.',
    es: 'La agencia ha confirmado tu reserva. Contrato, fianza y pago se gestionan allí, al entregar las llaves.',
    de: 'Der Vermieter hat Ihre Buchung bestätigt. Vertrag, Kaution und Zahlung werden vor Ort bei der Schlüsselübergabe erledigt.',
    nl: 'De verhuurder heeft je reservering bevestigd. Contract, borg en betaling regel je ter plaatse bij de sleuteloverdracht.',
    ar: 'أكدت الوكالة حجزك. يتم العقد والضمان والدفع في عين المكان عند تسليم المفاتيح.',
  },
  CONFIRMED: {
    fr: 'L’agence a confirmé votre réservation. Contrat, caution et paiement se règlent sur place, à la remise des clés.',
    en: 'The agency has confirmed your booking. Contract, deposit and payment are settled on site at the key handover.',
    es: 'La agencia ha confirmado tu reserva. Contrato, fianza y pago se gestionan allí, al entregar las llaves.',
    de: 'Der Vermieter hat Ihre Buchung bestätigt. Vertrag, Kaution und Zahlung werden vor Ort bei der Schlüsselübergabe erledigt.',
    nl: 'De verhuurder heeft je reservering bevestigd. Contract, borg en betaling regel je ter plaatse bij de sleuteloverdracht.',
    ar: 'أكدت الوكالة حجزك. يتم العقد والضمان والدفع في عين المكان عند تسليم المفاتيح.',
  },
  READY_FOR_PICKUP: {
    fr: 'Le véhicule est prêt. Présentez-vous au point de rendez-vous à l’heure prévue.',
    en: 'The vehicle is ready. Go to the meeting point at the agreed time.',
    es: 'El vehículo está listo. Acude al punto de encuentro a la hora prevista.',
    de: 'Das Fahrzeug ist bereit. Kommen Sie zur vereinbarten Zeit zum Treffpunkt.',
    nl: 'Het voertuig staat klaar. Ga op het afgesproken tijdstip naar het ontmoetingspunt.',
    ar: 'المركبة جاهزة. توجه إلى نقطة اللقاء في الموعد المحدد.',
  },
  ACTIVE: {
    fr: 'Votre location est en cours. Bonne route !',
    en: 'Your rental is under way. Have a good trip!',
    es: 'Tu alquiler está en curso. ¡Buen viaje!',
    de: 'Ihre Miete läuft. Gute Fahrt!',
    nl: 'Je huur loopt. Goede reis!',
    ar: 'كراؤك جارٍ. طريق السلامة!',
  },
  COMPLETED: {
    fr: 'Le véhicule a été restitué. Merci d’avoir loué avec ClickDrive.',
    en: 'The vehicle has been returned. Thank you for renting with ClickDrive.',
    es: 'El vehículo ha sido devuelto. Gracias por alquilar con ClickDrive.',
    de: 'Das Fahrzeug wurde zurückgegeben. Danke, dass Sie mit ClickDrive gemietet haben.',
    nl: 'Het voertuig is ingeleverd. Bedankt dat je via ClickDrive hebt gehuurd.',
    ar: 'تم إرجاع المركبة. شكراً لكرائك عبر ClickDrive.',
  },
  REJECTED: {
    fr: 'L’agence n’a pas pu accepter cette demande. Vous pouvez rechercher un autre véhicule aux mêmes dates.',
    en: 'The agency could not accept this request. You can look for another vehicle on the same dates.',
    es: 'La agencia no ha podido aceptar esta solicitud. Puedes buscar otro vehículo en las mismas fechas.',
    de: 'Der Vermieter konnte diese Anfrage nicht annehmen. Sie können ein anderes Fahrzeug zu denselben Daten suchen.',
    nl: 'De verhuurder kon deze aanvraag niet accepteren. Je kunt een ander voertuig op dezelfde data zoeken.',
    ar: 'لم تتمكن الوكالة من قبول هذا الطلب. يمكنك البحث عن مركبة أخرى في نفس التواريخ.',
  },
  EXPIRED: {
    fr: 'Cette demande a expiré sans réponse de l’agence. Vous pouvez en envoyer une nouvelle.',
    en: 'This request expired without an answer from the agency. You can send a new one.',
    es: 'Esta solicitud caducó sin respuesta de la agencia. Puedes enviar una nueva.',
    de: 'Diese Anfrage ist ohne Antwort des Vermieters abgelaufen. Sie können eine neue senden.',
    nl: 'Deze aanvraag is verlopen zonder antwoord van de verhuurder. Je kunt een nieuwe sturen.',
    ar: 'انتهت صلاحية هذا الطلب دون رد من الوكالة. يمكنك إرسال طلب جديد.',
  },
  CANCELLED: {
    fr: 'Cette réservation a été annulée.',
    en: 'This booking has been cancelled.',
    es: 'Esta reserva ha sido cancelada.',
    de: 'Diese Buchung wurde storniert.',
    nl: 'Deze reservering is geannuleerd.',
    ar: 'تم إلغاء هذا الحجز.',
  },
  NO_SHOW: {
    fr: 'Le véhicule n’a pas été retiré au rendez-vous prévu.',
    en: 'The vehicle was not collected at the agreed appointment.',
    es: 'El vehículo no se recogió en la cita prevista.',
    de: 'Das Fahrzeug wurde zum vereinbarten Termin nicht abgeholt.',
    nl: 'Het voertuig is op de afgesproken afspraak niet opgehaald.',
    ar: 'لم يتم استلام المركبة في الموعد المحدد.',
  },
};

export function bookingNextStepHint(status: string, locale: Locale = 'fr'): string {
  const labels = (NEXT_STEP_HINT as Record<string, Labels | undefined>)[status];
  return labels ? labels[locale] ?? labels.fr : '';
}

/** Textes de la barre de suivi (titre et état de chaque étape) */
export const PROGRESS_TEXT: Record<'heading' | 'done' | 'current' | 'upcoming', Labels> = {
  heading: { fr: 'Suivi de votre demande', en: 'Request progress', es: 'Seguimiento de tu solicitud', de: 'Status Ihrer Anfrage', nl: 'Status van je aanvraag', ar: 'تتبع طلبك' },
  done: { fr: 'Fait', en: 'Done', es: 'Hecho', de: 'Erledigt', nl: 'Klaar', ar: 'تم' },
  current: { fr: 'En cours', en: 'In progress', es: 'En curso', de: 'Läuft', nl: 'Bezig', ar: 'جارٍ' },
  upcoming: { fr: 'À venir', en: 'Upcoming', es: 'Pendiente', de: 'Ausstehend', nl: 'Nog niet', ar: 'قادم' },
};
