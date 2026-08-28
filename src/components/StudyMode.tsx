import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
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
  const cardCount = deck.cards?.length ?? 0;

  useEffect(() => {
    // Keep index valid when deck changes (e.g. after editing cards)
    setCurrentIndex((prev) => Math.min(prev, Math.max(cardCount - 1, 0)));
  }, [cardCount]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : prev);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => prev < cardCount - 1 ? prev + 1 : prev);
  }, [cardCount]);

  // Safety check: ensure deck has cards
  if (cardCount === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <div className="card-duo p-10 bg-white">
          <p className="text-duo-charcoal text-lg font-bold mb-6">This deck has no flashcards yet.</p>
          <button
            onClick={onExit}
            className="btn-duo-green duo-label px-8 py-3 text-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
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
      <div className="max-w-3xl mx-auto text-center py-12">
        <div className="card-duo p-10 bg-white">
          <p className="text-duo-charcoal text-lg font-bold mb-6">Card not found.</p>
          <button
            onClick={onExit}
            className="btn-duo-green duo-label px-8 py-3 text-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === cardCount - 1;

  if (showQuiz) {
    return <QuizMode deck={deck} onExit={onExit} />;
  }

  return (
    <div className="max-w-4xl mx-auto py-2">
      {/* Top Header Controls */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="duo-label text-xs md:text-sm text-duo-pencil hover:text-duo-charcoal flex items-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Back to Decks
        </button>
        <h2 className="text-lg md:text-xl font-heading font-black text-duo-charcoal truncate max-w-[200px] sm:max-w-sm">
          {deck.title}
        </h2>
        <div className="px-3 py-1 bg-duo-gold-subtle rounded-full border-2 border-duo-gold text-xs font-black text-duo-charcoal">
          {currentIndex + 1} / {cardCount}
        </div>
      </div>

      {/* Duolingo Chunky Progress Bar */}
      <div className="mb-8 h-4 bg-duo-border/60 rounded-full p-0.5 overflow-hidden">
        <div
          className="h-full bg-duo-green transition-all duration-300 rounded-full shadow-sm"
          style={{ width: `${((currentIndex + 1) / cardCount) * 100}%` }}
        />
      </div>

      {/* Flashcard Area */}
      <div className="mb-8">
        <FlashCard card={currentCard} />
      </div>

      {/* 3D Action Controls */}
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={handlePrevious}
          disabled={isFirst}
          className={`btn-duo-white duo-label px-7 py-3.5 text-sm gap-2 ${
            isFirst ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
          }`}
        >
          <ArrowLeft className="w-4 h-4 stroke-[3]" />
          Previous
        </button>

        {!isLast ? (
          <button
            onClick={handleNext}
            className="btn-duo-green duo-label px-8 py-3.5 text-sm gap-2 shadow-duo-green"
          >
            Next Card
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        ) : (
          <button
            onClick={() => setShowQuiz(true)}
            className="btn-duo-blue duo-label px-8 py-3.5 text-sm gap-2 shadow-duo-blue"
          >
            <Sparkles className="w-4 h-4 fill-white" />
            Take Quiz
          </button>
        )}
      </div>
    </div>
  );
}
