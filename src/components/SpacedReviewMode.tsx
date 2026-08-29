import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import type { Deck } from '../types/flashcard';
import { FlashCard } from './FlashCard';
import { LoadingSpinner } from './LoadingSpinner';
import {
  calculateNextReview,
  formatNextInterval,
  getDueCards,
  reviewCard,
  type DueCard,
  type ReviewQuality,
  type ReviewState,
} from '../services/spacedRepetitionService';

export interface SpacedReviewModeProps {
  deck: Deck;
  userId: string;
  onExit: () => void;
  onComplete: () => void;
}

const RATING_BUTTONS: Array<{
  quality: ReviewQuality;
  label: string;
  btnStyle: string;
  badgeStyle: string;
}> = [
  {
    quality: 1,
    label: 'Again',
    btnStyle: 'bg-rose-50 text-rose-700 border-2 border-rose-300 hover:bg-rose-100 hover:border-rose-400',
    badgeStyle: 'bg-rose-200/70 text-rose-800',
  },
  {
    quality: 2,
    label: 'Hard',
    btnStyle: 'bg-amber-50 text-amber-700 border-2 border-amber-300 hover:bg-amber-100 hover:border-amber-400',
    badgeStyle: 'bg-amber-200/70 text-amber-800',
  },
  {
    quality: 3,
    label: 'Good',
    btnStyle: 'bg-blue-50 text-blue-700 border-2 border-blue-300 hover:bg-blue-100 hover:border-blue-400',
    badgeStyle: 'bg-blue-200/70 text-blue-800',
  },
  {
    quality: 4,
    label: 'Easy',
    btnStyle: 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400',
    badgeStyle: 'bg-emerald-200/70 text-emerald-800',
  },
];

