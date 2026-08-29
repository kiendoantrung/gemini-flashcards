import type { CardReview } from '../types/flashcard';

export type ReviewQuality = 1 | 2 | 3 | 4;
export type ReviewState = Pick<CardReview, 'status' | 'easeFactor' | 'interval' | 'repetitions'>;

export function calculateNextReview(
  current: ReviewState,
  quality: ReviewQuality,
  now: Date = new Date(),
): ReviewState & { dueDate: string; lastReviewedAt: string } {
  const nowIso = now.toISOString();

  if (quality === 1) {
    const easeFactor = Math.max(1.3, Math.round((current.easeFactor - 0.2) * 100) / 100);
    return {
      status: 'relearning',
      repetitions: 0,
      interval: 0,
      easeFactor,
      dueDate: nowIso,
      lastReviewedAt: nowIso,
    };
  }

  let easeFactor = current.easeFactor;
  if (quality === 2) {
    easeFactor = Math.max(1.3, Math.round((current.easeFactor - 0.15) * 100) / 100);
  } else if (quality === 4) {
    easeFactor = Math.round((current.easeFactor + 0.15) * 100) / 100;
  }

  let interval: number;
  if (current.repetitions === 0) {
    interval = 1;
  } else if (current.repetitions === 1) {
    if (quality === 2) {
      interval = Math.round(6 * 1.2);
    } else if (quality === 4) {
      interval = Math.round(6 * 1.3);
    } else {
      interval = 6;
    }
  } else {
    const base = Math.round(current.interval * current.easeFactor);
    if (quality === 2) {
      interval = Math.max(1, Math.round(base * 1.2));
    } else if (quality === 4) {
      interval = Math.max(1, Math.round(base * current.easeFactor * 1.3));
    } else {
      interval = Math.max(1, Math.round(base * current.easeFactor));
    }
  }

  const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();

  return {
    status: 'review',
    repetitions: current.repetitions + 1,
    interval,
    easeFactor,
    dueDate,
    lastReviewedAt: nowIso,
  };
}

export function formatNextInterval(next: Pick<ReviewState, 'interval' | 'status'>): string {
  return next.status === 'relearning' && next.interval === 0 ? '<1m' : `${next.interval}d`;
}
