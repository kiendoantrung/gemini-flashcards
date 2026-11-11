import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows, PAGE_SIZE } from './fetchAllRows';

function rows(from: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `row-${from + index}` }));
}

/** A fake table of `total` rows that honours `.range(from, to)`. */
function fakeTable(total: number) {
  const range = vi.fn((from: number, to: number) => {
    const end = Math.min(to + 1, total);
    return Promise.resolve({ data: rows(from, Math.max(0, end - from)), error: null });
  });
  const order = vi.fn(() => ({ range }));
  const build = vi.fn(() => ({ order }));
  return { build, order, range };
}

describe('fetchAllRows', () => {
  it('stops after one request when the first page is short', async () => {
    const table = fakeTable(3);

    await expect(fetchAllRows(table.build)).resolves.toHaveLength(3);
    expect(table.range).toHaveBeenCalledTimes(1);
    expect(table.range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it('keeps paging past the PostgREST max-rows cap', async () => {
    const total = PAGE_SIZE * 2 + 250;
    const table = fakeTable(total);

    const result = await fetchAllRows<{ id: string }>(table.build);

    expect(result).toHaveLength(total);
    expect(new Set(result.map((row) => row.id)).size).toBe(total);
    expect(table.range.mock.calls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
    // A stable order is what makes offsets meaningful between pages.
    expect(table.order).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('asks for one more page when the total is an exact multiple of the page size', async () => {
    const table = fakeTable(PAGE_SIZE);

    await expect(fetchAllRows(table.build)).resolves.toHaveLength(PAGE_SIZE);
    expect(table.range).toHaveBeenCalledTimes(2);
  });

  it('surfaces a query error instead of returning a partial result', async () => {
    const error = new Error('boom');
    const build = () => ({
      order: () => ({ range: () => Promise.resolve({ data: null, error }) }),
    });

    await expect(fetchAllRows(build)).rejects.toBe(error);
  });
});
