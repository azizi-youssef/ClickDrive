import type { Locale } from '../config';

/**
 * Titres et descriptions des pages (balise title, meta description, Open Graph).
 * Titres : 60 caractères au plus avec le suffixe « | ClickDrive Nador » ; descriptions : 160 au plus.
 */
type PageMeta = { title: string; description: string };
type SharedPageMeta = PageMeta & { ogTitle: string; ogDescription: string };

const fr = {
  siteTitle: 'ClickDrive — Location de voitures à Nador',
  siteDescription:
    'Comparez les voitures et motos des agences de location de Nador : aéroport Nador-Al Aroui, port de Beni Ansar et centre-ville. Demande gratuite en ligne.',
  shareDescription: "Comparez les voitures disponibles à Nador et réservez auprès d'agences locales.",
  ogLocale: 'fr_MA',
  pages: {
    search: {
      title: 'Location de voiture à Nador : les prix',
      description:
        'Comparez les prix et disponibilités des voitures de location à Nador, Aéroport Nador Al-Aroui et Port Beni Ansar. Demande de réservation en ligne.',
      ogTitle: 'Rechercher une voiture de location à Nador — ClickDrive',
      ogDescription: 'Comparez instantanément les véhicules disponibles auprès des agences partenaires vérifiées à Nador.',
    } as SharedPageMeta,
    motos: {
      title: 'Location de moto et scooter à Nador',
      description:
        'Comparez les motos et scooters proposés par les agences partenaires vérifiées à Nador : tarifs, cylindrée, permis exigé. Demande de réservation en ligne.',
      ogTitle: 'Louer une moto ou un scooter à Nador — ClickDrive',
      ogDescription: 'Motos et scooters des agences partenaires vérifiées à Nador, avec cylindrée et permis exigé.',
    } as SharedPageMeta,
    agencies: {
      title: 'Agences de location de voitures à Nador',
      description:
        'Découvrez les agences partenaires vérifiées sur ClickDrive à Nador, l’aéroport Nador-Al Aroui et Beni Ansar. Consultez leurs parcs, conditions et tarifs.',
      ogTitle: 'Agences partenaires vérifiées à Nador — ClickDrive',
      ogDescription: 'Comparez les agences locales de location à Nador. Véhicules contrôlés, tarifs transparents et support dédié.',
    } as SharedPageMeta,
    contact: {
      title: 'Nous contacter',
      description:
        'Contactez l’équipe ClickDrive pour toute question sur la location de voitures à Nador : demande d’information, question technique ou partenariat agence.',
      ogTitle: 'Contacter ClickDrive — Location de voitures à Nador',
      ogDescription: 'Envoyez-nous un message. Notre équipe traite les demandes sous 24 h ouvrables (lundi–vendredi).',
    } as SharedPageMeta,
    faq: {
      title: 'Questions fréquentes sur la location à Nador',
      description:
        'Réponses aux questions les plus courantes : comment réserver, dépôt de garantie, assurance, kilométrage, annulation et agences vérifiées ClickDrive à Nador.',
      ogTitle: 'FAQ — Location de voitures à Nador | ClickDrive',
      ogDescription: 'Toutes les réponses sur la réservation, les tarifs, les garanties et les agences partenaires ClickDrive à Nador.',
    } as SharedPageMeta,
    about: {
      title: 'Comment ça marche',
      description:
        'ClickDrive rassemble les voitures des agences de location de Nador au même endroit : cherchez le modèle dont vous avez besoin, pas une agence.',
    } as PageMeta,
    cgv: {
      title: 'Conditions générales de vente',
      description:
        'Conditions générales de vente de ClickDrive, plateforme de location de voitures à Nador : réservation, annulation, tarification et responsabilités.',
    } as PageMeta,
    privacy: {
      title: 'Politique de confidentialité',
      description:
        'Comment ClickDrive collecte, utilise et protège vos données personnelles, conformément à la loi 09-08 (CNDP) et au RGPD.',
    } as PageMeta,
    legal: {
      title: 'Mentions légales',
      description:
        "Informations légales de la plateforme ClickDrive : éditeur, hébergeur et conditions d'utilisation du site de location de voitures à Nador.",
    } as PageMeta,
    vehicle: {
      notFound: "Véhicule introuvable",
      title: "Louer {name} à Nador",
      descCar: "Louez la voiture {name} à Nador{agency} : {price} DH par jour, {specs}. Demande de réservation en ligne.",
      descMoto: "Louez la moto {name} à Nador{agency} : {price} DH par jour, {specs}. Demande de réservation en ligne.",
      atAgency: " chez {agency}",
      ogTitle: "{name} en location à Nador — ClickDrive",
    },
    agency: {
      notFound: "Agence introuvable",
      title: "{agency} — location de véhicules à {city}",
      ogTitle: "{agency} — agence partenaire ClickDrive",
      description: "Louez une voiture ou une moto auprès de {agency}, agence partenaire à {city}. Comparez les véhicules et envoyez votre demande de réservation en ligne.",
    },
    login: { title: 'Connexion', description: 'Connectez-vous à votre espace ClickDrive.' } as PageMeta,
    tracking: { title: 'Suivi de votre demande', description: 'Suivez l’avancement de votre demande de location.' } as PageMeta,
    review: { title: 'Votre avis sur la location', description: 'Donnez votre avis sur votre location à Nador.' } as PageMeta,
    notFound: {
      title: 'Page introuvable',
      description: "Cette page n'existe pas ou a été déplacée. Retrouvez nos véhicules en location à Nador.",
    } as PageMeta,
  },
};

