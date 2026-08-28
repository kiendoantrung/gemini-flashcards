import { useState, useEffect } from 'react';
import type { Flashcard } from '../types/flashcard';
import { RotateCw, Sparkles } from 'lucide-react';

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
      className="relative w-full h-80 md:h-96 cursor-pointer perspective-1000 group focus:outline-none focus:ring-2 focus:ring-duo-green focus:ring-offset-2 rounded-2xl"
      onClick={() => setIsFlipped(!isFlipped)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsFlipped(!isFlipped);
        }
      }}
    >
      <div
        className={`relative w-full h-full duration-500 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front Side (Question) */}
        <div className="absolute w-full h-full backface-hidden transition-all duration-300">
          <div className="w-full h-full p-6 md:p-10 bg-white rounded-2xl border-2 border-duo-border shadow-duo-card group-hover:border-duo-green group-hover:shadow-duo-card-hover flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-duo-green-subtle text-duo-green font-extrabold text-xs uppercase tracking-wider rounded-full border-2 border-duo-green">
                Question
              </span>
              <span className="text-xs font-bold text-duo-pencil flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5" /> Tap to flip
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xl md:text-2xl lg:text-3xl text-duo-charcoal font-heading font-extrabold text-center leading-snug break-words overflow-y-auto max-h-full scrollbar-hide">
                {card.front}
              </p>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-duo-pencil">Click anywhere to reveal answer</span>
            </div>
          </div>
        </div>

        {/* Back Side (Answer) */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 transition-all duration-300">
          <div className="w-full h-full p-6 md:p-10 bg-duo-blue-subtle/50 rounded-2xl border-2 border-duo-blue shadow-duo-card group-hover:shadow-duo-card-hover flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-duo-blue text-white font-extrabold text-xs uppercase tracking-wider rounded-full border-2 border-duo-blue-dark shadow-duo-blue">
                Answer
              </span>
              <span className="text-xs font-bold text-duo-blue flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Flipped
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xl md:text-2xl lg:text-3xl text-duo-charcoal font-heading font-black text-center leading-snug break-words overflow-y-auto max-h-full scrollbar-hide">
                {card.back}
              </p>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-duo-blue">Tap to see question again</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}