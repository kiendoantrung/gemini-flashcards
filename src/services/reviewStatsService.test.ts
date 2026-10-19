import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getReviewStats } from './reviewStatsService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => {
  const fromMock = vi.fn();
  return { supabase: { from: fromMock } };
});

const now = new Date('2026-08-29T12:00:00.000Z'); // 08:00 study day, UTC, 4h boundary

const decks = [
  { id: 'deck-1', title: 'Spanish', cards: [{ id: 'c-1' }, { id: 'c-2' }] },
  { id: 'deck-2', title: 'Biology', cards: [{ id: 'b-1' }] },
];

function log(deckId: string, quality: number, reviewedAt: string) {
  return { deck_id: deckId, quality, reviewed_at: reviewedAt };
}

function due(deckId: string, cardId: string, dueDate: string) {
  return { deck_id: deckId, card_id: cardId, due_date: dueDate };
}

function mockTables(logs: unknown[], dues: unknown[]) {
  const logGte = vi.fn().mockResolvedValue({ data: logs, error: null });
  const logIs = vi.fn().mockReturnValue({ gte: logGte });
  const logEq = vi.fn().mockReturnValue({ is: logIs });
  const logSelect = vi.fn().mockReturnValue({ eq: logEq });

  const dueEq = vi.fn().mockResolvedValue({ data: dues, error: null });
  const dueSelect = vi.fn().mockReturnValue({ eq: dueEq });

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'review_logs') {
      return { select: logSelect } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'card_reviews') {
      return { select: dueSelect } as unknown as ReturnType<typeof supabase.from>;
    }
    return {} as unknown as ReturnType<typeof supabase.from>;
  });

  return { logGte, logIs, logEq, logSelect, dueEq, dueSelect };
}