export function SpacedReviewMode({ deck, userId, onExit, onComplete }: SpacedReviewModeProps) {
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<ReviewQuality, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });
  const [totalReviewed, setTotalReviewed] = useState(0);

  const fetchDueCards = useCallback(async () => {
    if (!userId || !deck.id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const due = await getDueCards(userId, deck.id, deck.cards);
      setQueue(due);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load due cards';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, deck.id, deck.cards]);

  useEffect(() => {
    void fetchDueCards();
  }, [fetchDueCards]);

  const isCompleted = !isLoading && queue.length > 0 && currentIndex >= queue.length;

  useEffect(() => {
    if (isCompleted) {
      onComplete();
    }
  }, [isCompleted, onComplete]);

  const handleRate = async (quality: ReviewQuality) => {
    if (isSubmitting || currentIndex >= queue.length) return;
    const currentItem = queue[currentIndex];
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await reviewCard(userId, deck.id, currentItem.card.id, quality);

      setRatings((prev) => ({
        ...prev,
        [quality]: prev[quality] + 1,
      }));
      setTotalReviewed((prev) => prev + 1);

      if (quality === 1) {
        // Requeue Again cards at the end of the current session
        setQueue((prev) => [...prev, currentItem]);
      }

      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } catch {
      setSubmitError('Failed to save review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner />
        <p className="mt-4 text-duo-pencil font-bold">Loading due cards...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-white border-2 border-duo-red rounded-3xl shadow-duo-card text-center">
        <h2 className="text-2xl font-heading font-black text-duo-charcoal mb-3">Unable to Load Review</h2>
        <p className="text-duo-pencil mb-6 font-medium">{loadError}</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => void fetchDueCards()}
            className="px-5 py-2.5 bg-duo-blue text-white font-extrabold rounded-2xl shadow-duo-button hover:bg-duo-blue-hover transition-all"
          >
            Retry
          </button>
          <button
            onClick={onExit}
            className="px-5 py-2.5 bg-duo-border/40 text-duo-charcoal font-extrabold rounded-2xl hover:bg-duo-border/80 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-10 bg-white border-2 border-duo-border rounded-3xl shadow-duo-card text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-duo-green-subtle text-duo-green rounded-2xl border-2 border-duo-green flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl md:text-3xl font-heading font-black text-duo-charcoal mb-2">
          Spaced Review: {deck.title}
        </h2>
        <p className="text-duo-pencil text-base mb-8 font-medium">
          No cards are due for review in this deck right now! Great job keeping up with your studies.
        </p>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-duo-green text-white font-extrabold rounded-2xl shadow-duo-button hover:bg-duo-green-hover transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (isCompleted) {
    const successfulCount = ratings[2] + ratings[3] + ratings[4];
    const retentionRate = totalReviewed > 0 ? Math.round((successfulCount / totalReviewed) * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto p-8 md:p-10 bg-white border-2 border-duo-border rounded-3xl shadow-duo-card text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-duo-green-subtle text-duo-green rounded-2xl border-2 border-duo-green flex items-center justify-center">
          <Sparkles className="w-8 h-8" />
        </div>
        <span className="inline-block px-4 py-1.5 bg-duo-green-subtle text-duo-green font-bold text-xs uppercase tracking-widest rounded-full border-2 border-duo-green mb-2">
          Session Complete!
        </span>
        <h2 className="text-3xl font-heading font-black text-duo-charcoal mb-2">
          Spaced Review: {deck.title}
        </h2>
        <p className="text-duo-pencil font-bold text-lg mb-6">
          {totalReviewed} {totalReviewed === 1 ? 'card' : 'cards'} reviewed
        </p>

        {/* Retention Meter */}
        <div className="mb-8 p-4 bg-duo-paper rounded-2xl border-2 border-duo-border inline-block">
          <span className="text-xs uppercase font-extrabold tracking-wider text-duo-pencil block mb-1">
            Retention Rate
          </span>
          <span className="text-3xl font-heading font-black text-duo-green">
            Retention: {retentionRate}%
          </span>
        </div>

        {/* Rating Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-2xl text-center">
            <span className="text-xs font-extrabold text-rose-700 block">Again: {ratings[1]}</span>
          </div>
          <div className="p-3.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-center">
            <span className="text-xs font-extrabold text-amber-700 block">Hard: {ratings[2]}</span>
          </div>
          <div className="p-3.5 bg-blue-50 border-2 border-blue-200 rounded-2xl text-center">
            <span className="text-xs font-extrabold text-blue-700 block">Good: {ratings[3]}</span>
          </div>
          <div className="p-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-center">
            <span className="text-xs font-extrabold text-emerald-700 block">Easy: {ratings[4]}</span>
          </div>
        </div>

        <button
          onClick={onExit}
          className="px-8 py-3.5 bg-duo-green text-white font-black text-base rounded-2xl shadow-duo-button hover:bg-duo-green-hover transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const currentItem = queue[currentIndex];
  const currentState: ReviewState = currentItem?.review
    ? {
        status: currentItem.review.status,
        easeFactor: currentItem.review.easeFactor,
        interval: currentItem.review.interval,
        repetitions: currentItem.review.repetitions,
      }
    : {
        status: 'new',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
      };

  const previews: Record<ReviewQuality, string> = {
    1: formatNextInterval(calculateNextReview(currentState, 1)),
    2: formatNextInterval(calculateNextReview(currentState, 2)),
    3: formatNextInterval(calculateNextReview(currentState, 3)),
    4: formatNextInterval(calculateNextReview(currentState, 4)),
  };

  return (
    <section className="max-w-3xl mx-auto">
      {/* Session Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-extrabold text-duo-pencil hover:text-duo-charcoal hover:bg-white rounded-xl border-2 border-transparent hover:border-duo-border transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="text-right">
          <h2 className="text-lg font-heading font-black text-duo-charcoal">
            Spaced Review: {deck.title}
          </h2>
          <span className="text-xs font-extrabold text-duo-pencil">
            Card {currentIndex + 1} of {queue.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-duo-border h-3 rounded-full overflow-hidden mb-6">
        <div
          className="bg-duo-green h-full transition-all duration-300 rounded-full"
          style={{ width: `${((currentIndex) / queue.length) * 100}%` }}
        />
      </div>

      {submitError && (
        <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-800 text-sm font-bold text-center">
          {submitError}
        </div>
      )}

      {/* FlashCard interactive area */}
      <div
        className="mb-8"
        onClick={() => setIsFlipped((prev) => !prev)}
      >
        <FlashCard card={currentItem.card} showAnswer={isFlipped} />
      </div>

      {/* Rating actions bar */}
      <div className="min-h-[90px] flex flex-col items-center justify-center">
        {!isFlipped ? (
          <div className="text-center p-4 bg-white/60 border-2 border-dashed border-duo-border rounded-2xl w-full">
            <p className="text-duo-pencil text-sm font-bold flex items-center justify-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Click card above to reveal answer and recall rating options
            </p>
          </div>
        ) : (
          <div className="w-full">
            <span className="text-xs uppercase font-extrabold tracking-wider text-duo-pencil text-center block mb-2">
              How well did you remember this?
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {RATING_BUTTONS.map(({ quality, label, btnStyle, badgeStyle }) => (
                <button
                  key={quality}
                  disabled={isSubmitting}
                  onClick={() => void handleRate(quality)}
                  className={`px-4 py-3 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95 shadow-duo-card hover:shadow-duo-card-hover ${btnStyle}`}
                >
                  <span className="text-base">{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badgeStyle}`}>
                    {previews[quality]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
