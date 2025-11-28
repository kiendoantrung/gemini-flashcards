import { BookOpen, Pencil, Trash, Plus } from 'lucide-react';
import type { Deck } from '../types/flashcard';

interface DeckListProps {
  decks: Deck[];
  onSelectDeck: (deck: Deck) => void;
  onUpdateDeck: (deckId: string, updates: Partial<Deck>) => void;
  onDeleteDeck: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
  onCreateDeck: () => void;
}

export function DeckList({ decks, onSelectDeck, onDeleteDeck, onEditDeck, onCreateDeck }: DeckListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Create New Deck Card */}
      <div
        onClick={onCreateDeck}
        className="group relative flex flex-col items-center justify-center p-8 bg-white/50 border-2 border-dashed border-warm-orange/30 rounded-xl hover:border-warm-orange hover:bg-warm-orange/5 transition-all duration-300 cursor-pointer min-h-[200px]"
      >
        <div className="w-16 h-16 rounded-full bg-warm-orange/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
          <Plus className="w-8 h-8 text-warm-orange" />
        </div>
        <h3 className="text-xl font-semibold text-warm-brown mb-2">Create New Deck</h3>
        <p className="text-warm-brown/60 text-center text-sm">
          Start a new collection of flashcards
        </p>
      </div>

      {/* Existing Decks */}
      {decks.map((deck) => (
        <div
          key={deck.id}
          className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-warm-gray overflow-hidden flex flex-col min-h-[200px]"
          onClick={() => onSelectDeck(deck)}
        >
          {/* Card Header Decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-warm-orange/50 to-warm-brown/50 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-warm-cream rounded-lg group-hover:bg-warm-orange/10 transition-colors duration-300">
                <BookOpen className="w-6 h-6 text-warm-brown" />
              </div>
              <span className="px-3 py-1 text-xs font-medium text-warm-brown/60 bg-warm-gray/50 rounded-full">
                {deck.cards.length} cards
              </span>
            </div>

            <h3 className="text-xl font-bold text-warm-brown mb-2 line-clamp-1 group-hover:text-warm-orange transition-colors duration-300">
              {deck.title}
            </h3>

            <p className="text-warm-brown/70 text-sm line-clamp-2 mb-4 flex-1">
              {deck.description || 'No description provided.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-warm-gray/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditDeck(deck);
                }}
                className="p-2 text-warm-brown/60 hover:text-warm-orange hover:bg-warm-orange/10 rounded-lg transition-colors"
                title="Edit Deck"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDeck(deck.id);
                }}
                className="p-2 text-warm-brown/60 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Deck"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}