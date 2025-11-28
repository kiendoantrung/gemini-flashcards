import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { generateDeck } from '../services/aiService';
import type { Deck } from '../types/flashcard';

interface CreateDeckProps {
  onDeckCreated: (deck: Deck) => void;
}

export function CreateDeck({ onDeckCreated }: CreateDeckProps) {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const deck = await generateDeck(topic, numQuestions);
        onDeckCreated(deck);
        setTopic('');
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          setRetryCount(attempt + 1);
          await attemptGeneration(attempt + 1);
        } else {
          const message = err instanceof Error ? err.message : 'Failed to generate deck';
          setError(`${message}. Please try again.`);
        }
      }
    };

    try {
      await attemptGeneration(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-warm-brown mb-2">
          Topic Details
        </label>
        <input
          type="text"
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic (e.g., 'Basic Python Concepts')"
          className="w-full px-4 py-3 rounded-xl border border-warm-gray bg-white/80 focus:ring-2 focus:ring-warm-orange focus:border-warm-orange text-warm-brown placeholder-warm-brown/40 transition-all"
          disabled={isLoading}
        />
        <p className="mt-2 text-xs text-warm-brown/60 flex items-center">
          <Wand2 className="w-3 h-3 mr-1" />
          Be specific about the topic to get better results
        </p>
      </div>

      <div>
        <label className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-warm-brown">Number of questions:</span>
          <input
            type="number"
            id="numQuestions"
            min="1"
            max="20"
            value={numQuestions}
            onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-24 px-3 py-2 border border-warm-gray rounded-lg bg-white/80 focus:ring-warm-orange focus:border-warm-orange text-warm-brown text-center"
            disabled={isLoading}
          />
        </label>
        <p className="mt-1 text-xs text-warm-brown/60">
          Maximum 20 questions per deck
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-red-600 text-sm flex items-center">
            {error}
          </p>
        </div>
      )}

      {isLoading && retryCount > 0 && (
        <div className="p-4 bg-warm-orange/10 rounded-xl border border-warm-orange/20">
          <p className="text-warm-orange text-sm flex items-center">
            Retry attempt {retryCount} of {MAX_RETRIES}...
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !topic.trim()}
        className="w-full px-4 py-3.5 rounded-xl bg-warm-orange text-white hover:bg-warm-brown disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center font-semibold shadow-lg shadow-orange-200/50 hover:shadow-xl hover:translate-y-[-1px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5 mr-2" />
            Generate Deck
          </>
        )}
      </button>
    </form>
  );
}