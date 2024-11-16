import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deck
        </button>

        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
          Edit Deck
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                rows={3}
                required
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                Cards
              </h2>
              <button
                type="button"
                onClick={addCard}
                className="px-6 py-2.5 text-sm font-medium rounded-full text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:shadow-lg"
              >
                Add Card
              </button>
            </div>

            {cards.map((card, index) => (
              <div key={card.id} className="p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                    <span>Card #{index + 1}</span>
                    <span className="text-gray-400">ID: {card.id.slice(0, 8)}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Front
                    </label>
                    <input
                      type="text"
                      value={card.front}
                      onChange={(e) => handleCardChange(index, 'front', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Back
                    </label>
                    <input
                      type="text"
                      value={card.back}
                      onChange={(e) => handleCardChange(index, 'back', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeCard(index)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-all"
                      aria-label="Remove card"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 text-sm font-medium rounded-full text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium rounded-full text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:shadow-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}