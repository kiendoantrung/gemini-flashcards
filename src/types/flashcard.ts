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
