import { describe, expect, it } from 'vitest';
import type { CardReview, DeckProgress } from '../types/flashcard';

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
