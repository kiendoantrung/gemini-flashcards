import { BookOpen, Pencil, Trash } from 'lucide-react';
import type { Deck } from '../types/flashcard';

interface DeckListProps {
  decks: Deck[];
  onSelectDeck: (deck: Deck) => void;
  onUpdateDeck: (deckId: string, updates: Partial<Deck>) => void;
  onDeleteDeck: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
}

export function DeckList({ decks, onSelectDeck, onDeleteDeck, onEditDeck }: DeckListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {decks.map((deck) => (
        <div
          key={deck.id}
          className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 hover:bg-gradient-to-br from-white via-white to-indigo-50/30 border border-white/20"
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
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDeck(deck.id);
                }}
                className="text-red-600 hover:text-red-800 p-2"
              >
                <Trash className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditDeck(deck);
                }}
                className="text-blue-600 hover:text-blue-800 p-2"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}