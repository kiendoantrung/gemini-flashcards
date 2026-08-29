import { describe, expect, it } from 'vitest';
import type { CardReview, DeckProgress } from '../types/flashcard';
import { calculateNextReview, formatNextInterval } from './spacedRepetitionService';

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
