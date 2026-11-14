/**
 * Faux client Supabase pour les tests unitaires des services et des routes.
 * Chaque requête est enregistrée (table, opération, colonnes, filtres, charge utile) au moment
 * où elle est exécutée ; la réponse est fournie par une fonction de résolution propre au test.
 * Aucune donnée n'est simulée côté production : ce module n'est importé que par des fichiers *.spec.ts.
 */

export type FakeOperation = 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';

export type FakeFilter = { method: string; args: unknown[] };

export type FakeCall = {
  table: string;
  op: FakeOperation;
  /** Colonnes du select (ou du select de retour après une écriture) */
  columns?: string;
  options?: unknown;
  payload?: unknown;
  filters: FakeFilter[];
  mode: 'many' | 'single' | 'maybeSingle';
};

export type FakeResult = {
  data?: unknown;
  error?: { message: string; code?: string; details?: string } | null;
  count?: number | null;
};

export type FakeResolver = (call: FakeCall) => FakeResult | undefined;

const FILTER_METHODS = [
  'eq', 'neq', 'in', 'is', 'or', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'not',
  'match', 'filter', 'contains', 'order', 'limit', 'range',
] as const;

export function createFakeSupabase(resolve: FakeResolver = () => undefined) {
  const calls: FakeCall[] = [];

  const execute = (call: FakeCall) => {
    calls.push(call);
    const result = resolve(call) ?? {};
    return Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    });
  };

  const chainFor = (call: FakeCall) => {
    const chain: Record<string, unknown> = {};
    for (const method of FILTER_METHODS) {
      chain[method] = (...args: unknown[]) => {
        call.filters.push({ method, args });
        return chain;
      };
    }
    chain.select = (columns?: string, options?: unknown) => {
      call.columns = columns;
      if (options !== undefined) call.options = options;
      return chain;
    };
    chain.single = () => execute({ ...call, mode: 'single' });
    chain.maybeSingle = () => execute({ ...call, mode: 'maybeSingle' });
    chain.then = (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      execute(call).then(onFulfilled, onRejected);
    return chain;
  };

  const start = (table: string, op: FakeOperation, payload?: unknown, options?: unknown) =>
    chainFor({ table, op, payload, options, filters: [], mode: 'many' });

  const client = {
    from: (table: string) => ({
      select: (columns?: string, options?: unknown) => {
        const chain = start(table, 'select', undefined, options) as Record<string, unknown> & {
          select: (c?: string, o?: unknown) => unknown;
        };
        chain.select(columns, options);
        return chain;
      },
      insert: (payload: unknown, options?: unknown) => start(table, 'insert', payload, options),
      update: (payload: unknown, options?: unknown) => start(table, 'update', payload, options),
      upsert: (payload: unknown, options?: unknown) => start(table, 'upsert', payload, options),
      delete: (options?: unknown) => start(table, 'delete', undefined, options),
    }),
    rpc: (name: string, params?: unknown) => start(name, 'rpc', params),
  };

  return { client, calls };
}

/** Valeur d'un filtre `eq` (ou undefined) */
export function eqValue(call: FakeCall, column: string): unknown {
  return call.filters.find((filter) => filter.method === 'eq' && filter.args[0] === column)?.args[1];
}

/** Écritures enregistrées sur une table */
export function writesTo(calls: FakeCall[], table: string): FakeCall[] {
  return calls.filter((call) => call.table === table && call.op !== 'select' && call.op !== 'rpc');
}
