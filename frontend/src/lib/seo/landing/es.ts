import type { LandingText } from './types';

const PROCESS = {
  question: '¿Cómo funciona una reserva en ClickDrive?',
  answer:
    'Envías gratis una solicitud para el vehículo y las fechas elegidos. La agencia comprueba la disponibilidad y confirma; después firmas el contrato y pagas el alquiler y la fianza directamente a la agencia al recoger las llaves.',
};
const DOCUMENTS = {
  question: '¿Qué documentos hay que presentar?',
  answer:
    'Un permiso de conducir válido y un documento de identidad (DNI o pasaporte), en original, al recoger las llaves. Cada agencia puede fijar otras condiciones (edad mínima, antigüedad del permiso): figuran en la ficha del vehículo.',
};
const DELIVERY = {
  question: '¿Me pueden entregar el coche en el aeropuerto o en el puerto?',
  answer:
    'Sí, cuando la agencia lo ofrece: elige el lugar de recogida en tu solicitud. El posible coste de entrega fijado por la agencia aparece en la ficha del vehículo y en la página de la agencia.',
};

export const es: Record<string, LandingText> = {
  'location-voiture-nador': {
    h1: 'Alquiler de coches en Nador: compara las agencias locales',
    title: 'Alquiler de coches en Nador: compara | ClickDrive',
    metaDescription:
      'Compara los coches de las agencias de alquiler de Nador: precio por día, condiciones y disponibilidad. Solicitud gratuita, pago en la agencia.',
    keywords: ['alquiler coches nador', 'alquiler coche barato nador', 'rent a car nador', 'agencia alquiler nador'],
    zoneName: 'Nador',
    introTitle: 'Todas las agencias asociadas de Nador en un solo lugar',
    introText:
      'ClickDrive reúne los vehículos de las agencias de alquiler asociadas de Nador. Compara el precio por día, la fianza y las condiciones de cada vehículo y envía gratis tu solicitud: la agencia confirma la disponibilidad.',
    faqs: [
      PROCESS,
      DOCUMENTS,
      {
        question: '¿Cómo encuentro el mejor precio?',
        answer:
          'Indica tus fechas en el buscador: solo aparecen los vehículos libres durante todo el periodo, con su precio por día. Ordena por precio y compara la fianza, el kilometraje y los gastos de entrega en cada ficha.',
      },
    ],
  },
  'location-voiture-nador-aeroport': {
    h1: 'Alquiler de coches en el aeropuerto Nador-Al Aroui (NDR)',
    title: 'Alquiler de coches aeropuerto de Nador | ClickDrive',
    metaDescription:
      'Alquila un coche a tu llegada al aeropuerto Nador-Al Aroui (NDR) con agencias locales. Compara precios y envía tu solicitud gratis.',
    keywords: ['alquiler coches aeropuerto nador', 'aeropuerto al aroui coche', 'alquiler coche NDR', 'rent a car aeropuerto nador'],
    zoneName: 'Aeropuerto Nador-Al Aroui',
    introTitle: 'Tu coche a la llegada de tu vuelo',
    introText:
      'Elige el aeropuerto Nador-Al Aroui como lugar de recogida e indica tu número de vuelo en la solicitud: la agencia te confirma la hora y el punto de encuentro.',
    faqs: [
      {
        question: '¿Cómo es la recogida en el aeropuerto?',
        answer:
          'Indicas tu número de vuelo y tu hora de llegada en la solicitud. Tras la confirmación, la agencia acuerda contigo el punto de encuentro; el contrato y la revisión del vehículo se hacen al entregar las llaves.',
      },
      DELIVERY,
      DOCUMENTS,
    ],
  },
  'location-voiture-beni-ansar': {
    h1: 'Alquiler de coches en el puerto de Beni Ansar (Nador)',
    title: 'Alquiler de coches puerto Beni Ansar | ClickDrive',
    metaDescription:
      '¿Llegas en ferri al puerto de Beni Ansar? Compara los coches de las agencias de Nador y pide la recogida en el puerto. Solicitud gratuita.',
    keywords: ['alquiler coches beni ansar', 'alquiler coche puerto nador', 'ferri beni ansar alquiler coche'],
    zoneName: 'Puerto de Beni Ansar',
    introTitle: 'Tu coche al bajar del ferri',
    introText:
      '¿Llegas en barco, por ejemplo desde Almería, Motril o Sète? Elige el puerto de Beni Ansar como lugar de recogida e indica tu travesía en la solicitud: la agencia confirma la cita.',
    faqs: [
      {
        question: '¿Qué debo indicar si llego en ferri?',
        answer:
          'La naviera, la travesía y la hora de llegada prevista. La agencia las usa para fijar la cita; si el barco se retrasa, avísala por WhatsApp.',
      },
      {
        question: '¿Puedo devolver el coche en otro lugar que no sea el puerto?',
        answer:
          'El lugar de devolución se elige en la solicitud; la agencia confirma si es posible e indica los posibles gastos antes de la reserva.',
      },
      DELIVERY,
    ],
  },
  'location-voiture-nador-suv': {
    h1: 'Alquiler de SUV en Nador',
    title: 'Alquiler de SUV en Nador: compara precios | ClickDrive',
    metaDescription:
      'Compara los SUV de las agencias de alquiler de Nador: precio por día, fianza y condiciones. Solicitud gratuita, pago en la agencia.',
    keywords: ['alquiler suv nador', 'alquiler 4x4 nador', 'suv nador'],
    zoneName: 'SUV en Nador',
    introTitle: 'Espacio para la familia y el equipaje',
    introText:
      'Los SUV de las agencias asociadas, con su precio por día, su cambio y su fianza. Indica tus fechas para ver solo los vehículos libres.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-automatique': {
    h1: 'Alquiler de coche automático en Nador',
    title: 'Alquiler de coche automático en Nador | ClickDrive',
    metaDescription:
      'Los coches de cambio automático de las agencias de Nador: urbanos, berlinas y SUV. Compara precios y envía tu solicitud gratis.',
    keywords: ['alquiler coche automatico nador', 'cambio automatico nador', 'coche automatico nador'],
    zoneName: 'Cambio automático',
    introTitle: 'Todos los automáticos de un vistazo',
    introText: 'Aquí solo aparecen los coches de cambio automático de las agencias asociadas, con su precio por día y sus condiciones.',
    faqs: [PROCESS, DOCUMENTS],
  },
  'location-voiture-nador-pas-cher': {
    h1: 'Alquiler de coches baratos en Nador',
    title: 'Alquiler de coches baratos en Nador | ClickDrive',
    metaDescription:
      'Los coches económicos de las agencias de Nador, del precio más bajo al más alto. Compara la fianza y las condiciones antes de enviar tu solicitud.',
    keywords: ['alquiler coche barato nador', 'alquiler coche economico nador', 'coche barato nador'],
    zoneName: 'Coches económicos',
    introTitle: 'Los urbanos económicos de las agencias de Nador',
    introText:
      'Los coches de la categoría Económico, ordenados por precio. El precio mostrado es el de la agencia; compara también la fianza y el kilometraje en cada ficha.',
    faqs: [
      {
        question: '¿El precio mostrado es el precio final?',
        answer:
          'Es el precio por día fijado por la agencia. El total estimado de tu solicitud lo aplica a tus fechas; las opciones y los posibles gastos de entrega, indicados en la ficha, se suman y se pagan en la agencia.',
      },
      PROCESS,
    ],
  },
  'location-voiture-luxe-nador': {
    h1: 'Alquiler de coches de lujo en Nador',
    title: 'Alquiler de coches de lujo en Nador | ClickDrive',
    metaDescription:
      'Los coches de gama alta de las agencias de alquiler de Nador: precio por día, fianza y condiciones. Solicitud gratuita, contrato con la agencia.',
    keywords: ['alquiler coche lujo nador', 'alquiler coche prestigio nador', 'coche gama alta nador'],
    zoneName: 'Coches de lujo',
    introTitle: 'La gama alta de las agencias asociadas',
    introText:
      'Los vehículos clasificados como Lujo por las agencias asociadas. La fianza es más alta en estos modelos: su importe figura en cada ficha.',
    faqs: [
      {
        question: '¿Por qué la fianza es más alta?',
        answer:
          'Cada agencia fija la fianza según el valor del vehículo. Su importe aparece en la ficha antes de tu solicitud y se paga en la agencia al entregar las llaves.',
      },
      DOCUMENTS,
    ],
  },
  'location-voiture-nador-longue-duree': {
    h1: 'Alquiler de coches por semanas o meses en Nador',
    title: 'Alquiler de coches larga duración Nador | ClickDrive',
    metaDescription:
      'Alquila un coche en Nador por una semana, un mes o todo el verano: las tarifas semanales y mensuales de las agencias se aplican solas.',
    keywords: ['alquiler coche larga duracion nador', 'alquiler coche por meses nador', 'alquiler coche semanal nador'],
    zoneName: 'Larga duración',
    introTitle: 'Tarifas semanales y mensuales aplicadas automáticamente',
    introText:
      'Cuando una agencia ofrece una tarifa semanal o mensual, se aplica a tu total estimado a partir de 7 o 30 días de alquiler. Los vehículos que la tienen la muestran en su ficha.',
    faqs: [
      {
        question: '¿Cómo se aplica la tarifa semanal?',
        answer:
          'A partir de 7 días de alquiler, la tarifa semanal de la agencia se convierte en precio por día; a partir de 30 días, su tarifa mensual. Si la agencia no las ofrece, se aplica el precio por día.',
      },
      PROCESS,
    ],
  },
  'location-voiture-nador-ete': {
    h1: 'Alquiler de coches en Nador para el verano',
    title: 'Alquiler de coches Nador verano: reserva ya | ClickDrive',
    metaDescription:
      '¿Vuelves a casa este verano? Reserva pronto tu coche en Nador, en el aeropuerto o en el puerto de Beni Ansar, con tarifas semanales y mensuales.',
    keywords: ['alquiler coche nador verano', 'alquiler coche nador agosto', 'alquiler coche puerto nador verano'],
    zoneName: 'Verano en Nador',
    introTitle: 'Vuelta a casa: reserva antes del pico de julio y agosto',
    introText:
      'En verano los coches vuelan. Envía tu solicitud en cuanto tengas tus fechas: recogida en el aeropuerto Nador-Al Aroui o en el puerto de Beni Ansar, con tarifa semanal o mensual aplicada sola cuando la agencia la ofrece.',
    faqs: [
      {
        question: '¿Con cuánta antelación reservar para el verano?',
        answer:
          'En cuanto conozcas tus fechas: el buscador solo muestra los vehículos libres durante todo tu periodo, y una solicitud no te compromete hasta que la agencia la confirma.',
      },
      {
        question: 'Llego en ferri: ¿qué debo indicar?',
        answer:
          'Elige el puerto de Beni Ansar como lugar de recogida e indica la naviera, la travesía y la hora de llegada prevista en tu solicitud.',
      },
      DELIVERY,
    ],
  },
  'location-scooter-moto-nador': {
    h1: 'Alquiler de scooters y motos en Nador',
    title: 'Alquiler de scooters y motos en Nador | ClickDrive',
    metaDescription:
      'Los scooters y motos de las agencias de Nador: cilindrada, permiso exigido, precio por día y fianza. Solicitud gratuita, pago en la agencia.',
    keywords: ['alquiler scooter nador', 'alquiler moto nador', 'scooter nador'],
    zoneName: 'Scooters y motos',
    introTitle: 'Dos ruedas: comprueba el permiso exigido',
    introText:
      'Cada ficha indica la cilindrada y el permiso que pide la agencia. Presenta ese permiso en original al recoger el vehículo.',
    faqs: [
      {
        question: '¿Qué permiso necesito para alquilar un scooter o una moto?',
        answer:
          'Depende de la cilindrada y de la agencia: el permiso exigido figura en cada ficha. Si tienes dudas, la agencia lo confirma al responder a tu solicitud.',
      },
      PROCESS,
    ],
  },
  'guide-caution-location-voiture-nador': {
    h1: 'Fianza del alquiler de coche en Nador: la guía',
    title: 'Fianza de alquiler de coche en Nador | ClickDrive',
    metaDescription:
      'Importe, forma de pago, devolución: lo que debes saber sobre la fianza antes de alquilar un coche en Nador con una agencia local.',
    keywords: ['fianza alquiler coche nador', 'fianza alquiler coche marruecos', 'deposito alquiler coche'],
    zoneName: 'Guía: la fianza',
    introTitle: 'Todo sobre la fianza antes de reservar',
    introText:
      'La fianza cubre a la agencia en caso de daños o retraso. Su importe depende del vehículo y figura en cada ficha de ClickDrive antes de tu solicitud.',
    sections: [
      {
        title: '¿Cuánto?',
        paragraphs: [
          'Cada agencia fija la fianza según el vehículo: suele ser más alta para un SUV o un vehículo de gama alta. El importe exacto aparece en la ficha del vehículo y en el resumen de tu solicitud.',
        ],
      },
      {
        title: '¿Cómo se deposita?',
        paragraphs: [
          'La fianza se paga en la agencia al recoger las llaves, según las modalidades que ofrezca (bloqueo en tarjeta, cheque u otra). Pregúntalas a la agencia antes de desplazarte si tienes alguna preferencia.',
        ],
      },
      {
        title: '¿Cuándo se devuelve?',
        paragraphs: [
          'Al devolver el vehículo, tras la revisión de devolución, según el contrato de la agencia. Revisad juntos el vehículo, el combustible y los posibles daños, y guarda una copia del informe.',
        ],
      },
    ],
    faqs: [
      {
        question: '¿La fianza se paga en ClickDrive?',
        answer: 'No. La fianza y el alquiler se pagan directamente a la agencia; ClickDrive envía tu solicitud y te informa de su respuesta.',
      },
      DOCUMENTS,
    ],
  },
  'guide-documents-location-voiture-maroc': {
    h1: 'Documentos para alquilar un coche en Marruecos: la guía',
    title: 'Documentos para alquilar un coche en Marruecos',
    metaDescription:
      'Permiso, documento de identidad, edad mínima: los documentos que hay que presentar para alquilar un coche en Nador y lo que depende de cada agencia.',
    keywords: ['documentos alquiler coche marruecos', 'permiso alquiler coche marruecos', 'edad minima alquiler coche nador'],
    zoneName: 'Guía: los documentos',
    introTitle: 'Prepara tus documentos antes de recoger las llaves',
    introText:
      'En ClickDrive puedes enviar una solicitud sin los números de tus documentos: presentas los originales a la agencia al recoger las llaves.',
    sections: [
      {
        title: 'Los documentos que hay que presentar',
        paragraphs: [
          'Un permiso de conducir válido durante todo el alquiler y un documento de identidad: DNI o pasaporte. La agencia comprueba los originales antes de firmar el contrato.',
        ],
      },
      {
        title: 'Lo que depende de la agencia',
        paragraphs: [
          'La edad mínima, la antigüedad del permiso o el permiso exigido para un vehículo de dos ruedas los fija cada agencia. Cuando los ha indicado, figuran en la ficha del vehículo.',
          'Si conduces con un permiso extranjero, pregunta a la agencia antes de llegar si también necesita un permiso internacional.',
        ],
      },
    ],
    faqs: [DOCUMENTS, PROCESS],
  },
  'guide-arrivee-aeroport-port-nador': {
    h1: 'Llegar a Nador en avión o en ferri: recoger tu coche',
    title: 'Llegar a Nador en avión o en ferri | ClickDrive',
    metaDescription:
      'Aeropuerto Nador-Al Aroui o puerto de Beni Ansar: cómo pedir la entrega de tu coche de alquiler a tu llegada.',
    keywords: ['llegada aeropuerto nador coche', 'llegada puerto beni ansar coche', 'alquiler coche llegada nador'],
    zoneName: 'Guía: la llegada',
    introTitle: 'La recogida se prepara en tu solicitud',
    introText:
      'Tanto si llegas al aeropuerto Nador-Al Aroui como al puerto de Beni Ansar, indica el lugar de recogida y tu hora de llegada: la agencia confirma la cita.',
    sections: [
      {
        title: 'En avión: aeropuerto Nador-Al Aroui (NDR)',
        paragraphs: [
          'Elige el aeropuerto como lugar de recogida e indica tu número de vuelo y tu hora de llegada. La agencia acuerda contigo el punto de encuentro.',
        ],
      },
      {
        title: 'En ferri: puerto de Beni Ansar',
        paragraphs: [
          'Elige el puerto como lugar de recogida e indica la naviera, la travesía y la hora de llegada prevista. Si el barco se retrasa, avisa a la agencia por WhatsApp.',
        ],
      },
      {
        title: 'Los gastos de entrega',
        paragraphs: [
          'Cuando una agencia cobra la entrega en el aeropuerto o en el puerto, el importe figura en la ficha del vehículo y en su página; se paga en la agencia con el alquiler.',
        ],
      },
    ],
    faqs: [DELIVERY, DOCUMENTS],
  },
};
