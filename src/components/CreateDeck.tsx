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
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
        <Wand2 className="w-7 h-7 mr-3 text-indigo-600" />
        AI-Generated Flashcards
      </h2>

      <div className="space-y-8">
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-md font-semibold text-gray-700 mb-4">
                Topic Details
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic (e.g., 'Basic Python Concepts')"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                disabled={isLoading}
              />
              <p className="mt-2 text-sm text-gray-500 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Be specific about the topic to get better results
              </p>
            </div>

            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Number of questions:</span>
                <input
                  type="number"
                  id="numQuestions"
                  min="1"
                  max="20"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                />
              </label>
              <p className="mt-1 text-sm text-gray-500 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Maximum 20 questions per deck
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-600 text-sm flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {isLoading && retryCount > 0 && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-amber-600 text-sm flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Retry attempt {retryCount} of {MAX_RETRIES}...
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="w-full px-4 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center font-semibold"
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
        </div>
      </div>
    </div>
  );
}