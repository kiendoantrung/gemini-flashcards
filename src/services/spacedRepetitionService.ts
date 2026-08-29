import { supabase } from '../lib/supabase';
import type { CardReview, DeckProgress, Flashcard, ReviewStatus } from '../types/flashcard';

export type ReviewQuality = 1 | 2 | 3 | 4;
export type ReviewState = Pick<CardReview, 'status' | 'easeFactor' | 'interval' | 'repetitions'>;

export interface DueCard {
  card: Flashcard;
  review: CardReview | null;
}

interface CardReviewRow {
  id: string;
  user_id: string;
  deck_id: string;
  card_id: string;
  status: ReviewStatus;
  ease_factor: number | string;
  interval: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string | null;
  created_at: string;
}

function mapRowToCardReview(row: CardReviewRow): CardReview {
  return {
    id: row.id,
    userId: row.user_id,
    deckId: row.deck_id,
    cardId: row.card_id,
    status: row.status,
    easeFactor: Number(row.ease_factor),
    interval: row.interval,
    repetitions: row.repetitions,
    dueDate: row.due_date,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
  };
}

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

export async function getDueCards(
  userId: string,
  deckId: string,
  allCards: Flashcard[],
  now: Date = new Date(),
): Promise<DueCard[]> {
  const { data, error } = await supabase
    .from('card_reviews')
    .select('id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at')
    .eq('user_id', userId)
    .eq('deck_id', deckId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CardReviewRow[];
  const reviewsByCardId = new Map<string, CardReview>();
  for (const row of rows) {
    reviewsByCardId.set(row.card_id, mapRowToCardReview(row));
  }

  const relearningDue: DueCard[] = [];
  const reviewDue: DueCard[] = [];
  const newCards: DueCard[] = [];

  const nowTime = now.getTime();

  for (const card of allCards) {
    const review = reviewsByCardId.get(card.id);
    if (!review) {
      newCards.push({ card, review: null });
    } else {
      const dueTime = new Date(review.dueDate).getTime();
      if (dueTime <= nowTime) {
        if (review.status === 'relearning' || review.status === 'learning') {
          relearningDue.push({ card, review });
        } else {
          reviewDue.push({ card, review });
        }
      }
    }
  }

  relearningDue.sort((a, b) => new Date(a.review!.dueDate).getTime() - new Date(b.review!.dueDate).getTime());
  reviewDue.sort((a, b) => new Date(a.review!.dueDate).getTime() - new Date(b.review!.dueDate).getTime());

  const sessionNewCards = newCards.slice(0, 20);

  return [...relearningDue, ...reviewDue, ...sessionNewCards];
}

export async function reviewCard(
  userId: string,
  deckId: string,
  cardId: string,
  quality: ReviewQuality,
  now: Date = new Date(),
): Promise<CardReview> {
  const { data: existingData, error: fetchError } = await supabase
    .from('card_reviews')
    .select('id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('card_id', cardId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const existingReview = existingData ? mapRowToCardReview(existingData as CardReviewRow) : null;
  const currentState: ReviewState = existingReview
    ? {
        status: existingReview.status,
        easeFactor: existingReview.easeFactor,
        interval: existingReview.interval,
        repetitions: existingReview.repetitions,
      }
    : {
        status: 'new',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
      };

  const nextState = calculateNextReview(currentState, quality, now);

  const upsertPayload = {
    user_id: userId,
    deck_id: deckId,
    card_id: cardId,
    status: nextState.status,
    ease_factor: nextState.easeFactor,
    interval: nextState.interval,
    repetitions: nextState.repetitions,
    due_date: nextState.dueDate,
    last_reviewed_at: nextState.lastReviewedAt,
  };

  const { data, error } = await supabase
    .from('card_reviews')
    .upsert(upsertPayload, { onConflict: 'user_id,deck_id,card_id' })
    .select('id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  return mapRowToCardReview(data as CardReviewRow);
}

export async function getDeckProgress(
  userId: string,
  deckId: string,
  totalCards: number,
  now: Date = new Date(),
): Promise<DeckProgress> {
  if (totalCards === 0) {
    return { new: 0, learning: 0, due: 0, mastered: 0, done: 0 };
  }

  const { data, error } = await supabase
    .from('card_reviews')
    .select('id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at')
    .eq('user_id', userId)
    .eq('deck_id', deckId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CardReviewRow[];
  const reviews = rows.map(mapRowToCardReview);

  const uniqueKnownCardIds = new Set(reviews.map((r) => r.cardId));
  const newCount = Math.max(totalCards - uniqueKnownCardIds.size, 0);

  let learningCount = 0;
  let dueCount = 0;
  let masteredCount = 0;
  let doneCount = 0;

  const nowTime = now.getTime();
  const nowIsoDateString = now.toISOString().slice(0, 10);

  for (const review of reviews) {
    if (review.status === 'learning' || review.status === 'relearning') {
      learningCount++;
    }

    const dueTime = new Date(review.dueDate).getTime();
    if (review.status !== 'new' && dueTime <= nowTime) {
      dueCount++;
    }

    if (review.interval >= 21) {
      masteredCount++;
    }

    if (review.lastReviewedAt) {
      const reviewedDateIsoString = new Date(review.lastReviewedAt).toISOString().slice(0, 10);
      if (reviewedDateIsoString === nowIsoDateString && dueTime > nowTime) {
        doneCount++;
      }
    }
  }

  return {
    new: newCount,
    learning: learningCount,
    due: dueCount,
    mastered: masteredCount,
    done: doneCount,
  };
}
