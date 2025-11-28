import { useState, useMemo, useEffect } from 'react';
import { RotateCcw, CheckCircle, XCircle, Trophy } from 'lucide-react';
import type { Deck, QuizAnswer } from '../types/flashcard';
import { generateBatchDistractors } from '../services/aiService';
import { motion, AnimatePresence } from 'framer-motion';

const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

interface QuizModeProps {
  deck: Deck;
  onExit: () => void;
}

export function QuizMode({ deck, onExit }: QuizModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [questionOptions, setQuestionOptions] = useState<Record<string, string[]>>({});

  const shuffledCards = useMemo(() => {
    return [...deck.cards].sort(() => Math.random() - 0.5);
  }, [deck.cards]);

  const currentCard = shuffledCards[currentIndex];
  const isLast = currentIndex === shuffledCards.length - 1;

  // Load ALL distractors once on mount and pre-generate all options
  useEffect(() => {
    const loadAllOptions = async () => {
      if (deck.cards.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Single API call to generate distractors for ALL cards
        const batchResults = await generateBatchDistractors(deck.cards);

        // Pre-generate and shuffle options for all cards
        const allOptions: Record<string, string[]> = {};

        for (const card of deck.cards) {
          const distractors = batchResults[card.id] || [];

          // Fallback if AI didn't return distractors for this card
          if (distractors.length === 0) {
            const otherCards = deck.cards.filter(c => c.id !== card.id);
            const fallbackDistractors = otherCards
              .sort(() => Math.random() - 0.5)
              .slice(0, 3)
              .map(c => c.back);
            allOptions[card.id] = shuffleArray([...fallbackDistractors, card.back]);
          } else {
            allOptions[card.id] = shuffleArray([...distractors, card.back]);
          }
        }

        setQuestionOptions(allOptions);
      } catch (error) {
        console.error('Error loading distractors:', error);

        // Fallback: use other card answers as distractors
        const allOptions: Record<string, string[]> = {};
        for (const card of deck.cards) {
          const otherCards = deck.cards.filter(c => c.id !== card.id);
          const fallbackDistractors = otherCards
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(c => c.back);
          allOptions[card.id] = shuffleArray([...fallbackDistractors, card.back]);
        }
        setQuestionOptions(allOptions);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllOptions();
  }, [deck.cards]);

  const options = questionOptions[currentCard?.id] || [];

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    const isCorrect = answer === currentCard.back;
    setAnswers([...answers, { cardId: currentCard.id, isCorrect, selectedAnswer: answer }]);

    if (isLast) {
      setTimeout(() => {
        setShowResult(true);
      }, 1500);
    } else {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer(null);
      }, 1500);
    }
  };

  const score = answers.filter(a => a.isCorrect).length;
  const totalQuestions = shuffledCards.length;
  const percentage = Math.round((score / totalQuestions) * 100);

  if (showResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-warm-orange/10 text-warm-orange mb-6 shadow-sm">
            <Trophy className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-bold text-warm-brown mb-2">Quiz Complete!</h2>
          <p className="text-warm-brown/60 text-lg">Here's how you did</p>
        </div>

        {/* Score Summary */}
        <div className="bg-white rounded-3xl shadow-sm border border-warm-gray p-10 mb-10 text-center animate-scale-in">
          <div className="text-8xl font-bold text-warm-brown mb-6 tracking-tight">
            {percentage}%
          </div>
          <p className="text-2xl text-warm-brown/80 mb-10">
            You got <span className="font-bold text-warm-orange">{score}</span> out of <span className="font-bold">{totalQuestions}</span> questions correct
          </p>

          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-warm-orange text-white hover:bg-warm-brown transition-all shadow-lg shadow-orange-200/50 hover:shadow-xl hover:-translate-y-1 font-medium text-lg"
          >
            <RotateCcw className="w-5 h-5" />
            Back to Decks
          </button>
        </div>

        {/* Detailed Review */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-warm-brown px-2 mb-6">Review Answers</h3>
          {answers.map((answer, index) => {
            const card = shuffledCards[index];
            const options = questionOptions[card.id] || [];

            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-warm-gray overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                {/* Question Header */}
                <div className="bg-warm-cream/30 p-6 border-b border-warm-gray">
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-warm-brown/5 text-warm-brown flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <p className="font-medium text-warm-brown text-lg pt-0.5">
                      {card.front}
                    </p>
                  </div>
                </div>

                {/* Answer Options */}
                <div className="p-6 space-y-3">
                  {options.map((option, optionIndex) => {
                    const isUserAnswer = answer.selectedAnswer === option;
                    const isCorrectAnswer = card.back === option;

                    let optionClass = "p-4 rounded-xl flex items-center gap-4 transition-all ";
                    if (isUserAnswer && isCorrectAnswer) {
                      optionClass += "bg-warm-olive/10 border-2 border-warm-olive text-warm-brown";
                    } else if (isUserAnswer && !isCorrectAnswer) {
                      optionClass += "bg-red-50 border-2 border-red-200 text-red-800";
                    } else if (isCorrectAnswer) {
                      optionClass += "bg-warm-olive/10 border-2 border-warm-olive text-warm-brown";
                    } else {
                      optionClass += "bg-white border border-warm-gray text-warm-brown/60 opacity-60";
                    }

                    return (
                      <div key={optionIndex} className={optionClass}>
                        {isUserAnswer && isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-warm-olive flex-shrink-0" />
                        )}
                        {isUserAnswer && !isCorrectAnswer && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                        {!isUserAnswer && isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-warm-olive flex-shrink-0" />
                        )}
                        {!isUserAnswer && !isCorrectAnswer && (
                          <div className="w-5 h-5" /> // Spacer
                        )}
                        <span className={`flex-1 ${isUserAnswer || isCorrectAnswer ? 'font-medium' : ''}`}>
                          {option}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 min-h-[60vh] flex flex-col justify-center mb-8">
      <div className="mb-12">
        <div className="flex justify-between items-center text-sm font-medium text-warm-brown/60 mb-4">
          <span className="bg-warm-brown/5 px-4 py-1.5 rounded-full">
            Question {currentIndex + 1} / {totalQuestions}
          </span>
          <span>{Math.round(((currentIndex + 1) / totalQuestions) * 100)}% completed</span>
        </div>
        <div className="w-full h-2 bg-warm-gray/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-warm-orange rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-warm-brown text-center mb-16 leading-tight">
            {currentCard.front}
          </h3>

          {isLoading || options.length === 0 ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="animate-pulse">
                  <div className="w-full h-[88px] rounded-2xl bg-warm-gray/50" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              className="flex flex-col gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === currentCard.back;

                let buttonClass = 'w-full text-left p-6 rounded-2xl border-2 transition-all duration-200 group relative overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1';
                if (!selectedAnswer) {
                  buttonClass += ' hover:border-warm-orange hover:bg-warm-cream/30 border-warm-gray bg-white text-warm-brown';
                } else if (isSelected) {
                  buttonClass += isCorrect
                    ? ' border-warm-olive bg-warm-olive/10 text-warm-brown'
                    : ' border-red-200 bg-red-50 text-red-800';
                } else if (isCorrect) {
                  buttonClass += ' border-warm-olive bg-warm-olive/10 text-warm-brown';
                } else {
                  buttonClass += ' border-warm-gray opacity-40 bg-gray-50';
                }

                return (
                  <button
                    key={index}
                    onClick={() => !selectedAnswer && handleAnswer(option)}
                    disabled={selectedAnswer !== null}
                    className={buttonClass}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selectedAnswer && (isSelected || isCorrect)
                        ? isCorrect ? 'border-warm-olive bg-warm-olive text-white' : 'border-red-500 bg-red-500 text-white'
                        : 'border-warm-gray group-hover:border-warm-orange text-warm-brown/40 group-hover:text-warm-orange'
                        }`}>
                        {selectedAnswer && (isSelected || isCorrect) ? (
                          isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-bold">{String.fromCharCode(65 + index)}</span>
                        )}
                      </div>
                      <span className="text-lg font-medium leading-snug">{option}</span>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}