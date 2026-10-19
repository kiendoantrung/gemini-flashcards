import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CardReview, DeckProgress } from '../types/flashcard';
import {
  calculateNextReview,
  formatNextInterval,
  getDueCards,
  reviewCard,
  getDeckProgress,
  getDeckProgressBatch,
  undoLastReview,
} from './spacedRepetitionService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => {
  const fromMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
    },
  };
});

describe('spaced repetition contracts', () => {
  it('exposes the persisted review and dashboard progress shapes', () => {
    const review: CardReview = {
      id: 'review-1',
      userId: 'user-1',
      deckId: 'deck-1',
      cardId: 'card-1',
      status: 'new',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate: '2026-08-29T00:00:00.000Z',
      lastReviewedAt: null,
      createdAt: '2026-08-29T00:00:00.000Z',
    };
    const progress: DeckProgress = {
      new: 3,
      learning: 0,
      due: 0,
      mastered: 0,
      done: 0,
    };

    expect(review.cardId).toBe('card-1');
    expect(progress.new).toBe(3);
  });
});

describe('four-grade spaced repetition calculation', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');
  const fresh = { status: 'new' as const, easeFactor: 2.5, interval: 0, repetitions: 0 };

  it('requeues Again immediately and clamps ease at 1.3', () => {
    expect(calculateNextReview({ ...fresh, easeFactor: 1.35, repetitions: 4, interval: 10 }, 1, now, 'UTC'))
      .toMatchObject({
        status: 'relearning',
        repetitions: 0,
        interval: 0,
        easeFactor: 1.3,
        dueDate: now.toISOString(),
      });
  });

  it.each([
    [2, 2.35],
    [3, 2.5],
    [4, 2.65],
  ] as const)('schedules the first successful review for quality %i after one day', (quality, easeFactor) => {
    expect(calculateNextReview(fresh, quality, now, 'UTC'))
      .toMatchObject({
        status: 'review',
        repetitions: 1,
        interval: 1,
        easeFactor,
      });
  });

  it.each([
    [2, 5, 2.35],
    [3, 6, 2.5],
    [4, 8, 2.65],
  ] as const)('stretches the six-day learning step for quality %i', (quality, interval, easeFactor) => {
    expect(calculateNextReview({ ...fresh, repetitions: 1 }, quality, now, 'UTC')).toMatchObject({
      repetitions: 2,
      interval,
      easeFactor,
    });
  });

  it.each([
    [2, 12, 2.35],
    [3, 25, 2.5],
    [4, 34, 2.65],
  ] as const)('applies ease once and the grade modifier for quality %i', (quality, interval, easeFactor) => {
    expect(calculateNextReview({ status: 'review', repetitions: 2, interval: 10, easeFactor: 2.5 }, quality, now, 'UTC'))
      .toMatchObject({
        repetitions: 3,
        interval,
        easeFactor,
      });
  });

  it('always schedules Hard sooner than Good and Easy later than Good', () => {
    const mature = { status: 'review' as const, repetitions: 2, interval: 10, easeFactor: 2.5 };
    const secondStep = { ...fresh, repetitions: 1 };

    for (const state of [mature, secondStep]) {
      const hard = calculateNextReview(state, 2, now, 'UTC').interval;
      const good = calculateNextReview(state, 3, now, 'UTC').interval;
      const easy = calculateNextReview(state, 4, now, 'UTC').interval;

      expect(hard).toBeLessThan(good);
      expect(easy).toBeGreaterThan(good);
    }
  });

  it('keeps the ease factor at its 1.3 lower bound across repeated Again ratings', () => {
    const onceAgain = calculateNextReview({ ...fresh, easeFactor: 1.3 }, 1, now, 'UTC');
    const twiceAgain = calculateNextReview(onceAgain, 1, now, 'UTC');

    expect(onceAgain.easeFactor).toBe(1.3);
    expect(twiceAgain).toMatchObject({
      status: 'relearning',
      repetitions: 0,
      interval: 0,
      easeFactor: 1.3,
    });
  });

  it('formats next interval predictions correctly', () => {
    expect(formatNextInterval({ status: 'relearning', interval: 0 })).toBe('<1m');
    expect(formatNextInterval({ status: 'review', interval: 1 })).toBe('1d');
    expect(formatNextInterval({ status: 'review', interval: 6 })).toBe('6d');
    expect(formatNextInterval({ status: 'review', interval: 25 })).toBe('25d');
  });

  it('schedules to the start of the study day, not 24h after the rating', () => {
    // 23:00 on Aug 29 in GMT+7. Adding 24h would hide the card until 23:00 on
    // Aug 30, which is outside the evening study window it came from.
    const lateEvening = new Date('2026-08-29T16:00:00.000Z');

    const next = calculateNextReview(fresh, 3, lateEvening, 'Asia/Ho_Chi_Minh');

    expect(next.interval).toBe(1);
    // 04:00 on Aug 30 local time, i.e. 21:00Z on Aug 29.
    expect(next.dueDate).toBe('2026-08-29T21:00:00.000Z');
  });

  it('treats a rating after midnight as belonging to the previous study day', () => {
    // 01:00 on Aug 30 local is still the Aug 29 study day, so a 1-day interval
    // lands on the Aug 30 boundary three hours later. This is the intended
    // night-owl behaviour, not an off-by-one.
    const afterMidnight = new Date('2026-08-29T18:00:00.000Z');

    const next = calculateNextReview(fresh, 3, afterMidnight, 'Asia/Ho_Chi_Minh');

    expect(next.dueDate).toBe('2026-08-29T21:00:00.000Z');
  });

  it('keeps the due time at 04:00 local across a daylight-saving transition', () => {
    // America/New_York springs forward on 2026-03-08 and falls back on
    // 2026-11-01. A fixed offset would land on 03:00 or 05:00 local.
    const beforeSpringForward = new Date('2026-03-07T17:00:00.000Z'); // 12:00 EST
    const beforeFallBack = new Date('2026-10-31T16:00:00.000Z'); // 12:00 EDT

    expect(calculateNextReview(fresh, 3, beforeSpringForward, 'America/New_York').dueDate).toBe(
      '2026-03-08T08:00:00.000Z', // 04:00 EDT
    );
    expect(calculateNextReview(fresh, 3, beforeFallBack, 'America/New_York').dueDate).toBe(
      '2026-11-01T09:00:00.000Z', // 04:00 EST
    );
  });
});

