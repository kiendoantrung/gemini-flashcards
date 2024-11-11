import React from 'react';
import { BookOpen } from 'lucide-react';
import type { Deck } from '../types/flashcard';

interface DeckListProps {
  decks: Deck[];
  onSelectDeck: (deck: Deck) => void;
}

export function DeckList({ decks, onSelectDeck }: DeckListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {decks.map((deck) => (
        <div
          key={deck.id}
          className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          onClick={() => onSelectDeck(deck)}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <BookOpen className="w-8 h-8 text-indigo-600" />
              <span className="text-sm text-gray-500">
                {deck.cards.length} cards
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {deck.title}
            </h3>
            <p className="text-gray-600">{deck.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}