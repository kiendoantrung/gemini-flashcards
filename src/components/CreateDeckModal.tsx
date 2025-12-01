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
      <div className="absolute inset-0 bg-neo-charcoal/30 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-neo-cream rounded-neo-xl border-2 border-neo-border shadow-neo-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neo-charcoal hover:text-neo-green hover:bg-neo-green/10 rounded-full border-2 border-transparent hover:border-neo-border transition-all"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-heading font-extrabold text-neo-charcoal mb-2">
            Create New Deck
          </h2>
          <p className="text-neo-gray mb-8">
            Choose how you want to start your new study deck.
          </p>

          {/* Mobile Tabs */}
          <div className="md:hidden flex space-x-2 mb-6 bg-white p-1.5 rounded-neo-lg border-2 border-neo-border">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 px-4 rounded-neo-md font-bold transition-all duration-200 ${activeTab === 'create'
                ? 'bg-neo-green text-white border-2 border-neo-border shadow-neo'
                : 'text-neo-gray hover:text-neo-charcoal'
                }`}
            >
              Generate
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2.5 px-4 rounded-neo-md font-bold transition-all duration-200 ${activeTab === 'upload'
                ? 'bg-neo-accent-blue text-neo-charcoal border-2 border-neo-border shadow-neo'
                : 'text-neo-gray hover:text-neo-charcoal'
                }`}
            >
              Upload File
            </button>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-neo-lg p-6 border-2 border-neo-border shadow-neo hover:shadow-neo-hover transition-all">
              <h3 className="text-lg font-heading font-bold text-neo-charcoal mb-4 flex items-center gap-2">
                <span className="w-10 h-10 rounded-neo-md bg-neo-green/20 border-2 border-neo-border flex items-center justify-center text-neo-green font-bold text-sm">AI</span>
                Generate with AI
              </h3>
              <CreateDeck onDeckCreated={handleDeckCreated} />
            </div>
            <div className="bg-white rounded-neo-lg p-6 border-2 border-neo-border shadow-neo hover:shadow-neo-hover transition-all">
              <h3 className="text-lg font-heading font-bold text-neo-charcoal mb-4 flex items-center gap-2">
                <span className="w-10 h-10 rounded-neo-md bg-neo-accent-blue/30 border-2 border-neo-border flex items-center justify-center text-neo-charcoal font-bold text-sm">PDF</span>
                Upload File
              </h3>
              <FileUploadDeck onDeckCreated={handleDeckCreated} />
            </div>
          </div>

          {/* Mobile Content */}
          <div className="md:hidden">
            <div className="bg-white rounded-neo-lg p-6 border-2 border-neo-border shadow-neo">
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