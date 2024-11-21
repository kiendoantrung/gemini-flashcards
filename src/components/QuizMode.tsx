import { useState, useMemo, useEffect } from 'react';
import { RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import type { Deck, QuizAnswer } from '../types/flashcard';
import { generateDistractors } from '../services/aiService';
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
  const [options, setOptions] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [distractorCache, setDistractorCache] = useState<Record<string, string[]>>({});
  const [questionOptions, setQuestionOptions] = useState<Record<string, string[]>>({});

  const shuffledCards = useMemo(() => {
    return [...deck.cards].sort(() => Math.random() - 0.5);
  }, [deck.cards]);

  const currentCard = shuffledCards[currentIndex];
  const isLast = currentIndex === shuffledCards.length - 1;

  // Load options when current card changes
  useEffect(() => {
    async function loadOptions() {
      if (!currentCard) return;
      
      setIsLoadingOptions(true);
      try {
        // Kiểm tra cache trước
        if (distractorCache[currentCard.id]) {
          const allOptions = [...distractorCache[currentCard.id], currentCard.back];
          setOptions(shuffleArray(allOptions));
          setQuestionOptions(prev => ({
            ...prev,
            [currentCard.id]: allOptions
          }));
          setIsLoadingOptions(false);
          return;
        }

        const distractors = await generateDistractors(
          currentCard.front,
          currentCard.back
        );
        
        // Lưu vào cache
        setDistractorCache(prev => ({
          ...prev,
          [currentCard.id]: distractors
        }));
        
        const allOptions = [...distractors, currentCard.back];
        setOptions(shuffleArray(allOptions));
        setQuestionOptions(prev => ({
          ...prev,
          [currentCard.id]: allOptions
        }));
      } catch (error) {
        console.error('Error loading options:', error);
        const otherCards = deck.cards.filter(card => card.id !== currentCard.id);
        const incorrectOptions = otherCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(card => card.back);
        
        const allOptions = [...incorrectOptions, currentCard.back];
        const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
        setOptions(shuffledOptions);
        setQuestionOptions(prev => ({
          ...prev,
          [currentCard.id]: shuffledOptions
        }));
      } finally {
        setIsLoadingOptions(false);
      }
    }

    loadOptions();
  }, [currentCard, deck.cards, distractorCache]);

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    const isCorrect = answer === currentCard.back;
    setAnswers([...answers, { cardId: currentCard.id, isCorrect }]);

    if (isLast) {
      setTimeout(() => {
        setShowResult(true);
      }, 1000);
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
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">Quiz Complete!</h2>
        
        {/* Score Summary */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-8 mb-6 border border-white/20 text-center">
          <div className="text-6xl font-bold mb-4">
            {percentage}%
          </div>
          <p className="text-xl text-gray-600 mb-6">
            You got {score} out of {totalQuestions} questions correct
          </p>
        </div>

        {/* Detailed Review */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-8 mb-6 border border-white/20">
          <h3 className="text-xl font-semibold mb-6">Review Answers</h3>
          <div className="space-y-8">
            {answers.map((answer, index) => {
              const card = shuffledCards[index];
              const options = questionOptions[card.id] || [];
              
              return (
                <div 
                  key={card.id}
                  className="rounded-lg border border-gray-200 overflow-hidden"
                >
                  {/* Question Header */}
                  <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <p className="font-medium text-gray-900">
                      Question {index + 1}: {card.front}
                    </p>
                  </div>

                  {/* Answer Options */}
                  <div className="p-4 space-y-3">
                    {options.map((option, optionIndex) => {
                      const isUserAnswer = selectedAnswer === option;
                      const isCorrectAnswer = card.back === option;
                      
                      let optionClass = "p-3 rounded-lg flex items-center gap-3 ";
                      if (isUserAnswer && isCorrectAnswer) {
                        optionClass += "bg-green-50 border-2 border-green-500";
                      } else if (isUserAnswer && !isCorrectAnswer) {
                        optionClass += "bg-red-50 border-2 border-red-500";
                      } else if (isCorrectAnswer) {
                        optionClass += "bg-green-50 border-2 border-green-500";
                      } else {
                        optionClass += "bg-gray-50 border-2 border-gray-200";
                      }

                      return (
                        <div key={optionIndex} className={optionClass}>
                          {isUserAnswer && isCorrectAnswer && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                          {isUserAnswer && !isCorrectAnswer && (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          )}
                          {!isUserAnswer && isCorrectAnswer && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                          <span className={`flex-1 ${
                            isUserAnswer || isCorrectAnswer ? 'font-medium' : ''
                          }`}>
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

        {/* Action Button */}
        <div className="text-center mb-8">
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
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{Math.round(((currentIndex + 1) / totalQuestions) * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-lg p-8 mb-6"
        >
          <h3 className="text-xl font-semibold text-gray-800 mb-6">
            {currentCard.front}
          </h3>
          
          {isLoadingOptions ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="animate-pulse">
                  <div className="w-full h-[60px] rounded-lg bg-gray-200" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
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
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}