export interface SeoLandingPageData {
  slug: string;
  h1: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  zoneName: string;
  zoneType: 'airport' | 'port' | 'city' | 'category';
  introTitle: string;
  introText: string;
  filterCategory?: string;
  filterTransmission?: 'MANUAL' | 'AUTOMATIC';
  defaultLocation?: string;
  faqs: Array<{ question: string; answer: string }>;
}

export const SEO_LANDING_PAGES: Record<string, SeoLandingPageData> = {
  'location-voiture-nador': {
    slug: 'location-voiture-nador',
    h1: 'Location de Voiture à Nador — Meilleur Prix & Comparateur Multi-Agences',
    title: 'Location Voiture Nador Pas Cher dès 250 DH/jour | ClickDrive',
    metaDescription: 'Comparez en direct les disponibilités des agences de location à Nador. Dacia, Renault, SUV, automatiques avec livraison aéroport & centre-ville sans mauvaise surprise.',
    keywords: ['location voiture nador', 'location voiture nador pas cher', 'rent a car nador', 'agences location nador'],
    zoneName: 'Nador Centre & Marchica',
    zoneType: 'city',
    introTitle: 'Trouvez et réservez votre voiture à Nador auprès d’agences vérifiées',
    introText: 'ClickDrive révolutionne la location de véhicules à Nador en rassemblant sous un même toit les meilleures flottes locales : Nador Auto Rent, Rif Car Luxury, Marchica Drive et Atlas Car. Comparez les tarifs réels, visualisez les modèles exacts et réservez sans acompte abusif.',
    defaultLocation: 'Centre-Ville Nador (Boulevard Mohammed V)',
    faqs: [
      {
        question: 'Quel est le prix moyen d’une location de voiture à Nador ?',
        answer: 'Le tarif moyen débute à partir de 250 DH/jour pour une citadine économique (Renault Clio 5, Dacia Sandero) et entre 350 et 500 DH/jour pour un SUV familial (Dacia Duster, Hyundai Tucson).',
      },
      {
        question: 'Est-il possible de récupérer la voiture directement à l’arrivée ?',
        answer: 'Oui, nos agences partenaires livrent gratuitement ou à tarif préférentiel votre véhicule à l’Aéroport Nador Al-Aroui, au Port de Beni Ansar ou à votre hôtel à Nador.',
      },
      {
        question: 'Quels sont les documents obligatoires pour louer ?',
        answer: 'Un permis de conduire valide (marocain ou international), un passeport ou CIN, et une caution par empreinte bancaire ou chèque selon les agences.',
      },
    ],
  },

  'location-voiture-nador-aeroport': {
    slug: 'location-voiture-nador-aeroport',
    h1: 'Location Voiture Aéroport Nador Al-Aroui (NDR) — Accueil VIP & Clés en main',
    title: 'Location Voiture Nador Aéroport (NDR) — Livraison Direct Terminal | ClickDrive',
    metaDescription: 'Réservez votre voiture livrée dès votre atterrissage à l’Aéroport Nador Al-Aroui (NDR). Pas de file d’attente, agences locales contrôlées, assistance locale par WhatsApp.',
    keywords: ['location voiture nador aeroport', 'car rental nador airport', 'aeroport al aroui voiture', 'location auto aéroport nador'],
    zoneName: 'Aéroport Nador Al-Aroui (NDR)',
    zoneType: 'airport',
    introTitle: 'Votre véhicule prêt dès la sortie du terminal des arrivées',
    introText: 'Finies les files d’attente aux guichets d’aéroport après votre vol. Un agent partenaire ClickDrive vous attend avec une pancarte à votre nom dans le hall des arrivées de l’Aéroport Al-Aroui (NDR). Faites l’état des lieux en 5 minutes et prenez la route sans stress.',
    defaultLocation: 'Aéroport Nador Al-Aroui (NDR)',
    faqs: [
      {
        question: 'Comment se passe la prise en charge à l’aéroport Al-Aroui ?',
        answer: 'L’agence suit votre numéro de vol en temps réel. Même en cas de retard de votre vol, un agent vous remet les clés directement sur le parking réservé de l’aéroport.',
      },
      {
        question: 'Y a-t-il des frais supplémentaires pour une livraison tardive ?',
        answer: 'La plupart des agences ClickDrive n’appliquent aucun supplément pour les vols réguliers en soirée. Tout est transparent dès la confirmation.',
      },
    ],
  },

  'location-voiture-beni-ansar': {
    slug: 'location-voiture-beni-ansar',
    h1: 'Location Voiture Port de Beni Ansar — Ferry & Gare Maritime Nador',
    title: 'Location Voiture Beni Ansar Port Nador | Prise en Charge Ferry ClickDrive',
    metaDescription: 'Louez votre voiture à l’arrivée du ferry au Port de Beni Ansar (Nador). Idéal pour les MRE et voyageurs arrivant d’Almería, Motril ou Sète.',
    keywords: ['location voiture beni ansar', 'location voiture port nador', 'ferry beni ansar car rental'],
    zoneName: 'Port de Beni Ansar (Ferry)',
    zoneType: 'port',
    introTitle: 'Récupérez votre véhicule à la descente du bateau',
    introText: 'Vous arrivez par bateau depuis l’Espagne ou la France ? Nos agences partenaires mettent à votre disposition votre véhicule directement au terminal maritime de Beni Ansar, pour vous éviter les trajets fastidieux en taxi.',
    defaultLocation: 'Gare Maritime Port Beni Ansar',
    faqs: [
      {
        question: 'Puis-je rendre la voiture à l’aéroport si je l’ai prise au port ?',
        answer: 'Absolument ! L’option drop-off flexible vous permet de récupérer votre voiture au Port de Beni Ansar et de la restituer à l’Aéroport d’Al-Aroui.',
      },
    ],
  },

  'location-voiture-nador-suv': {
    slug: 'location-voiture-nador-suv',
    h1: 'Location SUV à Nador — Dacia Duster, Hyundai Tucson & 4x4',
    title: 'Location SUV Nador — Duster, Tucson dès 340 DH | ClickDrive',
    metaDescription: 'Découvrez notre sélection de SUV robustes et confortables à Nador. Idéal pour explorer la côte de Marchica, Gourougou, Ras Kebdana et l’Oriental.',
    keywords: ['location suv nador', 'dacia duster nador', 'location 4x4 nador', 'tucson nador'],
    zoneName: 'Nador & Région',
    zoneType: 'category',
    filterCategory: 'SUV',
    introTitle: 'Le confort et l’espace pour vos trajets dans tout le Rif et l’Oriental',
    introText: 'Le SUV est le véhicule préféré de nos clients à Nador pour sa polyvalence, sa garde au sol haute et son confort de conduite, parfait pour sillonner la lagune de Marchica ou partir vers Al Hoceima et Oujda.',
    faqs: [
      {
        question: 'Quel est le SUV le plus populaire à Nador ?',
        answer: 'Le Dacia Duster Diesel reste le champion incontesté du rapport robustesse/consommation/prix à Nador (entre 340 et 380 DH/jour).',
      },
    ],
  },

  'location-voiture-nador-automatique': {
    slug: 'location-voiture-nador-automatique',
    h1: 'Location Voiture Automatique à Nador — Conduite fluide & Zéro fatigue',
    title: 'Location Voiture Boîte Automatique Nador | ClickDrive',
    metaDescription: 'Large choix de voitures à boîte automatique à Nador : citadines, berlines et SUV. Réservez en ligne avec confirmation rapide.',
    keywords: ['location voiture automatique nador', 'boite auto nador', 'location dsg edc nador'],
    zoneName: 'Nador Ville & Aéroports',
    zoneType: 'category',
    filterTransmission: 'AUTOMATIC',
    introTitle: 'Le plaisir d’une conduite décontractée en boîte auto',
    introText: 'Parce que les vacances riment avec détente, découvrez notre flotte de véhicules à boîte automatique séquentielle, DSG ou EDC disponibles immédiatement auprès de nos agences.',
    faqs: [
      {
        question: 'Les voitures automatiques sont-elles plus chères ?',
        answer: 'Le surcoût est généralement de seulement 30 à 50 DH/jour par rapport à une boîte manuelle équivalente.',
      },
    ],
  },
};

export const ALL_SEO_SLUGS = Object.keys(SEO_LANDING_PAGES);
