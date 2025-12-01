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
        <label className="block text-sm font-bold text-neo-charcoal mb-2">
          Topic Details
        </label>
        <input
          type="text"
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic (e.g., 'Basic Python Concepts')"
          className="w-full px-4 py-3 rounded-neo-md border-2 border-neo-border bg-neo-cream focus:ring-2 focus:ring-neo-green focus:border-neo-green text-neo-charcoal placeholder-neo-gray/60 transition-all font-medium"
          disabled={isLoading}
        />
        <p className="mt-2 text-xs text-neo-gray flex items-center font-medium">
          <Wand2 className="w-3 h-3 mr-1 text-neo-green" />
          Be specific about the topic to get better results
        </p>
      </div>

      <div>
        <label className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-neo-charcoal">Number of questions:</span>
          <input
            type="number"
            id="numQuestions"
            min="1"
            max="20"
            value={numQuestions}
            onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-24 px-3 py-2 border-2 border-neo-border rounded-neo-md bg-neo-cream focus:ring-neo-green focus:border-neo-green text-neo-charcoal text-center font-bold"
            disabled={isLoading}
          />
        </label>
        <p className="mt-1 text-xs text-neo-gray font-medium">
          Maximum 20 questions per deck
        </p>
      </div>

      {error && (
        <div className="p-4 bg-neo-pink/20 rounded-neo-md border-2 border-red-300">
          <p className="text-red-600 text-sm font-medium">
            {error}
          </p>
        </div>
      )}

      {isLoading && retryCount > 0 && (
        <div className="p-4 bg-neo-yellow/20 rounded-neo-md border-2 border-neo-yellow">
          <p className="text-neo-charcoal text-sm font-medium">
            Retry attempt {retryCount} of {MAX_RETRIES}...
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !topic.trim()}
        className="w-full px-4 py-3.5 rounded-full bg-neo-green text-white font-bold border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
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