import { useState } from 'react';
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

  const handleCardChange = (index: number, field: 'front' | 'back', value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);
  };

  const addCard = () => {
    setCards([...cards, { id: crypto.randomUUID(), front: '', back: '' }]);
  };

  const removeCard = (index: number) => {
    const newCards = cards.filter((_, i) => i !== index);
    setCards(newCards);
  };

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-warm-brown/60 hover:text-warm-brown transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Deck
        </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-warm-brown">
            Edit Deck
          </h1>
          <button
            onClick={() => {
              const form = document.querySelector('form');
              if (form) form.requestSubmit();
            }}
            className="hidden sm:flex items-center px-6 py-2.5 text-sm font-medium rounded-full text-white bg-warm-orange hover:bg-warm-brown transition-all hover:shadow-lg shadow-orange-200/50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center animate-fade-in">
              <span className="mr-2">⚠️</span>
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-warm-gray">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-warm-brown mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-warm-gray rounded-xl focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all bg-warm-cream/20 text-warm-brown placeholder-warm-brown/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-warm-brown mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-warm-gray rounded-xl focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all bg-warm-cream/20 text-warm-brown placeholder-warm-brown/40"
                  rows={3}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-warm-brown flex items-center gap-2">
                Cards
                <span className="text-sm font-normal text-warm-brown/60 bg-warm-brown/5 px-2 py-0.5 rounded-full">
                  {cards.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={addCard}
                className="flex items-center px-4 py-2 text-sm font-medium rounded-full text-warm-brown bg-white border border-warm-gray hover:bg-warm-cream hover:border-warm-orange/50 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Card
              </button>
            </div>

            <div className="space-y-4">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="group p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-warm-gray hover:border-warm-orange/30"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="font-medium text-warm-brown/60">Card #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCard(index)}
                        className="p-2 text-warm-brown/40 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Remove card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-warm-brown/80 mb-2 uppercase tracking-wide">
                          Front
                        </label>
                        <textarea
                          value={card.front}
                          onChange={(e) => handleCardChange(index, 'front', e.target.value)}
                          className="w-full px-4 py-3 border border-warm-gray rounded-xl focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all bg-warm-cream/10 text-warm-brown min-h-[100px] resize-none"
                          required
                          placeholder="Question or term..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-warm-brown/80 mb-2 uppercase tracking-wide">
                          Back
                        </label>
                        <textarea
                          value={card.back}
                          onChange={(e) => handleCardChange(index, 'back', e.target.value)}
                          className="w-full px-4 py-3 border border-warm-gray rounded-xl focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all bg-warm-cream/10 text-warm-brown min-h-[100px] resize-none"
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
            <div className="bg-white/80 backdrop-blur-md p-2 rounded-full shadow-lg border border-warm-gray flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 text-sm font-medium rounded-full text-warm-brown hover:bg-warm-gray/50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-medium rounded-full text-white bg-warm-orange hover:bg-warm-brown transition-all shadow-md hover:shadow-lg"
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