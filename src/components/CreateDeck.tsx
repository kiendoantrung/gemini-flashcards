import React, { useState, useCallback } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { generateDeck } from '../services/aiService';
import type { Deck } from '../types/flashcard';
import { createDeckFormSchema, validateField, topicSchema } from '../utils/validation';

interface CreateDeckProps {
  onDeckCreated: (deck: Deck) => Promise<void>;
}

export function CreateDeck({ onDeckCreated }: CreateDeckProps) {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ topic?: string; numQuestions?: string }>({});
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 3;

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
    setRetryCount(0);

    const attemptGeneration = async (attempt: number): Promise<Deck> => {
      try {
        return await generateDeck(topic, numQuestions);
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          setRetryCount(attempt + 1);
          return await attemptGeneration(attempt + 1);
        } else {
          throw err;
        }
      }
    };

    try {
      const deck = await attemptGeneration(0);
      await onDeckCreated(deck);
      setTopic('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate deck';
      setError(`${message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="topic" className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
          Topic or Subject
        </label>
        <input
          type="text"
          id="topic"
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
        <label htmlFor="numQuestions" className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-duo-pencil uppercase tracking-wider">Number of cards:</span>
          <input
            type="number"
            id="numQuestions"
            min="1"
            max="20"
            value={numQuestions}
            onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-20 px-3 py-2 border-2 border-duo-border rounded-xl bg-white focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green text-duo-charcoal text-center font-black text-base"
            disabled={isLoading}
          />
        </label>
        <p className="mt-1 text-xs text-duo-pencil font-medium">
          Maximum 20 questions per deck
        </p>
      </div>

      {error && (
        <div className="p-4 bg-duo-red-subtle/80 rounded-2xl border-2 border-duo-red">
          <p className="text-duo-red font-bold text-sm">
            {error}
          </p>
        </div>
      )}

      {isLoading && retryCount > 0 && (
        <div className="p-4 bg-duo-gold-subtle rounded-2xl border-2 border-duo-gold">
          <p className="text-duo-charcoal text-sm font-bold">
            Retry attempt {retryCount} of {MAX_RETRIES}...
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
