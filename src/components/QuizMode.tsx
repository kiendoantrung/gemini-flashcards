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
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-neo-yellow/30 border-2 border-neo-border shadow-neo text-neo-charcoal mb-6">
            <Trophy className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-heading font-extrabold text-neo-charcoal mb-2">Quiz Complete!</h2>
          <p className="text-neo-gray text-lg">Here's how you did</p>
        </div>

        {/* Score Summary */}
        <div className="bg-white rounded-neo-xl border-2 border-neo-border shadow-neo-lg p-10 mb-10 text-center animate-scale-in">
          <div className="text-8xl font-heading font-extrabold text-neo-charcoal mb-6 tracking-tight">
            {percentage}%
          </div>
          <p className="text-2xl text-neo-gray mb-10">
            You got <span className="font-bold text-neo-green">{score}</span> out of <span className="font-bold">{totalQuestions}</span> questions correct
          </p>

          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-neo-green text-white font-bold border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all text-lg"
          >
            <RotateCcw className="w-5 h-5" />
            Back to Decks
          </button>
        </div>

        {/* Detailed Review */}
        <div className="space-y-6">
          <h3 className="text-2xl font-heading font-bold text-neo-charcoal px-2 mb-6">Review Answers</h3>
          {answers.map((answer, index) => {
            const card = shuffledCards[index];
            const options = questionOptions[card.id] || [];

            return (
              <div
                key={card.id}
                className="bg-white rounded-neo-lg border-2 border-neo-border overflow-hidden shadow-neo hover:shadow-neo-hover transition-all"
              >
                {/* Question Header */}
                <div className="bg-neo-cream p-6 border-b-2 border-neo-border">
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-neo-accent-blue border-2 border-neo-border text-neo-charcoal flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <p className="font-heading font-bold text-neo-charcoal text-lg pt-0.5">
                      {card.front}
                    </p>
                  </div>
                </div>

                {/* Answer Options */}
                <div className="p-6 space-y-3">
                  {options.map((option, optionIndex) => {
                    const isUserAnswer = answer.selectedAnswer === option;
                    const isCorrectAnswer = card.back === option;

                    let optionClass = "p-4 rounded-neo-md flex items-center gap-4 transition-all border-2 ";
                    if (isUserAnswer && isCorrectAnswer) {
                      optionClass += "bg-neo-green/10 border-neo-green text-neo-charcoal";
                    } else if (isUserAnswer && !isCorrectAnswer) {
                      optionClass += "bg-neo-pink/20 border-red-300 text-red-800";
                    } else if (isCorrectAnswer) {
                      optionClass += "bg-neo-green/10 border-neo-green text-neo-charcoal";
                    } else {
                      optionClass += "bg-white border-neo-border/30 text-neo-gray opacity-60";
                    }

                    return (
                      <div key={optionIndex} className={optionClass}>
                        {isUserAnswer && isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-neo-green flex-shrink-0" />
                        )}
                        {isUserAnswer && !isCorrectAnswer && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                        {!isUserAnswer && isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-neo-green flex-shrink-0" />
                        )}
                        {!isUserAnswer && !isCorrectAnswer && (
                          <div className="w-5 h-5" /> // Spacer
                        )}
                        <span className={`flex-1 ${isUserAnswer || isCorrectAnswer ? 'font-bold' : ''}`}>
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
        <div className="flex justify-between items-center text-sm font-bold text-neo-charcoal mb-4">
          <span className="bg-neo-yellow/30 px-4 py-1.5 rounded-full border-2 border-neo-border">
            Question {currentIndex + 1} / {totalQuestions}
          </span>
          <span className="text-neo-gray">{Math.round(((currentIndex + 1) / totalQuestions) * 100)}% completed</span>
        </div>
        <div className="w-full h-3 bg-neo-cream rounded-full border-2 border-neo-border overflow-hidden">
          <div
            className="h-full bg-neo-green rounded-full transition-all duration-500 ease-out"
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
          <h3 className="text-3xl md:text-4xl font-heading font-extrabold text-neo-charcoal text-center mb-16 leading-tight">
            {currentCard.front}
          </h3>

          {isLoading || options.length === 0 ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="animate-pulse">
                  <div className="w-full h-[88px] rounded-neo-lg bg-neo-cream border-2 border-neo-border/30" />
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

                let buttonClass = 'w-full text-left p-6 rounded-neo-lg border-2 transition-all duration-200 group relative overflow-hidden';
                if (!selectedAnswer) {
                  buttonClass += ' hover:border-neo-green hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] border-neo-border bg-white text-neo-charcoal shadow-neo';
                } else if (isSelected) {
                  buttonClass += isCorrect
                    ? ' border-neo-green bg-neo-green/10 text-neo-charcoal shadow-neo'
                    : ' border-red-300 bg-neo-pink/20 text-red-800 shadow-neo';
                } else if (isCorrect) {
                  buttonClass += ' border-neo-green bg-neo-green/10 text-neo-charcoal shadow-neo';
                } else {
                  buttonClass += ' border-neo-border/30 opacity-40 bg-gray-50';
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
                        ? isCorrect ? 'border-neo-green bg-neo-green text-white' : 'border-red-500 bg-red-500 text-white'
                        : 'border-neo-border group-hover:border-neo-green text-neo-gray group-hover:text-neo-green'
                        }`}>
                        {selectedAnswer && (isSelected || isCorrect) ? (
                          isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-bold">{String.fromCharCode(65 + index)}</span>
                        )}
                      </div>
                      <span className="text-lg font-bold leading-snug">{option}</span>
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