import { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, CheckCircle } from 'lucide-react';
import type { Deck } from '../types/flashcard';
import { FlashCard } from './FlashCard';
import { QuizMode } from './QuizMode';

interface StudyModeProps {
  deck: Deck;
  onExit: () => void;
}

export function StudyMode({ deck, onExit }: StudyModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);

  const currentCard = deck.cards[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === deck.cards.length - 1;

  const handlePrevious = () => {
    if (!isFirst) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (!isLast) setCurrentIndex(currentIndex + 1);
  };

  if (showQuiz) {
    return <QuizMode deck={deck} onExit={onExit} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Back to Decks
        </button>
        <h2 className="text-xl font-semibold text-gray-800">{deck.title}</h2>
        <div className="text-sm text-gray-500">
          {currentIndex + 1} / {deck.cards.length}
        </div>
      </div>

      <div className="mb-6">
        <FlashCard card={currentCard} />
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={handlePrevious}
          disabled={isFirst}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isFirst
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-800 hover:bg-gray-50'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={isLast}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isLast
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </button>
        {isLast && (
          <button
            onClick={() => setShowQuiz(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4" />
            Take Quiz
          </button>
        )}
      </div>
    </div>
  );
}