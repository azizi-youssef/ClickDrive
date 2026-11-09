/**
 * Pages d'atterrissage SEO (zones, catégories, guides).
 *
 * Règle éditoriale : uniquement des affirmations vraies pour tout le site. Aucun nom d'agence,
 * aucun prix ni aucun service promis ici : les chiffres (nombre de véhicules, agences, prix de
 * départ) sont calculés à partir du catalogue réel au moment de l'affichage, et ce qui dépend
 * de l'agence (livraison, frais, assurance, annulation) est renvoyé à sa fiche.
 * Titres : 60 caractères au plus (affichés tels quels, sans suffixe) ; descriptions : 160 au plus.
 */

import type { Locale } from '@/lib/i18n/config';
import type { LandingText } from './landing/types';
import { en } from './landing/en';
import { es } from './landing/es';
import { de } from './landing/de';
import { nl } from './landing/nl';
import { ar } from './landing/ar';

export interface SeoLandingPageData {
  slug: string;
  h1: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  zoneName: string;
  zoneType: 'airport' | 'port' | 'city' | 'category' | 'guide';
  introTitle: string;
  introText: string;
  /** Type de véhicule listé (voitures par défaut) */
  vehicleType?: 'CAR' | 'MOTORCYCLE';
  filterCategory?: string;
  filterTransmission?: 'MANUAL' | 'AUTOMATIC';
  /** Met en avant les tarifs à la semaine et au mois renseignés par les agences */
  highlightLongStay?: boolean;
  defaultLocation?: string;
  /** Guides : sections de contenu */
  sections?: Array<{ title: string; paragraphs: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
}

const PROCESS_FAQ = {
  question: 'Comment se passe une réservation sur ClickDrive ?',
  answer:
    'Vous envoyez gratuitement une demande pour le véhicule et les dates choisis. L’agence vérifie la disponibilité et confirme ; vous signez ensuite le contrat et réglez la location et la caution directement à l’agence, à la remise des clés.',
};

const DOCUMENTS_FAQ = {
  question: 'Quels documents faut-il présenter ?',
  answer:
    'Un permis de conduire valide et une pièce d’identité (CIN ou passeport), présentés en original à la remise des clés. Chaque agence peut fixer d’autres conditions (âge minimum, ancienneté du permis) : elles figurent sur la fiche du véhicule.',
};

const DELIVERY_FAQ = {
  question: 'La voiture peut-elle être livrée à l’aéroport ou au port ?',
  answer:
    'Oui, quand l’agence le propose : choisissez le lieu de prise en charge dans votre demande. Les frais de livraison renseignés par l’agence sont affichés sur la fiche du véhicule et sur la page de l’agence.',
};

export const SEO_LANDING_PAGES: Record<string, SeoLandingPageData> = {
  'location-voiture-nador': {
    slug: 'location-voiture-nador',
    h1: 'Location de voiture à Nador : comparez les agences locales',
    title: 'Location voiture Nador : comparer les agences | ClickDrive',
    metaDescription:
      'Comparez les voitures des agences de location de Nador : prix par jour, conditions et disponibilité. Demande gratuite, paiement à l’agence.',
    keywords: ['location voiture nador', 'location voiture nador pas cher', 'rent a car nador', 'agence location nador'],
    zoneName: 'Nador',
    zoneType: 'city',
    introTitle: 'Toutes les agences partenaires de Nador au même endroit',
    introText:
      'ClickDrive rassemble les véhicules des agences de location partenaires de Nador. Comparez les prix par jour, la caution et les conditions de chaque véhicule, puis envoyez votre demande gratuitement : l’agence confirme la disponibilité.',
    defaultLocation: 'Nador',
    faqs: [
      PROCESS_FAQ,
      DOCUMENTS_FAQ,
      {
        question: 'Comment trouver le meilleur prix ?',
        answer:
          'Indiquez vos dates dans la recherche : seuls les véhicules libres sur toute la période s’affichent, avec leur prix par jour. Triez par prix et comparez la caution, le kilométrage et les frais de livraison sur chaque fiche.',
      },
    ],
  },

  'location-voiture-nador-aeroport': {
    slug: 'location-voiture-nador-aeroport',
    h1: 'Location de voiture à l’aéroport Nador-Al Aroui (NDR)',
    title: 'Location voiture aéroport Nador Al-Aroui | ClickDrive',
    metaDescription:
      'Louez une voiture à votre arrivée à l’aéroport Nador-Al Aroui (NDR) auprès d’agences locales. Comparez les prix et envoyez votre demande gratuitement.',
    keywords: ['location voiture aeroport nador', 'car rental nador airport', 'aeroport al aroui voiture', 'location voiture NDR'],
    zoneName: 'Aéroport Nador-Al Aroui',
    zoneType: 'airport',
    introTitle: 'Votre voiture à l’arrivée de votre vol',
    introText:
      'Choisissez l’aéroport Nador-Al Aroui comme lieu de prise en charge et indiquez votre numéro de vol dans la demande : l’agence confirme l’heure et le point de rendez-vous avec vous.',
    defaultLocation: 'Aéroport Nador-Al Aroui',
    faqs: [
      {
        question: 'Comment se passe la prise en charge à l’aéroport ?',
        answer:
          'Vous indiquez votre numéro et votre heure d’arrivée dans la demande. Après confirmation, l’agence convient avec vous du point de rendez-vous ; le contrat et l’état des lieux se font à la remise des clés.',
      },
      DELIVERY_FAQ,
      DOCUMENTS_FAQ,
    ],
  },

  'location-voiture-beni-ansar': {
    slug: 'location-voiture-beni-ansar',
    h1: 'Location de voiture au port de Beni Ansar (Nador)',
    title: 'Location voiture port Beni Ansar (Nador) | ClickDrive',
    metaDescription:
      'Vous arrivez en ferry au port de Beni Ansar ? Comparez les voitures des agences de Nador et demandez la prise en charge au port. Demande gratuite.',
    keywords: ['location voiture beni ansar', 'location voiture port nador', 'ferry beni ansar location voiture'],
    zoneName: 'Port de Beni Ansar',
    zoneType: 'port',
    introTitle: 'Votre voiture à la descente du ferry',
    introText:
      'Vous arrivez par bateau, notamment depuis Almería, Motril ou Sète ? Choisissez le port de Beni Ansar comme lieu de prise en charge et précisez votre traversée dans la demande : l’agence confirme le rendez-vous.',
    defaultLocation: 'Port de Beni Ansar',
    faqs: [
      {
        question: 'Que faut-il indiquer pour une arrivée en ferry ?',
        answer:
          'La compagnie, la traversée et l’heure d’arrivée prévue. L’agence s’en sert pour fixer le rendez-vous ; en cas de retard du bateau, prévenez-la par WhatsApp.',
      },
      {
        question: 'Puis-je rendre la voiture ailleurs qu’au port ?',
        answer:
          'Le lieu de restitution se choisit dans la demande ; l’agence confirme s’il est possible et précise les éventuels frais avant la réservation.',
      },
      DELIVERY_FAQ,
    ],
  },

  'location-voiture-nador-suv': {
    slug: 'location-voiture-nador-suv',
    h1: 'Location de SUV à Nador',
    title: 'Location SUV à Nador : comparer les prix | ClickDrive',
    metaDescription:
      'Comparez les SUV proposés par les agences de location de Nador : prix par jour, caution et conditions. Demande gratuite, paiement à l’agence.',
    keywords: ['location suv nador', 'location 4x4 nador', 'suv nador'],
    zoneName: 'SUV à Nador',
    zoneType: 'category',
    filterCategory: 'SUV',
    introTitle: 'De l’espace pour la famille et les bagages',
    introText:
      'Les SUV des agences partenaires, avec leur prix par jour, leur boîte de vitesses et leur caution. Indiquez vos dates pour ne voir que les véhicules libres.',
    faqs: [PROCESS_FAQ, DOCUMENTS_FAQ],
  },

  'location-voiture-nador-automatique': {
    slug: 'location-voiture-nador-automatique',
    h1: 'Location de voiture automatique à Nador',
    title: 'Location voiture automatique à Nador | ClickDrive',
    metaDescription:
      'Les voitures à boîte automatique des agences de location de Nador : citadines, berlines et SUV. Comparez les prix et envoyez votre demande gratuitement.',
    keywords: ['location voiture automatique nador', 'boite automatique nador', 'location auto nador'],
    zoneName: 'Boîte automatique',
    zoneType: 'category',
    filterTransmission: 'AUTOMATIC',
    introTitle: 'Toutes les boîtes automatiques en un coup d’œil',
    introText:
      'Seules les voitures à boîte automatique des agences partenaires sont listées ici, avec leur prix par jour et leurs conditions.',
    faqs: [PROCESS_FAQ, DOCUMENTS_FAQ],
  },

  'location-voiture-nador-pas-cher': {
    slug: 'location-voiture-nador-pas-cher',
    h1: 'Location de voiture pas chère à Nador',
    title: 'Location voiture pas chère à Nador | ClickDrive',
    metaDescription:
      'Les voitures économiques des agences de Nador, du prix le plus bas au plus haut. Comparez la caution et les conditions avant d’envoyer votre demande.',
    keywords: ['location voiture pas cher nador', 'location voiture economique nador', 'voiture pas chere nador'],
    zoneName: 'Voitures économiques',
    zoneType: 'category',
    filterCategory: 'Économique',
    introTitle: 'Les citadines économiques des agences de Nador',
    introText:
      'Les voitures de la catégorie Économique, classées par prix. Le prix affiché est celui de l’agence ; comparez aussi la caution et le kilométrage sur chaque fiche.',
    faqs: [
      {
        question: 'Le prix affiché est-il le prix final ?',
        answer:
          'C’est le prix par jour fixé par l’agence. Le total estimé de votre demande l’applique à vos dates ; les options et les frais de livraison éventuels, affichés sur la fiche, s’y ajoutent et se règlent à l’agence.',
      },
      PROCESS_FAQ,
    ],
  },

  'location-voiture-luxe-nador': {
    slug: 'location-voiture-luxe-nador',
    h1: 'Location de voiture de luxe à Nador',
    title: 'Location voiture de luxe à Nador | ClickDrive',
    metaDescription:
      'Les voitures haut de gamme des agences de location de Nador : prix par jour, caution et conditions. Demande gratuite, contrat signé avec l’agence.',
    keywords: ['location voiture luxe nador', 'location voiture prestige nador', 'voiture haut de gamme nador'],
    zoneName: 'Voitures de luxe',
    zoneType: 'category',
    filterCategory: 'Luxe',
    introTitle: 'Le haut de gamme des agences partenaires',
    introText:
      'Les véhicules classés Luxe par les agences partenaires. La caution est plus élevée sur ces modèles : son montant figure sur chaque fiche.',
    faqs: [
      {
        question: 'Pourquoi la caution est-elle plus élevée ?',
        answer:
          'Chaque agence fixe la caution selon la valeur du véhicule. Son montant est affiché sur la fiche avant votre demande et se règle à l’agence, à la remise des clés.',
      },
      DOCUMENTS_FAQ,
    ],
  },

  'location-voiture-nador-longue-duree': {
    slug: 'location-voiture-nador-longue-duree',
    h1: 'Location de voiture à la semaine ou au mois à Nador',
    title: 'Location voiture longue durée Nador | ClickDrive',
    metaDescription:
      'Louez une voiture à Nador pour une semaine, un mois ou tout l’été : tarifs semaine et mois des agences appliqués automatiquement à votre demande.',
    keywords: ['location voiture longue duree nador', 'location voiture mois nador', 'location voiture semaine nador'],
    zoneName: 'Longue durée',
    zoneType: 'category',
    highlightLongStay: true,
    introTitle: 'Les tarifs semaine et mois appliqués automatiquement',
    introText:
      'Quand une agence propose un tarif à la semaine ou au mois, il s’applique à votre total estimé dès 7 ou 30 jours de location. Les véhicules qui en proposent un l’affichent sur leur fiche.',
    faqs: [
      {
        question: 'Comment le tarif semaine est-il appliqué ?',
        answer:
          'Dès 7 jours de location, le tarif semaine de l’agence est ramené à la journée ; dès 30 jours, son tarif mois. Si l’agence n’en propose pas, c’est le prix par jour qui s’applique.',
      },
      PROCESS_FAQ,
    ],
  },

  'location-voiture-nador-ete': {
    slug: 'location-voiture-nador-ete',
    h1: 'Location de voiture à Nador pour l’été',
    title: 'Location voiture Nador été : réservez tôt | ClickDrive',
    metaDescription:
      'Retour au pays cet été ? Réservez tôt votre voiture à Nador, à l’aéroport ou au port de Beni Ansar, avec les tarifs semaine et mois des agences.',
    keywords: ['location voiture nador ete', 'location voiture nador aout', 'location voiture mre nador', 'location voiture port nador ete'],
    zoneName: 'Été à Nador',
    zoneType: 'category',
    highlightLongStay: true,
    introTitle: 'Retour au pays : réservez avant le pic de juillet et août',
    introText:
      'En été, les voitures partent vite. Envoyez votre demande dès que vos dates sont fixées : prise en charge à l’aéroport Nador-Al Aroui ou au port de Beni Ansar, tarif semaine ou mois appliqué automatiquement quand l’agence en propose un.',
    defaultLocation: 'Port de Beni Ansar',
    faqs: [
      {
        question: 'Combien de temps à l’avance réserver pour l’été ?',
        answer:
          'Dès que vos dates sont connues : la recherche n’affiche que les véhicules libres sur toute votre période, et une demande ne vous engage pas tant que l’agence ne l’a pas confirmée.',
      },
      {
        question: 'J’arrive en ferry : que dois-je indiquer ?',
        answer:
          'Choisissez le port de Beni Ansar comme lieu de prise en charge et précisez la compagnie, la traversée et l’heure d’arrivée prévue dans votre demande.',
      },
      DELIVERY_FAQ,
    ],
  },

  'location-scooter-moto-nador': {
    slug: 'location-scooter-moto-nador',
    h1: 'Location de scooter et de moto à Nador',
    title: 'Location scooter et moto à Nador | ClickDrive',
    metaDescription:
      'Les scooters et motos des agences de Nador : cylindrée, permis exigé, prix par jour et caution. Demande gratuite, paiement à l’agence.',
    keywords: ['location scooter nador', 'location moto nador', 'scooter nador'],
    zoneName: 'Scooters et motos',
    zoneType: 'category',
    vehicleType: 'MOTORCYCLE',
    introTitle: 'Deux-roues : vérifiez le permis exigé',
    introText:
      'Chaque fiche indique la cylindrée et le permis demandé par l’agence. Présentez ce permis en original à la remise du véhicule.',
    faqs: [
      {
        question: 'Quel permis faut-il pour louer un scooter ou une moto ?',
        answer:
          'Cela dépend de la cylindrée et de l’agence : le permis exigé figure sur chaque fiche. En cas de doute, l’agence le confirme en réponse à votre demande.',
      },
      PROCESS_FAQ,
    ],
  },

  'guide-caution-location-voiture-nador': {
    slug: 'guide-caution-location-voiture-nador',
    h1: 'Caution de location de voiture à Nador : le guide',
    title: 'Caution location voiture à Nador : le guide | ClickDrive',
    metaDescription:
      'Montant, mode de dépôt, restitution : ce qu’il faut savoir sur la caution avant de louer une voiture à Nador auprès d’une agence locale.',
    keywords: ['caution location voiture nador', 'caution location voiture maroc', 'depot de garantie location voiture'],
    zoneName: 'Guide : la caution',
    zoneType: 'guide',
    introTitle: 'Tout savoir sur la caution avant de réserver',
    introText:
      'La caution garantit l’agence en cas de dommage ou de retard. Son montant dépend du véhicule et figure sur chaque fiche ClickDrive avant votre demande.',
    sections: [
      {
        title: 'Combien ?',
        paragraphs: [
          'Chaque agence fixe la caution selon le véhicule : elle est en général plus élevée pour un SUV ou un véhicule haut de gamme. Le montant exact est affiché sur la fiche du véhicule et rappelé dans le récapitulatif de votre demande.',
        ],
      },
      {
        title: 'Comment est-elle déposée ?',
        paragraphs: [
          'La caution se règle à l’agence, à la remise des clés, selon les modalités qu’elle propose (empreinte de carte bancaire, chèque ou autre). Demandez-les à l’agence avant de vous déplacer si vous avez une préférence.',
        ],
      },
      {
        title: 'Quand est-elle rendue ?',
        paragraphs: [
          'À la restitution, après l’état des lieux de retour, selon le contrat de l’agence. Vérifiez ensemble le véhicule, le carburant et les éventuels dommages, et gardez une copie de l’état des lieux.',
        ],
      },
    ],
    faqs: [
      {
        question: 'La caution est-elle payée sur ClickDrive ?',
        answer: 'Non. La caution et la location se règlent directement à l’agence ; ClickDrive transmet votre demande et vous informe de sa réponse.',
      },
      DOCUMENTS_FAQ,
    ],
  },

  'guide-documents-location-voiture-maroc': {
    slug: 'guide-documents-location-voiture-maroc',
    h1: 'Documents pour louer une voiture au Maroc : le guide',
    title: 'Documents pour louer une voiture au Maroc | ClickDrive',
    metaDescription:
      'Permis, pièce d’identité, âge minimum : les documents à présenter pour louer une voiture à Nador, et ce qui dépend de chaque agence.',
    keywords: ['documents location voiture maroc', 'permis location voiture maroc', 'age minimum location voiture nador'],
    zoneName: 'Guide : les documents',
    zoneType: 'guide',
    introTitle: 'Préparez vos documents avant la remise des clés',
    introText:
      'Sur ClickDrive, vous pouvez envoyer une demande sans vos numéros de pièces : vous les présentez en original à l’agence, à la remise des clés.',
    sections: [
      {
        title: 'Les documents à présenter',
        paragraphs: [
          'Un permis de conduire valide pendant toute la durée de la location, et une pièce d’identité : CIN ou passeport. L’agence vérifie les originaux avant de signer le contrat.',
        ],
      },
      {
        title: 'Ce qui dépend de l’agence',
        paragraphs: [
          'L’âge minimum, l’ancienneté du permis ou le permis exigé pour un deux-roues sont fixés par chaque agence. Quand elle les a renseignés, ils figurent sur la fiche du véhicule.',
          'Si vous conduisez avec un permis étranger, demandez à l’agence s’il lui faut aussi un permis international avant votre arrivée.',
        ],
      },
    ],
    faqs: [DOCUMENTS_FAQ, PROCESS_FAQ],
  },

  'guide-arrivee-aeroport-port-nador': {
    slug: 'guide-arrivee-aeroport-port-nador',
    h1: 'Arriver à Nador en avion ou en ferry : récupérer sa voiture',
    title: 'Arrivée à Nador en avion ou en ferry | ClickDrive',
    metaDescription:
      'Aéroport Nador-Al Aroui ou port de Beni Ansar : comment demander la prise en charge de votre voiture de location à votre arrivée.',
    keywords: ['arrivee aeroport nador voiture', 'arrivee port beni ansar voiture', 'location voiture arrivee nador'],
    zoneName: 'Guide : l’arrivée',
    zoneType: 'guide',
    introTitle: 'La prise en charge se prépare dans votre demande',
    introText:
      'Que vous arriviez à l’aéroport Nador-Al Aroui ou au port de Beni Ansar, indiquez le lieu de prise en charge et votre heure d’arrivée : l’agence confirme le rendez-vous.',
    sections: [
      {
        title: 'En avion : aéroport Nador-Al Aroui (NDR)',
        paragraphs: [
          'Choisissez l’aéroport comme lieu de prise en charge et indiquez votre numéro de vol et votre heure d’arrivée. L’agence convient avec vous du point de rendez-vous.',
        ],
      },
      {
        title: 'En ferry : port de Beni Ansar',
        paragraphs: [
          'Choisissez le port comme lieu de prise en charge et précisez la compagnie, la traversée et l’heure d’arrivée prévue. En cas de retard du bateau, prévenez l’agence par WhatsApp.',
        ],
      },
      {
        title: 'Les frais de livraison',
        paragraphs: [
          'Quand une agence facture la livraison à l’aéroport ou au port, le montant figure sur la fiche du véhicule et sur sa page ; il se règle à l’agence avec la location.',
        ],
      },
    ],
    faqs: [DELIVERY_FAQ, DOCUMENTS_FAQ],
  },
};

export const ALL_SEO_SLUGS = Object.keys(SEO_LANDING_PAGES);

/** Textes traduits, par langue, indexés par le slug français ; le français est la source ci-dessus */
const TRANSLATED_TEXTS: Partial<Record<Locale, Record<string, LandingText>>> = { en, es, de, nl, ar };

/**
 * Page d'atterrissage dans une langue : configuration commune (filtres, type de véhicule) et textes
 * de la langue. `slug` reste le slug français : les liens sont traduits par localizeHref.
 */
export function getLandingPage(frSlug: string, locale: Locale): SeoLandingPageData | null {
  const base = SEO_LANDING_PAGES[frSlug];
  if (!base) return null;
  const text = TRANSLATED_TEXTS[locale]?.[frSlug];
  return text ? { ...base, ...text, slug: base.slug } : base;
}