export type MetaMessages = typeof fr;

export const meta: Record<Locale, MetaMessages> = {
  fr,
  en: {
    siteTitle: 'ClickDrive — Car rental in Nador',
    siteDescription:
      'Compare cars and motorbikes from rental agencies in Nador: Nador-Al Aroui airport, Beni Ansar port and the city centre. Free online request.',
    shareDescription: 'Compare the cars available in Nador and book with local agencies.',
    ogLocale: 'en_GB',
    pages: {
      search: {
        title: 'Car rental in Nador: prices',
        description:
          'Compare prices and availability of rental cars in Nador, at Nador Al-Aroui Airport and Beni Ansar Port. Online booking request.',
        ogTitle: 'Find a rental car in Nador — ClickDrive',
        ogDescription: 'Instantly compare the vehicles available from verified partner agencies in Nador.',
      },
      motos: {
        title: 'Motorbike and scooter rental in Nador',
        description:
          'Compare the motorbikes and scooters offered by verified partner agencies in Nador: prices, engine size, required licence. Online booking request.',
        ogTitle: 'Rent a motorbike or scooter in Nador — ClickDrive',
        ogDescription: 'Motorbikes and scooters from verified partner agencies in Nador, with engine size and required licence.',
      },
      agencies: {
        title: 'Car rental agencies in Nador',
        description:
          'Discover the verified partner agencies on ClickDrive in Nador, Nador-Al Aroui airport and Beni Ansar. See their fleets, conditions and prices.',
        ogTitle: 'Verified partner agencies in Nador — ClickDrive',
        ogDescription: 'Compare local rental agencies in Nador. Checked vehicles, clear prices and dedicated support.',
      },
      contact: {
        title: 'Contact us',
        description:
          'Contact the ClickDrive team with any question about car rental in Nador: information request, technical question or agency partnership.',
        ogTitle: 'Contact ClickDrive — Car rental in Nador',
        ogDescription: 'Send us a message. Our team answers within 24 business hours (Monday–Friday).',
      },
      faq: {
        title: 'Frequently asked questions about renting in Nador',
        description:
          'Answers to the most common questions: how to book, deposit, insurance, mileage, cancellation and ClickDrive’s verified agencies in Nador.',
        ogTitle: 'FAQ — Car rental in Nador | ClickDrive',
        ogDescription: 'All the answers about booking, prices, guarantees and ClickDrive partner agencies in Nador.',
      },
      about: {
        title: 'How it works',
        description:
          'ClickDrive brings the cars of Nador’s rental agencies together in one place: search for the model you need, not for an agency.',
      },
      cgv: {
        title: 'Terms and conditions',
        description:
          'Terms and conditions of ClickDrive, the car rental platform in Nador: booking, cancellation, pricing and responsibilities.',
      },
      privacy: {
        title: 'Privacy policy',
        description:
          'How ClickDrive collects, uses and protects your personal data, in line with Moroccan law 09-08 (CNDP) and the GDPR.',
      },
      legal: {
        title: 'Legal notice',
        description: 'Legal information about the ClickDrive platform: publisher, host and terms of use of the car rental site in Nador.',
      },
      vehicle: {
        notFound: "Vehicle not found",
        title: "Rent the {name} in Nador",
        descCar: "Rent the {name} car in Nador{agency}: {price} DH per day, {specs}. Online booking request.",
        descMoto: "Rent the {name} motorbike in Nador{agency}: {price} DH per day, {specs}. Online booking request.",
        atAgency: " from {agency}",
        ogTitle: "{name} for rent in Nador — ClickDrive",
      },
      agency: {
        notFound: "Agency not found",
        title: "{agency} — vehicle rental in {city}",
        ogTitle: "{agency} — ClickDrive partner agency",
        description: "Rent a car or motorbike from {agency}, a partner agency in {city}. Compare the vehicles and send your booking request online.",
      },
      login: { title: 'Sign in', description: 'Sign in to your ClickDrive account.' },
      tracking: { title: 'Track your request', description: 'Follow the progress of your rental request.' },
      review: { title: 'Your review of the rental', description: 'Share your opinion of your rental in Nador.' },
      notFound: {
        title: 'Page not found',
        description: 'This page does not exist or has moved. Find our rental vehicles in Nador.',
      },
    },
  },
  es: {
    siteTitle: 'ClickDrive — Alquiler de coches en Nador',
    siteDescription:
      'Compara coches y motos de las agencias de alquiler de Nador: aeropuerto Nador-Al Aroui, puerto de Beni Ansar y centro. Solicitud gratuita en línea.',
    shareDescription: 'Compara los coches disponibles en Nador y reserva con agencias locales.',
    ogLocale: 'es_ES',
    pages: {
      search: {
        title: 'Alquiler de coches en Nador: precios',
        description:
          'Compara precios y disponibilidad de coches de alquiler en Nador, el aeropuerto Nador Al-Aroui y el puerto de Beni Ansar. Solicitud de reserva en línea.',
        ogTitle: 'Busca un coche de alquiler en Nador — ClickDrive',
        ogDescription: 'Compara al instante los vehículos disponibles en las agencias asociadas verificadas de Nador.',
      },
      motos: {
        title: 'Alquiler de motos y scooters en Nador',
        description:
          'Compara las motos y scooters de las agencias asociadas verificadas de Nador: precios, cilindrada y permiso exigido. Solicitud de reserva en línea.',
        ogTitle: 'Alquila una moto o un scooter en Nador — ClickDrive',
        ogDescription: 'Motos y scooters de agencias asociadas verificadas en Nador, con cilindrada y permiso exigido.',
      },
      agencies: {
        title: 'Agencias de alquiler de coches en Nador',
        description:
          'Descubre las agencias asociadas verificadas en ClickDrive en Nador, el aeropuerto Nador-Al Aroui y Beni Ansar. Consulta su flota, condiciones y precios.',
        ogTitle: 'Agencias asociadas verificadas en Nador — ClickDrive',
        ogDescription: 'Compara las agencias de alquiler locales de Nador. Vehículos revisados, precios claros y soporte dedicado.',
      },
      contact: {
        title: 'Contacto',
        description:
          'Contacta con el equipo de ClickDrive para cualquier duda sobre el alquiler de coches en Nador: información, cuestión técnica o colaboración de agencias.',
        ogTitle: 'Contactar con ClickDrive — Alquiler de coches en Nador',
        ogDescription: 'Envíanos un mensaje. Nuestro equipo responde en 24 horas laborables (de lunes a viernes).',
      },
      faq: {
        title: 'Preguntas frecuentes sobre el alquiler en Nador',
        description:
          'Respuestas a las preguntas más habituales: cómo reservar, fianza, seguro, kilometraje, cancelación y agencias verificadas de ClickDrive en Nador.',
        ogTitle: 'Preguntas frecuentes — Alquiler de coches en Nador | ClickDrive',
        ogDescription: 'Todas las respuestas sobre reservas, precios, garantías y agencias asociadas de ClickDrive en Nador.',
      },
      about: {
        title: 'Cómo funciona',
        description:
          'ClickDrive reúne en un solo lugar los coches de las agencias de alquiler de Nador: busca el modelo que necesitas, no una agencia.',
      },
      cgv: {
        title: 'Condiciones generales de venta',
        description:
          'Condiciones generales de ClickDrive, plataforma de alquiler de coches en Nador: reserva, cancelación, precios y responsabilidades.',
      },
      privacy: {
        title: 'Política de privacidad',
        description:
          'Cómo ClickDrive recoge, utiliza y protege tus datos personales, conforme a la ley marroquí 09-08 (CNDP) y al RGPD.',
      },
      legal: {
        title: 'Aviso legal',
        description: 'Información legal de la plataforma ClickDrive: editor, alojamiento y condiciones de uso del sitio de alquiler en Nador.',
      },
      vehicle: {
        notFound: "Vehículo no encontrado",
        title: "Alquila el {name} en Nador",
        descCar: "Alquila el coche {name} en Nador{agency}: {price} DH al día, {specs}. Solicitud de reserva en línea.",
        descMoto: "Alquila la moto {name} en Nador{agency}: {price} DH al día, {specs}. Solicitud de reserva en línea.",
        atAgency: " en {agency}",
        ogTitle: "{name} de alquiler en Nador — ClickDrive",
      },
      agency: {
        notFound: "Agencia no encontrada",
        title: "{agency} — alquiler de vehículos en {city}",
        ogTitle: "{agency} — agencia asociada de ClickDrive",
        description: "Alquila un coche o una moto con {agency}, agencia asociada en {city}. Compara los vehículos y envía tu solicitud de reserva en línea.",
      },
      login: { title: 'Iniciar sesión', description: 'Inicia sesión en tu espacio ClickDrive.' },
      tracking: { title: 'Seguimiento de tu solicitud', description: 'Sigue el avance de tu solicitud de alquiler.' },
      review: { title: 'Tu opinión sobre el alquiler', description: 'Da tu opinión sobre tu alquiler en Nador.' },
      notFound: {
        title: 'Página no encontrada',
        description: 'Esta página no existe o se ha movido. Encuentra nuestros vehículos de alquiler en Nador.',
      },
    },
  },
  de: {
    siteTitle: 'ClickDrive — Mietwagen in Nador',
    siteDescription:
      'Vergleichen Sie Autos und Motorräder der Vermieter in Nador: Flughafen Nador-Al Aroui, Hafen Beni Ansar und Zentrum. Kostenlose Online-Anfrage.',
    shareDescription: 'Vergleichen Sie die verfügbaren Autos in Nador und buchen Sie bei lokalen Vermietern.',
    ogLocale: 'de_DE',
    pages: {
      search: {
        title: 'Mietwagen in Nador: Preise',
        description:
          'Vergleichen Sie Preise und Verfügbarkeit von Mietwagen in Nador, am Flughafen Nador Al-Aroui und im Hafen Beni Ansar. Buchungsanfrage online.',
        ogTitle: 'Mietwagen in Nador finden — ClickDrive',
        ogDescription: 'Vergleichen Sie sofort die verfügbaren Fahrzeuge geprüfter Partnervermieter in Nador.',
      },
      motos: {
        title: 'Motorrad- und Rollervermietung in Nador',
        description:
          'Vergleichen Sie Motorräder und Roller geprüfter Partnervermieter in Nador: Preise, Hubraum, erforderlicher Führerschein. Buchungsanfrage online.',
        ogTitle: 'Motorrad oder Roller in Nador mieten — ClickDrive',
        ogDescription: 'Motorräder und Roller geprüfter Partnervermieter in Nador, mit Hubraum und Führerscheinklasse.',
      },
      agencies: {
        title: 'Autovermietungen in Nador',
        description:
          'Entdecken Sie die geprüften Partnervermieter von ClickDrive in Nador, am Flughafen Nador-Al Aroui und in Beni Ansar: Flotte, Bedingungen und Preise.',
        ogTitle: 'Geprüfte Partnervermieter in Nador — ClickDrive',
        ogDescription: 'Vergleichen Sie lokale Vermieter in Nador. Geprüfte Fahrzeuge, klare Preise und persönlicher Support.',
      },
      contact: {
        title: 'Kontakt',
        description:
          'Kontaktieren Sie das ClickDrive-Team bei Fragen zur Automiete in Nador: Informationen, technische Fragen oder Partnerschaft als Vermieter.',
        ogTitle: 'ClickDrive kontaktieren — Mietwagen in Nador',
        ogDescription: 'Schreiben Sie uns. Unser Team antwortet innerhalb von 24 Arbeitsstunden (Montag–Freitag).',
      },
      faq: {
        title: 'Häufige Fragen zur Automiete in Nador',
        description:
          'Antworten auf die häufigsten Fragen: Buchung, Kaution, Versicherung, Kilometer, Stornierung und die geprüften Vermieter von ClickDrive in Nador.',
        ogTitle: 'FAQ — Mietwagen in Nador | ClickDrive',
        ogDescription: 'Alle Antworten zu Buchung, Preisen, Garantien und den Partnervermietern von ClickDrive in Nador.',
      },
      about: {
        title: "So funktioniert's",
        description:
          'ClickDrive bündelt die Autos der Vermieter in Nador an einem Ort: Suchen Sie das Modell, das Sie brauchen, nicht einen Vermieter.',
      },
      cgv: {
        title: 'Allgemeine Geschäftsbedingungen',
        description:
          'Allgemeine Geschäftsbedingungen von ClickDrive, der Mietwagenplattform in Nador: Buchung, Stornierung, Preise und Verantwortlichkeiten.',
      },
      privacy: {
        title: 'Datenschutzerklärung',
        description:
          'Wie ClickDrive Ihre personenbezogenen Daten erhebt, nutzt und schützt, gemäß marokkanischem Gesetz 09-08 (CNDP) und DSGVO.',
      },
      legal: {
        title: 'Impressum',
        description: 'Rechtliche Angaben zur Plattform ClickDrive: Herausgeber, Hosting und Nutzungsbedingungen der Mietwagenseite in Nador.',
      },
      vehicle: {
        notFound: "Fahrzeug nicht gefunden",
        title: "{name} in Nador mieten",
        descCar: "Mieten Sie das Auto {name} in Nador{agency}: {price} DH pro Tag, {specs}. Buchungsanfrage online.",
        descMoto: "Mieten Sie das Motorrad {name} in Nador{agency}: {price} DH pro Tag, {specs}. Buchungsanfrage online.",
        atAgency: " bei {agency}",
        ogTitle: "{name} zur Miete in Nador — ClickDrive",
      },
      agency: {
        notFound: "Vermieter nicht gefunden",
        title: "{agency} — Fahrzeugvermietung in {city}",
        ogTitle: "{agency} — Partnervermieter von ClickDrive",
        description: "Mieten Sie ein Auto oder Motorrad bei {agency}, Partnervermieter in {city}. Vergleichen Sie die Fahrzeuge und senden Sie Ihre Buchungsanfrage online.",
      },
      login: { title: 'Anmelden', description: 'Melden Sie sich in Ihrem ClickDrive-Bereich an.' },
      tracking: { title: 'Status Ihrer Anfrage', description: 'Verfolgen Sie den Fortschritt Ihrer Mietanfrage.' },
      review: { title: 'Ihre Bewertung der Miete', description: 'Bewerten Sie Ihre Miete in Nador.' },
      notFound: {
        title: 'Seite nicht gefunden',
        description: 'Diese Seite existiert nicht oder wurde verschoben. Entdecken Sie unsere Mietfahrzeuge in Nador.',
      },
    },
  },
  nl: {
    siteTitle: 'ClickDrive — Auto huren in Nador',
    siteDescription:
      'Vergelijk auto’s en motoren van verhuurbedrijven in Nador: luchthaven Nador-Al Aroui, haven Beni Ansar en het centrum. Gratis online aanvraag.',
    shareDescription: 'Vergelijk de beschikbare auto’s in Nador en boek bij lokale verhuurbedrijven.',
    ogLocale: 'nl_NL',
    pages: {
      search: {
        title: 'Auto huren in Nador: prijzen',
        description:
          'Vergelijk prijzen en beschikbaarheid van huurauto’s in Nador, op luchthaven Nador Al-Aroui en in de haven van Beni Ansar. Online reserveringsaanvraag.',
        ogTitle: 'Zoek een huurauto in Nador — ClickDrive',
        ogDescription: 'Vergelijk direct de beschikbare voertuigen van gecontroleerde partnerverhuurders in Nador.',
      },
      motos: {
        title: 'Motor en scooter huren in Nador',
        description:
          'Vergelijk de motoren en scooters van gecontroleerde partnerverhuurders in Nador: prijzen, cilinderinhoud, vereist rijbewijs. Online reserveringsaanvraag.',
        ogTitle: 'Huur een motor of scooter in Nador — ClickDrive',
        ogDescription: 'Motoren en scooters van gecontroleerde partnerverhuurders in Nador, met cilinderinhoud en vereist rijbewijs.',
      },
      agencies: {
        title: 'Autoverhuurbedrijven in Nador',
        description:
          'Ontdek de gecontroleerde partnerverhuurders van ClickDrive in Nador, op luchthaven Nador-Al Aroui en in Beni Ansar: vloot, voorwaarden en prijzen.',
        ogTitle: 'Gecontroleerde partnerverhuurders in Nador — ClickDrive',
        ogDescription: 'Vergelijk lokale verhuurbedrijven in Nador. Gecontroleerde voertuigen, duidelijke prijzen en persoonlijke hulp.',
      },
      contact: {
        title: 'Contact',
        description:
          'Neem contact op met het ClickDrive-team voor vragen over autohuur in Nador: informatie, een technische vraag of een samenwerking als verhuurder.',
        ogTitle: 'Contact met ClickDrive — Auto huren in Nador',
        ogDescription: 'Stuur ons een bericht. Ons team antwoordt binnen 24 werkuren (maandag–vrijdag).',
      },
      faq: {
        title: 'Veelgestelde vragen over huren in Nador',
        description:
          'Antwoorden op de meest gestelde vragen: reserveren, borg, verzekering, kilometers, annuleren en de gecontroleerde verhuurders van ClickDrive in Nador.',
        ogTitle: 'Veelgestelde vragen — Auto huren in Nador | ClickDrive',
        ogDescription: 'Alle antwoorden over reserveren, prijzen, garanties en de partnerverhuurders van ClickDrive in Nador.',
      },
      about: {
        title: 'Hoe het werkt',
        description:
          'ClickDrive brengt de auto’s van de verhuurbedrijven in Nador samen op één plek: zoek het model dat je nodig hebt, niet een verhuurder.',
      },
      cgv: {
        title: 'Algemene voorwaarden',
        description:
          'Algemene voorwaarden van ClickDrive, het platform voor autohuur in Nador: reserveren, annuleren, prijzen en verantwoordelijkheden.',
      },
      privacy: {
        title: 'Privacybeleid',
        description:
          'Hoe ClickDrive je persoonsgegevens verzamelt, gebruikt en beschermt, volgens de Marokkaanse wet 09-08 (CNDP) en de AVG.',
      },
      legal: {
        title: 'Juridische informatie',
        description: 'Juridische informatie over het platform ClickDrive: uitgever, hosting en gebruiksvoorwaarden van de autohuursite in Nador.',
      },
      vehicle: {
        notFound: "Voertuig niet gevonden",
        title: "Huur de {name} in Nador",
        descCar: "Huur de auto {name} in Nador{agency}: {price} DH per dag, {specs}. Online reserveringsaanvraag.",
        descMoto: "Huur de motor {name} in Nador{agency}: {price} DH per dag, {specs}. Online reserveringsaanvraag.",
        atAgency: " bij {agency}",
        ogTitle: "{name} te huur in Nador — ClickDrive",
      },
      agency: {
        notFound: "Verhuurder niet gevonden",
        title: "{agency} — voertuigverhuur in {city}",
        ogTitle: "{agency} — partnerverhuurder van ClickDrive",
        description: "Huur een auto of motor bij {agency}, partnerverhuurder in {city}. Vergelijk de voertuigen en verstuur je reserveringsaanvraag online.",
      },
      login: { title: 'Inloggen', description: 'Log in op je ClickDrive-account.' },
      tracking: { title: 'Status van je aanvraag', description: 'Volg de voortgang van je huuraanvraag.' },
      review: { title: 'Jouw beoordeling van de huur', description: 'Geef je mening over je huur in Nador.' },
      notFound: {
        title: 'Pagina niet gevonden',
        description: 'Deze pagina bestaat niet of is verplaatst. Bekijk onze huurvoertuigen in Nador.',
      },
    },
  },
  ar: {
    siteTitle: 'ClickDrive — كراء السيارات في الناظور',
    siteDescription:
      'قارن السيارات والدراجات النارية لدى وكالات الكراء في الناظور: مطار الناظور العروي، ميناء بني انصار ووسط المدينة. طلب مجاني عبر الإنترنت.',
    shareDescription: 'قارن السيارات المتوفرة في الناظور واحجز لدى الوكالات المحلية.',
    ogLocale: 'ar_MA',
    pages: {
      search: {
        title: 'كراء السيارات في الناظور: الأسعار',
        description: 'قارن أسعار وتوفر سيارات الكراء في الناظور ومطار الناظور العروي وميناء بني انصار. طلب حجز عبر الإنترنت.',
        ogTitle: 'ابحث عن سيارة للكراء في الناظور — ClickDrive',
        ogDescription: 'قارن فوراً المركبات المتاحة لدى الوكالات الشريكة الموثقة في الناظور.',
      },
      motos: {
        title: 'كراء الدراجات النارية والسكوترات في الناظور',
        description:
          'قارن الدراجات النارية والسكوترات لدى الوكالات الشريكة الموثقة في الناظور: الأسعار، سعة المحرك والرخصة المطلوبة. طلب حجز عبر الإنترنت.',
        ogTitle: 'استأجر دراجة نارية أو سكوتر في الناظور — ClickDrive',
        ogDescription: 'دراجات نارية وسكوترات من وكالات شريكة موثقة في الناظور، مع سعة المحرك والرخصة المطلوبة.',
      },
      agencies: {
        title: 'وكالات كراء السيارات في الناظور',
        description:
          'اكتشف الوكالات الشريكة الموثقة على ClickDrive في الناظور ومطار الناظور العروي وبني انصار. اطلع على أساطيلها وشروطها وأسعارها.',
        ogTitle: 'وكالات شريكة موثقة في الناظور — ClickDrive',
        ogDescription: 'قارن وكالات الكراء المحلية في الناظور. مركبات مفحوصة وأسعار واضحة ودعم مخصص.',
      },
      contact: {
        title: 'اتصل بنا',
        description: 'تواصل مع فريق ClickDrive لأي سؤال حول كراء السيارات في الناظور: طلب معلومات، سؤال تقني أو شراكة وكالة.',
        ogTitle: 'تواصل مع ClickDrive — كراء السيارات في الناظور',
        ogDescription: 'راسلنا. يرد فريقنا خلال 24 ساعة عمل (من الاثنين إلى الجمعة).',
      },
      faq: {
        title: 'الأسئلة الشائعة حول الكراء في الناظور',
        description:
          'إجابات على الأسئلة الأكثر شيوعاً: طريقة الحجز، الضمان، التأمين، المسافة المقطوعة، الإلغاء والوكالات الموثقة على ClickDrive في الناظور.',
        ogTitle: 'الأسئلة الشائعة — كراء السيارات في الناظور | ClickDrive',
        ogDescription: 'كل الإجابات حول الحجز والأسعار والضمانات والوكالات الشريكة لـ ClickDrive في الناظور.',
      },
      about: {
        title: 'كيف يعمل',
        description: 'يجمع ClickDrive سيارات وكالات الكراء في الناظور في مكان واحد: ابحث عن الموديل الذي تحتاجه، لا عن وكالة.',
      },
      cgv: {
        title: 'الشروط العامة للبيع',
        description: 'الشروط العامة لـ ClickDrive، منصة كراء السيارات في الناظور: الحجز والإلغاء والأسعار والمسؤوليات.',
      },
      privacy: {
        title: 'سياسة الخصوصية',
        description: 'كيف يجمع ClickDrive بياناتك الشخصية ويستعملها ويحميها، وفقاً للقانون 09-08 (CNDP) والنظام الأوروبي لحماية البيانات.',
      },
      legal: {
        title: 'الإشعار القانوني',
        description: 'المعلومات القانونية لمنصة ClickDrive: الناشر، الاستضافة وشروط استعمال موقع كراء السيارات في الناظور.',
      },
      vehicle: {
        notFound: "المركبة غير موجودة",
        title: "استأجر {name} في الناظور",
        descCar: "استأجر سيارة {name} في الناظور{agency}: {price} درهم لليوم، {specs}. طلب حجز عبر الإنترنت.",
        descMoto: "استأجر الدراجة النارية {name} في الناظور{agency}: {price} درهم لليوم، {specs}. طلب حجز عبر الإنترنت.",
        atAgency: " لدى {agency}",
        ogTitle: "{name} للكراء في الناظور — ClickDrive",
      },
      agency: {
        notFound: "الوكالة غير موجودة",
        title: "{agency} — كراء المركبات في {city}",
        ogTitle: "{agency} — وكالة شريكة لـ ClickDrive",
        description: "استأجر سيارة أو دراجة نارية لدى {agency}، الوكالة الشريكة في {city}. قارن المركبات وأرسل طلب الحجز عبر الإنترنت.",
      },
      login: { title: 'تسجيل الدخول', description: 'سجّل الدخول إلى حسابك في ClickDrive.' },
      tracking: { title: 'تتبع طلبك', description: 'تابع تقدم طلب الكراء الخاص بك.' },
      review: { title: 'رأيك في الكراء', description: 'شاركنا رأيك في كرائك في الناظور.' },
      notFound: {
        title: 'الصفحة غير موجودة',
        description: 'هذه الصفحة غير موجودة أو تم نقلها. اكتشف مركباتنا للكراء في الناظور.',
      },
    },
  },
};
