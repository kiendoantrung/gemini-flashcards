import type { Deck } from '../types/flashcard';

export interface SpacedReviewModeProps {
  deck: Deck;
  userId: string;
  onExit: () => void;
  onComplete: () => void;
}

export function SpacedReviewMode({ deck, onExit }: SpacedReviewModeProps) {
  return (
    <section>
      <h2>Spaced Review: {deck.title}</h2>
      <button onClick={onExit}>Back to Dashboard</button>
    </section>
  );
}
