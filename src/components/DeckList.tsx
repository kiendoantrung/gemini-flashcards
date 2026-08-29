import { BookOpen, Pencil, Trash, Plus } from 'lucide-react';
import type { Deck, DeckProgress } from '../types/flashcard';

interface DeckListProps {
  decks: Deck[];
  deckProgressById?: Record<string, DeckProgress>;
  onStartSpacedReview: (deck: Deck) => void;
  onSelectDeck: (deck: Deck) => void;
  onUpdateDeck: (deckId: string, updates: Partial<Deck>) => void;
  onDeleteDeck: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
  onCreateDeck: () => void;
}

export function DeckList({
  decks,
  deckProgressById = {},
  onStartSpacedReview,
  onSelectDeck,
  onDeleteDeck,
  onEditDeck,
  onCreateDeck,
}: DeckListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Create New Deck Card */}
      <div
        onClick={onCreateDeck}
        className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-duo-green/50 rounded-2xl shadow-duo-card hover:border-duo-green hover:bg-duo-green-subtle/20 hover:shadow-duo-card-hover transition-all duration-200 cursor-pointer min-h-[230px]"
      >
        <div className="w-16 h-16 rounded-2xl bg-duo-green-subtle border-2 border-duo-green flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
          <Plus className="w-8 h-8 text-duo-green stroke-[3]" />
        </div>
        <h3 className="text-xl font-heading font-black text-duo-charcoal mb-1">Create New Deck</h3>
        <p className="text-duo-pencil text-center text-sm font-medium">
          Start a new AI flashcard collection
        </p>
      </div>

      {/* Existing Decks */}
      {decks.map((deck) => {
        const progress = deckProgressById[deck.id] ?? {
          new: 0,
          learning: 0,
          due: 0,
          mastered: 0,
          done: 0,
        };

        return (
          <div
            key={deck.id}
            className="group relative bg-white rounded-2xl border-2 border-duo-border shadow-duo-card hover:border-duo-green hover:shadow-duo-card-hover transition-all duration-200 cursor-pointer flex flex-col min-h-[230px] overflow-hidden"
            onClick={() => onSelectDeck(deck)}
          >
            {/* Card Header Decoration */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-duo-green rounded-t-2xl transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-duo-blue-subtle rounded-xl border-2 border-duo-blue group-hover:bg-duo-green-subtle group-hover:border-duo-green transition-colors duration-200">
                  <BookOpen className="w-6 h-6 text-duo-blue group-hover:text-duo-green transition-colors duration-200" />
                </div>
                <span className="px-3 py-1 text-xs font-extrabold text-duo-charcoal bg-duo-green-subtle rounded-full border-2 border-duo-green">
                  {deck.cards.length} cards
                </span>
              </div>

              {/* Spaced repetition progress counters */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {progress.new} new
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {progress.due} due
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {progress.done} done
                </span>
              </div>

              <h3 className="text-xl font-heading font-black text-duo-charcoal mb-2 line-clamp-1 group-hover:text-duo-green transition-colors duration-200">
                {deck.title}
              </h3>

              <p className="text-duo-pencil text-sm line-clamp-2 mb-4 flex-1 font-medium leading-relaxed">
                {deck.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between pt-4 border-t-2 border-duo-border/60 gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDeck(deck);
                    }}
                    className="px-3 py-1.5 text-xs font-extrabold text-duo-charcoal bg-duo-border/40 hover:bg-duo-border/80 rounded-xl transition-colors"
                  >
                    Study
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartSpacedReview(deck);
                    }}
                    className="px-3 py-1.5 text-xs font-extrabold text-white bg-duo-green hover:bg-duo-green-hover rounded-xl shadow-duo-button hover:shadow-duo-button-hover active:translate-y-0.5 transition-all"
                  >
                    Spaced Review
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDeck(deck);
                    }}
                    className="p-2 text-duo-pencil hover:text-duo-charcoal hover:bg-duo-border/50 rounded-xl border-2 border-transparent hover:border-duo-border transition-all"
                    title="Edit Deck"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDeck(deck.id);
                    }}
                    className="p-2 text-duo-pencil hover:text-duo-red hover:bg-duo-red-subtle/50 rounded-xl border-2 border-transparent hover:border-duo-red/50 transition-all"
                    title="Delete Deck"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}