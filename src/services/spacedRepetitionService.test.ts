import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CardReview, DeckProgress } from '../types/flashcard';
import {
  calculateNextReview,
  formatNextInterval,
  getDueCards,
  reviewCard,
  getDeckProgress,
  getDeckProgressBatch,
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
    expect(calculateNextReview({ ...fresh, easeFactor: 1.35, repetitions: 4, interval: 10 }, 1, now))
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
    expect(calculateNextReview(fresh, quality, now))
      .toMatchObject({
        status: 'review',
        repetitions: 1,
        interval: 1,
        easeFactor,
      });
  });

  it.each([
    [2, 2.35],
    [3, 2.5],
    [4, 2.65],
  ] as const)('schedules the second successful review for quality %i after six days', (quality, easeFactor) => {
    expect(calculateNextReview({ ...fresh, repetitions: 1 }, quality, now)).toMatchObject({
      repetitions: 2,
      interval: 6,
      easeFactor,
    });
  });

  it.each([
    [2, 24, 2.35],
    [3, 25, 2.5],
    [4, 27, 2.65],
  ] as const)('applies the updated ease factor once to mature cards for quality %i', (quality, interval, easeFactor) => {
    expect(calculateNextReview({ status: 'review', repetitions: 2, interval: 10, easeFactor: 2.5 }, quality, now))
      .toMatchObject({
        repetitions: 3,
        interval,
        easeFactor,
      });
  });

  it('keeps the ease factor at its 1.3 lower bound across repeated Again ratings', () => {
    const onceAgain = calculateNextReview({ ...fresh, easeFactor: 1.3 }, 1, now);
    const twiceAgain = calculateNextReview(onceAgain, 1, now);

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
        due_date: '2026-08-30T12:00:00.000Z',
        last_reviewed_at: '2026-08-29T12:00:00.000Z',
      },
      error: null,
    });

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
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    await reviewCard('user-1', 'deck-1', 'card-1', 3, now);

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        deck_id: 'deck-1',
        card_id: 'card-1',
        status: 'review',
        ease_factor: 2.5,
        interval: 1,
        repetitions: 1,
        due_date: '2026-08-30T12:00:00.000Z',
        last_reviewed_at: '2026-08-29T12:00:00.000Z',
      },
      { onConflict: 'user_id,deck_id,card_id' },
    );
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
      0,
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

    const progress = await getDeckProgress('user-1', 'deck-1', [{ id: 'kept' }], now, 0);

    // The deleted card must not inflate due/mastered, and the deck still has 1 card.
    expect(progress).toEqual({
      new: 0,
      learning: 0,
      due: 0,
      mastered: 1,
      done: 0,
    });
  });

  it('counts "done" by the local calendar day, not the UTC day', async () => {
    const reviewedAt = '2026-08-29T17:30:00.000Z'; // 00:30 on Aug 30 in GMT+7
    const localNow = new Date('2026-08-30T00:00:00.000Z'); // 07:00 on Aug 30 in GMT+7

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

    const cards = [{ id: 'card-1' }];

    // GMT+7: both timestamps fall on Aug 30 locally.
    await expect(getDeckProgress('user-1', 'deck-1', cards, localNow, 420)).resolves.toMatchObject({ done: 1 });
    // UTC: the review is still on Aug 29, so the old behaviour reported nothing.
    await expect(getDeckProgress('user-1', 'deck-1', cards, localNow, 0)).resolves.toMatchObject({ done: 0 });
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
      0,
    );

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(mockIn).toHaveBeenCalledWith('deck_id', ['deck-a', 'deck-b']);
    expect(progress).toEqual({
      'deck-a': { new: 1, learning: 0, due: 1, mastered: 0, done: 0 },
      'deck-b': { new: 0, learning: 1, due: 1, mastered: 0, done: 0 },
    });
  });
});
