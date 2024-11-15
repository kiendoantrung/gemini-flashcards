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
      className="relative w-full h-64 cursor-pointer perspective-1000 group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full duration-500 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden transition-all duration-300 group-hover:shadow-lg">
          <div className="w-full h-full p-6 bg-white rounded-xl shadow-lg flex items-center justify-center">
            <p className="text-xl text-gray-800 font-medium text-center">
              {card.front}
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 transition-all duration-300 group-hover:shadow-lg">
          <div className="w-full h-full p-6 bg-indigo-50 rounded-xl shadow-lg flex items-center justify-center">
            <p className="text-xl text-gray-800 font-medium text-center">
              {card.back}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}