import { useState, useMemo, useEffect, useRef } from 'react';
import { RotateCcw, CheckCircle, XCircle, Trophy, Sparkles } from 'lucide-react';
import type { Deck, QuizAnswer } from '../types/flashcard';
import { buildOptions, shuffleArray } from '../utils/quizOptions';
import { generateBatchDistractors } from '../services/aiService';
import { cacheDistractors, getCachedDistractors } from '../services/distractorCache';
import { motion, AnimatePresence } from 'framer-motion';

const ANSWER_FEEDBACK_MS = 1400;

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
    return shuffleArray(deck.cards);
  }, [deck.cards]);

  const currentCard = shuffledCards[currentIndex];
  const isLast = currentIndex === shuffledCards.length - 1;

  // Load distractors once per deck: cached ones first, the AI only for cards
  // that have none (or whose text changed since they were cached).
  useEffect(() => {
    let isCancelled = false;

    const loadAllOptions = async () => {
      const cards = deck.cards;
      if (cards.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const cached = getCachedDistractors(deck.id, cards);
      const missing = cards.filter((card) => !cached[card.id]);

      let fresh: Record<string, string[]> = {};
      if (missing.length > 0) {
        try {
          fresh = await generateBatchDistractors(missing);
          cacheDistractors(deck.id, cards, fresh);
        } catch (error) {
          // Falls back to other cards' answers below.
          console.error('Error loading distractors:', error);
        }
      }

      if (isCancelled) return;

      const allOptions: Record<string, string[]> = {};
      for (const card of cards) {
        allOptions[card.id] = buildOptions(card, cards, cached[card.id] ?? fresh[card.id]);
      }
      setQuestionOptions(allOptions);
      setIsLoading(false);
    };

    void loadAllOptions();

    return () => {
      isCancelled = true;
    };
  }, [deck.id, deck.cards]);

  // The 1.4 s answer feedback must not fire after the quiz is closed.
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  if (shuffledCards.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="card-duo p-10 bg-white">
          <h2 className="text-3xl font-heading font-black text-duo-charcoal mb-3">
            This deck has no cards yet
          </h2>
          <p className="text-duo-pencil mb-8 font-medium">
            Add at least one flashcard before starting a quiz.
          </p>
          <button
            onClick={onExit}
            className="btn-duo-green duo-label px-8 py-3.5"
          >
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  const options = questionOptions[currentCard?.id] || [];

  const handleAnswer = (answer: string) => {
    if (!currentCard) return;

    setSelectedAnswer(answer);
    const isCorrect = answer === currentCard.back;

    const optionsSnapshot = Array.from(
      new Set([...options, answer, currentCard.back])
    );

    setAnswers((prevAnswers) => [
      ...prevAnswers,
      {
        cardId: currentCard.id,
        isCorrect,
        selectedAnswer: answer,
        optionsSnapshot,
      },
    ]);

    feedbackTimer.current = setTimeout(() => {
      feedbackTimer.current = null;
      if (isLast) {
        setShowResult(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setSelectedAnswer(null);
      }
    }, ANSWER_FEEDBACK_MS);
  };

  const score = answers.filter(a => a.isCorrect).length;
  const totalQuestions = shuffledCards.length;
  const percentage = Math.round((score / totalQuestions) * 100);

  if (showResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-duo-gold border-2 border-duo-gold-dark shadow-duo-gold text-white mb-5 animate-bounce-subtle">
            <Trophy className="w-12 h-12 stroke-[2.5]" />
          </div>
          <h2 className="text-4xl font-heading font-black text-duo-charcoal mb-2">
            Quiz Complete!
          </h2>
          <p className="text-duo-pencil text-lg font-semibold">Great effort! Here is your summary.</p>
        </div>

        {/* Score Card Summary */}
        <div className="card-duo p-8 md:p-10 mb-10 text-center bg-white animate-scale-in">
          <div className="text-7xl md:text-8xl font-heading font-black text-duo-charcoal mb-4 tracking-tight">
            {percentage}%
          </div>
          <p className="text-xl md:text-2xl text-duo-pencil mb-8 font-medium">
            You got <span className="font-extrabold text-duo-green">{score}</span> out of <span className="font-extrabold text-duo-charcoal">{totalQuestions}</span> questions correct!
          </p>

          <button
            onClick={onExit}
            className="btn-duo-green duo-label px-10 py-4 text-base shadow-duo-green"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Back to Decks
          </button>
        </div>

        {/* Detailed Review List */}
        <div className="space-y-5">
          <h3 className="text-2xl font-heading font-black text-duo-charcoal px-1 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-duo-gold" />
            Review Answers
          </h3>
          {answers.map((answer, index) => {
            const card = shuffledCards.find(c => c.id === answer.cardId);
            if (!card) return null;

            const options = Array.from(
              new Set([
                ...answer.optionsSnapshot,
                answer.selectedAnswer,
                card.back,
              ])
            );

            return (
              <div
                key={card.id}
                className="card-duo overflow-hidden bg-white"
              >
                {/* Question Header */}
                <div className="bg-white p-5 border-b-2 border-duo-border">
                  <div className="flex items-start gap-3.5">
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-duo-blue-subtle border-2 border-duo-blue text-duo-blue flex items-center justify-center text-sm font-black">
                      {index + 1}
                    </span>
                    <p className="font-heading font-bold text-duo-charcoal text-lg pt-0.5">
                      {card.front}
                    </p>
                  </div>
                </div>

                {/* Answer Options */}
                <div className="p-5 space-y-2.5">
                  {options.map((option, optionIndex) => {
                    const isUserAnswer = answer.selectedAnswer === option;
                    const isCorrectAnswer = card.back === option;

                    let optionClass = "p-4 rounded-2xl flex items-center gap-3.5 transition-all border-2 ";
                    if (isUserAnswer && isCorrectAnswer) {
                      optionClass += "bg-duo-green-subtle/70 border-duo-green text-duo-charcoal font-bold shadow-sm";
                    } else if (isUserAnswer && !isCorrectAnswer) {
                      optionClass += "bg-duo-red-subtle/70 border-duo-red text-duo-charcoal font-bold shadow-sm";
                    } else if (isCorrectAnswer) {
                      optionClass += "bg-duo-green-subtle/50 border-duo-green text-duo-charcoal font-bold";
                    } else {
                      optionClass += "bg-white border-duo-border text-duo-pencil opacity-60";
                    }

                    return (
                      <div key={optionIndex} className={optionClass}>
                        {isUserAnswer && isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-duo-green flex-shrink-0" />
                        )}
                        {isUserAnswer && !isCorrectAnswer && (
                          <XCircle className="w-5 h-5 text-duo-red flex-shrink-0" />
                        )}
                        {!isUserAnswer && isCorrectAnswer && (
                          <CheckCircle className="w-5 h-5 text-duo-green flex-shrink-0" />
                        )}
                        {!isUserAnswer && !isCorrectAnswer && (
                          <div className="w-5 h-5" />
                        )}
                        <span className="flex-1 text-sm md:text-base">
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
    <div className="max-w-3xl mx-auto p-4 min-h-[60vh] flex flex-col justify-center mb-8">
      {/* Top Header & Duolingo Progress Bar */}
      <div className="mb-10">
        <div className="flex justify-between items-center text-xs md:text-sm font-black text-duo-charcoal mb-3">
          <span className="bg-duo-gold-subtle px-3.5 py-1 rounded-full border-2 border-duo-gold">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span className="text-duo-pencil font-bold">
            {Math.round(((currentIndex + 1) / totalQuestions) * 100)}% complete
          </span>
        </div>
        <div className="w-full h-4 bg-duo-border/60 rounded-full p-0.5 overflow-hidden">
          <div
            className="h-full bg-duo-green rounded-full transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full"
        >
          {/* Question Prompt */}
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-heading font-black text-duo-charcoal text-center mb-10 leading-snug">
            {currentCard.front}
          </h3>

          {isLoading || options.length === 0 ? (
            <div className="flex flex-col gap-3.5">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="animate-pulse">
                  <div className="w-full h-[76px] rounded-2xl bg-duo-border/40 border-2 border-duo-border" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              className="flex flex-col gap-3.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              {options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === currentCard.back;

                let buttonClass = 'w-full text-left p-5 rounded-2xl border-2 transition-all duration-150 relative overflow-hidden ';
                if (!selectedAnswer) {
                  buttonClass += 'bg-white border-duo-border text-duo-charcoal shadow-duo-white hover:border-duo-blue hover:bg-duo-blue-subtle/20 hover:shadow-duo-hover active:translate-y-[2px] active:shadow-duo-white-active';
                } else if (isSelected) {
                  buttonClass += isCorrect
                    ? 'border-duo-green bg-duo-green-subtle/80 text-duo-charcoal shadow-duo-green'
                    : 'border-duo-red bg-duo-red-subtle/80 text-duo-charcoal shadow-duo-red';
                } else if (isCorrect) {
                  buttonClass += 'border-duo-green bg-duo-green-subtle/60 text-duo-charcoal shadow-duo-green';
                } else {
                  buttonClass += 'border-duo-border/40 opacity-40 bg-gray-50';
                }

                return (
                  <button
                    key={index}
                    onClick={() => !selectedAnswer && handleAnswer(option)}
                    disabled={selectedAnswer !== null}
                    className={buttonClass}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-8 h-8 rounded-xl border-2 flex-shrink-0 flex items-center justify-center font-black text-sm transition-colors ${
                        selectedAnswer && (isSelected || isCorrect)
                          ? isCorrect
                            ? 'border-duo-green bg-duo-green text-white'
                            : 'border-duo-red bg-duo-red text-white'
                          : 'border-duo-border bg-white text-duo-pencil'
                      }`}>
                        {selectedAnswer && (isSelected || isCorrect) ? (
                          isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </div>
                      <span className="text-base md:text-lg font-bold leading-snug">{option}</span>
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