describe('Supabase review persistence and queries', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty queue for an empty deck', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({ eq: mockEqUser } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({ eq: mockEqDeck } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    await expect(getDueCards('user-1', 'deck-1', [])).resolves.toEqual([]);
  });

  it('excludes reviews whose cards no longer belong to the deck', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [{
        id: 'orphan-review', user_id: 'user-1', deck_id: 'deck-1', card_id: 'deleted-card',
        status: 'review', ease_factor: 2.5, interval: 1, repetitions: 1,
        due_date: '2026-08-29T10:00:00.000Z', last_reviewed_at: '2026-08-28T10:00:00.000Z',
        created_at: '2026-08-28T10:00:00.000Z',
      }],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({ eq: mockEqUser } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({ eq: mockEqDeck } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    const queue = await getDueCards(
      'user-1',
      'deck-1',
      [{ id: 'current-card', front: 'Current', back: 'Card' }],
      new Date('2026-08-29T12:00:00.000Z')
    );

    expect(queue.map(({ card }) => card.id)).toEqual(['current-card']);
    expect(queue[0].review).toBeNull();
  });

  it('includes a review due exactly at the supplied time', async () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [{
        id: 'boundary-review', user_id: 'user-1', deck_id: 'deck-1', card_id: 'card-1',
        status: 'review', ease_factor: 2.5, interval: 1, repetitions: 1,
        due_date: now.toISOString(), last_reviewed_at: '2026-08-28T12:00:00.000Z',
        created_at: '2026-08-28T12:00:00.000Z',
      }],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({ eq: mockEqUser } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({ eq: mockEqDeck } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    const queue = await getDueCards('user-1', 'deck-1', [{ id: 'card-1', front: 'A', back: 'a' }], now);

    expect(queue).toHaveLength(1);
    expect(queue[0].card.id).toBe('card-1');
  });

  describe('daily new-card budget', () => {
    const cards = Array.from({ length: 25 }, (_, index) => ({
      id: `new-${index}`,
      front: `Front ${index}`,
      back: `Back ${index}`,
    }));

    const introducedRow = (index: number, createdAt = '2026-08-29T08:00:00.000Z') => ({
      id: `rev-${index}`,
      user_id: 'user-1',
      deck_id: 'deck-1',
      card_id: `new-${index}`,
      status: 'review',
      ease_factor: 2.5,
      interval: 1,
      repetitions: 1,
      due_date: '2026-09-05T00:00:00.000Z',
      last_reviewed_at: createdAt,
      created_at: createdAt,
    });

    const mockRows = (rows: unknown[]) => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEqUser = vi.fn().mockReturnThis();
      const mockEqDeck = vi.fn().mockResolvedValue({ data: rows, error: null });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);
      mockSelect.mockReturnValue({ eq: mockEqUser } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
      mockEqUser.mockReturnValue({ eq: mockEqDeck } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);
    };

    it('subtracts the cards already introduced today from the budget', async () => {
      mockRows([0, 1, 2, 3, 4].map((index) => introducedRow(index)));

      const queue = await getDueCards('user-1', 'deck-1', cards, now, 'UTC');

      expect(queue.map(({ card }) => card.id)).toEqual(
        Array.from({ length: 15 }, (_, index) => `new-${index + 5}`),
      );
    });

    it('introduces no new cards once the daily budget is spent', async () => {
      mockRows(Array.from({ length: 20 }, (_, index) => introducedRow(index)));

      const queue = await getDueCards('user-1', 'deck-1', cards, now, 'UTC');

      expect(queue).toEqual([]);
    });

    it('ignores reviews from previous days and cards no longer in the deck', async () => {
      mockRows([
        introducedRow(0, '2026-08-28T08:00:00.000Z'),
        {
          ...introducedRow(1),
          id: 'rev-orphan',
          card_id: 'deleted-card',
        },
      ]);

      const queue = await getDueCards('user-1', 'deck-1', cards, now, 'UTC');

      // new-0 was introduced yesterday so it is no longer new, but it does not
      // consume today's budget either. The orphan row is ignored entirely.
      expect(queue).toHaveLength(20);
      expect(queue[0].card.id).toBe('new-1');
      expect(queue[19].card.id).toBe('new-20');
    });

    it('refreshes the budget at 04:00 local time, not at midnight', async () => {
      // 01:00 on Aug 30 in GMT+7 — still the Aug 29 study day.
      mockRows([0, 1, 2, 3, 4].map((index) => introducedRow(index, '2026-08-29T18:00:00.000Z')));

      const beforeRollover = new Date('2026-08-29T20:00:00.000Z'); // 03:00 Aug 30 local
      const afterRollover = new Date('2026-08-29T21:00:00.000Z'); // 04:00 Aug 30 local

      await expect(getDueCards('user-1', 'deck-1', cards, beforeRollover, 'Asia/Ho_Chi_Minh'))
        .resolves.toHaveLength(15);

      // A midnight boundary would still count these five as today's work.
      await expect(getDueCards('user-1', 'deck-1', cards, afterRollover, 'Asia/Ho_Chi_Minh'))
        .resolves.toHaveLength(20);
    });
  });

  it('fetches and orders due cards with relearning first, due reviews next, and up to 20 new cards', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rev-relearn',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'relearn',
          status: 'relearning',
          ease_factor: 2.3,
          interval: 0,
          repetitions: 0,
          due_date: '2026-08-29T11:00:00.000Z',
          last_reviewed_at: '2026-08-29T11:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
        {
          id: 'rev-due',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'due',
          status: 'review',
          ease_factor: 2.5,
          interval: 1,
          repetitions: 1,
          due_date: '2026-08-29T10:00:00.000Z',
          last_reviewed_at: '2026-08-28T10:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
        {
          id: 'rev-future',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'future',
          status: 'review',
          ease_factor: 2.5,
          interval: 6,
          repetitions: 2,
          due_date: '2026-09-04T10:00:00.000Z',
          last_reviewed_at: '2026-08-29T10:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    const cards = [
      { id: 'relearn', front: 'A', back: 'a' },
      { id: 'due', front: 'B', back: 'b' },
      { id: 'future', front: 'F', back: 'f' },
      ...Array.from({ length: 21 }, (_, index) => ({ id: `new-${index}`, front: `N${index}`, back: `n${index}` })),
    ];

    const queue = await getDueCards('user-1', 'deck-1', cards, now);

    expect(supabase.from).toHaveBeenCalledWith('card_reviews');
    expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockEqDeck).toHaveBeenCalledWith('deck_id', 'deck-1');
    expect(queue.map(({ card }) => card.id)).toEqual([
      'relearn',
      'due',
      ...Array.from({ length: 20 }, (_, index) => `new-${index}`),
    ]);
    expect(queue[0].review?.status).toBe('relearning');
    expect(queue[1].review?.status).toBe('review');
    expect(queue[2].review).toBeNull();
  });

  it('upserts reviewed cards with the calculated next SM-2 state', async () => {
    const existingRow = {
      id: 'rev-1',
      user_id: 'user-1',
      deck_id: 'deck-1',
      card_id: 'card-1',
      status: 'review',
      ease_factor: 2.5,
      interval: 1,
      repetitions: 0,
      due_date: '2026-08-29T10:00:00.000Z',
      last_reviewed_at: '2026-08-28T10:00:00.000Z',
      created_at: '2026-08-28T10:00:00.000Z',
    };

    const mockEqCard = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: existingRow,
      error: null,
    });

    const mockUpsert = vi.fn().mockReturnThis();
    const mockUpsertSelect = vi.fn().mockReturnThis();
    const mockUpsertSingle = vi.fn().mockResolvedValue({
      data: {
        ...existingRow,
        status: 'review',
        interval: 1,
        repetitions: 1,
        due_date: '2026-08-30T04:00:00.000Z',
        last_reviewed_at: '2026-08-29T12:00:00.000Z',
      },
      error: null,
    });

    const mockLogInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'card_reviews') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: mockEqCard.mockReturnValue({
                  maybeSingle: mockMaybeSingle,
                }),
              }),
            }),
          }),
          upsert: mockUpsert.mockReturnValue({
            select: mockUpsertSelect.mockReturnValue({
              single: mockUpsertSingle,
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'review_logs') {
        return { insert: mockLogInsert } as unknown as ReturnType<typeof supabase.from>;
      }
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    await reviewCard('user-1', 'deck-1', 'card-1', 3, now, 'UTC');

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        deck_id: 'deck-1',
        card_id: 'card-1',
        status: 'review',
        ease_factor: 2.5,
        interval: 1,
        repetitions: 1,
        due_date: '2026-08-30T04:00:00.000Z',
        last_reviewed_at: '2026-08-29T12:00:00.000Z',
      },
      { onConflict: 'user_id,deck_id,card_id' },
    );

    // The log records both sides of the transition so undo can restore it.
    expect(mockLogInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      deck_id: 'deck-1',
      card_id: 'card-1',
      quality: 3,
      prev_status: existingRow.status,
      prev_ease_factor: Number(existingRow.ease_factor),
      prev_interval: existingRow.interval,
      prev_repetitions: existingRow.repetitions,
      prev_due_date: existingRow.due_date,
      prev_last_reviewed_at: existingRow.last_reviewed_at,
      next_status: 'review',
      next_ease_factor: 2.5,
      next_interval: 1,
      next_repetitions: 1,
      next_due_date: '2026-08-30T04:00:00.000Z',
      reviewed_at: '2026-08-29T12:00:00.000Z',
    });
  });

  it('still saves the review when the log write fails', async () => {
    const savedRow = {
      id: 'rev-1',
      user_id: 'user-1',
      deck_id: 'deck-1',
      card_id: 'card-1',
      status: 'review',
      ease_factor: 2.5,
      interval: 1,
      repetitions: 1,
      due_date: '2026-08-30T04:00:00.000Z',
      last_reviewed_at: '2026-08-29T12:00:00.000Z',
      created_at: '2026-08-28T10:00:00.000Z',
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'card_reviews') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: savedRow, error: null }) }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        insert: () => Promise.resolve({ error: new Error('review_logs unavailable') }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await reviewCard('user-1', 'deck-1', 'card-1', 3, now, 'UTC');

    expect(result.interval).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('undo unavailable'),
      expect.anything(),
    );
    consoleError.mockRestore();
  });

  it('calculates deck progress buckets correctly', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [
        // due review (due <= now)
        {
          id: 'rev-1',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'c-1',
          status: 'review',
          ease_factor: 2.5,
          interval: 1,
          repetitions: 1,
          due_date: '2026-08-29T10:00:00.000Z',
          last_reviewed_at: '2026-08-28T10:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
        // learning / relearning
        {
          id: 'rev-2',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'c-2',
          status: 'relearning',
          ease_factor: 2.1,
          interval: 0,
          repetitions: 0,
          due_date: '2026-08-30T10:00:00.000Z',
          last_reviewed_at: '2026-08-28T10:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
        // mastered (interval >= 21)
        {
          id: 'rev-3',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'c-3',
          status: 'review',
          ease_factor: 2.5,
          interval: 21,
          repetitions: 3,
          due_date: '2026-09-19T10:00:00.000Z',
          last_reviewed_at: '2026-08-01T10:00:00.000Z',
          created_at: '2026-08-01T10:00:00.000Z',
        },
        // reviewed today and not due (done)
        {
          id: 'rev-4',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'c-4',
          status: 'review',
          ease_factor: 2.5,
          interval: 1,
          repetitions: 1,
          due_date: '2026-08-30T10:00:00.000Z',
          last_reviewed_at: '2026-08-29T08:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    const progress = await getDeckProgress(
      'user-1',
      'deck-1',
      ['c-1', 'c-2', 'c-3', 'c-4', 'c-5'].map((id) => ({ id })),
      now,
      'UTC',
    );

    expect(progress).toEqual({
      new: 1,
      learning: 1,
      due: 1,
      mastered: 1,
      done: 1,
    });
  });

  it('ignores reviews whose card was removed from the deck', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rev-live',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'kept',
          status: 'review',
          ease_factor: 2.5,
          interval: 25,
          repetitions: 3,
          due_date: '2026-09-20T10:00:00.000Z',
          last_reviewed_at: '2026-08-26T10:00:00.000Z',
          created_at: '2026-08-26T10:00:00.000Z',
        },
        {
          id: 'rev-orphan-due',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'deleted',
          status: 'review',
          ease_factor: 2.5,
          interval: 1,
          repetitions: 1,
          due_date: '2026-08-29T10:00:00.000Z',
          last_reviewed_at: '2026-08-28T10:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    const progress = await getDeckProgress('user-1', 'deck-1', [{ id: 'kept' }], now, 'UTC');

    // The deleted card must not inflate due/mastered, and the deck still has 1 card.
    expect(progress).toEqual({
      new: 0,
      learning: 0,
      due: 0,
      mastered: 1,
      done: 0,
    });
  });

  /** Wires `getDeckProgress` to return one row reviewed at `reviewedAt`. */
  function mockOneReviewedCard(reviewedAt: string) {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rev-1',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'card-1',
          status: 'review',
          ease_factor: 2.5,
          interval: 6,
          repetitions: 2,
          due_date: '2026-09-05T00:00:00.000Z',
          last_reviewed_at: reviewedAt,
          created_at: '2026-08-20T10:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);
  }

  it('rolls the study day over at 04:00 local time', async () => {
    // 00:30 on Aug 30 in GMT+7 still belongs to the Aug 29 study day.
    mockOneReviewedCard('2026-08-29T17:30:00.000Z');
    const cards = [{ id: 'card-1' }];

    const justBeforeRollover = new Date('2026-08-29T20:59:00.000Z'); // 03:59 Aug 30 local
    const justAfterRollover = new Date('2026-08-29T21:01:00.000Z'); // 04:01 Aug 30 local

    await expect(
      getDeckProgress('user-1', 'deck-1', cards, justBeforeRollover, 'Asia/Ho_Chi_Minh'),
    ).resolves.toMatchObject({ done: 1 });

    // Both timestamps share a calendar date, so a midnight boundary would still
    // report 1 here. Only the 04:00 boundary separates the two study days.
    await expect(
      getDeckProgress('user-1', 'deck-1', cards, justAfterRollover, 'Asia/Ho_Chi_Minh'),
    ).resolves.toMatchObject({ done: 0 });
  });

  it('counts "done" by the local day, not the UTC day', async () => {
    // 03:00 on Aug 30 local (study day Aug 29) against 04:30 the same morning
    // (study day Aug 30). In UTC both timestamps are still on Aug 29.
    mockOneReviewedCard('2026-08-29T20:00:00.000Z');
    const cards = [{ id: 'card-1' }];
    const localNow = new Date('2026-08-29T21:30:00.000Z');

    await expect(
      getDeckProgress('user-1', 'deck-1', cards, localNow, 'Asia/Ho_Chi_Minh'),
    ).resolves.toMatchObject({ done: 0 });
    await expect(
      getDeckProgress('user-1', 'deck-1', cards, localNow, 'UTC'),
    ).resolves.toMatchObject({ done: 1 });
  });

  it('uses each timestamp\'s own offset across a daylight-saving transition', async () => {
    // America/New_York springs forward on 2026-03-08: 23:30 EST Mar 7 becomes
    // 08:00 EDT Mar 8. A single fixed offset would put both on the same day.
    const reviewedAt = '2026-03-08T04:30:00.000Z';
    const localNow = new Date('2026-03-08T12:00:00.000Z');

    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rev-dst',
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'card-1',
          status: 'review',
          ease_factor: 2.5,
          interval: 6,
          repetitions: 2,
          due_date: '2026-03-14T00:00:00.000Z',
          last_reviewed_at: reviewedAt,
          created_at: '2026-03-01T10:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    await expect(
      getDeckProgress('user-1', 'deck-1', [{ id: 'card-1' }], localNow, 'America/New_York'),
    ).resolves.toMatchObject({ done: 0 });
  });

  it('loads progress for every deck in a single query', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rev-a',
          user_id: 'user-1',
          deck_id: 'deck-a',
          card_id: 'a-1',
          status: 'review',
          ease_factor: 2.5,
          interval: 1,
          repetitions: 1,
          due_date: '2026-08-29T10:00:00.000Z',
          last_reviewed_at: '2026-08-28T10:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
        {
          id: 'rev-b',
          user_id: 'user-1',
          deck_id: 'deck-b',
          card_id: 'b-1',
          status: 'relearning',
          ease_factor: 2.3,
          interval: 0,
          repetitions: 0,
          due_date: '2026-08-29T11:00:00.000Z',
          last_reviewed_at: '2026-08-29T11:00:00.000Z',
          created_at: '2026-08-28T10:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as unknown as ReturnType<typeof supabase.from>);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>);
    mockEqUser.mockReturnValue({
      in: mockIn,
    } as unknown as ReturnType<ReturnType<ReturnType<typeof supabase.from>['select']>['eq']>);

    const progress = await getDeckProgressBatch(
      'user-1',
      [
        { id: 'deck-a', cards: [{ id: 'a-1' }, { id: 'a-2' }] },
        { id: 'deck-b', cards: [{ id: 'b-1' }] },
      ],
      now,
      'UTC',
    );

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(mockIn).toHaveBeenCalledWith('deck_id', ['deck-a', 'deck-b']);
    expect(progress).toEqual({
      'deck-a': { new: 1, learning: 0, due: 1, mastered: 0, done: 0 },
      'deck-b': { new: 0, learning: 1, due: 1, mastered: 0, done: 0 },
    });
  });

  describe('undo', () => {
    interface LogFixture {
      id: string;
      card_id: string;
      prev_status: string;
      prev_ease_factor: number;
      prev_interval: number;
      prev_repetitions: number;
      prev_due_date: string | null;
      prev_last_reviewed_at: string | null;
    }

    const logRow: LogFixture = {
      id: 'log-1',
      card_id: 'card-1',
      prev_status: 'review',
      prev_ease_factor: 2.36,
      prev_interval: 6,
      prev_repetitions: 2,
      prev_due_date: '2026-09-04T12:00:00.000Z',
      prev_last_reviewed_at: '2026-08-29T12:00:00.000Z',
    };

    /**
     * Wires `from()` for both tables used by undo. `review_logs` needs two
     * shapes (select for the newest log, update to mark it undone), so the
     * returned object carries both.
     */
    function mockUndoTables(data: LogFixture | null) {
      const markUndone = vi.fn().mockResolvedValue({ error: null });
      const updateEqUser = vi.fn().mockReturnValue({ eq: markUndone });
      const updateEqId = vi.fn().mockReturnValue({ eq: updateEqUser });
      const update = vi.fn().mockReturnValue({ eq: updateEqId });

      const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const is = vi.fn().mockReturnValue({ order });
      const logsEqDeck = vi.fn().mockReturnValue({ is });
      const logsEqUser = vi.fn().mockReturnValue({ eq: logsEqDeck });
      const select = vi.fn().mockReturnValue({ eq: logsEqUser });

      const deleteCard = vi.fn().mockResolvedValue({ error: null });
      const deleteDeck = vi.fn().mockReturnValue({ eq: deleteCard });
      const deleteUser = vi.fn().mockReturnValue({ eq: deleteDeck });
      const remove = vi.fn().mockReturnValue({ eq: deleteUser });
      const upsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'review_logs') {
          return { select, update } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'card_reviews') {
          return { delete: remove, upsert } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      return { update, markUndone, remove, upsert, maybeSingle, order, limit };
    }

    it('deletes the review row when undoing a card’s first rating', async () => {
      const mocks = mockUndoTables({ ...logRow, prev_status: 'new', prev_interval: 0, prev_repetitions: 0, prev_due_date: null, prev_last_reviewed_at: null });

      const result = await undoLastReview('user-1', 'deck-1', now);

      expect(result).toEqual({ cardId: 'card-1', review: null });
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.update).toHaveBeenCalledWith({ undone_at: now.toISOString() });
    });

    it('restores the previous SM-2 state when undoing a later rating', async () => {
      const mocks = mockUndoTables(logRow);

      const result = await undoLastReview('user-1', 'deck-1', now);

      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          deck_id: 'deck-1',
          card_id: 'card-1',
          status: 'review',
          ease_factor: 2.36,
          interval: 6,
          repetitions: 2,
          due_date: '2026-09-04T12:00:00.000Z',
          last_reviewed_at: '2026-08-29T12:00:00.000Z',
        },
        { onConflict: 'user_id,deck_id,card_id' },
      );
      expect(result?.review).toMatchObject({
        cardId: 'card-1',
        status: 'review',
        easeFactor: 2.36,
        interval: 6,
        repetitions: 2,
        dueDate: '2026-09-04T12:00:00.000Z',
      });
      expect(mocks.update).toHaveBeenCalledWith({ undone_at: now.toISOString() });
    });

    it('returns null and writes nothing when no log is pending', async () => {
      const mocks = mockUndoTables(null);

      const result = await undoLastReview('user-1', 'deck-1', now);

      expect(result).toBeNull();
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(supabase.from).toHaveBeenCalledWith('review_logs');
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it('only looks at the newest non-undone log', async () => {
      const mocks = mockUndoTables(logRow);

      await undoLastReview('user-1', 'deck-1', now);

      expect(mocks.order).toHaveBeenCalledWith('reviewed_at', { ascending: false });
      expect(mocks.limit).toHaveBeenCalledWith(1);
    });
  });
});
