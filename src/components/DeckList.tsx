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
        className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-neo-border/40 rounded-neo-lg hover:border-neo-green hover:bg-neo-green/5 transition-all duration-300 cursor-pointer min-h-[220px]"
      >
        <div className="w-16 h-16 rounded-full bg-neo-green/10 border-2 border-neo-border flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-neo-green/20 transition-transform duration-300">
          <Plus className="w-8 h-8 text-neo-green" />
        </div>
        <h3 className="text-xl font-heading font-bold text-neo-charcoal mb-2">Create New Deck</h3>
        <p className="text-neo-gray text-center text-sm">
          Start a new collection of flashcards
        </p>
      </div>

      {/* Existing Decks */}
      {decks.map((deck) => (
        <div
          key={deck.id}
          className="group relative bg-white rounded-neo-lg border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col min-h-[220px]"
          onClick={() => onSelectDeck(deck)}
        >
          {/* Card Header Decoration */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-neo-green transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-neo-accent-blue/30 rounded-neo-md border-2 border-neo-border group-hover:bg-neo-green/20 transition-colors duration-300">
                <BookOpen className="w-6 h-6 text-neo-charcoal" />
              </div>
              <span className="px-3 py-1.5 text-xs font-bold text-neo-charcoal bg-neo-yellow/30 rounded-full border-2 border-neo-border">
                {deck.cards.length} cards
              </span>
            </div>

            <h3 className="text-xl font-heading font-bold text-neo-charcoal mb-2 line-clamp-1 group-hover:text-neo-green transition-colors duration-300">
              {deck.title}
            </h3>

            <p className="text-neo-gray text-sm line-clamp-2 mb-4 flex-1">
              {deck.description || 'No description provided.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 border-t-2 border-neo-border/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditDeck(deck);
                }}
                className="p-2.5 text-neo-charcoal hover:text-neo-green hover:bg-neo-green/10 rounded-neo-md border-2 border-transparent hover:border-neo-border transition-all"
                title="Edit Deck"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDeck(deck.id);
                }}
                className="p-2.5 text-neo-charcoal hover:text-red-500 hover:bg-red-50 rounded-neo-md border-2 border-transparent hover:border-red-300 transition-all"
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