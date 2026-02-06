import { useState, useEffect } from 'react';
import type { Flashcard } from '../types/flashcard';

interface FlashCardProps {
  card: Flashcard;
  showAnswer?: boolean;
}

export function FlashCard({ card, showAnswer = false }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(showAnswer);

  // Sync isFlipped state when showAnswer prop changes
  useEffect(() => {
    setIsFlipped(showAnswer);
  }, [showAnswer]);

  return (
    <div
      role="button"
      aria-label={isFlipped ? `Answer: ${card.back}. Press to see question.` : `Question: ${card.front}. Press to see answer.`}
      tabIndex={0}
      className="relative w-full h-80 md:h-96 cursor-pointer perspective-1000 group focus:outline-none focus:ring-2 focus:ring-neo-green focus:ring-offset-2 rounded-neo-xl"
      onClick={() => setIsFlipped(!isFlipped)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsFlipped(!isFlipped);
        }
      }}
    >
      <div
        className={`relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''
          }`}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden transition-all duration-300">
          <div className="w-full h-full p-4 md:p-8 bg-white rounded-neo-xl border-2 border-neo-border shadow-neo group-hover:shadow-neo-hover flex items-center justify-center overflow-hidden">
            <p className="text-lg md:text-2xl lg:text-3xl text-neo-charcoal font-heading font-bold text-center leading-relaxed break-words overflow-y-auto max-h-full scrollbar-hide">
              {card.front}
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 transition-all duration-300">
          <div className="w-full h-full p-4 md:p-8 bg-neo-accent-blue/30 rounded-neo-xl border-2 border-neo-border shadow-neo group-hover:shadow-neo-hover flex items-center justify-center overflow-hidden">
            <p className="text-lg md:text-2xl lg:text-3xl text-neo-charcoal font-heading font-bold text-center leading-relaxed break-words overflow-y-auto max-h-full scrollbar-hide">
              {card.back}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}