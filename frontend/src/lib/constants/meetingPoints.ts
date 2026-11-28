import { PICKUP_LOCATIONS, findPickupLocation, type LocationId } from '@/data/locations';

/** Libellés normalisés des lieux (src/data/locations.ts) */
function place(id: LocationId): { name: string; shortName: string } {
  const location = PICKUP_LOCATIONS.find((entry) => entry.id === id);
  return { name: location?.label ?? id, shortName: location?.shortLabel ?? id };
}

export interface MeetingPoint {
  id: string;
  name: string;
  shortName: string;
  code: string;
  type: 'AIRPORT' | 'PORT' | 'AGENCY' | 'CITY' | 'RESORT' | 'TRAIN';
  badgeLabel: string;
  iconName: 'Plane' | 'Anchor' | 'Building2' | 'MapPin' | 'Sparkles' | 'Train';
  gradientBg: string;
  borderColor: string;
  textColor: string;
  instructions: string;
  logoBadgeUrl?: string;
}

export const MEETING_POINTS: MeetingPoint[] = [
  {
    id: 'aeroport-nador',
    ...place('aeroport-nador'),
    code: 'NDR',
    type: 'AIRPORT',
    badgeLabel: 'Aéroport International',
    iconName: 'Plane',
    gradientBg: 'from-blue-600 to-indigo-700',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    instructions: 'Rendez-vous dans le hall Arrivées, à la sortie des bagages, au point convenu avec l’agence.',
  },
  {
    id: 'port-beni-ansar',
    ...place('port-beni-ansar'),
    code: 'BA-PORT',
    type: 'PORT',
    badgeLabel: 'Terminal Ferry & Port',
    iconName: 'Anchor',
    gradientBg: 'from-teal-600 to-cyan-700',
    borderColor: 'border-teal-300',
    textColor: 'text-teal-700',
    instructions: 'Remise en main propre devant le débarcadère passagers ou parking dédié ferry de Beni Ansar.',
  },
  {
    id: 'agence-partenaire',
    name: 'En agence partenaire (Nador)',
    shortName: 'Comptoir Agence',
    code: 'AGENCY',
    type: 'AGENCY',
    badgeLabel: 'Siège Agence Certifiée',
    iconName: 'Building2',
    gradientBg: 'from-slate-700 to-slate-900',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-800',
    instructions: 'Accueil direct au comptoir de l’agence partenaire avec vérification physique immédiate des pièces.',
  },
  {
    id: 'centre-ville-nador',
    ...place('nador-centre'),
    code: 'NDR-CENTRE',
    type: 'CITY',
    badgeLabel: 'Zone Urbaine',
    iconName: 'MapPin',
    gradientBg: 'from-amber-600 to-orange-700',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    instructions: 'Remise au point de rendez-vous convenu sur le Boulevard Mohammed V ou devant votre établissement.',
  },
  {
    id: 'corniche-marchica',
    ...place('corniche-marchica'),
    code: 'MARCHICA',
    type: 'RESORT',
    badgeLabel: 'Resort & Hôtels',
    iconName: 'Sparkles',
    gradientBg: 'from-emerald-600 to-teal-700',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
    instructions: 'Livraison premium devant votre hôtel ou résidence sur la corniche lagunaire de Marchica.',
  },
  {
    id: 'gare-oncf-nador',
    ...place('gare-oncf-nador'),
    code: 'ONCF',
    type: 'TRAIN',
    badgeLabel: 'Gare Ferroviaire',
    iconName: 'Train',
    gradientBg: 'from-rose-600 to-red-700',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-700',
    instructions: 'Rendez-vous sur le parvis principal de la gare de Nador Ville.',
  },
];

/**
 * Recherche intelligente du point de rendez-vous correspondant au libellé
 */
export function getMeetingPoint(locationStr?: string): MeetingPoint {
  if (!locationStr) return MEETING_POINTS[0];

  const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const lower = fold(locationStr);

  // 1. Nom exact (accents ignorés) : valeurs enregistrées par la demande et lieux du catalogue
  const exact = MEETING_POINTS.find((point) => [point.name, point.shortName, point.id].some((value) => fold(value) === lower));
  if (exact) return exact;
  // 1 bis. Lieu connu sous une autre orthographe (valeur historique, alias) : même point de rendez-vous
  const known = findPickupLocation(locationStr);
  const knownPoint = known && MEETING_POINTS.find((point) => point.name === known.label);
  if (knownPoint) return knownPoint;

  // 2. Saisie libre : mots-clés. La gare passe avant le centre-ville (« Gare ONCF Nador Ville ») ; les
  //    autres localités (« Selouane Centre », « Al-Aroui Ville ») restent des lieux convenus.
  if (lower.includes('aero') || lower.includes('airport') || lower.includes('ndr')) {
    return MEETING_POINTS[0];
  }
  if (lower.includes('port') || lower.includes('ansar') || lower.includes('ferry') || lower.includes('maritime')) {
    return MEETING_POINTS[1];
  }
  if (lower.includes('agence') || lower.includes('comptoir')) {
    return MEETING_POINTS[2];
  }
  if (lower.includes('gare') || lower.includes('oncf') || lower.includes('train')) {
    return MEETING_POINTS[5];
  }
  if (lower.includes('marchica') || lower.includes('corniche') || lower.includes('lagune') || lower.includes('resort')) {
    return MEETING_POINTS[4];
  }
  if (
    lower.includes('centre-ville') ||
    lower.includes('centre ville') ||
    lower.includes('boulevard') ||
    lower.includes('mohammed') ||
    (lower.includes('centre') && lower.includes('nador'))
  ) {
    return MEETING_POINTS[3];
  }

  // Fallback personnalisé
  return {
    id: 'custom-location',
    name: locationStr,
    shortName: locationStr,
    code: 'LIEU',
    type: 'CITY',
    badgeLabel: 'Point Convenu',
    iconName: 'MapPin',
    gradientBg: 'from-blue-600 to-indigo-700',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    instructions: 'Point de remise convenu avec la conciergerie ClickDrive et l’agence.',
  };
}
