import type { AdminOverview, AdminOverviewCount } from './overview';

/**
 * Bloc « À traiter » du tableau de bord : ce qui attend une action de l'administrateur.
 * Fonctions pures (testées sans interface) : le composant ne fait que les afficher.
 */

export type TodoKey = 'agencies' | 'bookings' | 'messages' | 'plans' | 'health';
export type TodoTone = 'amber' | 'slate' | 'red' | 'blue';

export type TodoItem = {
  key: TodoKey;
  href: string;
  title: string;
  text: string;
  tone: TodoTone;
};

/** Le nombre n'existe pas : droit de lecture absent ou lecture en échec (jamais lu comme « zéro ») */
const unknown = (count: AdminOverviewCount) => Boolean(count.restricted || count.unavailable);

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** « a », « a ou b », « a, b ou c » */
function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ou ${items[items.length - 1]}`;
}

/** Éléments à traiter, dans l'ordre d'affichage. `unhealthyServices` : noms des services à surveiller. */
export function buildTodos(overview: AdminOverview, unhealthyServices: string[]): TodoItem[] {
  const todos: TodoItem[] = [];
  const agencies = overview.pendingAgencies.count;
  const bookings = overview.bookings.pending;
  const { contactMessages, planRequests } = overview;

  if (agencies > 0) {
    todos.push({
      key: 'agencies',
      href: '/admin/agencies?filter=PENDING',
      title: `${agencies} agence${plural(agencies, '', 's')} à vérifier`,
      text: 'Validez les nouvelles agences pour les rendre visibles.',
      tone: 'amber',
    });
  }
  if (bookings > 0) {
    todos.push({
      key: 'bookings',
      href: '/admin/bookings',
      title: `${bookings} réservation${plural(bookings, '', 's')} en attente`,
      text: 'Demandes pas encore confirmées par les agences.',
      tone: 'slate',
    });
  }
  if (!unknown(contactMessages) && contactMessages.count > 0) {
    const n = contactMessages.count;
    todos.push({
      key: 'messages',
      href: '/admin/messages',
      title: `${n} ${plural(n, 'nouveau message', 'nouveaux messages')} de contact`,
      text: 'Des personnes attendent une réponse de l’équipe.',
      tone: 'blue',
    });
  }
  if (!unknown(planRequests) && planRequests.count > 0) {
    const n = planRequests.count;
    todos.push({
      key: 'plans',
      href: '/admin/finance',
      title: `${n} demande${plural(n, '', 's')} de changement de formule`,
      text: 'Vérifiez le paiement reçu avant d’appliquer la nouvelle formule.',
      tone: 'amber',
    });
  }
  if (unhealthyServices.length > 0) {
    todos.push({
      key: 'health',
      href: '/admin/health',
      title: `${unhealthyServices.length} service${plural(unhealthyServices.length, '', 's')} à surveiller`,
      text: unhealthyServices.join(', '),
      tone: 'red',
    });
  }
  return todos;
}

/**
 * Message quand rien n'attend l'administrateur. Il ne cite que ce qui a réellement été vérifié :
 * une rubrique illisible (droit absent ou lecture en échec) n'est jamais déclarée « à jour ».
 */
export function allClearMessage(overview: AdminOverview, servicesChecked: boolean): string {
  const { pendingAgencies, contactMessages, planRequests } = overview;
  const checked = [
    !pendingAgencies.restricted && 'agence',
    'réservation',
    !unknown(contactMessages) && 'message de contact',
    !unknown(planRequests) && 'demande de formule',
  ].filter(Boolean) as string[];
  const none = `aucune ${joinOr(checked)} en attente`;

  const failed = [
    contactMessages.unavailable && 'messages de contact',
    planRequests.unavailable && 'demandes de formule',
  ].filter(Boolean) as string[];
  if (failed.length > 0) {
    return `Rien à traiter parmi les éléments lus : ${none}. Lecture impossible pour le moment : ${failed.join(', ')}.`;
  }
  return servicesChecked
    ? `Tout est à jour : ${none}, tous les services répondent.`
    : `${none.charAt(0).toUpperCase()}${none.slice(1)}. L’état des services n’a pas pu être vérifié.`;
}
