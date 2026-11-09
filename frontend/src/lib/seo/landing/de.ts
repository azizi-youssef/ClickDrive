import type { LandingText } from './types';

const PROCESS = {
  question: 'Wie funktioniert eine Buchung bei ClickDrive?',
  answer:
    'Sie senden kostenlos eine Anfrage für das gewählte Fahrzeug und Ihre Daten. Der Vermieter prüft die Verfügbarkeit und bestätigt; anschließend unterschreiben Sie den Vertrag und zahlen Miete und Kaution bei der Schlüsselübergabe direkt beim Vermieter.',
};
const DOCUMENTS = {
  question: 'Welche Dokumente muss ich vorlegen?',
  answer:
    'Einen gültigen Führerschein und einen Ausweis (Personalausweis oder Reisepass), im Original bei der Schlüsselübergabe. Jeder Vermieter kann weitere Bedingungen festlegen (Mindestalter, Führerscheinbesitz): Sie stehen auf der Fahrzeugseite.',
};
const DELIVERY = {
  question: 'Kann das Auto zum Flughafen oder zum Hafen gebracht werden?',
  answer:
    'Ja, wenn der Vermieter es anbietet: Wählen Sie den Abholort in Ihrer Anfrage. Eventuelle Zustellkosten des Vermieters stehen auf der Fahrzeug- und auf der Vermieterseite.',
};

