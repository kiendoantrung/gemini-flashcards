export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  cards: Flashcard[];
}

export interface QuizAnswer {
  cardId: string;
  isCorrect: boolean;
  selectedAnswer: string;
  optionsSnapshot: string[];
}

export type ReviewStatus = 'new' | 'learning' | 'review' | 'relearning';

export interface CardReview {
  id: string;
  userId: string;
  deckId: string;
  cardId: string;
  status: ReviewStatus;
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: string;
  lastReviewedAt: string | null;
  createdAt: string;
}

export interface DeckProgress {
  new: number;
  learning: number;
  due: number;
  mastered: number;
  done: number;
}

/** One study day in the review history. `dayKey` is YYYY-MM-DD, 04:00 boundary. */
export interface DailyReviewCount {
  dayKey: string;
  total: number;
  /** Ratings that were not Again. Matches the session summary's definition. */
  passed: number;
  again: number;
}

export interface DeckRetention {
  deckId: string;
  title: string;
  total: number;
  passed: number;
  /** 0-100, rounded. Zero when the deck has no reviews in the window. */
  retention: number;
}

export interface ForecastDay {
  dayKey: string;
  /** Cards becoming due on this study day, including anything overdue on day 0. */
  due: number;
}

export interface ReviewStats {
  /** Reviews in the window, excluding undone ratings. */
  totalReviews: number;
  passedReviews: number;
  /** 0-100, rounded. */
  retention: number;
  /** Distinct study days with at least one review in the window. */
  activeDays: number;
  /** Consecutive study days with a review, counting back from today. */
  currentStreak: number;
  /** Oldest to newest, one entry per day in the window (gaps included). */
  daily: DailyReviewCount[];
  /** Decks with at least one review in the window, busiest first. */
  byDeck: DeckRetention[];
  /** Today plus the next six study days. */
  forecast: ForecastDay[];
}
