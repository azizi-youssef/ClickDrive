/**
 * Lit toutes les lignes d'une requête, page par page : l'API Supabase plafonne chaque réponse
 * (1 000 lignes par défaut), et un calcul fait sur une réponse tronquée serait faux sans le dire.
 * La requête doit être triée sur une clé unique (`order('id')`) pour que les pages ne se chevauchent pas.
 */
export const SELECT_PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = SELECT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
