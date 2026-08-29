import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CardReview, DeckProgress } from '../types/flashcard';
import {
  calculateNextReview,
  formatNextInterval,
  getDueCards,
  reviewCard,
  getDeckProgress,
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

describe('SM-2 calculation', () => {
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
    [2, 1, 2.35],
    [3, 1, 2.5],
    [4, 1, 2.65],
  ] as const)('schedules first successful review for quality %i', (quality, interval, easeFactor) => {
    expect(calculateNextReview(fresh, quality, now))
      .toMatchObject({
        status: 'review',
        repetitions: 1,
        interval,
        easeFactor,
      });
  });

  it('uses six days for a second success and applies the Easy modifier', () => {
    expect(calculateNextReview({ ...fresh, repetitions: 1 }, 4, now))
      .toMatchObject({
        repetitions: 2,
        interval: 8,
        easeFactor: 2.65,
      });
  });

  it('schedules mature cards using base interval and Good multiplier', () => {
    expect(calculateNextReview({ status: 'review', repetitions: 2, interval: 10, easeFactor: 2.5 }, 3, now))
      .toMatchObject({
        repetitions: 3,
        interval: 63,
        easeFactor: 2.5,
      });
  });

  it('formats next interval predictions correctly', () => {
    expect(formatNextInterval({ status: 'relearning', interval: 0 })).toBe('<1m');
    expect(formatNextInterval({ status: 'review', interval: 1 })).toBe('1d');
    expect(formatNextInterval({ status: 'review', interval: 6 })).toBe('6d');
    expect(formatNextInterval({ status: 'review', interval: 8 })).toBe('8d');
  });
});

describe('Supabase review persistence and queries', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
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
    } as any);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as any);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as any);

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

    const mockSelect = vi.fn().mockReturnThis();
    const mockEqUser = vi.fn().mockReturnThis();
    const mockEqDeck = vi.fn().mockReturnThis();
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
          select: (columns: string) => ({
            eq: (col1: string, val1: string) => ({
              eq: (col2: string, val2: string) => ({
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
        } as any;
      }
      return {} as any;
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
    } as any);
    mockSelect.mockReturnValue({
      eq: mockEqUser,
    } as any);
    mockEqUser.mockReturnValue({
      eq: mockEqDeck,
    } as any);

    const progress = await getDeckProgress('user-1', 'deck-1', 5, now);

    expect(progress).toEqual({
      new: 1,
      learning: 1,
      due: 1,
      mastered: 1,
      done: 1,
    });
  });
});
