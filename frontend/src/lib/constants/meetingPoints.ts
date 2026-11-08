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
    name: 'Aéroport Nador Al-Aroui (NDR)',
    shortName: 'Aéroport Nador Al-Aroui',
    code: 'NDR',
    type: 'AIRPORT',
    badgeLabel: 'Aéroport International',
    iconName: 'Plane',
    gradientBg: 'from-blue-600 to-indigo-700',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    instructions: 'Accueil personnalisé au hall Arrivées avec pancarte nominative ClickDrive dès la sortie des bagages.',
  },
  {
    id: 'port-beni-ansar',
    name: 'Port de Beni Ansar (Gare Maritime)',
    shortName: 'Port de Beni Ansar',
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
    name: 'Centre-Ville Nador (Boulevard Mohammed V)',
    shortName: 'Centre-Ville Nador',
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
    name: 'Corniche Marchica (Nador)',
    shortName: 'Lagune Marchica',
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
    name: 'Gare ONCF Nador Ville',
    shortName: 'Gare ONCF Nador',
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

  const lower = locationStr.toLowerCase();
  if (lower.includes('aéro') || lower.includes('aeroport') || lower.includes('aroui') || lower.includes('ndr')) {
    return MEETING_POINTS[0];
  }
  if (lower.includes('port') || lower.includes('ansar') || lower.includes('ferry') || lower.includes('maritime')) {
    return MEETING_POINTS[1];
  }
  if (lower.includes('agence') || lower.includes('comptoir')) {
    return MEETING_POINTS[2];
  }
  if (lower.includes('centre') || lower.includes('ville') || lower.includes('boulevard') || lower.includes('mohammed')) {
    return MEETING_POINTS[3];
  }
  if (lower.includes('marchica') || lower.includes('corniche') || lower.includes('lagune') || lower.includes('resort')) {
    return MEETING_POINTS[4];
  }
  if (lower.includes('gare') || lower.includes('oncf') || lower.includes('train')) {
    return MEETING_POINTS[5];
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
