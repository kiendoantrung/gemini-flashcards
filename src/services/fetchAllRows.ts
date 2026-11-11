/**
 * PostgREST caps every response at the project's "Max rows" setting (1000 by
 * default on Supabase) and truncates silently: no error, no header the client
 * checks. Any query whose result can grow with the user's history has to page.
 *
 * PAGE_SIZE must not exceed the project's Max rows. A smaller server limit
 * would make the first page come back short and end the loop early, which is
 * exactly the silent truncation this helper exists to prevent.
 */
export const PAGE_SIZE = 1000;

/**
 * Hard stop so a misbehaving server (or a mock) cannot loop forever.
 * 200 pages = 200k rows, far beyond any realistic per-user result.
 */
const MAX_PAGES = 200;

interface PageResult {
  data: unknown[] | null;
  error: unknown;
}

interface RangeableQuery {
  range(from: number, to: number): PromiseLike<PageResult>;
}

interface OrderableQuery {
  order(column: string, options?: { ascending?: boolean }): RangeableQuery;
}

/**
 * Fetches every row of a filtered query, one page at a time.
 *
 * `buildQuery` must return a fresh, filtered builder on every call. Rows are
 * ordered by `orderColumn` (a unique column) so that pages neither overlap nor
 * skip rows.
 */
export async function fetchAllRows<T>(
  buildQuery: () => OrderableQuery,
  orderColumn = 'id',
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery()
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const pageRows = (data ?? []) as T[];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return rows;
    }
  }

  throw new Error(`Query exceeded ${MAX_PAGES * PAGE_SIZE} rows`);
}
