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

  const handleDeckCreated = async (deck: Deck) => {
    await onDeckCreated(deck);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-duo-charcoal/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-3xl border-2 border-duo-border shadow-duo-modal max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-duo-pencil hover:text-duo-charcoal hover:bg-duo-border/40 rounded-full border-2 border-transparent hover:border-duo-border transition-all"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div className="p-6 md:p-10">
          <h2 className="text-2xl md:text-3xl font-heading font-black text-duo-charcoal mb-2">
            Create New Deck
          </h2>
          <p className="text-duo-pencil mb-8 font-medium">
            Choose how you want to build your new study set.
          </p>

          {/* Mobile Tabs */}
          <div className="md:hidden flex space-x-2 mb-6 bg-duo-paper p-1.5 rounded-2xl border-2 border-duo-border">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 ${
                activeTab === 'create'
                  ? 'bg-duo-green text-white shadow-duo-green'
                  : 'text-duo-pencil hover:text-duo-charcoal'
              }`}
            >
              Generate AI
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 ${
                activeTab === 'upload'
                  ? 'bg-duo-blue text-white shadow-duo-blue'
                  : 'text-duo-pencil hover:text-duo-charcoal'
              }`}
            >
              Upload File
            </button>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-2 gap-8">
            <div className="card-duo p-6 bg-white">
              <h3 className="text-lg font-heading font-bold text-duo-charcoal mb-4 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-duo-green-subtle border-2 border-duo-green flex items-center justify-center text-duo-green font-black text-xs">
                  AI
                </span>
                Generate with AI
              </h3>
              <CreateDeck onDeckCreated={handleDeckCreated} />
            </div>
            <div className="card-duo p-6 bg-white">
              <h3 className="text-lg font-heading font-bold text-duo-charcoal mb-4 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-duo-blue-subtle border-2 border-duo-blue flex items-center justify-center text-duo-blue font-black text-xs">
                  PDF
                </span>
                Upload Document
              </h3>
              <FileUploadDeck onDeckCreated={handleDeckCreated} />
            </div>
          </div>

          {/* Mobile Content */}
          <div className="md:hidden">
            <div className="card-duo p-6 bg-white">
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
