import { supabase } from '../lib/supabase';
import type { CardReview, DeckProgress, Flashcard, ReviewStatus } from '../types/flashcard';

export type ReviewQuality = 1 | 2 | 3 | 4;
export type ReviewState = Pick<CardReview, 'status' | 'easeFactor' | 'interval' | 'repetitions'>;

const REVIEW_COLUMNS =
  'id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at';

const MASTERED_INTERVAL_DAYS = 21;
const NEW_CARD_LIMIT = 20;

const MIN_EASE_FACTOR = 1.3;
const FIRST_INTERVAL_DAYS = 1;
const SECOND_INTERVAL_DAYS = 6;
/** Hard barely grows the current interval; Easy adds a flat bonus on top of ease. */
const HARD_INTERVAL_MULTIPLIER = 1.2;
const EASY_INTERVAL_BONUS = 1.3;

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
    const easeFactor = Math.max(MIN_EASE_FACTOR, Math.round((current.easeFactor - 0.2) * 100) / 100);
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
    easeFactor = Math.max(MIN_EASE_FACTOR, Math.round((current.easeFactor - 0.15) * 100) / 100);
  } else if (quality === 4) {
    easeFactor = Math.round((current.easeFactor + 0.15) * 100) / 100;
  }

  // Four-grade, SM-2-inspired schedule: Hard lowers ease, Good preserves it,
  // and Easy raises it. The first two successful reviews establish the 1d/6d
  // learning steps; mature reviews apply the resulting ease exactly once.
  // Hard and Easy also stretch the interval itself, otherwise Hard would give
  // the same delay as Good while still costing ease.
  let interval: number;
  if (current.repetitions === 0) {
    // Sub-day learning steps are not modelled, so every first success waits a day.
    interval = FIRST_INTERVAL_DAYS;
  } else if (current.repetitions === 1) {
    if (quality === 2) {
      interval = Math.round(SECOND_INTERVAL_DAYS / HARD_INTERVAL_MULTIPLIER);
    } else if (quality === 4) {
      interval = Math.round(SECOND_INTERVAL_DAYS * EASY_INTERVAL_BONUS);
    } else {
      interval = SECOND_INTERVAL_DAYS;
    }
  } else {
    const goodInterval = current.interval * easeFactor;
    if (quality === 2) {
      interval = Math.max(1, Math.round(current.interval * HARD_INTERVAL_MULTIPLIER));
    } else if (quality === 4) {
      interval = Math.max(1, Math.round(goodInterval * EASY_INTERVAL_BONUS));
    } else {
      interval = Math.max(1, Math.round(goodInterval));
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
    .select(REVIEW_COLUMNS)
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

  // New cards are capped per session so a large deck does not dump every
  // unseen card at once. Reviewed cards are never capped: due work comes first.
  const sessionNewCards = newCards.slice(0, NEW_CARD_LIMIT);

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
    .select(REVIEW_COLUMNS)
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('card_id', cardId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  // Read-modify-write: two devices reviewing the same card within one request
  // window can lose an update (last write wins). Acceptable for a single-user
  // app; moving the schedule into an RPC would make it atomic.
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
    .select(REVIEW_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapRowToCardReview(data as CardReviewRow);
}

function currentUtcOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * Calendar day of `date` in the user's timezone, expressed as YYYY-MM-DD.
 * Comparing UTC days directly would put a 01:00 review in GMT+7 on the
 * previous day, so the offset is applied before slicing.
 */
function localDayKey(date: Date, utcOffsetMinutes: number): string {
  return new Date(date.getTime() + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function emptyProgress(): DeckProgress {
  return { new: 0, learning: 0, due: 0, mastered: 0, done: 0 };
}

/**
 * Counts a deck's buckets from already-fetched review rows.
 * Reviews whose card is no longer in the deck are dropped: cards live in the
 * `decks.cards` JSONB column, so deleting a card leaves its review row behind.
 */
function countProgress(
  reviews: CardReview[],
  cards: Pick<Flashcard, 'id'>[],
  now: Date,
  utcOffsetMinutes: number,
): DeckProgress {
  if (cards.length === 0) {
    return emptyProgress();
  }

  const cardIds = new Set(cards.map((card) => card.id));
  const relevantReviews = reviews.filter((review) => cardIds.has(review.cardId));

  const reviewedCardIds = new Set(relevantReviews.map((review) => review.cardId));
  const newCount = Math.max(cards.length - reviewedCardIds.size, 0);

  let learningCount = 0;
  let dueCount = 0;
  let masteredCount = 0;
  let doneCount = 0;

  const nowTime = now.getTime();
  const todayKey = localDayKey(now, utcOffsetMinutes);

  for (const review of relevantReviews) {
    if (review.status === 'learning' || review.status === 'relearning') {
      learningCount++;
    }

    const dueTime = new Date(review.dueDate).getTime();
    if (review.status !== 'new' && dueTime <= nowTime) {
      dueCount++;
    }

    if (review.interval >= MASTERED_INTERVAL_DAYS) {
      masteredCount++;
    }

    if (
      review.lastReviewedAt &&
      dueTime > nowTime &&
      localDayKey(new Date(review.lastReviewedAt), utcOffsetMinutes) === todayKey
    ) {
      doneCount++;
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

function groupReviewsByDeck(rows: CardReviewRow[]): Map<string, CardReview[]> {
  const byDeck = new Map<string, CardReview[]>();
  for (const row of rows) {
    const review = mapRowToCardReview(row);
    const bucket = byDeck.get(review.deckId);
    if (bucket) {
      bucket.push(review);
    } else {
      byDeck.set(review.deckId, [review]);
    }
  }
  return byDeck;
}

export async function getDeckProgress(
  userId: string,
  deckId: string,
  cards: Pick<Flashcard, 'id'>[],
  now: Date = new Date(),
  utcOffsetMinutes: number = currentUtcOffsetMinutes(),
): Promise<DeckProgress> {
  if (cards.length === 0) {
    return emptyProgress();
  }

  const { data, error } = await supabase
    .from('card_reviews')
    .select(REVIEW_COLUMNS)
    .eq('user_id', userId)
    .eq('deck_id', deckId);

  if (error) {
    throw error;
  }

  const reviews = ((data ?? []) as CardReviewRow[]).map(mapRowToCardReview);
  return countProgress(reviews, cards, now, utcOffsetMinutes);
}

/**
 * Progress for every deck in one round trip. The dashboard used to issue one
 * query per deck, which grows linearly with the number of decks.
 */
export async function getDeckProgressBatch(
  userId: string,
  decks: Array<{ id: string; cards: Pick<Flashcard, 'id'>[] }>,
  now: Date = new Date(),
  utcOffsetMinutes: number = currentUtcOffsetMinutes(),
): Promise<Record<string, DeckProgress>> {
  const deckIds = decks.map((deck) => deck.id);
  if (deckIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('card_reviews')
    .select(REVIEW_COLUMNS)
    .eq('user_id', userId)
    .in('deck_id', deckIds);

  if (error) {
    throw error;
  }

  const byDeck = groupReviewsByDeck((data ?? []) as CardReviewRow[]);

  const progressById: Record<string, DeckProgress> = {};
  for (const deck of decks) {
    progressById[deck.id] = countProgress(byDeck.get(deck.id) ?? [], deck.cards, now, utcOffsetMinutes);
  }
  return progressById;
}