export const de: Record<string, LandingText> = {
  'location-voiture-nador': {
    h1: 'Mietwagen in Nador: lokale Vermieter vergleichen',
    title: 'Mietwagen in Nador: Vermieter vergleichen | ClickDrive',
    metaDescription:
      'Vergleichen Sie die Autos der Vermieter in Nador: Preis pro Tag, Bedingungen und Verfügbarkeit. Kostenlose Anfrage, Zahlung beim Vermieter.',
    keywords: ['mietwagen nador', 'auto mieten nador', 'günstiger mietwagen nador', 'autovermietung nador'],
    zoneName: 'Nador',
    introTitle: 'Alle Partnervermieter in Nador an einem Ort',
    introText:
      'ClickDrive bündelt die Fahrzeuge der Partnervermieter in Nador. Vergleichen Sie Tagespreis, Kaution und Bedingungen jedes Fahrzeugs und senden Sie Ihre Anfrage kostenlos: Der Vermieter bestätigt die Verfügbarkeit.',
    faqs: [
      PROCESS,
      DOCUMENTS,
      {
        question: 'Wie finde ich den besten Preis?',
        answer:
          'Geben Sie Ihre Daten in der Suche ein: Es werden nur Fahrzeuge angezeigt, die im ganzen Zeitraum frei sind, mit ihrem Tagespreis. Sortieren Sie nach Preis und vergleichen Sie Kaution, Kilometer und Zustellkosten auf jeder Fahrzeugseite.',
      },
    ],
  },
  'location-voiture-nador-aeroport': {
    h1: 'Mietwagen am Flughafen Nador-Al Aroui (NDR)',
    title: 'Mietwagen am Flughafen Nador Al-Aroui | ClickDrive',
    metaDescription:
      'Mieten Sie bei Ihrer Ankunft am Flughafen Nador-Al Aroui (NDR) ein Auto bei lokalen Vermietern. Preise vergleichen, kostenlos anfragen.',
    keywords: ['mietwagen flughafen nador', 'auto mieten flughafen nador', 'flughafen al aroui mietwagen', 'NDR mietwagen'],
    zoneName: 'Flughafen Nador-Al Aroui',
    introTitle: 'Ihr Auto bei der Ankunft Ihres Flugs',
    introText:
      'Wählen Sie den Flughafen Nador-Al Aroui als Abholort und geben Sie Ihre Flugnummer in der Anfrage an: Der Vermieter bestätigt Uhrzeit und Treffpunkt mit Ihnen.',
    faqs: [
      {
        question: 'Wie läuft die Abholung am Flughafen ab?',
        answer:
          'Sie geben Flugnummer und Ankunftszeit in der Anfrage an. Nach der Bestätigung vereinbart der Vermieter den Treffpunkt mit Ihnen; Vertrag und Fahrzeugprotokoll folgen bei der Schlüsselübergabe.',
      },
      DELIVERY,
      DOCUMENTS,
    ],
  },
  'location-voiture-beni-ansar': {
    h1: 'Mietwagen am Hafen Beni Ansar (Nador)',
    title: 'Mietwagen am Hafen Beni Ansar, Nador | ClickDrive',
    metaDescription:
      'Sie kommen mit der Fähre im Hafen Beni Ansar an? Vergleichen Sie die Autos der Vermieter in Nador und fragen Sie die Abholung am Hafen an.',
    keywords: ['mietwagen beni ansar', 'mietwagen hafen nador', 'fähre beni ansar mietwagen'],
    zoneName: 'Hafen Beni Ansar',
    introTitle: 'Ihr Auto direkt nach der Fähre',
    introText:
      'Sie kommen mit dem Schiff, etwa aus Almería, Motril oder Sète? Wählen Sie den Hafen Beni Ansar als Abholort und geben Sie Ihre Überfahrt in der Anfrage an: Der Vermieter bestätigt den Treffpunkt.',
    faqs: [
      {
        question: 'Was muss ich bei einer Ankunft mit der Fähre angeben?',
        answer:
          'Reederei, Überfahrt und voraussichtliche Ankunftszeit. Der Vermieter legt damit den Treffpunkt fest; bei Verspätung der Fähre informieren Sie ihn per WhatsApp.',
      },
      {
        question: 'Kann ich das Auto woanders als am Hafen zurückgeben?',
        answer:
          'Den Rückgabeort wählen Sie in der Anfrage; der Vermieter bestätigt, ob das möglich ist, und nennt eventuelle Kosten vor der Buchung.',
      },
      DELIVERY,
    ],
  },
  'location-voiture-nador-suv': {
    h1: 'SUV mieten in Nador',
    title: 'SUV mieten in Nador: Preise vergleichen | ClickDrive',
    metaDescription:
      'Vergleichen Sie die SUVs der Vermieter in Nador: Preis pro Tag, Kaution und Bedingungen. Kostenlose Anfrage, Zahlung beim Vermieter.',
    keywords: ['suv mieten nador', '4x4 mieten nador', 'suv nador'],
    zoneName: 'SUVs in Nador',
    introTitle: 'Platz für Familie und Gepäck',
    introText:
      'Die SUVs der Partnervermieter mit Tagespreis, Getriebe und Kaution. Geben Sie Ihre Daten ein, um nur freie Fahrzeuge zu sehen.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-automatique': {
    h1: 'Automatik-Mietwagen in Nador',
    title: 'Automatik-Mietwagen in Nador | ClickDrive',
    metaDescription:
      'Autos mit Automatikgetriebe der Vermieter in Nador: Kleinwagen, Limousinen und SUVs. Preise vergleichen und kostenlos anfragen.',
    keywords: ['automatik mietwagen nador', 'auto mit automatik mieten nador', 'automatikgetriebe nador'],
    zoneName: 'Automatikgetriebe',
    introTitle: 'Alle Automatikautos auf einen Blick',
    introText: 'Hier stehen nur Autos mit Automatikgetriebe der Partnervermieter, mit Tagespreis und Bedingungen.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-pas-cher': {
    h1: 'Günstiger Mietwagen in Nador',
    title: 'Günstiger Mietwagen in Nador | ClickDrive',
    metaDescription:
      'Die günstigen Autos der Vermieter in Nador, vom niedrigsten zum höchsten Preis. Vergleichen Sie Kaution und Bedingungen vor Ihrer Anfrage.',
    keywords: ['günstiger mietwagen nador', 'billig auto mieten nador', 'economy mietwagen nador'],
    zoneName: 'Günstige Autos',
    introTitle: 'Die günstigen Kleinwagen der Vermieter in Nador',
    introText:
      'Die Autos der Kategorie Economy, nach Preis sortiert. Der angezeigte Preis ist der des Vermieters; vergleichen Sie auch Kaution und Kilometer auf jeder Fahrzeugseite.',
    faqs: [
      {
        question: 'Ist der angezeigte Preis der Endpreis?',
        answer:
          'Es ist der vom Vermieter festgelegte Tagespreis. Der geschätzte Gesamtpreis Ihrer Anfrage wendet ihn auf Ihre Daten an; Optionen und eventuelle Zustellkosten, die auf der Fahrzeugseite stehen, kommen hinzu und werden beim Vermieter bezahlt.',
      },
      PROCESS,
    ],
  },
  'location-voiture-luxe-nador': {
    h1: 'Luxus-Mietwagen in Nador',
    title: 'Luxus-Mietwagen in Nador | ClickDrive',
    metaDescription:
      'Die Oberklasse-Autos der Vermieter in Nador: Preis pro Tag, Kaution und Bedingungen. Kostenlose Anfrage, Vertrag mit dem Vermieter.',
    keywords: ['luxus mietwagen nador', 'premium auto mieten nador', 'oberklasse mietwagen nador'],
    zoneName: 'Luxusautos',
    introTitle: 'Die Oberklasse der Partnervermieter',
    introText:
      'Die von den Partnervermietern als Luxus eingestuften Fahrzeuge. Die Kaution ist bei diesen Modellen höher: Ihr Betrag steht auf jeder Fahrzeugseite.',
    faqs: [
      {
        question: 'Warum ist die Kaution höher?',
        answer:
          'Jeder Vermieter legt die Kaution nach dem Wert des Fahrzeugs fest. Der Betrag steht vor Ihrer Anfrage auf der Fahrzeugseite und wird bei der Schlüsselübergabe beim Vermieter bezahlt.',
      },
      DOCUMENTS,
    ],
  },
  'location-voiture-nador-longue-duree': {
    h1: 'Auto für eine Woche oder einen Monat in Nador mieten',
    title: 'Langzeitmiete Auto in Nador | ClickDrive',
    metaDescription:
      'Mieten Sie ein Auto in Nador für eine Woche, einen Monat oder den ganzen Sommer: Wochen- und Monatspreise der Vermieter automatisch angewendet.',
    keywords: ['langzeitmiete auto nador', 'auto monatlich mieten nador', 'mietwagen woche nador'],
    zoneName: 'Langzeitmiete',
    introTitle: 'Wochen- und Monatspreise automatisch angewendet',
    introText:
      'Bietet ein Vermieter einen Wochen- oder Monatspreis an, gilt er ab 7 bzw. 30 Miettagen für Ihren geschätzten Gesamtpreis. Fahrzeuge mit solchem Preis zeigen ihn auf ihrer Seite.',
    faqs: [
      {
        question: 'Wie wird der Wochenpreis angewendet?',
        answer:
          'Ab 7 Miettagen wird der Wochenpreis des Vermieters auf den Tag umgerechnet, ab 30 Tagen sein Monatspreis. Bietet der Vermieter keinen an, gilt der Tagespreis.',
      },
      PROCESS,
    ],
  },
  'location-voiture-nador-ete': {
    h1: 'Mietwagen für den Sommer in Nador',
    title: 'Mietwagen Nador im Sommer: früh buchen | ClickDrive',
    metaDescription:
      'Heimaturlaub im Sommer? Buchen Sie Ihr Auto in Nador früh, am Flughafen oder im Hafen Beni Ansar, mit Wochen- und Monatspreisen der Vermieter.',
    keywords: ['mietwagen nador sommer', 'mietwagen nador august', 'auto mieten nador urlaub', 'mietwagen hafen nador sommer'],
    zoneName: 'Sommer in Nador',
    introTitle: 'Heimaturlaub: vor der Spitze im Juli und August buchen',
    introText:
      'Im Sommer sind die Autos schnell weg. Senden Sie Ihre Anfrage, sobald Ihre Daten feststehen: Abholung am Flughafen Nador-Al Aroui oder im Hafen Beni Ansar, Wochen- oder Monatspreis automatisch angewendet, wenn der Vermieter einen anbietet.',
    faqs: [
      {
        question: 'Wie früh sollte ich für den Sommer buchen?',
        answer:
          'Sobald Sie Ihre Daten kennen: Die Suche zeigt nur Fahrzeuge, die im ganzen Zeitraum frei sind, und eine Anfrage bindet Sie erst, wenn der Vermieter sie bestätigt hat.',
      },
      {
        question: 'Ich komme mit der Fähre: Was muss ich angeben?',
        answer:
          'Wählen Sie den Hafen Beni Ansar als Abholort und geben Sie Reederei, Überfahrt und voraussichtliche Ankunftszeit in Ihrer Anfrage an.',
      },
      DELIVERY,
    ],
  },
  'location-scooter-moto-nador': {
    h1: 'Roller und Motorrad mieten in Nador',
    title: 'Roller und Motorrad mieten in Nador | ClickDrive',
    metaDescription:
      'Die Roller und Motorräder der Vermieter in Nador: Hubraum, Führerscheinklasse, Preis pro Tag und Kaution. Kostenlose Anfrage, Zahlung vor Ort.',
    keywords: ['roller mieten nador', 'motorrad mieten nador', 'scooter nador'],
    zoneName: 'Roller und Motorräder',
    introTitle: 'Zweiräder: Führerscheinklasse prüfen',
    introText:
      'Jede Fahrzeugseite nennt Hubraum und den vom Vermieter verlangten Führerschein. Legen Sie diesen Führerschein bei der Übergabe im Original vor.',
    faqs: [
      {
        question: 'Welchen Führerschein brauche ich für einen Roller oder ein Motorrad?',
        answer:
          'Das hängt vom Hubraum und vom Vermieter ab: Der verlangte Führerschein steht auf jeder Fahrzeugseite. Im Zweifel bestätigt ihn der Vermieter in seiner Antwort auf Ihre Anfrage.',
      },
      PROCESS,
    ],
  },
  'guide-caution-location-voiture-nador': {
    h1: 'Kaution für den Mietwagen in Nador: der Ratgeber',
    title: 'Kaution für Mietwagen in Nador | ClickDrive',
    metaDescription:
      'Höhe, Hinterlegung, Rückzahlung: Was Sie über die Kaution wissen sollten, bevor Sie in Nador bei einem lokalen Vermieter ein Auto mieten.',
    keywords: ['kaution mietwagen nador', 'kaution mietwagen marokko', 'mietwagen sicherheitsleistung'],
    zoneName: 'Ratgeber: die Kaution',
    introTitle: 'Alles zur Kaution vor der Buchung',
    introText:
      'Die Kaution sichert den Vermieter bei Schäden oder verspäteter Rückgabe ab. Ihre Höhe hängt vom Fahrzeug ab und steht vor Ihrer Anfrage auf jeder Fahrzeugseite von ClickDrive.',
    sections: [
      {
        title: 'Wie hoch?',
        paragraphs: [
          'Jeder Vermieter legt die Kaution je nach Fahrzeug fest: Für einen SUV oder ein Oberklassefahrzeug ist sie meist höher. Der genaue Betrag steht auf der Fahrzeugseite und in der Übersicht Ihrer Anfrage.',
        ],
      },
      {
        title: 'Wie wird sie hinterlegt?',
        paragraphs: [
          'Die Kaution wird bei der Schlüsselübergabe beim Vermieter hinterlegt, auf die von ihm angebotene Art (Kartenreservierung, Scheck oder anders). Fragen Sie den Vermieter vor der Anreise, wenn Sie eine Vorliebe haben.',
        ],
      },
      {
        title: 'Wann wird sie zurückgezahlt?',
        paragraphs: [
          'Bei der Rückgabe, nach dem Rückgabeprotokoll, gemäß dem Vertrag des Vermieters. Prüfen Sie gemeinsam Fahrzeug, Tankfüllung und eventuelle Schäden und behalten Sie eine Kopie des Protokolls.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Wird die Kaution über ClickDrive bezahlt?',
        answer: 'Nein. Kaution und Miete werden direkt beim Vermieter bezahlt; ClickDrive leitet Ihre Anfrage weiter und teilt Ihnen seine Antwort mit.',
      },
      DOCUMENTS,
    ],
  },
  'guide-documents-location-voiture-maroc': {
    h1: 'Dokumente für die Automiete in Marokko: der Ratgeber',
    title: 'Dokumente für die Automiete in Marokko | ClickDrive',
    metaDescription:
      'Führerschein, Ausweis, Mindestalter: die Dokumente für die Automiete in Nador und was vom jeweiligen Vermieter abhängt.',
    keywords: ['dokumente mietwagen marokko', 'führerschein mietwagen marokko', 'mindestalter mietwagen nador'],
    zoneName: 'Ratgeber: die Dokumente',
    introTitle: 'Dokumente vor der Schlüsselübergabe bereitlegen',
    introText:
      'Bei ClickDrive können Sie eine Anfrage ohne Ihre Dokumentennummern senden: Die Originale zeigen Sie dem Vermieter bei der Schlüsselübergabe.',
    sections: [
      {
        title: 'Die vorzulegenden Dokumente',
        paragraphs: [
          'Ein Führerschein, der während der ganzen Mietdauer gültig ist, und ein Ausweis: Personalausweis oder Reisepass. Der Vermieter prüft die Originale vor der Vertragsunterzeichnung.',
        ],
      },
      {
        title: 'Was vom Vermieter abhängt',
        paragraphs: [
          'Mindestalter, Führerscheinbesitz oder die Führerscheinklasse für ein Zweirad legt jeder Vermieter fest. Wenn er sie angegeben hat, stehen sie auf der Fahrzeugseite.',
          'Fahren Sie mit einem ausländischen Führerschein, fragen Sie den Vermieter vor Ihrer Ankunft, ob er zusätzlich einen internationalen Führerschein verlangt.',
        ],
      },
    ],
    faqs: [DOCUMENTS, PROCESS],
  },
  'guide-arrivee-aeroport-port-nador': {
    h1: 'Ankunft in Nador per Flugzeug oder Fähre: das Auto abholen',
    title: 'Ankunft in Nador per Flugzeug oder Fähre | ClickDrive',
    metaDescription:
      'Flughafen Nador-Al Aroui oder Hafen Beni Ansar: So fragen Sie die Übergabe Ihres Mietwagens bei Ihrer Ankunft an.',
    keywords: ['ankunft flughafen nador mietwagen', 'ankunft hafen beni ansar auto', 'mietwagen bei ankunft nador'],
    zoneName: 'Ratgeber: die Ankunft',
    introTitle: 'Die Abholung wird in Ihrer Anfrage vorbereitet',
    introText:
      'Ob Sie am Flughafen Nador-Al Aroui oder im Hafen Beni Ansar ankommen: Geben Sie Abholort und Ankunftszeit an, der Vermieter bestätigt den Treffpunkt.',
    sections: [
      {
        title: 'Mit dem Flugzeug: Flughafen Nador-Al Aroui (NDR)',
        paragraphs: [
          'Wählen Sie den Flughafen als Abholort und geben Sie Flugnummer und Ankunftszeit an. Der Vermieter vereinbart den Treffpunkt mit Ihnen.',
        ],
      },
      {
        title: 'Mit der Fähre: Hafen Beni Ansar',
        paragraphs: [
          'Wählen Sie den Hafen als Abholort und geben Sie Reederei, Überfahrt und voraussichtliche Ankunftszeit an. Bei Verspätung der Fähre informieren Sie den Vermieter per WhatsApp.',
        ],
      },
      {
        title: 'Zustellkosten',
        paragraphs: [
          'Berechnet ein Vermieter die Zustellung zum Flughafen oder Hafen, steht der Betrag auf der Fahrzeugseite und auf seiner Seite; er wird mit der Miete beim Vermieter bezahlt.',
        ],
      },
    ],
    faqs: [DELIVERY, DOCUMENTS],
  },
};
