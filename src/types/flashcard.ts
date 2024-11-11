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
}