import React, { useState, useCallback, useEffect, useId } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { generateDeck } from '../services/aiService';
import type { Deck } from '../types/flashcard';
import { MAX_CARDS_PER_GENERATION } from '../config/limits';
import { createDeckFormSchema, validateField, topicSchema } from '../utils/validation';

interface CreateDeckProps {
  onDeckCreated: (deck: Deck) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

export function CreateDeck({ onDeckCreated, onBusyChange }: CreateDeckProps) {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ topic?: string; numQuestions?: string }>({});
  const topicId = useId();
  const numQuestionsId = useId();

  // Lets the surrounding modal refuse to close mid-request.
  useEffect(() => {
    if (!isLoading || !onBusyChange) return;
    onBusyChange(true);
    return () => onBusyChange(false);
  }, [isLoading, onBusyChange]);

  // Validate topic field on blur
  const handleTopicBlur = useCallback(() => {
    const result = validateField(topicSchema, topic);
    setFieldErrors(prev => ({ ...prev, topic: result.error ?? undefined }));
  }, [topic]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate entire form
    const validationResult = createDeckFormSchema.safeParse({ topic: topic.trim(), numQuestions });
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        topic: errors.topic?.[0],
        numQuestions: errors.numQuestions?.[0],
      });
      setError('Please fix the errors above');
      return;
    }

    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    // No client-side retry loop: the Edge Function already retries Gemini, and
    // retrying here as well multiplied one click into dozens of AI calls.
    try {
      const deck = await generateDeck(topic.trim(), numQuestions);
      await onDeckCreated(deck);
      setTopic('');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to generate deck. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor={topicId} className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
          Topic or Subject
        </label>
        <input
          type="text"
          id={topicId}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onBlur={handleTopicBlur}
          placeholder="e.g. Basic Spanish Verbs, Photosynthesis, React Hooks"
          className={`w-full px-4 py-3.5 rounded-2xl border-2 bg-white focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green text-duo-charcoal placeholder-duo-pencil/50 transition-all font-bold ${
            fieldErrors.topic ? 'border-duo-red' : 'border-duo-border'
          }`}
          disabled={isLoading}
        />
        {fieldErrors.topic && (
          <p className="mt-1.5 text-xs text-duo-red font-bold">{fieldErrors.topic}</p>
        )}
        <p className="mt-2 text-xs text-duo-pencil flex items-center font-medium">
          <Wand2 className="w-3.5 h-3.5 mr-1 text-duo-green" />
          Be specific to get higher quality cards
        </p>
      </div>

      <div>
        <label htmlFor={numQuestionsId} className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-duo-pencil uppercase tracking-wider">Number of cards:</span>
          <input
            type="number"
            id={numQuestionsId}
            min="1"
            max={MAX_CARDS_PER_GENERATION}
            value={numQuestions}
            onChange={(e) =>
              setNumQuestions(
                Math.max(1, Math.min(MAX_CARDS_PER_GENERATION, Number.parseInt(e.target.value, 10) || 1))
              )
            }
            className="w-20 px-3 py-2 border-2 border-duo-border rounded-xl bg-white focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green text-duo-charcoal text-center font-black text-base"
            disabled={isLoading}
          />
        </label>
        <p className="mt-1 text-xs text-duo-pencil font-medium">
          Maximum {MAX_CARDS_PER_GENERATION} cards per deck
        </p>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-duo-red-subtle/80 rounded-2xl border-2 border-duo-red">
          <p className="text-duo-red font-bold text-sm">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !topic.trim()}
        className="btn-duo-green duo-label w-full py-4 text-sm tracking-wider shadow-duo-green disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating Cards...
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5 mr-2 stroke-[2.5]" />
            Generate Deck
          </>
        )}
      </button>
    </form>
  );
}
