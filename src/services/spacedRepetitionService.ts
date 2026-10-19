import { supabase } from '../lib/supabase';
import type { CardReview, DeckProgress, Flashcard, ReviewStatus } from '../types/flashcard';

export type ReviewQuality = 1 | 2 | 3 | 4;
export type ReviewState = Pick<CardReview, 'status' | 'easeFactor' | 'interval' | 'repetitions'>;

const REVIEW_COLUMNS =
  'id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at';

const MASTERED_INTERVAL_DAYS = 21;
const DAILY_NEW_CARD_LIMIT = 20;

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
  timeZone: string = currentTimeZone(),
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

  // The new-card budget is per deck per local day, not per session: without
  // this, reopening the deck would hand out another 20 unseen cards and let a
  // user burn through a large deck in one sitting.
  const cardIds = new Set(allCards.map((card) => card.id));
  const todayKey = localDayKey(now, timeZone);
  const introducedToday = rows.filter(
    (row) =>
      cardIds.has(row.card_id) &&
      localDayKey(new Date(row.created_at), timeZone) === todayKey,
  ).length;
  const remainingNewBudget = Math.max(0, DAILY_NEW_CARD_LIMIT - introducedToday);

  const sessionNewCards = newCards.slice(0, remainingNewBudget);

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

  const savedReview = mapRowToCardReview(data as CardReviewRow);

  // The rating is already persisted at this point. A failed log write costs the
  // user the ability to undo this one rating, which is a far better outcome than
  // surfacing an error for a review that did save.
  const { error: logError } = await supabase.from('review_logs').insert({
    user_id: userId,
    deck_id: deckId,
    card_id: cardId,
    quality,
    prev_status: currentState.status,
    prev_ease_factor: currentState.easeFactor,
    prev_interval: currentState.interval,
    prev_repetitions: currentState.repetitions,
    prev_due_date: existingReview?.dueDate ?? null,
    prev_last_reviewed_at: existingReview?.lastReviewedAt ?? null,
    next_status: nextState.status,
    next_ease_factor: nextState.easeFactor,
    next_interval: nextState.interval,
    next_repetitions: nextState.repetitions,
    next_due_date: nextState.dueDate,
    reviewed_at: nextState.lastReviewedAt,
  });

  if (logError) {
    console.error('Review saved but its log was not written; undo unavailable for this rating:', logError);
  }

  return savedReview;
}

export interface UndoResult {
  cardId: string;
  /** Null when the undone rating was the card's first one: it is new again. */
  review: CardReview | null;
}

interface ReviewLogRow {
  id: string;
  card_id: string;
  prev_status: ReviewStatus;
  prev_ease_factor: number | string;
  prev_interval: number;
  prev_repetitions: number;
  prev_due_date: string | null;
  prev_last_reviewed_at: string | null;
}

/**
 * Reverts the newest non-undone rating in a deck and marks it undone.
 * Returns null when there is nothing to undo.
 */
export async function undoLastReview(
  userId: string,
  deckId: string,
  now: Date = new Date(),
): Promise<UndoResult | null> {
  const { data, error } = await supabase
    .from('review_logs')
    .select('id, card_id, prev_status, prev_ease_factor, prev_interval, prev_repetitions, prev_due_date, prev_last_reviewed_at')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .is('undone_at', null)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const log = data as ReviewLogRow;
  const wasFirstReview = log.prev_status === 'new';

  if (wasFirstReview) {
    const { error: deleteError } = await supabase
      .from('card_reviews')
      .delete()
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .eq('card_id', log.card_id);

    if (deleteError) {
      throw deleteError;
    }
  } else {
    const { error: restoreError } = await supabase
      .from('card_reviews')
      .upsert(
        {
          user_id: userId,
          deck_id: deckId,
          card_id: log.card_id,
          status: log.prev_status,
          ease_factor: Number(log.prev_ease_factor),
          interval: log.prev_interval,
          repetitions: log.prev_repetitions,
          due_date: log.prev_due_date ?? now.toISOString(),
          last_reviewed_at: log.prev_last_reviewed_at,
        },
        { onConflict: 'user_id,deck_id,card_id' },
      );

    if (restoreError) {
      throw restoreError;
    }
  }

  const { error: markError } = await supabase
    .from('review_logs')
    .update({ undone_at: now.toISOString() })
    .eq('id', log.id)
    .eq('user_id', userId);

  if (markError) {
    throw markError;
  }

  return {
    cardId: log.card_id,
    review: wasFirstReview
      ? null
      : {
          id: '',
          userId,
          deckId,
          cardId: log.card_id,
          status: log.prev_status,
          easeFactor: Number(log.prev_ease_factor),
          interval: log.prev_interval,
          repetitions: log.prev_repetitions,
          dueDate: log.prev_due_date ?? now.toISOString(),
          lastReviewedAt: log.prev_last_reviewed_at,
          createdAt: now.toISOString(),
        },
  };
}

function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Calendar day of `date` in the given timezone, expressed as YYYY-MM-DD.
 * Comparing UTC days directly would put a 01:00 review in GMT+7 on the
 * previous day. A timezone name is used instead of a fixed offset because
 * the offset changes across a daylight-saving transition, and the two
 * timestamps being compared can sit on different sides of it.
 */
function localDayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
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
  timeZone: string,
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
  const todayKey = localDayKey(now, timeZone);

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
      localDayKey(new Date(review.lastReviewedAt), timeZone) === todayKey
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
  timeZone: string = currentTimeZone(),
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
  return countProgress(reviews, cards, now, timeZone);
}

/**
 * Progress for every deck in one round trip. The dashboard used to issue one
 * query per deck, which grows linearly with the number of decks.
 */
export async function getDeckProgressBatch(
  userId: string,
  decks: Array<{ id: string; cards: Pick<Flashcard, 'id'>[] }>,
  now: Date = new Date(),
  timeZone: string = currentTimeZone(),
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
    progressById[deck.id] = countProgress(byDeck.get(deck.id) ?? [], deck.cards, now, timeZone);
  }
  return progressById;
}
