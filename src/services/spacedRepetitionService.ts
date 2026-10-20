import { supabase } from '../lib/supabase';
import type { CardReview, DeckProgress, Flashcard, ReviewStatus } from '../types/flashcard';

export type ReviewQuality = 1 | 2 | 3 | 4;
export type ReviewState = Pick<CardReview, 'status' | 'easeFactor' | 'interval' | 'repetitions'>;

const REVIEW_COLUMNS =
  'id, user_id, deck_id, card_id, status, ease_factor, interval, repetitions, due_date, last_reviewed_at, created_at';

const MASTERED_INTERVAL_DAYS = 21;
const DAILY_NEW_CARD_LIMIT = 20;

const MIN_EASE_FACTOR = 1.3;
/**
 * Ceiling on ease. Ease compounds, so a card answered Easy a few times in a row
 * would otherwise reach intervals in the thousands of days before the interval
 * cap below ever binds. Anki allows up to 5.0; with a one-year interval ceiling
 * anything past 3.0 has no practical effect, so the tighter bound is used.
 */
const MAX_EASE_FACTOR = 3.0;
const FIRST_INTERVAL_DAYS = 1;
/**
 * Easy on a card that is still learning skips the 1-day step entirely, so the
 * first grade on a new card actually differs: Again and Hard repeat the step,
 * Good graduates to 1 day, Easy graduates to 4.
 */
const EASY_LEARNING_INTERVAL_DAYS = 4;
const SECOND_INTERVAL_DAYS = 6;
/** Hard barely grows the current interval; Easy adds a flat bonus on top of ease. */
const HARD_INTERVAL_MULTIPLIER = 1.2;
const EASY_INTERVAL_BONUS = 1.3;
/**
 * A card is never scheduled further out than this. Without a ceiling a mature
 * card reaches multi-year intervals, which for a personal deck means it is
 * effectively gone.
 */
const MAX_INTERVAL_DAYS = 365;
/**
 * Intervals are randomised by up to 5% (at least one day) so that cards learned
 * on the same day do not come due as one clump forever. Below this threshold
 * fuzzing is pointless: 5% of one day rounds to zero.
 */
const FUZZ_RATIO = 0.05;
const FUZZ_MIN_INTERVAL_DAYS = 2;

/**
 * The study day rolls over at 04:00 local time, not midnight (the Anki
 * convention). Someone reviewing at 01:00 is still in the previous day's
 * session: their "done" count keeps climbing and the daily new-card budget
 * does not silently refresh while they are still studying.
 */
export const DAY_ROLLOVER_HOUR = 4;

const HOUR_MS = 60 * 60 * 1000;

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

/**
 * `now` and `timeZone` both default to the ambient values for convenience in
 * the UI, but the result now depends on the timezone, so tests must pass both
 * explicitly or they will pass locally and fail on a machine in another zone.
 */
