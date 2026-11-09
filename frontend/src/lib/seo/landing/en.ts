import type { LandingText } from './types';

const PROCESS = {
  question: 'How does a booking on ClickDrive work?',
  answer:
    'You send a free request for the vehicle and dates you have chosen. The agency checks availability and confirms; you then sign the contract and pay the rental and deposit directly to the agency when you collect the keys.',
};
const DOCUMENTS = {
  question: 'Which documents do I need to show?',
  answer:
    'A valid driving licence and an ID (national ID card or passport), shown in the original at the key handover. Each agency may set other conditions (minimum age, years of driving): they are listed on the vehicle page.',
};
const DELIVERY = {
  question: 'Can the car be delivered to the airport or the port?',
  answer:
    'Yes, when the agency offers it: choose the pickup location in your request. Any delivery fee set by the agency is shown on the vehicle page and on the agency page.',
};

export const en: Record<string, LandingText> = {
  'location-voiture-nador': {
    h1: 'Car rental in Nador: compare local agencies',
    title: 'Car rental in Nador: compare agencies | ClickDrive',
    metaDescription:
      'Compare cars from rental agencies in Nador: price per day, conditions and availability. Free request, payment to the agency.',
    keywords: ['car rental nador', 'cheap car rental nador', 'rent a car nador', 'nador car hire'],
    zoneName: 'Nador',
    introTitle: 'All partner agencies in Nador in one place',
    introText:
      'ClickDrive brings together the vehicles of partner rental agencies in Nador. Compare the price per day, the deposit and the conditions of each vehicle, then send your request free of charge: the agency confirms availability.',
    faqs: [
      PROCESS,
      DOCUMENTS,
      {
        question: 'How do I find the best price?',
        answer:
          'Enter your dates in the search: only vehicles free for the whole period are shown, with their price per day. Sort by price and compare the deposit, mileage and delivery fees on each vehicle page.',
      },
    ],
  },
  'location-voiture-nador-aeroport': {
    h1: 'Car rental at Nador-Al Aroui airport (NDR)',
    title: 'Car rental at Nador Al-Aroui airport | ClickDrive',
    metaDescription:
      'Rent a car on arrival at Nador-Al Aroui airport (NDR) from local agencies. Compare prices and send your request free of charge.',
    keywords: ['car rental nador airport', 'nador airport car hire', 'al aroui airport car rental', 'NDR car rental'],
    zoneName: 'Nador-Al Aroui airport',
    introTitle: 'Your car when your flight lands',
    introText:
      'Choose Nador-Al Aroui airport as the pickup location and add your flight number to the request: the agency confirms the time and meeting point with you.',
    faqs: [
      {
        question: 'How does pickup at the airport work?',
        answer:
          'You give your flight number and arrival time in the request. Once confirmed, the agency agrees the meeting point with you; the contract and the vehicle check are done at the key handover.',
      },
      DELIVERY,
      DOCUMENTS,
    ],
  },
  'location-voiture-beni-ansar': {
    h1: 'Car rental at Beni Ansar port (Nador)',
    title: 'Car rental at Beni Ansar port, Nador | ClickDrive',
    metaDescription:
      'Arriving by ferry at Beni Ansar port? Compare cars from Nador’s agencies and ask for pickup at the port. Free request.',
    keywords: ['car rental beni ansar', 'car rental nador port', 'beni ansar ferry car hire'],
    zoneName: 'Beni Ansar port',
    introTitle: 'Your car as you leave the ferry',
    introText:
      'Arriving by boat, for example from Almería, Motril or Sète? Choose Beni Ansar port as the pickup location and give your crossing in the request: the agency confirms the meeting.',
    faqs: [
      {
        question: 'What should I give for a ferry arrival?',
        answer:
          'The ferry company, the crossing and the expected arrival time. The agency uses them to set the meeting; if the ferry is late, let it know on WhatsApp.',
      },
      {
        question: 'Can I return the car somewhere other than the port?',
        answer:
          'You choose the return location in the request; the agency confirms whether it is possible and gives any fees before the booking.',
      },
      DELIVERY,
    ],
  },
  'location-voiture-nador-suv': {
    h1: 'SUV rental in Nador',
    title: 'SUV rental in Nador: compare prices | ClickDrive',
    metaDescription:
      'Compare the SUVs offered by rental agencies in Nador: price per day, deposit and conditions. Free request, payment to the agency.',
    keywords: ['suv rental nador', '4x4 rental nador', 'suv hire nador'],
    zoneName: 'SUVs in Nador',
    introTitle: 'Room for the family and the luggage',
    introText:
      'The SUVs of partner agencies, with their price per day, gearbox and deposit. Enter your dates to see only the vehicles that are free.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-automatique': {
    h1: 'Automatic car rental in Nador',
    title: 'Automatic car rental in Nador | ClickDrive',
    metaDescription:
      'Automatic cars from rental agencies in Nador: city cars, saloons and SUVs. Compare prices and send your request free of charge.',
    keywords: ['automatic car rental nador', 'automatic car hire nador', 'nador automatic gearbox'],
    zoneName: 'Automatic gearbox',
    introTitle: 'Every automatic car at a glance',
    introText: 'Only cars with an automatic gearbox from partner agencies are listed here, with their price per day and conditions.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-pas-cher': {
    h1: 'Cheap car rental in Nador',
    title: 'Cheap car rental in Nador | ClickDrive',
    metaDescription:
      'Economy cars from Nador’s agencies, from the lowest price to the highest. Compare the deposit and conditions before sending your request.',
    keywords: ['cheap car rental nador', 'budget car hire nador', 'economy car nador'],
    zoneName: 'Economy cars',
    introTitle: 'Economy city cars from Nador’s agencies',
    introText:
      'Cars in the Economy category, sorted by price. The price shown is the agency’s; also compare the deposit and mileage on each vehicle page.',
    faqs: [
      {
        question: 'Is the price shown the final price?',
        answer:
          'It is the price per day set by the agency. The estimated total of your request applies it to your dates; any options and delivery fees, shown on the vehicle page, are added and paid to the agency.',
      },
      PROCESS,
    ],
  },
  'location-voiture-luxe-nador': {
    h1: 'Luxury car rental in Nador',
    title: 'Luxury car rental in Nador | ClickDrive',
    metaDescription:
      'High-end cars from rental agencies in Nador: price per day, deposit and conditions. Free request, contract signed with the agency.',
    keywords: ['luxury car rental nador', 'prestige car hire nador', 'premium car nador'],
    zoneName: 'Luxury cars',
    introTitle: 'The high end of partner agencies',
    introText:
      'Vehicles classed as Luxury by partner agencies. The deposit is higher on these models: its amount is shown on each vehicle page.',
    faqs: [
      {
        question: 'Why is the deposit higher?',
        answer:
          'Each agency sets the deposit according to the vehicle’s value. Its amount is shown on the vehicle page before your request and is paid to the agency at the key handover.',
      },
      DOCUMENTS,
    ],
  },
  'location-voiture-nador-longue-duree': {
    h1: 'Weekly or monthly car rental in Nador',
    title: 'Long-term car rental in Nador | ClickDrive',
    metaDescription:
      'Rent a car in Nador for a week, a month or the whole summer: agencies’ weekly and monthly rates applied automatically to your request.',
    keywords: ['long term car rental nador', 'monthly car rental nador', 'weekly car hire nador'],
    zoneName: 'Long-term rental',
    introTitle: 'Weekly and monthly rates applied automatically',
    introText:
      'When an agency offers a weekly or monthly rate, it applies to your estimated total from 7 or 30 days of rental. Vehicles with such a rate show it on their page.',
    faqs: [
      {
        question: 'How is the weekly rate applied?',
        answer:
          'From 7 days of rental, the agency’s weekly rate is converted to a daily rate; from 30 days, its monthly rate. If the agency offers neither, the price per day applies.',
      },
      PROCESS,
    ],
  },
  'location-voiture-nador-ete': {
    h1: 'Summer car rental in Nador',
    title: 'Summer car rental in Nador: book early | ClickDrive',
    metaDescription:
      'Coming home this summer? Book your car in Nador early, at the airport or Beni Ansar port, with the agencies’ weekly and monthly rates.',
    keywords: ['summer car rental nador', 'august car rental nador', 'car rental nador holiday', 'nador port car hire summer'],
    zoneName: 'Summer in Nador',
    introTitle: 'Coming home: book before the July and August peak',
    introText:
      'In summer, cars go fast. Send your request as soon as your dates are set: pickup at Nador-Al Aroui airport or Beni Ansar port, with a weekly or monthly rate applied automatically when the agency offers one.',
    faqs: [
      {
        question: 'How far ahead should I book for the summer?',
        answer:
          'As soon as you know your dates: the search only shows vehicles free for your whole period, and a request does not commit you until the agency has confirmed it.',
      },
      {
        question: 'I am arriving by ferry: what should I give?',
        answer:
          'Choose Beni Ansar port as the pickup location and give the ferry company, the crossing and the expected arrival time in your request.',
      },
      DELIVERY,
    ],
  },
  'location-scooter-moto-nador': {
    h1: 'Scooter and motorbike rental in Nador',
    title: 'Scooter and motorbike rental in Nador | ClickDrive',
    metaDescription:
      'Scooters and motorbikes from Nador’s agencies: engine size, required licence, price per day and deposit. Free request, payment to the agency.',
    keywords: ['scooter rental nador', 'motorbike rental nador', 'scooter hire nador'],
    zoneName: 'Scooters and motorbikes',
    introTitle: 'Two-wheelers: check the required licence',
    introText:
      'Each vehicle page shows the engine size and the licence required by the agency. Show this licence in the original when you collect the vehicle.',
    faqs: [
      {
        question: 'Which licence do I need to rent a scooter or motorbike?',
        answer:
          'It depends on the engine size and the agency: the required licence is shown on each vehicle page. If in doubt, the agency confirms it when it answers your request.',
      },
      PROCESS,
    ],
  },
  'guide-caution-location-voiture-nador': {
    h1: 'Car rental deposit in Nador: the guide',
    title: 'Car rental deposit in Nador: the guide | ClickDrive',
    metaDescription:
      'Amount, how it is paid, when it is returned: what to know about the deposit before renting a car in Nador from a local agency.',
    keywords: ['car rental deposit nador', 'car rental deposit morocco', 'security deposit car hire'],
    zoneName: 'Guide: the deposit',
    introTitle: 'Everything about the deposit before you book',
    introText:
      'The deposit protects the agency against damage or late return. Its amount depends on the vehicle and is shown on each ClickDrive vehicle page before your request.',
    sections: [
      {
        title: 'How much?',
        paragraphs: [
          'Each agency sets the deposit according to the vehicle: it is usually higher for an SUV or a high-end vehicle. The exact amount is shown on the vehicle page and repeated in the summary of your request.',
        ],
      },
      {
        title: 'How is it paid?',
        paragraphs: [
          'The deposit is paid to the agency at the key handover, in the ways it accepts (card pre-authorisation, cheque or other). Ask the agency before you travel if you have a preference.',
        ],
      },
      {
        title: 'When is it returned?',
        paragraphs: [
          'On return, after the return vehicle check, under the agency’s contract. Check the vehicle, fuel and any damage together, and keep a copy of the check report.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is the deposit paid on ClickDrive?',
        answer: 'No. The deposit and the rental are paid directly to the agency; ClickDrive passes on your request and tells you the agency’s answer.',
      },
      DOCUMENTS,
    ],
  },
  'guide-documents-location-voiture-maroc': {
    h1: 'Documents to rent a car in Morocco: the guide',
    title: 'Documents to rent a car in Morocco | ClickDrive',
    metaDescription:
      'Licence, ID, minimum age: the documents to show when renting a car in Nador, and what depends on each agency.',
    keywords: ['documents car rental morocco', 'driving licence car rental morocco', 'minimum age car rental nador'],
    zoneName: 'Guide: documents',
    introTitle: 'Prepare your documents before the key handover',
    introText:
      'On ClickDrive, you can send a request without your document numbers: you show the originals to the agency at the key handover.',
    sections: [
      {
        title: 'The documents to show',
        paragraphs: [
          'A driving licence valid for the whole rental, and an ID: national ID card or passport. The agency checks the originals before signing the contract.',
        ],
      },
      {
        title: 'What depends on the agency',
        paragraphs: [
          'The minimum age, years of driving or the licence required for a two-wheeler are set by each agency. When it has entered them, they are shown on the vehicle page.',
          'If you drive with a foreign licence, ask the agency before you arrive whether it also needs an international driving permit.',
        ],
      },
    ],
    faqs: [DOCUMENTS, PROCESS],
  },
  'guide-arrivee-aeroport-port-nador': {
    h1: 'Arriving in Nador by plane or ferry: getting your car',
    title: 'Arriving in Nador by plane or ferry | ClickDrive',
    metaDescription:
      'Nador-Al Aroui airport or Beni Ansar port: how to ask for your rental car to be handed over when you arrive.',
    keywords: ['nador airport arrival car', 'beni ansar port arrival car', 'car rental on arrival nador'],
    zoneName: 'Guide: arrival',
    introTitle: 'Pickup is arranged in your request',
    introText:
      'Whether you arrive at Nador-Al Aroui airport or Beni Ansar port, give the pickup location and your arrival time: the agency confirms the meeting.',
    sections: [
      {
        title: 'By plane: Nador-Al Aroui airport (NDR)',
        paragraphs: [
          'Choose the airport as the pickup location and give your flight number and arrival time. The agency agrees the meeting point with you.',
        ],
      },
      {
        title: 'By ferry: Beni Ansar port',
        paragraphs: [
          'Choose the port as the pickup location and give the ferry company, the crossing and the expected arrival time. If the ferry is late, let the agency know on WhatsApp.',
        ],
      },
      {
        title: 'Delivery fees',
        paragraphs: [
          'When an agency charges for delivery to the airport or port, the amount is shown on the vehicle page and the agency page; it is paid to the agency with the rental.',
        ],
      },
    ],
    faqs: [DELIVERY, DOCUMENTS],
  },
};
