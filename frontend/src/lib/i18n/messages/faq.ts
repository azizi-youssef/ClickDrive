import type { Locale } from '../config';
import type { PluralForms } from '../format';

type QA = { question: string; answer: string };

/**
 * Page /faq : textes de l'interface et questions-réponses (identifiants stables pour les liens #id,
 * icônes et thèmes dans app/faq/faq-data.ts). Mêmes réponses dans les données structurées FAQPage.
 */
const fr = {
  ui: {
    eyebrow: 'Centre d’aide',
    titleBefore: 'Questions fréquentes',
    subtitle: 'Recherche, réservation, caution, prise en charge à Nador : retrouvez les réponses avant de louer votre véhicule.',
    searchLabel: 'Rechercher dans la FAQ',
    searchPlaceholder: 'Caution, aéroport, assurance, annulation…',
    clearSearch: 'Effacer la recherche',
    results: { one: '{count} réponse pour « {query} »', other: '{count} réponses pour « {query} »' } as PluralForms,
    allQuestions: 'Toutes les questions',
    themesAria: 'Thèmes',
    needAnswer: 'Besoin d’une réponse précise ?',
    needAnswerText: 'Notre équipe vous répond pour votre réservation.',
    contactUs: 'Nous contacter',
    qaAria: 'Questions et réponses',
    noMatchTitle: 'Aucune question ne correspond',
    noMatchText: 'Essayez un autre mot-clé, ou posez directement votre question à notre équipe.',
    seeAll: 'Voir toutes les questions',
    moreTitle: 'Vous avez encore une question ?',
    moreText: 'Consultez les véhicules disponibles ou contactez notre équipe pour une information propre à votre réservation.',
    searchCar: 'Rechercher une voiture',
    linkToQuestion: 'Lien vers cette question',
  },
  categories: {
    plateforme: 'La plateforme',
    reservation: 'Réservation',
    tarifs: 'Caution & assurance',
    'prise-en-charge': 'Prise en charge',
    agences: 'Agences partenaires',
  } as Record<string, string>,
  items: {
    fonctionnement: {
      question: 'Comment fonctionne ClickDrive Nador ?',
      answer:
        'ClickDrive est une plateforme qui permet de découvrir les véhicules proposés par plusieurs agences de location à Nador et dans les environs. Vous recherchez un véhicule, consultez ses caractéristiques, ses conditions et son tarif, puis envoyez gratuitement votre demande à l’agence concernée, qui la confirme.',
    },
    rechercher: {
      question: 'Comment rechercher une voiture ?',
      answer:
        'Vous pouvez commencer votre recherche depuis la page Véhicules en indiquant vos dates et vos critères. Vous pouvez ensuite consulter les modèles disponibles, comparer les caractéristiques et ouvrir la fiche d’un véhicule pour obtenir davantage d’informations.',
    },
    reserver: {
      question: 'Comment réserver un véhicule ?',
      answer:
        'Après avoir choisi un véhicule et vos dates, cliquez sur « Réserver ce véhicule » et complétez votre demande avec vos coordonnées ; la pièce d’identité et le permis peuvent être présentés plus tard, en original, à la remise des clés. ClickDrive transmet votre demande à l’agence partenaire, qui confirme la disponibilité. Si elle tarde à répondre, ClickDrive la relance puis vous propose des véhicules équivalents.',
    },
    disponibilite: {
      question: 'Comment fonctionne la disponibilité des véhicules ?',
      answer:
        'La disponibilité est gérée en direct par les agences partenaires et vérifiée pour vos dates avant l’envoi de votre demande. Le tarif affiché est enregistré avec votre demande. Si le véhicule n’est finalement pas disponible, ClickDrive vous propose des véhicules équivalents.',
    },
    annulation: {
      question: 'Puis-je annuler ma réservation ?',
      answer:
        'Les conditions d’annulation sont définies par chaque agence et peuvent dépendre du délai avant la prise en charge du véhicule. Avant de réserver, vérifiez les conditions applicables à votre demande et demandez à l’agence quelles éventuelles pénalités peuvent s’appliquer.',
    },
    caution: {
      question: 'Quel montant de caution dois-je prévoir ?',
      answer:
        'Le montant de la caution dépend notamment du véhicule, de l’agence et des conditions du contrat. Les modalités de paiement ou de blocage de la caution peuvent également varier. Vérifiez toujours les conditions communiquées par l’agence avant de confirmer votre réservation.',
    },
    assurance: {
      question: 'Les assurances sont-elles incluses dans le prix ?',
      answer:
        'Les conditions d’assurance peuvent varier selon le véhicule et l’agence. Le tarif affiché ne doit donc pas être interprété comme incluant automatiquement toutes les garanties ou options. Consultez les conditions du véhicule et demandez à l’agence quelles couvertures sont incluses dans le prix.',
    },
    aeroport: {
      question: 'Puis-je récupérer une voiture à l’aéroport Nador-Al Aroui ?',
      answer:
        'Oui, lorsque l’agence le propose : la livraison à l’aéroport Nador-Al Aroui ou au port de Beni Ansar et ses éventuels frais sont indiqués sur la fiche du véhicule. Précisez votre numéro de vol ou votre traversée dans votre demande pour que l’agence fixe le rendez-vous à votre arrivée.',
    },
    mre: {
      question: 'ClickDrive est-il adapté aux Marocains résidant à l’étranger (MRE) ?',
      answer:
        'Oui. La plateforme est pensée notamment pour faciliter la recherche d’un véhicule avant ou pendant un séjour à Nador. Les services proposés aux MRE, les horaires de prise en charge, les conditions de retard de vol ou les documents nécessaires dépendent toutefois de chaque agence.',
    },
    'agence-verifiee': {
      question: 'Que signifie le badge « Agence vérifiée » ?',
      answer:
        'Lorsqu’une agence dispose du badge « Agence vérifiée », cela signifie que son registre de commerce, ses assurances professionnelles et son parc ont fait l’objet d’une validation par ClickDrive.',
    },
    'devenir-partenaire': {
      question: 'Une agence peut-elle rejoindre ClickDrive ?',
      answer:
        'Oui. Les agences de location souhaitant proposer leurs véhicules sur ClickDrive peuvent soumettre une demande de partenariat depuis la page dédiée. Après étude des informations fournies, l’agence peut être intégrée à la plateforme selon les conditions du service.',
    },
  } as Record<string, QA>,
};

