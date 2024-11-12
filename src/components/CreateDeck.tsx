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
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Create New Deck
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="topic"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Topic
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic (e.g., 'Basic Python Concepts')"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoading}
          />
        </div>
        <div>
          <label
            htmlFor="numQuestions"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Number of Questions
          </label>
          <input
            type="number"
            id="numQuestions"
            min="1"
            max="20"
            value={numQuestions}
            onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoading}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {isLoading && retryCount > 0 && (
          <p className="text-sm text-amber-600">
            Retry attempt {retryCount} of {MAX_RETRIES}...
          </p>
        )}
        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className="inline-flex items-center justify-center w-full px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Deck
            </>
          )}
        </button>
      </form>
    </div>
  );
}