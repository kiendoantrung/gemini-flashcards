import { useState } from 'react';
import type { Flashcard } from '../types/flashcard';

interface FlashCardProps {
  card: Flashcard;
  showAnswer?: boolean;
}

export function FlashCard({ card, showAnswer = false }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(showAnswer);

  return (
    <div
      className="relative w-full h-80 md:h-96 cursor-pointer perspective-1000 group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''
          }`}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden transition-all duration-300">
          <div className="w-full h-full p-8 bg-white rounded-neo-xl border-2 border-neo-border shadow-neo group-hover:shadow-neo-hover flex items-center justify-center">
            <p className="text-2xl md:text-3xl text-neo-charcoal font-heading font-bold text-center leading-relaxed">
              {card.front}
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 transition-all duration-300">
          <div className="w-full h-full p-8 bg-neo-accent-blue/30 rounded-neo-xl border-2 border-neo-border shadow-neo group-hover:shadow-neo-hover flex items-center justify-center">
            <p className="text-2xl md:text-3xl text-neo-charcoal font-heading font-bold text-center leading-relaxed">
              {card.back}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}