export type FaqMessages = typeof fr;

export const faq: Record<Locale, FaqMessages> = {
  fr,
  en: {
    ui: {
      eyebrow: 'Help centre',
      titleBefore: 'Frequently asked questions',
      subtitle: 'Searching, booking, deposit, pickup in Nador: find the answers before you rent your vehicle.',
      searchLabel: 'Search the FAQ',
      searchPlaceholder: 'Deposit, airport, insurance, cancellation…',
      clearSearch: 'Clear the search',
      results: { one: '{count} answer for “{query}”', other: '{count} answers for “{query}”' },
      allQuestions: 'All questions',
      themesAria: 'Topics',
      needAnswer: 'Need a specific answer?',
      needAnswerText: 'Our team answers questions about your booking.',
      contactUs: 'Contact us',
      qaAria: 'Questions and answers',
      noMatchTitle: 'No question matches',
      noMatchText: 'Try another keyword, or ask our team directly.',
      seeAll: 'See all questions',
      moreTitle: 'Still have a question?',
      moreText: 'Browse the available vehicles or contact our team for information about your own booking.',
      searchCar: 'Search for a car',
      linkToQuestion: 'Link to this question',
    },
    categories: {
      plateforme: 'The platform',
      reservation: 'Booking',
      tarifs: 'Deposit & insurance',
      'prise-en-charge': 'Pickup',
      agences: 'Partner agencies',
    },
    items: {
      fonctionnement: {
        question: 'How does ClickDrive Nador work?',
        answer:
          'ClickDrive is a platform that shows the vehicles offered by several rental agencies in and around Nador. You search for a vehicle, check its features, conditions and price, then send your request free of charge to the agency, which confirms it.',
      },
      rechercher: {
        question: 'How do I search for a car?',
        answer:
          'Start your search on the Vehicles page by entering your dates and criteria. You can then browse the available models, compare their features and open a vehicle’s page for more information.',
      },
      reserver: {
        question: 'How do I book a vehicle?',
        answer:
          'Once you have chosen a vehicle and your dates, click “Book this vehicle” and complete your request with your contact details; your ID and driving licence can be shown later, in the original, when you collect the keys. ClickDrive passes your request to the partner agency, which confirms availability. If it is slow to reply, ClickDrive reminds it and then suggests equivalent vehicles.',
      },
      disponibilite: {
        question: 'How does vehicle availability work?',
        answer:
          'Availability is managed live by the partner agencies and checked for your dates before your request is sent. The price shown is recorded with your request. If the vehicle turns out not to be available, ClickDrive suggests equivalent vehicles.',
      },
      annulation: {
        question: 'Can I cancel my booking?',
        answer:
          'Cancellation conditions are set by each agency and may depend on how long before pickup you cancel. Before booking, check the conditions that apply to your request and ask the agency about any penalties.',
      },
      caution: {
        question: 'How much deposit should I plan for?',
        answer:
          'The deposit depends in particular on the vehicle, the agency and the contract conditions. How the deposit is paid or held can also vary. Always check the conditions given by the agency before confirming your booking.',
      },
      assurance: {
        question: 'Is insurance included in the price?',
        answer:
          'Insurance conditions can vary by vehicle and agency, so the price shown should not be read as automatically including every cover or option. Check the vehicle’s conditions and ask the agency which cover is included in the price.',
      },
      aeroport: {
        question: 'Can I pick up a car at Nador-Al Aroui airport?',
        answer:
          'Yes, when the agency offers it: delivery to Nador-Al Aroui airport or Beni Ansar port, and any fee, are shown on the vehicle’s page. Give your flight number or ferry crossing in your request so the agency can arrange to meet you on arrival.',
      },
      mre: {
        question: 'Is ClickDrive suitable for Moroccans living abroad?',
        answer:
          'Yes. The platform is designed in particular to make it easier to find a vehicle before or during a stay in Nador. Services for visitors from abroad, pickup times, conditions in case of a flight delay and the documents required depend on each agency, however.',
      },
      'agence-verifiee': {
        question: 'What does the “Verified agency” badge mean?',
        answer:
          'When an agency has the “Verified agency” badge, its trade registration, professional insurance and fleet have been checked by ClickDrive.',
      },
      'devenir-partenaire': {
        question: 'Can an agency join ClickDrive?',
        answer:
          'Yes. Rental agencies that want to offer their vehicles on ClickDrive can apply for a partnership from the dedicated page. After reviewing the information provided, the agency can be added to the platform under the terms of the service.',
      },
    },
  },
  es: {
    ui: {
      eyebrow: 'Centro de ayuda',
      titleBefore: 'Preguntas frecuentes',
      subtitle: 'Búsqueda, reserva, fianza, recogida en Nador: encuentra las respuestas antes de alquilar tu vehículo.',
      searchLabel: 'Buscar en las preguntas frecuentes',
      searchPlaceholder: 'Fianza, aeropuerto, seguro, cancelación…',
      clearSearch: 'Borrar la búsqueda',
      results: { one: '{count} respuesta para «{query}»', other: '{count} respuestas para «{query}»' },
      allQuestions: 'Todas las preguntas',
      themesAria: 'Temas',
      needAnswer: '¿Necesitas una respuesta concreta?',
      needAnswerText: 'Nuestro equipo te responde sobre tu reserva.',
      contactUs: 'Contactar',
      qaAria: 'Preguntas y respuestas',
      noMatchTitle: 'Ninguna pregunta coincide',
      noMatchText: 'Prueba otra palabra clave o haz tu pregunta directamente a nuestro equipo.',
      seeAll: 'Ver todas las preguntas',
      moreTitle: '¿Tienes otra pregunta?',
      moreText: 'Consulta los vehículos disponibles o contacta con nuestro equipo para información sobre tu reserva.',
      searchCar: 'Buscar un coche',
      linkToQuestion: 'Enlace a esta pregunta',
    },
    categories: {
      plateforme: 'La plataforma',
      reservation: 'Reserva',
      tarifs: 'Fianza y seguro',
      'prise-en-charge': 'Recogida',
      agences: 'Agencias asociadas',
    },
    items: {
      fonctionnement: {
        question: '¿Cómo funciona ClickDrive Nador?',
        answer:
          'ClickDrive es una plataforma que muestra los vehículos de varias agencias de alquiler de Nador y alrededores. Buscas un vehículo, consultas sus características, condiciones y precio, y envías gratis tu solicitud a la agencia, que la confirma.',
      },
      rechercher: {
        question: '¿Cómo busco un coche?',
        answer:
          'Empieza la búsqueda en la página Vehículos indicando tus fechas y criterios. Después puedes ver los modelos disponibles, comparar sus características y abrir la ficha de un vehículo para obtener más información.',
      },
      reserver: {
        question: '¿Cómo reservo un vehículo?',
        answer:
          'Después de elegir un vehículo y tus fechas, haz clic en «Reservar este vehículo» y completa tu solicitud con tus datos de contacto; el documento de identidad y el permiso pueden presentarse más tarde, en original, al recoger las llaves. ClickDrive envía tu solicitud a la agencia asociada, que confirma la disponibilidad. Si tarda en responder, ClickDrive se lo recuerda y luego te propone vehículos equivalentes.',
      },
      disponibilite: {
        question: '¿Cómo funciona la disponibilidad de los vehículos?',
        answer:
          'Las agencias asociadas gestionan la disponibilidad en directo y se comprueba para tus fechas antes de enviar la solicitud. El precio mostrado queda registrado con tu solicitud. Si al final el vehículo no está disponible, ClickDrive te propone vehículos equivalentes.',
      },
      annulation: {
        question: '¿Puedo cancelar mi reserva?',
        answer:
          'Cada agencia fija sus condiciones de cancelación, que pueden depender de la antelación con la que cancelas. Antes de reservar, revisa las condiciones de tu solicitud y pregunta a la agencia por posibles penalizaciones.',
      },
      caution: {
        question: '¿Qué fianza debo prever?',
        answer:
          'El importe de la fianza depende sobre todo del vehículo, de la agencia y de las condiciones del contrato. La forma de pagarla o bloquearla también puede variar. Revisa siempre las condiciones indicadas por la agencia antes de confirmar tu reserva.',
      },
      assurance: {
        question: '¿El seguro está incluido en el precio?',
        answer:
          'Las condiciones del seguro pueden variar según el vehículo y la agencia, por lo que el precio mostrado no incluye automáticamente todas las coberturas u opciones. Consulta las condiciones del vehículo y pregunta a la agencia qué coberturas incluye el precio.',
      },
      aeroport: {
        question: '¿Puedo recoger un coche en el aeropuerto Nador-Al Aroui?',
        answer:
          'Sí, cuando la agencia lo ofrece: la entrega en el aeropuerto Nador-Al Aroui o en el puerto de Beni Ansar y su posible coste figuran en la ficha del vehículo. Indica tu número de vuelo o tu travesía en la solicitud para que la agencia fije la cita a tu llegada.',
      },
      mre: {
        question: '¿ClickDrive es adecuado para los marroquíes residentes en el extranjero?',
        answer:
          'Sí. La plataforma está pensada para facilitar la búsqueda de un vehículo antes o durante una estancia en Nador. Aun así, los servicios para quienes llegan del extranjero, los horarios de recogida, las condiciones en caso de retraso del vuelo y los documentos necesarios dependen de cada agencia.',
      },
      'agence-verifiee': {
        question: '¿Qué significa la insignia «Agencia verificada»?',
        answer:
          'Cuando una agencia tiene la insignia «Agencia verificada», ClickDrive ha comprobado su registro mercantil, sus seguros profesionales y su flota.',
      },
      'devenir-partenaire': {
        question: '¿Puede una agencia unirse a ClickDrive?',
        answer:
          'Sí. Las agencias de alquiler que quieran ofrecer sus vehículos en ClickDrive pueden solicitar la colaboración desde la página dedicada. Tras estudiar la información, la agencia puede incorporarse a la plataforma según las condiciones del servicio.',
      },
    },
  },
  de: {
    ui: {
      eyebrow: 'Hilfe-Center',
      titleBefore: 'Häufige Fragen',
      subtitle: 'Suche, Buchung, Kaution, Abholung in Nador: Hier finden Sie die Antworten, bevor Sie Ihr Fahrzeug mieten.',
      searchLabel: 'In den FAQ suchen',
      searchPlaceholder: 'Kaution, Flughafen, Versicherung, Stornierung…',
      clearSearch: 'Suche löschen',
      results: { one: '{count} Antwort für „{query}“', other: '{count} Antworten für „{query}“' },
      allQuestions: 'Alle Fragen',
      themesAria: 'Themen',
      needAnswer: 'Sie brauchen eine genaue Antwort?',
      needAnswerText: 'Unser Team beantwortet Fragen zu Ihrer Buchung.',
      contactUs: 'Kontakt',
      qaAria: 'Fragen und Antworten',
      noMatchTitle: 'Keine passende Frage',
      noMatchText: 'Versuchen Sie ein anderes Stichwort oder stellen Sie Ihre Frage direkt unserem Team.',
      seeAll: 'Alle Fragen ansehen',
      moreTitle: 'Noch eine Frage?',
      moreText: 'Sehen Sie sich die verfügbaren Fahrzeuge an oder kontaktieren Sie unser Team zu Ihrer Buchung.',
      searchCar: 'Auto suchen',
      linkToQuestion: 'Link zu dieser Frage',
    },
    categories: {
      plateforme: 'Die Plattform',
      reservation: 'Buchung',
      tarifs: 'Kaution & Versicherung',
      'prise-en-charge': 'Abholung',
      agences: 'Partnervermieter',
    },
    items: {
      fonctionnement: {
        question: 'Wie funktioniert ClickDrive Nador?',
        answer:
          'ClickDrive ist eine Plattform, auf der Sie die Fahrzeuge mehrerer Vermieter in und um Nador entdecken. Sie suchen ein Fahrzeug, prüfen Merkmale, Bedingungen und Preis und senden Ihre Anfrage kostenlos an den Vermieter, der sie bestätigt.',
      },
      rechercher: {
        question: 'Wie suche ich ein Auto?',
        answer:
          'Beginnen Sie Ihre Suche auf der Seite Fahrzeuge mit Ihren Daten und Kriterien. Anschließend können Sie die verfügbaren Modelle ansehen, ihre Merkmale vergleichen und die Seite eines Fahrzeugs für weitere Informationen öffnen.',
      },
      reserver: {
        question: 'Wie buche ich ein Fahrzeug?',
        answer:
          'Wählen Sie ein Fahrzeug und Ihre Daten, klicken Sie auf „Dieses Fahrzeug buchen“ und vervollständigen Sie Ihre Anfrage mit Ihren Kontaktdaten; Ausweis und Führerschein können Sie später im Original bei der Schlüsselübergabe vorlegen. ClickDrive leitet Ihre Anfrage an den Partnervermieter weiter, der die Verfügbarkeit bestätigt. Antwortet er nicht rechtzeitig, erinnert ClickDrive ihn und schlägt Ihnen dann gleichwertige Fahrzeuge vor.',
      },
      disponibilite: {
        question: 'Wie funktioniert die Verfügbarkeit der Fahrzeuge?',
        answer:
          'Die Verfügbarkeit wird live von den Partnervermietern verwaltet und vor dem Senden Ihrer Anfrage für Ihre Daten geprüft. Der angezeigte Preis wird mit Ihrer Anfrage gespeichert. Ist das Fahrzeug doch nicht verfügbar, schlägt Ihnen ClickDrive gleichwertige Fahrzeuge vor.',
      },
      annulation: {
        question: 'Kann ich meine Buchung stornieren?',
        answer:
          'Die Stornobedingungen legt jeder Vermieter fest; sie können davon abhängen, wie lange vor der Abholung Sie stornieren. Prüfen Sie vor der Buchung die geltenden Bedingungen und fragen Sie den Vermieter nach möglichen Gebühren.',
      },
      caution: {
        question: 'Mit welcher Kaution muss ich rechnen?',
        answer:
          'Die Höhe der Kaution hängt vor allem vom Fahrzeug, vom Vermieter und von den Vertragsbedingungen ab. Auch die Art der Zahlung oder Blockierung kann variieren. Prüfen Sie stets die Bedingungen des Vermieters, bevor Sie Ihre Buchung bestätigen.',
      },
      assurance: {
        question: 'Ist die Versicherung im Preis enthalten?',
        answer:
          'Die Versicherungsbedingungen können je nach Fahrzeug und Vermieter variieren; der angezeigte Preis umfasst also nicht automatisch alle Deckungen oder Optionen. Prüfen Sie die Bedingungen des Fahrzeugs und fragen Sie den Vermieter, welche Deckung im Preis enthalten ist.',
      },
      aeroport: {
        question: 'Kann ich ein Auto am Flughafen Nador-Al Aroui abholen?',
        answer:
          'Ja, wenn der Vermieter es anbietet: Die Zustellung zum Flughafen Nador-Al Aroui oder zum Hafen Beni Ansar und eventuelle Kosten stehen auf der Fahrzeugseite. Geben Sie in Ihrer Anfrage Ihre Flugnummer oder Fährüberfahrt an, damit der Vermieter den Treffpunkt bei Ihrer Ankunft festlegt.',
      },
      mre: {
        question: 'Eignet sich ClickDrive für im Ausland lebende Marokkaner?',
        answer:
          'Ja. Die Plattform soll vor allem die Fahrzeugsuche vor oder während eines Aufenthalts in Nador erleichtern. Angebote für Reisende aus dem Ausland, Abholzeiten, Regeln bei Flugverspätung und die nötigen Dokumente hängen jedoch vom jeweiligen Vermieter ab.',
      },
      'agence-verifiee': {
        question: 'Was bedeutet das Abzeichen „Geprüfter Vermieter“?',
        answer:
          'Hat ein Vermieter das Abzeichen „Geprüfter Vermieter“, wurden sein Handelsregistereintrag, seine Berufsversicherungen und seine Flotte von ClickDrive geprüft.',
      },
      'devenir-partenaire': {
        question: 'Kann ein Vermieter ClickDrive beitreten?',
        answer:
          'Ja. Vermieter, die ihre Fahrzeuge auf ClickDrive anbieten möchten, können über die entsprechende Seite eine Partnerschaft beantragen. Nach Prüfung der Angaben kann der Vermieter zu den Bedingungen des Dienstes aufgenommen werden.',
      },
    },
  },
  nl: {
    ui: {
      eyebrow: 'Helpcentrum',
      titleBefore: 'Veelgestelde vragen',
      subtitle: 'Zoeken, reserveren, borg, ophalen in Nador: vind de antwoorden voordat je je voertuig huurt.',
      searchLabel: 'Zoeken in de veelgestelde vragen',
      searchPlaceholder: 'Borg, luchthaven, verzekering, annuleren…',
      clearSearch: 'Zoekopdracht wissen',
      results: { one: '{count} antwoord voor ‘{query}’', other: '{count} antwoorden voor ‘{query}’' },
      allQuestions: 'Alle vragen',
      themesAria: 'Thema’s',
      needAnswer: 'Een specifiek antwoord nodig?',
      needAnswerText: 'Ons team beantwoordt vragen over je reservering.',
      contactUs: 'Contact',
      qaAria: 'Vragen en antwoorden',
      noMatchTitle: 'Geen vraag gevonden',
      noMatchText: 'Probeer een ander trefwoord of stel je vraag rechtstreeks aan ons team.',
      seeAll: 'Alle vragen bekijken',
      moreTitle: 'Nog een vraag?',
      moreText: 'Bekijk de beschikbare voertuigen of neem contact op met ons team voor informatie over je reservering.',
      searchCar: 'Zoek een auto',
      linkToQuestion: 'Link naar deze vraag',
    },
    categories: {
      plateforme: 'Het platform',
      reservation: 'Reserveren',
      tarifs: 'Borg & verzekering',
      'prise-en-charge': 'Ophalen',
      agences: 'Partnerverhuurders',
    },
    items: {
      fonctionnement: {
        question: 'Hoe werkt ClickDrive Nador?',
        answer:
          'ClickDrive is een platform waarop je de voertuigen van verschillende verhuurders in en rond Nador vindt. Je zoekt een voertuig, bekijkt de kenmerken, voorwaarden en prijs, en stuurt gratis je aanvraag naar de verhuurder, die deze bevestigt.',
      },
      rechercher: {
        question: 'Hoe zoek ik een auto?',
        answer:
          'Begin je zoektocht op de pagina Voertuigen met je data en wensen. Daarna kun je de beschikbare modellen bekijken, de kenmerken vergelijken en de pagina van een voertuig openen voor meer informatie.',
      },
      reserver: {
        question: 'Hoe reserveer ik een voertuig?',
        answer:
          'Kies een voertuig en je data, klik op ‘Dit voertuig reserveren’ en vul je aanvraag aan met je contactgegevens; je identiteitsbewijs en rijbewijs kun je later in het origineel tonen bij de sleuteloverdracht. ClickDrive stuurt je aanvraag naar de partnerverhuurder, die de beschikbaarheid bevestigt. Reageert die niet snel genoeg, dan herinnert ClickDrive hem eraan en stelt je daarna vergelijkbare voertuigen voor.',
      },
      disponibilite: {
        question: 'Hoe werkt de beschikbaarheid van de voertuigen?',
        answer:
          'De partnerverhuurders beheren de beschikbaarheid live en die wordt voor jouw data gecontroleerd voordat je aanvraag wordt verstuurd. De getoonde prijs wordt met je aanvraag vastgelegd. Is het voertuig toch niet beschikbaar, dan stelt ClickDrive je vergelijkbare voertuigen voor.',
      },
      annulation: {
        question: 'Kan ik mijn reservering annuleren?',
        answer:
          'Elke verhuurder bepaalt zijn eigen annuleringsvoorwaarden, die kunnen afhangen van hoe lang voor het ophalen je annuleert. Controleer vóór het reserveren de voorwaarden van je aanvraag en vraag de verhuurder naar eventuele kosten.',
      },
      caution: {
        question: 'Met welke borg moet ik rekening houden?',
        answer:
          'De hoogte van de borg hangt vooral af van het voertuig, de verhuurder en de contractvoorwaarden. Ook de manier waarop de borg wordt betaald of geblokkeerd kan verschillen. Controleer altijd de voorwaarden van de verhuurder voordat je je reservering bevestigt.',
      },
      assurance: {
        question: 'Is de verzekering bij de prijs inbegrepen?',
        answer:
          'De verzekeringsvoorwaarden kunnen per voertuig en verhuurder verschillen; de getoonde prijs omvat dus niet automatisch alle dekkingen of opties. Bekijk de voorwaarden van het voertuig en vraag de verhuurder welke dekking in de prijs zit.',
      },
      aeroport: {
        question: 'Kan ik een auto ophalen op luchthaven Nador-Al Aroui?',
        answer:
          'Ja, als de verhuurder dat aanbiedt: bezorging op luchthaven Nador-Al Aroui of in de haven van Beni Ansar en eventuele kosten staan op de pagina van het voertuig. Vermeld je vluchtnummer of je overtocht in je aanvraag, zodat de verhuurder de afspraak bij je aankomst kan plannen.',
      },
      mre: {
        question: 'Is ClickDrive geschikt voor Marokkanen die in het buitenland wonen?',
        answer:
          'Ja. Het platform is er juist om het zoeken naar een voertuig voor of tijdens een verblijf in Nador makkelijker te maken. De diensten voor bezoekers uit het buitenland, de ophaaltijden, de regels bij vertraging van je vlucht en de nodige documenten verschillen wel per verhuurder.',
      },
      'agence-verifiee': {
        question: 'Wat betekent het label ‘Gecontroleerde verhuurder’?',
        answer:
          'Heeft een verhuurder het label ‘Gecontroleerde verhuurder’, dan heeft ClickDrive zijn inschrijving in het handelsregister, zijn beroepsverzekeringen en zijn vloot gecontroleerd.',
      },
      'devenir-partenaire': {
        question: 'Kan een verhuurder zich bij ClickDrive aansluiten?',
        answer:
          'Ja. Verhuurders die hun voertuigen op ClickDrive willen aanbieden, kunnen via de speciale pagina een samenwerking aanvragen. Na beoordeling van de gegevens kan de verhuurder volgens de voorwaarden van de dienst worden toegevoegd.',
      },
    },
  },
  ar: {
    ui: {
      eyebrow: 'مركز المساعدة',
      titleBefore: 'الأسئلة الشائعة',
      subtitle: 'البحث، الحجز، الضمان، الاستلام في الناظور: اعثر على الإجابات قبل كراء مركبتك.',
      searchLabel: 'ابحث في الأسئلة الشائعة',
      searchPlaceholder: 'الضمان، المطار، التأمين، الإلغاء…',
      clearSearch: 'مسح البحث',
      results: {
        zero: 'لا توجد إجابة عن «{query}»',
        one: 'إجابة واحدة عن «{query}»',
        two: 'إجابتان عن «{query}»',
        few: '{count} إجابات عن «{query}»',
        many: '{count} إجابة عن «{query}»',
        other: '{count} إجابة عن «{query}»',
      },
      allQuestions: 'جميع الأسئلة',
      themesAria: 'المواضيع',
      needAnswer: 'تحتاج إلى إجابة دقيقة؟',
      needAnswerText: 'يجيبك فريقنا عن أسئلتك حول حجزك.',
      contactUs: 'اتصل بنا',
      qaAria: 'الأسئلة والأجوبة',
      noMatchTitle: 'لا يوجد سؤال مطابق',
      noMatchText: 'جرّب كلمة أخرى أو اطرح سؤالك مباشرة على فريقنا.',
      seeAll: 'عرض جميع الأسئلة',
      moreTitle: 'لديك سؤال آخر؟',
      moreText: 'تصفح المركبات المتاحة أو تواصل مع فريقنا للحصول على معلومات تخص حجزك.',
      searchCar: 'ابحث عن سيارة',
      linkToQuestion: 'رابط هذا السؤال',
    },
    categories: {
      plateforme: 'المنصة',
      reservation: 'الحجز',
      tarifs: 'الضمان والتأمين',
      'prise-en-charge': 'الاستلام',
      agences: 'الوكالات الشريكة',
    },
    items: {
      fonctionnement: {
        question: 'كيف يعمل ClickDrive الناظور؟',
        answer:
          'ClickDrive منصة تعرض المركبات التي تقترحها عدة وكالات كراء في الناظور ونواحيها. تبحث عن مركبة، وتطلع على مواصفاتها وشروطها وسعرها، ثم ترسل طلبك مجاناً إلى الوكالة المعنية التي تؤكده.',
      },
      rechercher: {
        question: 'كيف أبحث عن سيارة؟',
        answer:
          'ابدأ بحثك من صفحة المركبات بإدخال تواريخك ومعاييرك. ثم يمكنك الاطلاع على الموديلات المتاحة ومقارنة مواصفاتها وفتح صفحة المركبة لمزيد من المعلومات.',
      },
      reserver: {
        question: 'كيف أحجز مركبة؟',
        answer:
          'بعد اختيار مركبة وتواريخك، انقر على «احجز هذه المركبة» وأكمل طلبك بمعلومات الاتصال؛ ويمكن تقديم وثيقة الهوية والرخصة لاحقاً بالأصل عند تسلم المفاتيح. يحيل ClickDrive طلبك إلى الوكالة الشريكة التي تؤكد التوفر. وإذا تأخرت في الرد، يذكّرها ClickDrive ثم يقترح عليك مركبات مماثلة.',
      },
      disponibilite: {
        question: 'كيف يُدار توفر المركبات؟',
        answer:
          'تدير الوكالات الشريكة التوفر مباشرة، ويتم التحقق منه لتواريخك قبل إرسال طلبك. ويُسجَّل السعر المعروض مع طلبك. وإذا تبيّن أن المركبة غير متاحة، يقترح عليك ClickDrive مركبات مماثلة.',
      },
      annulation: {
        question: 'هل يمكنني إلغاء حجزي؟',
        answer:
          'تحدد كل وكالة شروط الإلغاء الخاصة بها، وقد ترتبط بالمدة المتبقية قبل استلام المركبة. قبل الحجز، تحقق من الشروط المطبقة على طلبك واسأل الوكالة عن أي غرامات محتملة.',
      },
      caution: {
        question: 'ما مبلغ الضمان الذي يجب أن أتوقعه؟',
        answer:
          'يتوقف مبلغ الضمان خصوصاً على المركبة والوكالة وشروط العقد. وقد تختلف أيضاً طريقة دفعه أو حجزه. تحقق دائماً من الشروط التي تبلغك بها الوكالة قبل تأكيد حجزك.',
      },
      assurance: {
        question: 'هل التأمين مشمول في السعر؟',
        answer:
          'قد تختلف شروط التأمين حسب المركبة والوكالة، لذا لا يعني السعر المعروض أنه يشمل تلقائياً جميع الضمانات أو الخيارات. اطلع على شروط المركبة واسأل الوكالة عن التغطيات المشمولة في السعر.',
      },
      aeroport: {
        question: 'هل يمكنني استلام سيارة في مطار الناظور العروي؟',
        answer:
          'نعم، عندما تقترح الوكالة ذلك: يظهر التوصيل إلى مطار الناظور العروي أو ميناء بني انصار ورسومه المحتملة في صفحة المركبة. حدد رقم رحلتك أو رحلتك البحرية في طلبك لتحدد الوكالة موعد اللقاء عند وصولك.',
      },
      mre: {
        question: 'هل يناسب ClickDrive مغاربة العالم؟',
        answer:
          'نعم. صُممت المنصة خصوصاً لتسهيل البحث عن مركبة قبل الإقامة في الناظور أو خلالها. لكن الخدمات المقدمة للقادمين من الخارج ومواعيد الاستلام وشروط تأخر الرحلات والوثائق المطلوبة تختلف من وكالة إلى أخرى.',
      },
      'agence-verifiee': {
        question: 'ماذا تعني شارة «وكالة موثقة»؟',
        answer: 'عندما تحمل وكالة شارة «وكالة موثقة»، فهذا يعني أن ClickDrive تحققت من سجلها التجاري وتأميناتها المهنية وأسطولها.',
      },
      'devenir-partenaire': {
        question: 'هل يمكن لوكالة الانضمام إلى ClickDrive؟',
        answer:
          'نعم. يمكن لوكالات الكراء الراغبة في عرض مركباتها على ClickDrive تقديم طلب شراكة من الصفحة المخصصة. وبعد دراسة المعلومات المقدمة، يمكن إدماج الوكالة في المنصة وفق شروط الخدمة.',
      },
    },
  },
};
