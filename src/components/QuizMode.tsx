import React, { useState, useMemo } from 'react';
import { RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import type { Deck, QuizAnswer } from '../types/flashcard';

interface QuizModeProps {
  deck: Deck;
  onExit: () => void;
}

export function QuizMode({ deck, onExit }: QuizModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const shuffledCards = useMemo(() => {
    return [...deck.cards].sort(() => Math.random() - 0.5);
  }, [deck.cards]);

  const currentCard = shuffledCards[currentIndex];
  const isLast = currentIndex === shuffledCards.length - 1;

  // Generate options including the correct answer and 3 random incorrect ones
  const options = useMemo(() => {
    if (!currentCard) return [];
    
    const otherCards = deck.cards.filter(card => card.id !== currentCard.id);
    const incorrectOptions = otherCards
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(card => card.back);
    
    const allOptions = [...incorrectOptions, currentCard.back];
    return allOptions.sort(() => Math.random() - 0.5);
  }, [currentCard, deck.cards]);

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    const isCorrect = answer === currentCard.back;
    setAnswers([...answers, { cardId: currentCard.id, isCorrect }]);

    if (isLast) {
      setShowResult(true);
    } else {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer(null);
      }, 1000);
    }
  };

  const score = answers.filter(a => a.isCorrect).length;
  const totalQuestions = shuffledCards.length;
  const percentage = Math.round((score / totalQuestions) * 100);

  if (showResult) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Quiz Complete!</h2>
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-8 mb-6 border border-white/20">
          <div className="text-6xl font-bold mb-4">
            {percentage}%
          </div>
          <p className="text-xl text-gray-600 mb-6">
            You got {score} out of {totalQuestions} questions correct
          </p>
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <RotateCcw className="w-4 h-4" />
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Exit Quiz
        </button>
        <div className="text-sm text-gray-500">
          Question {currentIndex + 1} of {shuffledCards.length}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">
          {currentCard.front}
        </h3>
        <div className="space-y-4">
          {options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === currentCard.back;
            
            let buttonClass = 'w-full text-left p-4 rounded-lg border-2 transition-all';
            if (!selectedAnswer) {
              buttonClass += ' hover:border-indigo-600 border-gray-200';
            } else if (isSelected) {
              buttonClass += isCorrect
                ? ' border-green-500 bg-green-50'
                : ' border-red-500 bg-red-50';
            } else if (isCorrect) {
              buttonClass += ' border-green-500 bg-green-50';
            } else {
              buttonClass += ' border-gray-200 opacity-50';
            }

            return (
              <button
                key={index}
                onClick={() => !selectedAnswer && handleAnswer(option)}
                disabled={selectedAnswer !== null}
                className={buttonClass}
              >
                <div className="flex items-center gap-3">
                  {selectedAnswer && (isSelected || isCorrect) && (
                    isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )
                  )}
                  <span>{option}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}