export function calculateNextReview(
  current: ReviewState,
  quality: ReviewQuality,
  now: Date = new Date(),
  timeZone: string = getTimeZone(),
): ReviewState & { dueDate: string; lastReviewedAt: string } {
  const nowIso = now.toISOString();

  if (quality === 1) {
    const easeFactor = Math.max(MIN_EASE_FACTOR, Math.round((current.easeFactor - 0.2) * 100) / 100);
    return {
      // A card that has never graduated is still learning; only a card that
      // once had a real interval and then failed is relearning.
      status: current.repetitions === 0 ? 'learning' : 'relearning',
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
    easeFactor = Math.min(MAX_EASE_FACTOR, Math.round((current.easeFactor + 0.15) * 100) / 100);
  }

  // Four-grade, SM-2-inspired schedule: Hard lowers ease, Good preserves it,
  // and Easy raises it. The first two successful reviews establish the 1d/6d
  // learning steps; mature reviews apply the resulting ease exactly once.
  // Hard and Easy also stretch the interval itself, otherwise Hard would give
  // the same delay as Good while still costing ease.
  let interval: number;
  if (current.repetitions === 0) {
    if (quality === 2) {
      // Hard repeats the learning step instead of graduating. Before this, a
      // new card's first Hard, Good and Easy all produced the same one-day
      // interval, so the three buttons were indistinguishable.
      return {
        status: 'learning',
        repetitions: 0,
        interval: 0,
        easeFactor,
        dueDate: nowIso,
        lastReviewedAt: nowIso,
      };
    }
    interval = quality === 4 ? EASY_LEARNING_INTERVAL_DAYS : FIRST_INTERVAL_DAYS;
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

  const dueDate = dueDateFor(now, Math.min(interval, MAX_INTERVAL_DAYS), timeZone);

  return {
    status: 'review',
    repetitions: current.repetitions + 1,
    interval: Math.min(interval, MAX_INTERVAL_DAYS),
    easeFactor,
    dueDate,
    lastReviewedAt: nowIso,
  };
}

/**
 * Spreads an interval by up to FUZZ_RATIO so cards sharing a learn date drift
 * apart instead of coming due together forever. The jitter is at least one day
 * because 5% of a short interval rounds to zero, which would leave small
 * intervals un-fuzzed and still clumped.
 *
 * Kept out of calculateNextReview on purpose: the review screen recomputes four
 * interval previews on every render, and a random result there would make the
 * "8d" badges flicker. Anki also shows the un-fuzzed number in the preview.
 */
function fuzzInterval(interval: number, random: () => number): number {
  if (interval < FUZZ_MIN_INTERVAL_DAYS) {
    return interval;
  }

  const spread = Math.max(1, Math.round(interval * FUZZ_RATIO));
  const offset = Math.floor(random() * (spread * 2 + 1)) - spread;
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, interval + offset));
}

export function formatNextInterval(next: Pick<ReviewState, 'interval' | 'status'>): string {
  const isLearningStep =
    (next.status === 'learning' || next.status === 'relearning') && next.interval === 0;
  return isLearningStep ? '<1m' : `${next.interval}d`;
}