describe('review statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a fully shaped empty state when nothing has been reviewed', async () => {
    mockTables([], []);

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats).toMatchObject({
      totalReviews: 0,
      passedReviews: 0,
      retention: 0,
      activeDays: 0,
      currentStreak: 0,
      byDeck: [],
    });
    expect(stats.daily).toHaveLength(30);
    expect(stats.daily[0].dayKey).toBe('2026-07-31');
    expect(stats.daily[29].dayKey).toBe('2026-08-29');
    expect(stats.forecast).toHaveLength(7);
    expect(stats.forecast[0].dayKey).toBe('2026-08-29');
  });

  it('excludes undone ratings from every figure', async () => {
    const { logIs } = mockTables([log('deck-1', 3, '2026-08-29T09:00:00.000Z')], []);

    await getReviewStats('user-1', decks, now, 'UTC');

    // Undo marks a row undone instead of deleting it, so the filter matters.
    expect(logIs).toHaveBeenCalledWith('undone_at', null);
  });

  it('buckets reviews into study days and computes retention', async () => {
    mockTables(
      [
        log('deck-1', 3, '2026-08-29T09:00:00.000Z'), // Good  -> pass
        log('deck-1', 4, '2026-08-29T10:00:00.000Z'), // Easy  -> pass
        log('deck-1', 2, '2026-08-29T11:00:00.000Z'), // Hard  -> pass
        log('deck-1', 1, '2026-08-28T10:00:00.000Z'), // Again -> fail
        log('deck-2', 3, '2026-08-27T10:00:00.000Z'), // Good  -> pass
      ],
      [],
    );

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats.totalReviews).toBe(5);
    // Hard counts as remembered: only Again is a lapse, matching the summary.
    expect(stats.passedReviews).toBe(4);
    expect(stats.retention).toBe(80);
    expect(stats.activeDays).toBe(3);

    const byKey = new Map(stats.daily.map((day) => [day.dayKey, day]));
    expect(byKey.get('2026-08-29')).toMatchObject({ total: 3, passed: 3, again: 0 });
    expect(byKey.get('2026-08-28')).toMatchObject({ total: 1, passed: 0, again: 1 });
    expect(byKey.get('2026-08-27')).toMatchObject({ total: 1, passed: 1 });
    // Days with no reviews still appear so the chart has no gaps.
    expect(byKey.get('2026-08-26')).toMatchObject({ total: 0, passed: 0 });
  });

  it('applies the 04:00 boundary when bucketing', async () => {
    mockTables(
      [
        // 01:00 on Aug 29 local, which is still the Aug 28 study day.
        log('deck-1', 3, '2026-08-28T18:00:00.000Z'),
        // 04:30 on Aug 29 local, the first minute of the Aug 29 study day.
        log('deck-1', 3, '2026-08-28T21:30:00.000Z'),
      ],
      [],
    );

    const stats = await getReviewStats('user-1', decks, now, 'Asia/Ho_Chi_Minh');

    const byKey = new Map(stats.daily.map((day) => [day.dayKey, day]));
    expect(byKey.get('2026-08-28')?.total).toBe(1);
    expect(byKey.get('2026-08-29')?.total).toBe(1);
  });

  it('drops rows that fall outside the window', async () => {
    mockTables(
      [
        log('deck-1', 3, '2026-08-29T09:00:00.000Z'),
        // 40 days before "now": outside the 30-day window even though the
        // query over-fetches by a day.
        log('deck-1', 3, '2026-07-20T09:00:00.000Z'),
      ],
      [],
    );

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats.totalReviews).toBe(1);
  });

  it('counts a streak of consecutive study days', async () => {
    mockTables(
      [
        log('deck-1', 3, '2026-08-29T09:00:00.000Z'),
        log('deck-1', 3, '2026-08-28T09:00:00.000Z'),
        log('deck-1', 3, '2026-08-27T09:00:00.000Z'),
        // Gap on Aug 26, so the streak stops at three.
        log('deck-1', 3, '2026-08-25T09:00:00.000Z'),
      ],
      [],
    );

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats.currentStreak).toBe(3);
    expect(stats.activeDays).toBe(4);
  });

  it('does not break the streak before the first review of the day', async () => {
    mockTables(
      [
        log('deck-1', 3, '2026-08-28T09:00:00.000Z'),
        log('deck-1', 3, '2026-08-27T09:00:00.000Z'),
      ],
      [],
    );

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    // Nothing studied yet today; yesterday's streak is still alive.
    expect(stats.currentStreak).toBe(2);
  });

  it('breaks the streak when the last study day was two days ago', async () => {
    mockTables([log('deck-1', 3, '2026-08-27T09:00:00.000Z')], []);

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats.currentStreak).toBe(0);
  });

  it('splits retention per deck, busiest first, ignoring deleted decks', async () => {
    mockTables(
      [
        log('deck-2', 3, '2026-08-29T09:00:00.000Z'),
        log('deck-1', 3, '2026-08-29T09:00:00.000Z'),
        log('deck-1', 1, '2026-08-29T10:00:00.000Z'),
        log('deck-1', 1, '2026-08-29T11:00:00.000Z'),
        log('deck-deleted', 3, '2026-08-29T12:00:00.000Z'),
      ],
      [],
    );

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats.byDeck.map((deck) => deck.deckId)).toEqual(['deck-1', 'deck-2']);
    expect(stats.byDeck[0]).toMatchObject({
      title: 'Spanish',
      total: 3,
      passed: 1,
      retention: 33,
    });
    expect(stats.byDeck[1]).toMatchObject({ title: 'Biology', total: 1, retention: 100 });
  });

  it('forecasts due cards by study day, folding overdue cards into today', async () => {
    mockTables(
      [],
      [
        due('deck-1', 'c-1', '2026-08-25T10:00:00.000Z'), // overdue
        due('deck-1', 'c-2', '2026-08-29T20:00:00.000Z'), // later today
        due('deck-2', 'b-1', '2026-09-01T06:00:00.000Z'), // +3 days
        due('deck-2', 'b-1', '2026-09-10T06:00:00.000Z'), // beyond the window
        due('deck-1', 'gone', '2026-08-29T06:00:00.000Z'), // card no longer in the deck
      ],
    );

    const stats = await getReviewStats('user-1', decks, now, 'UTC');

    expect(stats.forecast.map((day) => day.due)).toEqual([2, 0, 0, 1, 0, 0, 0]);
  });

  it('uses the study-day boundary for the forecast too', async () => {
    mockTables(
      [],
      [
        // 02:00 on Aug 30 local is still the Aug 29 study day.
        due('deck-1', 'c-1', '2026-08-29T19:00:00.000Z'),
        // 04:30 on Aug 30 local is Aug 30.
        due('deck-1', 'c-2', '2026-08-29T21:30:00.000Z'),
      ],
    );

    const stats = await getReviewStats('user-1', decks, now, 'Asia/Ho_Chi_Minh');

    expect(stats.forecast[0].due).toBe(1);
    expect(stats.forecast[1].due).toBe(1);
  });

  it('scopes both queries to the current user', async () => {
    const { logEq, dueEq } = mockTables([], []);

    await getReviewStats('user-1', decks, now, 'UTC');

    expect(logEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(dueEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('surfaces a query failure instead of showing empty statistics', async () => {
    vi.mocked(supabase.from).mockImplementation(
      () =>
        ({
          select: () => ({ eq: () => ({ is: () => ({ gte: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }) }),
        }) as unknown as ReturnType<typeof supabase.from>,
    );

    await expect(getReviewStats('user-1', decks, now, 'UTC')).rejects.toThrow('boom');
  });
});
