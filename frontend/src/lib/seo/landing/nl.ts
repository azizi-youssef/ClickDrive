import type { LandingText } from './types';

const PROCESS = {
  question: 'Hoe werkt een reservering via ClickDrive?',
  answer:
    'Je stuurt gratis een aanvraag voor het gekozen voertuig en je data. De verhuurder controleert de beschikbaarheid en bevestigt; daarna teken je het contract en betaal je de huur en de borg rechtstreeks aan de verhuurder bij de sleuteloverdracht.',
};
const DOCUMENTS = {
  question: 'Welke documenten moet ik laten zien?',
  answer:
    'Een geldig rijbewijs en een identiteitsbewijs (identiteitskaart of paspoort), in het origineel bij de sleuteloverdracht. Elke verhuurder kan andere voorwaarden stellen (minimumleeftijd, aantal jaren rijbewijs): die staan op de pagina van het voertuig.',
};
const DELIVERY = {
  question: 'Kan de auto naar de luchthaven of de haven worden gebracht?',
  answer:
    'Ja, als de verhuurder dat aanbiedt: kies de ophaallocatie in je aanvraag. Eventuele bezorgkosten van de verhuurder staan op de pagina van het voertuig en op die van de verhuurder.',
};

export const nl: Record<string, LandingText> = {
  'location-voiture-nador': {
    h1: 'Auto huren in Nador: vergelijk de lokale verhuurders',
    title: 'Auto huren in Nador: verhuurders vergelijken',
    metaDescription:
      'Vergelijk de auto’s van de verhuurders in Nador: prijs per dag, voorwaarden en beschikbaarheid. Gratis aanvraag, betaling bij de verhuurder.',
    keywords: ['auto huren nador', 'goedkoop auto huren nador', 'autoverhuur nador', 'huurauto nador'],
    zoneName: 'Nador',
    introTitle: 'Alle partnerverhuurders in Nador op één plek',
    introText:
      'ClickDrive brengt de voertuigen van de partnerverhuurders in Nador samen. Vergelijk de prijs per dag, de borg en de voorwaarden van elk voertuig en verstuur je aanvraag gratis: de verhuurder bevestigt de beschikbaarheid.',
    faqs: [
      PROCESS,
      DOCUMENTS,
      {
        question: 'Hoe vind ik de beste prijs?',
        answer:
          'Vul je data in bij het zoeken: alleen voertuigen die de hele periode vrij zijn, verschijnen met hun prijs per dag. Sorteer op prijs en vergelijk de borg, de kilometers en de bezorgkosten op elke pagina.',
      },
    ],
  },
  'location-voiture-nador-aeroport': {
    h1: 'Auto huren op luchthaven Nador-Al Aroui (NDR)',
    title: 'Auto huren op luchthaven Nador Al-Aroui | ClickDrive',
    metaDescription:
      'Huur een auto bij aankomst op luchthaven Nador-Al Aroui (NDR) bij lokale verhuurders. Vergelijk prijzen en verstuur gratis je aanvraag.',
    keywords: ['auto huren luchthaven nador', 'autoverhuur luchthaven nador', 'al aroui luchthaven auto', 'NDR auto huren'],
    zoneName: 'Luchthaven Nador-Al Aroui',
    introTitle: 'Je auto bij aankomst van je vlucht',
    introText:
      'Kies luchthaven Nador-Al Aroui als ophaallocatie en vermeld je vluchtnummer in de aanvraag: de verhuurder bevestigt het tijdstip en de ontmoetingsplek met je.',
    faqs: [
      {
        question: 'Hoe gaat het ophalen op de luchthaven?',
        answer:
          'Je vermeldt je vluchtnummer en aankomsttijd in de aanvraag. Na bevestiging spreekt de verhuurder de ontmoetingsplek met je af; het contract en de inspectie van het voertuig gebeuren bij de sleuteloverdracht.',
      },
      DELIVERY,
      DOCUMENTS,
    ],
  },
  'location-voiture-beni-ansar': {
    h1: 'Auto huren in de haven van Beni Ansar (Nador)',
    title: 'Auto huren in de haven van Beni Ansar | ClickDrive',
    metaDescription:
      'Kom je met de ferry aan in de haven van Beni Ansar? Vergelijk de auto’s van de verhuurders in Nador en vraag ophalen in de haven aan.',
    keywords: ['auto huren beni ansar', 'auto huren haven nador', 'ferry beni ansar auto huren'],
    zoneName: 'Haven Beni Ansar',
    introTitle: 'Je auto zodra je van de ferry komt',
    introText:
      'Kom je met de boot, bijvoorbeeld uit Almería, Motril of Sète? Kies de haven van Beni Ansar als ophaallocatie en vermeld je overtocht in de aanvraag: de verhuurder bevestigt de afspraak.',
    faqs: [
      {
        question: 'Wat moet ik vermelden bij aankomst met de ferry?',
        answer:
          'De rederij, de overtocht en de verwachte aankomsttijd. De verhuurder gebruikt die om de afspraak te plannen; is de boot te laat, laat het dan via WhatsApp weten.',
      },
      {
        question: 'Kan ik de auto ergens anders dan in de haven inleveren?',
        answer:
          'De inleverlocatie kies je in de aanvraag; de verhuurder bevestigt of dat kan en noemt eventuele kosten vóór de reservering.',
      },
      DELIVERY,
    ],
  },
  'location-voiture-nador-suv': {
    h1: 'SUV huren in Nador',
    title: 'SUV huren in Nador: prijzen vergelijken | ClickDrive',
    metaDescription:
      'Vergelijk de SUV’s van de verhuurders in Nador: prijs per dag, borg en voorwaarden. Gratis aanvraag, betaling bij de verhuurder.',
    keywords: ['suv huren nador', '4x4 huren nador', 'suv nador'],
    zoneName: 'SUV’s in Nador',
    introTitle: 'Ruimte voor het gezin en de bagage',
    introText:
      'De SUV’s van de partnerverhuurders, met hun prijs per dag, versnellingsbak en borg. Vul je data in om alleen vrije voertuigen te zien.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-automatique': {
    h1: 'Automaat huren in Nador',
    title: 'Automaat huren in Nador | ClickDrive',
    metaDescription:
      'De auto’s met automatische versnellingsbak van de verhuurders in Nador: stadsauto’s, sedans en SUV’s. Vergelijk prijzen en vraag gratis aan.',
    keywords: ['automaat huren nador', 'auto huren automaat nador', 'automatische versnellingsbak nador'],
    zoneName: 'Automatische versnellingsbak',
    introTitle: 'Alle automaten in één oogopslag',
    introText: 'Hier staan alleen de auto’s met automatische versnellingsbak van de partnerverhuurders, met hun prijs per dag en voorwaarden.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-pas-cher': {
    h1: 'Goedkoop auto huren in Nador',
    title: 'Goedkoop auto huren in Nador | ClickDrive',
    metaDescription:
      'De voordelige auto’s van de verhuurders in Nador, van de laagste tot de hoogste prijs. Vergelijk de borg en voorwaarden voordat je aanvraagt.',
    keywords: ['goedkoop auto huren nador', 'voordelige huurauto nador', 'budget auto nador'],
    zoneName: 'Voordelige auto’s',
    introTitle: 'De voordelige stadsauto’s van de verhuurders in Nador',
    introText:
      'De auto’s in de categorie Voordelig, gesorteerd op prijs. De getoonde prijs is die van de verhuurder; vergelijk ook de borg en de kilometers op elke pagina.',
    faqs: [
      {
        question: 'Is de getoonde prijs de eindprijs?',
        answer:
          'Het is de prijs per dag van de verhuurder. Het geschatte totaal van je aanvraag past die toe op je data; opties en eventuele bezorgkosten, vermeld op de pagina, komen erbij en betaal je bij de verhuurder.',
      },
      PROCESS,
    ],
  },
  'location-voiture-luxe-nador': {
    h1: 'Luxe auto huren in Nador',
    title: 'Luxe auto huren in Nador | ClickDrive',
    metaDescription:
      'De luxe auto’s van de verhuurders in Nador: prijs per dag, borg en voorwaarden. Gratis aanvraag, contract met de verhuurder.',
    keywords: ['luxe auto huren nador', 'premium auto huren nador', 'luxe huurauto nador'],
    zoneName: 'Luxe auto’s',
    introTitle: 'Het topsegment van de partnerverhuurders',
    introText:
      'De voertuigen die de partnerverhuurders als Luxe hebben ingedeeld. De borg is bij deze modellen hoger: het bedrag staat op elke pagina.',
    faqs: [
      {
        question: 'Waarom is de borg hoger?',
        answer:
          'Elke verhuurder stelt de borg vast op basis van de waarde van het voertuig. Het bedrag staat op de pagina vóór je aanvraag en betaal je bij de verhuurder bij de sleuteloverdracht.',
      },
      DOCUMENTS,
    ],
  },
  'location-voiture-nador-longue-duree': {
    h1: 'Auto huren per week of per maand in Nador',
    title: 'Auto huren voor lange termijn in Nador | ClickDrive',
    metaDescription:
      'Huur een auto in Nador voor een week, een maand of de hele zomer: week- en maandtarieven van de verhuurders worden automatisch toegepast.',
    keywords: ['auto huren lange termijn nador', 'auto huren per maand nador', 'auto huren per week nador'],
    zoneName: 'Lange termijn',
    introTitle: 'Week- en maandtarieven automatisch toegepast',
    introText:
      'Biedt een verhuurder een week- of maandtarief aan, dan geldt dat vanaf 7 of 30 huurdagen voor je geschatte totaal. Voertuigen met zo’n tarief tonen het op hun pagina.',
    faqs: [
      {
        question: 'Hoe wordt het weektarief toegepast?',
        answer:
          'Vanaf 7 huurdagen wordt het weektarief van de verhuurder omgerekend naar een dagprijs; vanaf 30 dagen het maandtarief. Biedt de verhuurder die niet aan, dan geldt de prijs per dag.',
      },
      PROCESS,
    ],
  },
  'location-voiture-nador-ete': {
    h1: 'Auto huren in Nador voor de zomer',
    title: 'Auto huren Nador in de zomer: boek vroeg',
    metaDescription:
      'Deze zomer naar Marokko? Boek je auto in Nador op tijd, op de luchthaven of in de haven van Beni Ansar, met de week- en maandtarieven.',
    keywords: ['auto huren nador zomer', 'auto huren nador augustus', 'auto huren nador vakantie', 'auto huren haven nador zomer'],
    zoneName: 'Zomer in Nador',
    introTitle: 'Op vakantie naar huis: boek vóór de piek van juli en augustus',
    introText:
      'In de zomer zijn de auto’s snel weg. Verstuur je aanvraag zodra je data vastliggen: ophalen op luchthaven Nador-Al Aroui of in de haven van Beni Ansar, week- of maandtarief automatisch toegepast als de verhuurder dat aanbiedt.',
    faqs: [
      {
        question: 'Hoe ver vooruit moet ik voor de zomer boeken?',
        answer:
          'Zodra je je data kent: de zoekfunctie toont alleen voertuigen die je hele periode vrij zijn, en een aanvraag verplicht je tot niets zolang de verhuurder die niet heeft bevestigd.',
      },
      {
        question: 'Ik kom met de ferry: wat moet ik vermelden?',
        answer:
          'Kies de haven van Beni Ansar als ophaallocatie en vermeld de rederij, de overtocht en de verwachte aankomsttijd in je aanvraag.',
      },
      DELIVERY,
    ],
  },
  'location-scooter-moto-nador': {
    h1: 'Scooter en motor huren in Nador',
    title: 'Scooter en motor huren in Nador | ClickDrive',
    metaDescription:
      'De scooters en motoren van de verhuurders in Nador: cilinderinhoud, vereist rijbewijs, prijs per dag en borg. Gratis aanvraag, betaling ter plaatse.',
    keywords: ['scooter huren nador', 'motor huren nador', 'scooter nador'],
    zoneName: 'Scooters en motoren',
    introTitle: 'Tweewielers: controleer het vereiste rijbewijs',
    introText:
      'Elke pagina vermeldt de cilinderinhoud en het rijbewijs dat de verhuurder vraagt. Toon dat rijbewijs in het origineel bij het ophalen.',
    faqs: [
      {
        question: 'Welk rijbewijs heb ik nodig voor een scooter of motor?',
        answer:
          'Dat hangt af van de cilinderinhoud en de verhuurder: het vereiste rijbewijs staat op elke pagina. Bij twijfel bevestigt de verhuurder het in zijn antwoord op je aanvraag.',
      },
      PROCESS,
    ],
  },
  'guide-caution-location-voiture-nador': {
    h1: 'Borg bij autohuur in Nador: de gids',
    title: 'Borg bij autohuur in Nador: de gids | ClickDrive',
    metaDescription:
      'Bedrag, betaling, terugbetaling: wat je moet weten over de borg voordat je in Nador een auto huurt bij een lokale verhuurder.',
    keywords: ['borg auto huren nador', 'borg autohuur marokko', 'waarborgsom huurauto'],
    zoneName: 'Gids: de borg',
    introTitle: 'Alles over de borg voordat je reserveert',
    introText:
      'De borg dekt de verhuurder bij schade of te late inlevering. Het bedrag hangt af van het voertuig en staat op elke pagina van ClickDrive vóór je aanvraag.',
    sections: [
      {
        title: 'Hoeveel?',
        paragraphs: [
          'Elke verhuurder stelt de borg vast per voertuig: voor een SUV of een luxe voertuig is die meestal hoger. Het exacte bedrag staat op de pagina van het voertuig en in het overzicht van je aanvraag.',
        ],
      },
      {
        title: 'Hoe betaal je de borg?',
        paragraphs: [
          'De borg betaal je bij de verhuurder bij de sleuteloverdracht, op de manier die hij aanbiedt (blokkering op je kaart, cheque of anders). Vraag het de verhuurder vóór je vertrek als je een voorkeur hebt.',
        ],
      },
      {
        title: 'Wanneer krijg je hem terug?',
        paragraphs: [
          'Bij het inleveren, na de inspectie, volgens het contract van de verhuurder. Controleer samen het voertuig, de brandstof en eventuele schade, en bewaar een kopie van het inspectierapport.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Betaal ik de borg via ClickDrive?',
        answer: 'Nee. De borg en de huur betaal je rechtstreeks aan de verhuurder; ClickDrive stuurt je aanvraag door en laat je zijn antwoord weten.',
      },
      DOCUMENTS,
    ],
  },
  'guide-documents-location-voiture-maroc': {
    h1: 'Documenten om een auto te huren in Marokko: de gids',
    title: 'Documenten voor autohuur in Marokko | ClickDrive',
    metaDescription:
      'Rijbewijs, identiteitsbewijs, minimumleeftijd: de documenten om een auto te huren in Nador en wat per verhuurder verschilt.',
    keywords: ['documenten autohuur marokko', 'rijbewijs auto huren marokko', 'minimumleeftijd auto huren nador'],
    zoneName: 'Gids: de documenten',
    introTitle: 'Leg je documenten klaar vóór de sleuteloverdracht',
    introText:
      'Bij ClickDrive kun je een aanvraag versturen zonder de nummers van je documenten: de originelen laat je bij de sleuteloverdracht aan de verhuurder zien.',
    sections: [
      {
        title: 'De documenten die je laat zien',
        paragraphs: [
          'Een rijbewijs dat de hele huurperiode geldig is, en een identiteitsbewijs: identiteitskaart of paspoort. De verhuurder controleert de originelen voordat het contract wordt getekend.',
        ],
      },
      {
        title: 'Wat per verhuurder verschilt',
        paragraphs: [
          'De minimumleeftijd, het aantal jaren rijbewijs of het rijbewijs voor een tweewieler bepaalt elke verhuurder zelf. Heeft hij ze ingevuld, dan staan ze op de pagina van het voertuig.',
          'Rijd je met een buitenlands rijbewijs, vraag de verhuurder dan vóór je aankomst of hij ook een internationaal rijbewijs wil zien.',
        ],
      },
    ],
    faqs: [DOCUMENTS, PROCESS],
  },
  'guide-arrivee-aeroport-port-nador': {
    h1: 'Met vliegtuig of ferry in Nador aankomen: je auto ophalen',
    title: 'Aankomst in Nador per vliegtuig of ferry | ClickDrive',
    metaDescription:
      'Luchthaven Nador-Al Aroui of haven Beni Ansar: zo vraag je de overdracht van je huurauto bij aankomst aan.',
    keywords: ['aankomst luchthaven nador auto', 'aankomst haven beni ansar auto', 'auto huren bij aankomst nador'],
    zoneName: 'Gids: de aankomst',
    introTitle: 'Het ophalen regel je in je aanvraag',
    introText:
      'Of je nu aankomt op luchthaven Nador-Al Aroui of in de haven van Beni Ansar: vermeld de ophaallocatie en je aankomsttijd, de verhuurder bevestigt de afspraak.',
    sections: [
      {
        title: 'Met het vliegtuig: luchthaven Nador-Al Aroui (NDR)',
        paragraphs: [
          'Kies de luchthaven als ophaallocatie en vermeld je vluchtnummer en aankomsttijd. De verhuurder spreekt de ontmoetingsplek met je af.',
        ],
      },
      {
        title: 'Met de ferry: haven Beni Ansar',
        paragraphs: [
          'Kies de haven als ophaallocatie en vermeld de rederij, de overtocht en de verwachte aankomsttijd. Is de boot te laat, laat het de verhuurder dan via WhatsApp weten.',
        ],
      },
      {
        title: 'Bezorgkosten',
        paragraphs: [
          'Rekent een verhuurder kosten voor bezorging op de luchthaven of in de haven, dan staat het bedrag op de pagina van het voertuig en op zijn pagina; je betaalt het samen met de huur bij de verhuurder.',
        ],
      },
    ],
    faqs: [DELIVERY, DOCUMENTS],
  },
};
