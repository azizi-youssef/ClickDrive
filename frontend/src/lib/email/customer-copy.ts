import type { Locale } from '@/lib/i18n/config';
import type { PluralForms } from '@/lib/i18n/format';

/**
 * Textes des e-mails envoyés aux clients, dans la langue de leur demande (bookings.customer_locale)
 * ou du formulaire de contact. Les e-mails destinés aux agences et à l'équipe restent en français.
 * Variables : {name}, {agency}, {vehicle}, {reference}, {count}.
 */
export type CustomerEmailCopy = {
  htmlLang: string;
  footer: string;
  hello: string;
  labels: {
    reference: string;
    vehicle: string;
    agency: string;
    from: string;
    to: string;
    duration: string;
    pickup: string;
    ferry: string;
    total: string;
    category: string;
    subject: string;
  };
  days: PluralForms;
  perDay: string;
  received: {
    subject: string;
    title: string;
    intro: string;
    notConfirmed: string;
    pending: string;
    pdf: string;
    track: string;
    keepReference: string;
    pdfText: string;
    trackText: string;
  };
  status: {
    subject: string;
    labels: { APPROVED: string; CONFIRMED: string; REJECTED: string; ALTERNATIVE_PROPOSED: string };
    reason: string;
    pdf: string;
    track: string;
    pdfText: string;
  };
  alternatives: {
    subject: string;
    title: string;
    intro: string;
    seeAll: string;
    track: string;
    allText: string;
    trackText: string;
  };
  review: {
    subject: string;
    title: string;
    intro: string;
    button: string;
    notice: string;
    text: string;
  };
  contact: {
    subject: string;
    title: string;
    intro: string;
    yourMessage: string;
    categories: Record<string, string>;
  };
  fallbackVehicle: string;
  fallbackAgency: string;
};

const fr: CustomerEmailCopy = {
  htmlLang: 'fr',
  footer:
    'ClickDrive met en relation clients et agences de location partenaires à Nador. Une question ? Répondez à cet e-mail ou écrivez-nous sur WhatsApp au +{whatsapp}.',
  hello: 'Bonjour {name},',
  labels: {
    reference: 'Référence',
    vehicle: 'Véhicule',
    agency: 'Agence',
    from: 'Du',
    to: 'Au',
    duration: 'Durée',
    pickup: 'Lieu de prise en charge',
    ferry: 'Arrivée en ferry',
    total: 'Total estimé',
    category: 'Catégorie',
    subject: 'Objet',
  },
  days: { one: '{count} jour', other: '{count} jours' },
  perDay: 'jour',
  received: {
    subject: 'Demande {reference} reçue — {vehicle}',
    title: 'Demande reçue',
    intro: 'Votre demande de réservation est enregistrée.',
    notConfirmed: 'Ce n’est pas encore une réservation confirmée',
    pending: 'l’agence {agency} vérifie la disponibilité et vous répond.',
    pdf: 'Télécharger mon bon de demande',
    track: 'Suivre ma demande',
    keepReference: 'Gardez votre référence : elle vous sera demandée par l’agence.',
    pdfText: 'Bon de demande',
    trackText: 'Suivre ma demande',
  },
  status: {
    subject: 'Réservation {reference} : {label}',
    labels: {
      APPROVED: 'confirmée',
      CONFIRMED: 'confirmée',
      REJECTED: 'non acceptée',
      ALTERNATIVE_PROPOSED: 'une alternative vous est proposée',
    },
    reason: 'Motif indiqué par l’agence : {reason}',
    pdf: 'Télécharger mon bon de réservation',
    track: 'Voir le suivi de ma demande',
    pdfText: 'Bon de réservation',
  },
  alternatives: {
    subject: 'Votre demande {reference} : d’autres véhicules sont libres aux mêmes dates',
    title: 'Votre demande est toujours en attente',
    intro:
      'L’agence {agency} n’a pas encore répondu à votre demande pour {vehicle}. Votre demande reste valable ; si vous préférez ne pas attendre, ces véhicules sont libres aux mêmes dates :',
    seeAll: 'Voir tous les véhicules disponibles',
    track: 'Suivre ma demande',
    allText: 'Tous les véhicules disponibles',
    trackText: 'Suivre ma demande',
  },
  review: {
    subject: 'Votre avis sur la location {reference}',
    title: 'Votre avis compte',
    intro:
      'Merci d’avoir loué {vehicle} auprès de {agency}. En une minute, votre avis aide les prochains voyageurs à choisir et l’agence à s’améliorer.',
    button: 'Donner mon avis',
    notice: 'Seuls les clients ayant terminé une location peuvent publier un avis : il apparaîtra comme avis vérifié.',
    text: 'Merci d’avoir loué {vehicle} auprès de {agency}. Votre avis aide les prochains voyageurs : {url}',
  },
  contact: {
    subject: 'Nous avons bien reçu votre message ({reference})',
    title: 'Message reçu',
    intro: 'Votre message a bien été reçu par l’équipe ClickDrive. Nous vous répondons sous 24 h ouvrées.',
    yourMessage: 'Votre message :',
    categories: {
      reservation: 'Information sur un véhicule ou une réservation',
      'agency-partner': 'Inscription ou partenariat agence',
      vehicle: 'Question sur un véhicule',
      technical: 'Problème technique',
      billing: 'Facturation ou abonnement',
      other: 'Autre demande',
    },
  },
  fallbackVehicle: 'Véhicule',
  fallbackAgency: 'l’agence partenaire',
};

