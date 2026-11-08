import type { LucideIcon } from 'lucide-react';
import { Building2, CalendarCheck, Car, MapPin, Search, ShieldCheck, Wallet } from 'lucide-react';

export type FaqCategoryId = 'plateforme' | 'reservation' | 'tarifs' | 'prise-en-charge' | 'agences';

export const FAQ_CATEGORIES: { id: FaqCategoryId; label: string; icon: LucideIcon }[] = [
  { id: 'plateforme', label: 'La plateforme', icon: Car },
  { id: 'reservation', label: 'Réservation', icon: CalendarCheck },
  { id: 'tarifs', label: 'Caution & assurance', icon: Wallet },
  { id: 'prise-en-charge', label: 'Prise en charge', icon: MapPin },
  { id: 'agences', label: 'Agences partenaires', icon: Building2 },
];

export type FaqItem = {
  /** Ancre stable pour les liens directs (#id) */
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
  icon: LucideIcon;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'fonctionnement',
    category: 'plateforme',
    question: 'Comment fonctionne ClickDrive Nador ?',
    answer:
      "ClickDrive est une plateforme qui permet de découvrir les véhicules proposés par plusieurs agences de location à Nador et dans les environs. Vous recherchez un véhicule, consultez ses caractéristiques, ses conditions et son tarif, puis contactez l'agence concernée pour finaliser votre réservation.",
    icon: Car,
  },
  {
    id: 'rechercher',
    category: 'plateforme',
    question: 'Comment rechercher une voiture ?',
    answer:
      "Vous pouvez commencer votre recherche depuis la page Véhicules en indiquant vos dates et vos critères. Vous pouvez ensuite consulter les modèles disponibles, comparer les caractéristiques et ouvrir la fiche d'un véhicule pour obtenir davantage d'informations.",
    icon: Search,
  },
  {
    id: 'reserver',
    category: 'reservation',
    question: 'Comment réserver un véhicule ?',
    answer:
      "Après avoir sélectionné un véhicule, cliquez sur « Demander cette voiture ». Vous complétez votre demande avec votre numéro de CIN et vos coordonnées. ClickDrive transmet votre dossier à l'agence partenaire qui confirme la disponibilité sous 1h à 2h.",
    icon: CalendarCheck,
  },
  {
    id: 'disponibilite',
    category: 'reservation',
    question: 'Comment fonctionne la disponibilité des véhicules ?',
    answer:
      "La disponibilité est gérée en direct par les agences partenaires sur la plateforme ClickDrive. En envoyant votre demande via ClickDrive, vous bloquez le tarif affiché. Si le véhicule venait à être indisponible, ClickDrive vous propose immédiatement des alternatives équivalentes.",
    icon: CalendarCheck,
  },
  {
    id: 'annulation',
    category: 'reservation',
    question: 'Puis-je annuler ma réservation ?',
    answer:
      "Les conditions d'annulation sont définies par chaque agence et peuvent dépendre du délai avant la prise en charge du véhicule. Avant de réserver, vérifiez les conditions applicables à votre demande et demandez à l'agence quelles éventuelles pénalités peuvent s'appliquer.",
    icon: CalendarCheck,
  },
  {
    id: 'caution',
    category: 'tarifs',
    question: 'Quel montant de caution dois-je prévoir ?',
    answer:
      "Le montant de la caution dépend notamment du véhicule, de l'agence et des conditions du contrat. Les modalités de paiement ou de blocage de la caution peuvent également varier. Vérifiez toujours les conditions communiquées par l'agence avant de confirmer votre réservation.",
    icon: ShieldCheck,
  },
  {
    id: 'assurance',
    category: 'tarifs',
    question: 'Les assurances sont-elles incluses dans le prix ?',
    answer:
      "Les conditions d'assurance peuvent varier selon le véhicule et l'agence. Le tarif affiché ne doit donc pas être interprété comme incluant automatiquement toutes les garanties ou options. Consultez les conditions du véhicule et demandez à l'agence quelles couvertures sont incluses dans le prix.",
    icon: ShieldCheck,
  },
  {
    id: 'aeroport',
    category: 'prise-en-charge',
    question: "Puis-je récupérer une voiture à l'aéroport Nador-Al Aroui ?",
    answer:
      "Oui, la majorité de nos agences partenaires assurent la livraison à l'aéroport Nador-Al Aroui ou au port de Beni Ansar. Précisez simplement votre numéro de vol ou de traversée lors de votre demande sur ClickDrive pour que l'agent vous attende à votre arrivée.",
    icon: MapPin,
  },
  {
    id: 'mre',
    category: 'prise-en-charge',
    question: "ClickDrive est-il adapté aux Marocains résidant à l'étranger (MRE) ?",
    answer:
      "Oui. La plateforme est pensée notamment pour faciliter la recherche d'un véhicule avant ou pendant un séjour à Nador. Les services proposés aux MRE, les horaires de prise en charge, les conditions de retard de vol ou les documents nécessaires dépendent toutefois de chaque agence.",
    icon: MapPin,
  },
  {
    id: 'agence-verifiee',
    category: 'agences',
    question: 'Que signifie le badge « Agence vérifiée » ?',
    answer:
      "Lorsqu'une agence dispose du badge « Agence vérifiée », cela signifie que son registre de commerce, ses assurances professionnelles et son parc ont fait l'objet d'une validation rigoureuse par ClickDrive.",
    icon: ShieldCheck,
  },
  {
    id: 'devenir-partenaire',
    category: 'agences',
    question: 'Une agence peut-elle rejoindre ClickDrive ?',
    answer:
      "Oui. Les agences de location souhaitant proposer leurs véhicules sur ClickDrive peuvent soumettre une demande de partenariat depuis la page dédiée. Après étude des informations fournies, l'agence peut être intégrée à la plateforme selon les conditions du service.",
    icon: Building2,
  },
];
