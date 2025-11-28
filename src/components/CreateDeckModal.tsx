import { X } from 'lucide-react';
import { CreateDeck } from './CreateDeck';
import { FileUploadDeck } from './FileUploadDeck';
import type { Deck } from '../types/flashcard';
import { useState } from 'react';

interface CreateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeckCreated: (newDeck: Deck) => Promise<void>;
  className?: string;
}

export function CreateDeckModal({ isOpen, onClose, onDeckCreated }: CreateDeckModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'upload'>('create');

  if (!isOpen) return null;

  const handleDeckCreated = (deck: Deck) => {
    onDeckCreated(deck);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-warm-brown/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-warm-cream rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-warm-gray animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-warm-brown/60 hover:text-warm-brown hover:bg-warm-brown/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-warm-brown mb-2">
            Create New Deck
          </h2>
          <p className="text-warm-brown/60 mb-8">
            Choose how you want to start your new study deck.
          </p>

          <div className="md:hidden flex space-x-4 mb-6 bg-white/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === 'create'
                ? 'bg-white text-warm-orange shadow-sm'
                : 'text-warm-brown/60 hover:text-warm-brown'
                }`}
            >
              Generate
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === 'upload'
                ? 'bg-white text-warm-orange shadow-sm'
                : 'text-warm-brown/60 hover:text-warm-brown'
                }`}
            >
              Upload File
            </button>
          </div>

          <div className="hidden md:grid md:grid-cols-2 gap-8">
            <div className="bg-white/50 rounded-xl p-6 border border-warm-gray/50 hover:border-warm-orange/30 transition-colors">
              <h3 className="text-lg font-semibold text-warm-brown mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-warm-orange/10 flex items-center justify-center text-warm-orange text-sm">AI</span>
                Generate with AI
              </h3>
              <CreateDeck onDeckCreated={handleDeckCreated} />
            </div>
            <div className="bg-white/50 rounded-xl p-6 border border-warm-gray/50 hover:border-warm-orange/30 transition-colors">
              <h3 className="text-lg font-semibold text-warm-brown mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-warm-olive/20 flex items-center justify-center text-warm-olive text-sm">PDF</span>
                Upload File
              </h3>
              <FileUploadDeck onDeckCreated={handleDeckCreated} />
            </div>
          </div>

          <div className="md:hidden">
            <div className="bg-white/50 rounded-xl p-6 border border-warm-gray/50">
              {activeTab === 'create' ? (
                <CreateDeck onDeckCreated={handleDeckCreated} />
              ) : (
                <FileUploadDeck onDeckCreated={handleDeckCreated} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}