export const CUSTOMER_EMAIL_COPY: Record<Locale, CustomerEmailCopy> = {
  fr,
  en: {
    htmlLang: 'en',
    footer:
      'ClickDrive connects customers with partner rental agencies in Nador. A question? Reply to this email or message us on WhatsApp at +{whatsapp}.',
    hello: 'Hello {name},',
    labels: {
      reference: 'Reference',
      vehicle: 'Vehicle',
      agency: 'Agency',
      from: 'From',
      to: 'To',
      duration: 'Duration',
      pickup: 'Pick-up location',
      ferry: 'Ferry arrival',
      total: 'Estimated total',
      category: 'Category',
      subject: 'Subject',
    },
    days: { one: '{count} day', other: '{count} days' },
    perDay: 'day',
    received: {
      subject: 'Request {reference} received — {vehicle}',
      title: 'Request received',
      intro: 'Your booking request has been recorded.',
      notConfirmed: 'This is not a confirmed booking yet',
      pending: 'the agency {agency} is checking availability and will reply to you.',
      pdf: 'Download my request voucher',
      track: 'Track my request',
      keepReference: 'Keep your reference: the agency will ask you for it.',
      pdfText: 'Request voucher',
      trackText: 'Track my request',
    },
    status: {
      subject: 'Booking {reference}: {label}',
      labels: {
        APPROVED: 'confirmed',
        CONFIRMED: 'confirmed',
        REJECTED: 'not accepted',
        ALTERNATIVE_PROPOSED: 'an alternative is offered',
      },
      reason: 'Reason given by the agency: {reason}',
      pdf: 'Download my booking voucher',
      track: 'See the status of my request',
      pdfText: 'Booking voucher',
    },
    alternatives: {
      subject: 'Your request {reference}: other vehicles are free on the same dates',
      title: 'Your request is still pending',
      intro:
        'The agency {agency} has not yet replied to your request for {vehicle}. Your request remains valid; if you would rather not wait, these vehicles are free on the same dates:',
      seeAll: 'See all available vehicles',
      track: 'Track my request',
      allText: 'All available vehicles',
      trackText: 'Track my request',
    },
    review: {
      subject: 'Your review of rental {reference}',
      title: 'Your opinion matters',
      intro:
        'Thank you for renting {vehicle} from {agency}. In one minute, your review helps future travellers choose and helps the agency improve.',
      button: 'Leave my review',
      notice: 'Only customers who have completed a rental can publish a review: it will appear as a verified review.',
      text: 'Thank you for renting {vehicle} from {agency}. Your review helps future travellers: {url}',
    },
    contact: {
      subject: 'We have received your message ({reference})',
      title: 'Message received',
      intro: 'The ClickDrive team has received your message. We reply within 24 working hours.',
      yourMessage: 'Your message:',
      categories: {
        reservation: 'Information about a vehicle or a booking',
        'agency-partner': 'Agency sign-up or partnership',
        vehicle: 'Question about a vehicle',
        technical: 'Technical problem',
        billing: 'Billing or subscription',
        other: 'Other request',
      },
    },
    fallbackVehicle: 'Vehicle',
    fallbackAgency: 'the partner agency',
  },
  es: {
    htmlLang: 'es',
    footer:
      'ClickDrive pone en contacto a clientes y agencias de alquiler asociadas en Nador. ¿Alguna pregunta? Responde a este correo o escríbenos por WhatsApp al +{whatsapp}.',
    hello: 'Hola, {name}:',
    labels: {
      reference: 'Referencia',
      vehicle: 'Vehículo',
      agency: 'Agencia',
      from: 'Del',
      to: 'Al',
      duration: 'Duración',
      pickup: 'Lugar de recogida',
      ferry: 'Llegada en ferry',
      total: 'Total estimado',
      category: 'Categoría',
      subject: 'Asunto',
    },
    days: { one: '{count} día', other: '{count} días' },
    perDay: 'día',
    received: {
      subject: 'Solicitud {reference} recibida — {vehicle}',
      title: 'Solicitud recibida',
      intro: 'Tu solicitud de reserva está registrada.',
      notConfirmed: 'Todavía no es una reserva confirmada',
      pending: 'la agencia {agency} comprueba la disponibilidad y te responde.',
      pdf: 'Descargar mi bono de solicitud',
      track: 'Seguir mi solicitud',
      keepReference: 'Guarda tu referencia: la agencia te la pedirá.',
      pdfText: 'Bono de solicitud',
      trackText: 'Seguir mi solicitud',
    },
    status: {
      subject: 'Reserva {reference}: {label}',
      labels: {
        APPROVED: 'confirmada',
        CONFIRMED: 'confirmada',
        REJECTED: 'no aceptada',
        ALTERNATIVE_PROPOSED: 'te proponen una alternativa',
      },
      reason: 'Motivo indicado por la agencia: {reason}',
      pdf: 'Descargar mi bono de reserva',
      track: 'Ver el seguimiento de mi solicitud',
      pdfText: 'Bono de reserva',
    },
    alternatives: {
      subject: 'Tu solicitud {reference}: hay otros vehículos libres en las mismas fechas',
      title: 'Tu solicitud sigue pendiente',
      intro:
        'La agencia {agency} todavía no ha respondido a tu solicitud para {vehicle}. Tu solicitud sigue siendo válida; si prefieres no esperar, estos vehículos están libres en las mismas fechas:',
      seeAll: 'Ver todos los vehículos disponibles',
      track: 'Seguir mi solicitud',
      allText: 'Todos los vehículos disponibles',
      trackText: 'Seguir mi solicitud',
    },
    review: {
      subject: 'Tu opinión sobre el alquiler {reference}',
      title: 'Tu opinión cuenta',
      intro:
        'Gracias por alquilar {vehicle} con {agency}. En un minuto, tu opinión ayuda a los próximos viajeros a elegir y a la agencia a mejorar.',
      button: 'Dar mi opinión',
      notice: 'Solo los clientes que han terminado un alquiler pueden publicar una opinión: aparecerá como opinión verificada.',
      text: 'Gracias por alquilar {vehicle} con {agency}. Tu opinión ayuda a los próximos viajeros: {url}',
    },
    contact: {
      subject: 'Hemos recibido tu mensaje ({reference})',
      title: 'Mensaje recibido',
      intro: 'El equipo de ClickDrive ha recibido tu mensaje. Te respondemos en un plazo de 24 horas laborables.',
      yourMessage: 'Tu mensaje:',
      categories: {
        reservation: 'Información sobre un vehículo o una reserva',
        'agency-partner': 'Registro o colaboración de agencia',
        vehicle: 'Pregunta sobre un vehículo',
        technical: 'Problema técnico',
        billing: 'Facturación o suscripción',
        other: 'Otra solicitud',
      },
    },
    fallbackVehicle: 'Vehículo',
    fallbackAgency: 'la agencia asociada',
  },
  de: {
    htmlLang: 'de',
    footer:
      'ClickDrive bringt Kunden und Partner-Autovermieter in Nador zusammen. Eine Frage? Antworten Sie auf diese E-Mail oder schreiben Sie uns per WhatsApp an +{whatsapp}.',
    hello: 'Guten Tag {name},',
    labels: {
      reference: 'Referenz',
      vehicle: 'Fahrzeug',
      agency: 'Vermieter',
      from: 'Vom',
      to: 'Bis',
      duration: 'Dauer',
      pickup: 'Abholort',
      ferry: 'Ankunft mit der Fähre',
      total: 'Geschätzter Gesamtpreis',
      category: 'Kategorie',
      subject: 'Betreff',
    },
    days: { one: '{count} Tag', other: '{count} Tage' },
    perDay: 'Tag',
    received: {
      subject: 'Anfrage {reference} erhalten — {vehicle}',
      title: 'Anfrage erhalten',
      intro: 'Ihre Buchungsanfrage wurde registriert.',
      notConfirmed: 'Dies ist noch keine bestätigte Buchung',
      pending: 'der Vermieter {agency} prüft die Verfügbarkeit und antwortet Ihnen.',
      pdf: 'Meinen Anfragebeleg herunterladen',
      track: 'Meine Anfrage verfolgen',
      keepReference: 'Bewahren Sie Ihre Referenz auf: Der Vermieter wird Sie danach fragen.',
      pdfText: 'Anfragebeleg',
      trackText: 'Meine Anfrage verfolgen',
    },
    status: {
      subject: 'Buchung {reference}: {label}',
      labels: {
        APPROVED: 'bestätigt',
        CONFIRMED: 'bestätigt',
        REJECTED: 'nicht angenommen',
        ALTERNATIVE_PROPOSED: 'Ihnen wird eine Alternative angeboten',
      },
      reason: 'Vom Vermieter angegebener Grund: {reason}',
      pdf: 'Meinen Buchungsbeleg herunterladen',
      track: 'Status meiner Anfrage ansehen',
      pdfText: 'Buchungsbeleg',
    },
    alternatives: {
      subject: 'Ihre Anfrage {reference}: Andere Fahrzeuge sind zu denselben Daten frei',
      title: 'Ihre Anfrage ist noch offen',
      intro:
        'Der Vermieter {agency} hat auf Ihre Anfrage für {vehicle} noch nicht geantwortet. Ihre Anfrage bleibt gültig; wenn Sie nicht warten möchten, sind diese Fahrzeuge zu denselben Daten frei:',
      seeAll: 'Alle verfügbaren Fahrzeuge ansehen',
      track: 'Meine Anfrage verfolgen',
      allText: 'Alle verfügbaren Fahrzeuge',
      trackText: 'Meine Anfrage verfolgen',
    },
    review: {
      subject: 'Ihre Bewertung der Miete {reference}',
      title: 'Ihre Meinung zählt',
      intro:
        'Vielen Dank, dass Sie {vehicle} bei {agency} gemietet haben. In einer Minute hilft Ihre Bewertung künftigen Reisenden bei der Wahl und dem Vermieter, besser zu werden.',
      button: 'Bewertung abgeben',
      notice: 'Nur Kunden mit abgeschlossener Miete können eine Bewertung veröffentlichen: Sie erscheint als verifizierte Bewertung.',
      text: 'Vielen Dank, dass Sie {vehicle} bei {agency} gemietet haben. Ihre Bewertung hilft künftigen Reisenden: {url}',
    },
    contact: {
      subject: 'Wir haben Ihre Nachricht erhalten ({reference})',
      title: 'Nachricht erhalten',
      intro: 'Das ClickDrive-Team hat Ihre Nachricht erhalten. Wir antworten innerhalb von 24 Arbeitsstunden.',
      yourMessage: 'Ihre Nachricht:',
      categories: {
        reservation: 'Information zu einem Fahrzeug oder einer Buchung',
        'agency-partner': 'Registrierung oder Partnerschaft als Vermieter',
        vehicle: 'Frage zu einem Fahrzeug',
        technical: 'Technisches Problem',
        billing: 'Abrechnung oder Abonnement',
        other: 'Sonstige Anfrage',
      },
    },
    fallbackVehicle: 'Fahrzeug',
    fallbackAgency: 'der Partnervermieter',
  },
  nl: {
    htmlLang: 'nl',
    footer:
      'ClickDrive brengt klanten en partnerverhuurders in Nador met elkaar in contact. Een vraag? Beantwoord deze e-mail of stuur ons een WhatsApp-bericht op +{whatsapp}.',
    hello: 'Hallo {name},',
    labels: {
      reference: 'Referentie',
      vehicle: 'Voertuig',
      agency: 'Verhuurder',
      from: 'Van',
      to: 'Tot',
      duration: 'Duur',
      pickup: 'Ophaallocatie',
      ferry: 'Aankomst met de ferry',
      total: 'Geschat totaal',
      category: 'Categorie',
      subject: 'Onderwerp',
    },
    days: { one: '{count} dag', other: '{count} dagen' },
    perDay: 'dag',
    received: {
      subject: 'Aanvraag {reference} ontvangen — {vehicle}',
      title: 'Aanvraag ontvangen',
      intro: 'Je reserveringsaanvraag is geregistreerd.',
      notConfirmed: 'Dit is nog geen bevestigde reservering',
      pending: 'de verhuurder {agency} controleert de beschikbaarheid en antwoordt je.',
      pdf: 'Mijn aanvraagbewijs downloaden',
      track: 'Mijn aanvraag volgen',
      keepReference: 'Bewaar je referentie: de verhuurder vraagt ernaar.',
      pdfText: 'Aanvraagbewijs',
      trackText: 'Mijn aanvraag volgen',
    },
    status: {
      subject: 'Reservering {reference}: {label}',
      labels: {
        APPROVED: 'bevestigd',
        CONFIRMED: 'bevestigd',
        REJECTED: 'niet geaccepteerd',
        ALTERNATIVE_PROPOSED: 'er wordt je een alternatief voorgesteld',
      },
      reason: 'Reden opgegeven door de verhuurder: {reason}',
      pdf: 'Mijn reserveringsbewijs downloaden',
      track: 'De status van mijn aanvraag bekijken',
      pdfText: 'Reserveringsbewijs',
    },
    alternatives: {
      subject: 'Je aanvraag {reference}: andere voertuigen zijn vrij op dezelfde data',
      title: 'Je aanvraag staat nog open',
      intro:
        'De verhuurder {agency} heeft nog niet gereageerd op je aanvraag voor {vehicle}. Je aanvraag blijft geldig; wil je liever niet wachten, dan zijn deze voertuigen vrij op dezelfde data:',
      seeAll: 'Alle beschikbare voertuigen bekijken',
      track: 'Mijn aanvraag volgen',
      allText: 'Alle beschikbare voertuigen',
      trackText: 'Mijn aanvraag volgen',
    },
    review: {
      subject: 'Je beoordeling van huur {reference}',
      title: 'Je mening telt',
      intro:
        'Bedankt dat je {vehicle} hebt gehuurd bij {agency}. In één minuut helpt je beoordeling toekomstige reizigers kiezen en de verhuurder verbeteren.',
      button: 'Mijn beoordeling geven',
      notice: 'Alleen klanten die een huur hebben afgerond, kunnen een beoordeling plaatsen: die verschijnt als geverifieerde beoordeling.',
      text: 'Bedankt dat je {vehicle} hebt gehuurd bij {agency}. Je beoordeling helpt toekomstige reizigers: {url}',
    },
    contact: {
      subject: 'We hebben je bericht ontvangen ({reference})',
      title: 'Bericht ontvangen',
      intro: 'Het ClickDrive-team heeft je bericht ontvangen. We antwoorden binnen 24 werkuren.',
      yourMessage: 'Je bericht:',
      categories: {
        reservation: 'Informatie over een voertuig of een reservering',
        'agency-partner': 'Aanmelding of partnerschap als verhuurder',
        vehicle: 'Vraag over een voertuig',
        technical: 'Technisch probleem',
        billing: 'Facturatie of abonnement',
        other: 'Andere vraag',
      },
    },
    fallbackVehicle: 'Voertuig',
    fallbackAgency: 'de partnerverhuurder',
  },
  ar: {
    htmlLang: 'ar',
    footer:
      'يربط ClickDrive الزبناء بوكالات الكراء الشريكة في الناظور. لديك سؤال؟ أجب على هذه الرسالة أو راسلنا عبر واتساب على الرقم ‎+{whatsapp}.',
    hello: 'مرحبًا {name}،',
    labels: {
      reference: 'المرجع',
      vehicle: 'المركبة',
      agency: 'الوكالة',
      from: 'من',
      to: 'إلى',
      duration: 'المدة',
      pickup: 'مكان الاستلام',
      ferry: 'الوصول بالباخرة',
      total: 'المجموع التقديري',
      category: 'الفئة',
      subject: 'الموضوع',
    },
    days: { one: 'يوم واحد', two: 'يومان', few: '{count} أيام', many: '{count} يومًا', other: '{count} يوم' },
    perDay: 'اليوم',
    received: {
      subject: 'تم استلام الطلب {reference} — {vehicle}',
      title: 'تم استلام الطلب',
      intro: 'تم تسجيل طلب الحجز الخاص بك.',
      notConfirmed: 'هذا ليس حجزًا مؤكدًا بعد',
      pending: 'تتحقق الوكالة {agency} من التوفر وسترد عليك.',
      pdf: 'تحميل قسيمة الطلب',
      track: 'تتبع طلبي',
      keepReference: 'احتفظ بمرجعك: ستطلبه منك الوكالة.',
      pdfText: 'قسيمة الطلب',
      trackText: 'تتبع طلبي',
    },
    status: {
      subject: 'الحجز {reference}: {label}',
      labels: {
        APPROVED: 'مؤكد',
        CONFIRMED: 'مؤكد',
        REJECTED: 'غير مقبول',
        ALTERNATIVE_PROPOSED: 'يُقترح عليك بديل',
      },
      reason: 'السبب الذي ذكرته الوكالة: {reason}',
      pdf: 'تحميل قسيمة الحجز',
      track: 'عرض تتبع طلبي',
      pdfText: 'قسيمة الحجز',
    },
    alternatives: {
      subject: 'طلبك {reference}: مركبات أخرى متاحة في نفس التواريخ',
      title: 'طلبك لا يزال في الانتظار',
      intro:
        'لم ترد الوكالة {agency} بعد على طلبك لـ{vehicle}. يبقى طلبك ساريًا؛ وإن كنت تفضل عدم الانتظار، فهذه المركبات متاحة في نفس التواريخ:',
      seeAll: 'عرض جميع المركبات المتاحة',
      track: 'تتبع طلبي',
      allText: 'جميع المركبات المتاحة',
      trackText: 'تتبع طلبي',
    },
    review: {
      subject: 'رأيك في الكراء {reference}',
      title: 'رأيك يهمنا',
      intro: 'شكرًا لكرائك {vehicle} لدى {agency}. في دقيقة واحدة، يساعد رأيك المسافرين القادمين على الاختيار والوكالة على التحسن.',
      button: 'أعطِ رأيي',
      notice: 'يمكن فقط للزبناء الذين أتموا الكراء نشر تقييم: سيظهر كتقييم موثق.',
      text: 'شكرًا لكرائك {vehicle} لدى {agency}. يساعد رأيك المسافرين القادمين: {url}',
    },
    contact: {
      subject: 'لقد استلمنا رسالتك ({reference})',
      title: 'تم استلام الرسالة',
      intro: 'استلم فريق ClickDrive رسالتك. نرد عليك خلال 24 ساعة عمل.',
      yourMessage: 'رسالتك:',
      categories: {
        reservation: 'معلومات عن مركبة أو حجز',
        'agency-partner': 'تسجيل وكالة أو شراكة',
        vehicle: 'سؤال عن مركبة',
        technical: 'مشكلة تقنية',
        billing: 'الفوترة أو الاشتراك',
        other: 'طلب آخر',
      },
    },
    fallbackVehicle: 'المركبة',
    fallbackAgency: 'الوكالة الشريكة',
  },
};
