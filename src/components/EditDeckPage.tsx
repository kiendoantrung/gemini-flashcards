import { useState, useCallback } from 'react';
import { ArrowLeft, Trash2, Plus, Save } from 'lucide-react';
import type { Deck } from '../types/flashcard';

interface EditDeckPageProps {
  deck: Deck;
  onSave: (updates: Partial<Deck>) => void;
  onCancel: () => void;
}

export function EditDeckPage({ deck, onSave, onCancel }: EditDeckPageProps) {
  const [title, setTitle] = useState(deck.title);
  const [description, setDescription] = useState(deck.description);
  const [cards, setCards] = useState(deck.cards);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }

    if (cards.length === 0) {
      setError('At least one card is required');
      return;
    }

    if (cards.some(card => !card.front.trim() || !card.back.trim())) {
      setError('All cards must have both front and back content');
      return;
    }

    onSave({
      title,
      description,
      cards
    });
  };

  const handleCardChange = useCallback((index: number, field: 'front' | 'back', value: string) => {
    setCards(prevCards => {
      const newCards = [...prevCards];
      newCards[index] = { ...newCards[index], [field]: value };
      return newCards;
    });
  }, []);

  const addCard = useCallback(() => {
    setCards(prevCards => [...prevCards, { id: crypto.randomUUID(), front: '', back: '' }]);
  }, []);

  const removeCard = useCallback((index: number) => {
    setCards(prevCards => prevCards.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="min-h-screen bg-neo-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-dark/60 hover:text-dark transition-colors mb-6 group font-semibold"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Deck
        </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-heading font-bold text-dark">
            Edit Deck
          </h1>
          <button
            onClick={() => {
              const form = document.querySelector('form');
              if (form) form.requestSubmit();
            }}
            className="hidden sm:flex items-center px-6 py-2.5 text-sm font-semibold rounded-full text-dark bg-primary-green border-2 border-dark neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-4 bg-accent-pink/30 border-2 border-dark text-dark rounded-xl flex items-center animate-fade-in neo-shadow">
              <span className="mr-2">⚠️</span>
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 border-2 border-dark neo-shadow">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all bg-neo-cream/50 text-dark placeholder-dark/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all bg-neo-cream/50 text-dark placeholder-dark/40"
                  rows={3}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-heading font-bold text-dark flex items-center gap-2">
                🃏 Cards
                <span className="text-sm font-normal text-dark bg-accent-yellow px-3 py-1 rounded-full border-2 border-dark">
                  {cards.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={addCard}
                className="flex items-center px-4 py-2 text-sm font-semibold rounded-full text-dark bg-neo-blue border-2 border-dark neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Card
              </button>
            </div>

            <div className="space-y-4">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="group p-6 bg-white rounded-xl border-2 border-dark neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="font-semibold text-dark bg-accent-yellow/50 px-3 py-1 rounded-full border border-dark">Card #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCard(index)}
                        className="p-2 text-dark/40 hover:text-dark hover:bg-accent-pink/30 rounded-full border-2 border-transparent hover:border-dark transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Remove card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-dark mb-2 uppercase tracking-wide">
                          Front
                        </label>
                        <textarea
                          value={card.front}
                          onChange={(e) => handleCardChange(index, 'front', e.target.value)}
                          className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all bg-neo-cream/30 text-dark min-h-[100px] resize-none"
                          required
                          placeholder="Question or term..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-dark mb-2 uppercase tracking-wide">
                          Back
                        </label>
                        <textarea
                          value={card.back}
                          onChange={(e) => handleCardChange(index, 'back', e.target.value)}
                          className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all bg-neo-cream/30 text-dark min-h-[100px] resize-none"
                          required
                          placeholder="Answer or definition..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 sticky bottom-6 z-10">
            <div className="bg-neo-cream p-3 rounded-full border-2 border-dark neo-shadow flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 text-sm font-semibold rounded-full text-dark bg-white border-2 border-dark hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold rounded-full text-dark bg-primary-green border-2 border-dark hover:bg-green-400 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}