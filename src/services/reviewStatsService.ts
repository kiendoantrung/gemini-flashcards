import { supabase } from '../lib/supabase';
import type { DailyReviewCount, Deck, DeckRetention, Flashcard, ReviewStats } from '../types/flashcard';
import { addDaysToDayKey, getTimeZone, studyDayKey } from './spacedRepetitionService';

const DEFAULT_WINDOW_DAYS = 30;
const FORECAST_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A rating counts as remembered when it was not Again. This mirrors the
 * session summary's retention figure, so the two screens never disagree.
 */
const PASSING_QUALITY = 2;

interface ReviewLogRow {
  deck_id: string;
  quality: number;
  reviewed_at: string;
}

interface DueRow {
  deck_id: string;
  card_id: string;
  due_date: string;
}

function emptyStats(windowDays: number, todayKey: string): ReviewStats {
  return {
    totalReviews: 0,
    passedReviews: 0,
    retention: 0,
    activeDays: 0,
    currentStreak: 0,
    daily: Array.from({ length: windowDays }, (_, index) => ({
      dayKey: addDaysToDayKey(todayKey, index - (windowDays - 1)),
      total: 0,
      passed: 0,
      again: 0,
    })),
    byDeck: [],
    forecast: Array.from({ length: FORECAST_DAYS }, (_, index) => ({
      dayKey: addDaysToDayKey(todayKey, index),
      due: 0,
    })),
  };
}

/** Whole calendar days from `fromKey` to `toKey`, which are both YYYY-MM-DD. */
function dayDifference(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / MS_PER_DAY,
  );
}

/**
 * Consecutive study days ending today. A day that has not been studied *yet*
 * does not break the streak, otherwise every user would appear to have a
 * zero-day streak every morning before their first review.
 */
function currentStreak(dailyByKey: Map<string, DailyReviewCount>, todayKey: string): number {
  const studied = (key: string) => (dailyByKey.get(key)?.total ?? 0) > 0;

  let cursor = studied(todayKey) ? todayKey : addDaysToDayKey(todayKey, -1);
  let streak = 0;
  // The walk stops at the oldest day in the window, so the reported streak is
  // a lower bound once it exceeds the window length.
  while (studied(cursor)) {
    streak += 1;
    cursor = addDaysToDayKey(cursor, -1);
  }
  return streak;
}

function percentage(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/**
 * Only the deck title and its card ids are read, so callers may pass decks
 * with card stubs. Keeping the parameter narrow makes that explicit.
 */
export type StatsDeck = Pick<Deck, 'id' | 'title'> & { cards: Pick<Flashcard, 'id'>[] };

/**
 * Aggregates the rating log into the numbers the statistics page shows.
 *
 * Aggregation happens in JavaScript over a bounded window rather than in SQL.
 * A heavy user produces a few thousand rows in 30 days, which is a small
 * response; if that ever stops being true, move this into an RPC.
 */
export async function getReviewStats(
  userId: string,
  decks: StatsDeck[],
  now: Date = new Date(),
  timeZone: string = getTimeZone(),
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<ReviewStats> {
  const todayKey = studyDayKey(now, timeZone);

  // Over-fetch by one day: the 04:00 boundary means the oldest day in the
  // window starts before midnight of its own key, so a precise lower bound
  // would need the timezone resolved back to an instant. Rows outside the
  // window are dropped below.
  const since = new Date(now.getTime() - (windowDays + 1) * MS_PER_DAY).toISOString();

  const [logResult, dueResult] = await Promise.all([
    supabase
      .from('review_logs')
      .select('deck_id, quality, reviewed_at')
      .eq('user_id', userId)
      .is('undone_at', null)
      .gte('reviewed_at', since),
    supabase.from('card_reviews').select('deck_id, card_id, due_date').eq('user_id', userId),
  ]);

  if (logResult.error) {
    throw logResult.error;
  }
  if (dueResult.error) {
    throw dueResult.error;
  }

  const stats = emptyStats(windowDays, todayKey);
  const dailyByKey = new Map(stats.daily.map((bucket) => [bucket.dayKey, bucket]));

  const totalsByDeck = new Map<string, { total: number; passed: number }>();

  for (const row of (logResult.data ?? []) as ReviewLogRow[]) {
    const dayKey = studyDayKey(new Date(row.reviewed_at), timeZone);
    const bucket = dailyByKey.get(dayKey);
    if (!bucket) {
      continue;
    }

    const passed = row.quality >= PASSING_QUALITY;
    bucket.total += 1;
    if (passed) {
      bucket.passed += 1;
    } else {
      bucket.again += 1;
    }

    const deckTotals = totalsByDeck.get(row.deck_id) ?? { total: 0, passed: 0 };
    deckTotals.total += 1;
    if (passed) {
      deckTotals.passed += 1;
    }
    totalsByDeck.set(row.deck_id, deckTotals);
  }

  stats.totalReviews = stats.daily.reduce((sum, bucket) => sum + bucket.total, 0);
  stats.passedReviews = stats.daily.reduce((sum, bucket) => sum + bucket.passed, 0);
  stats.retention = percentage(stats.passedReviews, stats.totalReviews);
  stats.activeDays = stats.daily.filter((bucket) => bucket.total > 0).length;
  stats.currentStreak = currentStreak(dailyByKey, todayKey);

  const titleById = new Map(decks.map((deck) => [deck.id, deck.title]));
  stats.byDeck = [...totalsByDeck.entries()]
    // A deck deleted after its reviews were written is no longer in `decks`.
    .filter(([deckId]) => titleById.has(deckId))
    .map<DeckRetention>(([deckId, totals]) => ({
      deckId,
      title: titleById.get(deckId) ?? '',
      total: totals.total,
      passed: totals.passed,
      retention: percentage(totals.passed, totals.total),
    }))
    .sort((a, b) => b.total - a.total);

  // Only cards that still exist in a deck can be forecast: cards live in the
  // `decks.cards` JSONB column, so removing one leaves its review row behind.
  const liveCardKeys = new Set(
    decks.flatMap((deck) => deck.cards.map((card) => `${deck.id}:${card.id}`)),
  );
  const forecastByKey = new Map(stats.forecast.map((day) => [day.dayKey, day]));

  for (const row of (dueResult.data ?? []) as DueRow[]) {
    if (!liveCardKeys.has(`${row.deck_id}:${row.card_id}`)) {
      continue;
    }

    const dueKey = studyDayKey(new Date(row.due_date), timeZone);
    // Anything overdue lands on today rather than disappearing.
    const offset = Math.max(0, dayDifference(todayKey, dueKey));
    if (offset >= FORECAST_DAYS) {
      continue;
    }

    const day = forecastByKey.get(addDaysToDayKey(todayKey, offset));
    if (day) {
      day.due += 1;
    }
  }

  return stats;
}
