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

  // Safety check: ensure deck has cards
  if (!deck.cards || deck.cards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="bg-white rounded-neo-xl border-2 border-neo-border shadow-neo p-8">
          <p className="text-neo-charcoal text-lg font-medium mb-4">This deck has no flashcards.</p>
          <button
            onClick={onExit}
            className="text-neo-green hover:text-neo-charcoal flex items-center gap-2 mx-auto font-bold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  const currentCard = deck.cards[currentIndex];
  
  // Safety check: ensure currentCard exists
  if (!currentCard) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="bg-white rounded-neo-xl border-2 border-neo-border shadow-neo p-8">
          <p className="text-neo-charcoal text-lg font-medium mb-4">Card not found.</p>
          <button
            onClick={onExit}
            className="text-neo-green hover:text-neo-charcoal flex items-center gap-2 mx-auto font-bold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-neo-gray hover:text-neo-charcoal flex items-center gap-2 font-bold transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Back to Decks
        </button>
        <h2 className="text-xl font-heading font-bold text-neo-charcoal">{deck.title}</h2>
        <div className="px-3 py-1.5 bg-neo-yellow/30 rounded-full border-2 border-neo-border text-sm font-bold text-neo-charcoal">
          {currentIndex + 1} / {deck.cards.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 h-3 bg-neo-cream rounded-full border-2 border-neo-border overflow-hidden">
        <div 
          className="h-full bg-neo-green transition-all duration-300 rounded-full"
          style={{ width: `${((currentIndex + 1) / deck.cards.length) * 100}%` }}
        />
      </div>

      <div className="mb-8">
        <FlashCard card={currentCard} />
      </div>

      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={handlePrevious}
          disabled={isFirst}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold border-2 border-neo-border transition-all ${isFirst
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-neo-charcoal shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px]'
            }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={isLast}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold border-2 border-neo-border transition-all ${isLast
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-neo-green text-white shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px]'
            }`}
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </button>
        {isLast && (
          <button
            onClick={() => setShowQuiz(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-bold border-2 border-neo-border bg-neo-accent-blue text-neo-charcoal shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
          >
            <CheckCircle className="w-4 h-4" />
            Take Quiz
          </button>
        )}
      </div>
    </div>
  );
}