export async function getDueCards(
  userId: string,
  deckId: string,
  allCards: Flashcard[],
  now: Date = new Date(),
  timeZone: string = getTimeZone(),
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
  const todayKey = studyDayKey(now, timeZone);
  const introducedToday = rows.filter(
    (row) =>
      cardIds.has(row.card_id) &&
      studyDayKey(new Date(row.created_at), timeZone) === todayKey,
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
  timeZone: string = getTimeZone(),
  /** Injectable so tests can pin the fuzz instead of asserting a range. */
  random: () => number = Math.random,
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

  const nextState = calculateNextReview(currentState, quality, now, timeZone);

  // Fuzz here rather than in calculateNextReview: this is the value that gets
  // persisted, while the UI preview must stay stable across re-renders.
  const interval = fuzzInterval(nextState.interval, random);
  const dueDate =
    interval === nextState.interval ? nextState.dueDate : dueDateFor(now, interval, timeZone);

  const upsertPayload = {
    user_id: userId,
    deck_id: deckId,
    card_id: cardId,
    status: nextState.status,
    ease_factor: nextState.easeFactor,
    interval,
    repetitions: nextState.repetitions,
    due_date: dueDate,
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
    // The fuzzed values, so the log matches the row that was actually written.
    next_interval: interval,
    next_repetitions: nextState.repetitions,
    next_due_date: dueDate,
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
  /**
   * True when the card had already been removed from the deck. Nothing was
   * restored; the stale review row was deleted instead.
   */
  cardMissing?: boolean;
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
 * Whether a card is still part of its deck. Cards live in the deck's `cards`
 * JSONB column rather than their own table, so deleting one leaves any
 * `card_reviews` row behind.
 */
async function deckHasCard(userId: string, deckId: string, cardId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('decks')
    .select('cards')
    .eq('id', deckId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const cards = (data as { cards?: { id?: string }[] } | null)?.cards;
  return Array.isArray(cards) && cards.some((card) => card?.id === cardId);
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

  // The card may have been deleted from the deck between the rating and the
  // undo. Restoring its state would recreate an orphan `card_reviews` row that
  // nothing can ever read, so check first and clean up instead.
  const cardExists = await deckHasCard(userId, deckId, log.card_id);
  let restoredReview: CardReview | null = null;

  if (!cardExists) {
    const { error: cleanupError } = await supabase
      .from('card_reviews')
      .delete()
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .eq('card_id', log.card_id);

    if (cleanupError) {
      throw cleanupError;
    }
  } else if (wasFirstReview) {
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

    restoredReview = {
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
    };
  }

  const { error: markError } = await supabase
    .from('review_logs')
    .update({ undone_at: now.toISOString() })
    .eq('id', log.id)
    .eq('user_id', userId);

  if (markError) {
    throw markError;
  }

  const result: UndoResult = { cardId: log.card_id, review: restoredReview };
  if (!cardExists) {
    result.cardMissing = true;
  }
  return result;
}

export function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Formatters are cached because constructing one costs about ten times as much
 * as formatting with an existing one, and the review screen recomputes four
 * interval previews on every render. The key set is tiny: a user has one or two
 * timezones per session.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string, withTime: boolean): Intl.DateTimeFormat {
  const cacheKey = `${withTime ? 'datetime' : 'date'}:${timeZone}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(
    'en-US',
    withTime
      ? {
          timeZone,
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }
      : { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' },
  );
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

/**
 * Logical study day of `date` in the given timezone, expressed as YYYY-MM-DD,
 * with the day starting at DAY_ROLLOVER_HOUR rather than midnight.
 *
 * Shifting the instant back by the rollover amount moves the boundary without
 * any wall-clock arithmetic, which keeps it correct across a daylight-saving
 * transition: the shift is applied to an instant, then read in the timezone.
 *
 * A timezone name is used instead of a fixed offset because the offset changes
 * across a DST transition, and the two timestamps being compared can sit on
 * different sides of it.
 */
export function studyDayKey(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() - DAY_ROLLOVER_HOUR * HOUR_MS);
  const parts = formatterFor(timeZone, false).formatToParts(shifted);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Offset of `timeZone` at `date`, in milliseconds (local wall clock minus UTC). */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = formatterFor(timeZone, true).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);

  // Some engines report midnight as hour 24 under hour12: false.
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour') % 24,
    part('minute'),
    part('second'),
  );

  return wallClock - date.getTime();
}

/** Adds whole calendar days to a YYYY-MM-DD key. */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** The instant at which the logical day `dayKey` starts in `timeZone`. */
function dayStartForKey(dayKey: string, timeZone: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, DAY_ROLLOVER_HOUR, 0, 0);

  // Two passes: the first offset is read at the uncorrected instant, which is
  // the wrong side of a DST transition; the second pass uses the corrected one.
  let instant = wallClock;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wallClock - timeZoneOffsetMs(new Date(instant), timeZone);
  }

  return new Date(instant);
}

/**
 * Due at the start of the study day `interval` days from now, not `interval`
 * × 24h after the rating. Without this a card rated at 23:00 stays hidden until
 * 23:00 days later, so a user who studies in the evening watches due cards
 * drift out of their study window one day at a time.
 */
function dueDateFor(now: Date, interval: number, timeZone: string): string {
  const targetKey = addDaysToDayKey(studyDayKey(now, timeZone), interval);
  return dayStartForKey(targetKey, timeZone).toISOString();
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
  const todayKey = studyDayKey(now, timeZone);

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
      studyDayKey(new Date(review.lastReviewedAt), timeZone) === todayKey
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
  timeZone: string = getTimeZone(),
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
  timeZone: string = getTimeZone(),
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
