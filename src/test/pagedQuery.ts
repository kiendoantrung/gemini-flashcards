import { vi } from 'vitest';

/**
 * Stands in for the tail of a paged PostgREST query (`.order().range()`, see
 * services/fetchAllRows.ts). Every page resolves to `result`, so pass fewer
 * rows than a page to end the loop after one request.
 */
export function pagedQuery<T>(result: { data: T[] | null; error: unknown }) {
  const query = {
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}
