import { X } from 'lucide-react';
import { CreateDeck } from './CreateDeck';
import { FileUploadDeck } from './FileUploadDeck';
import type { Deck } from '../types/flashcard';

interface CreateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeckCreated: (deck: Deck) => void;
}

export function CreateDeckModal({ isOpen, onClose, onDeckCreated }: CreateDeckModalProps) {
  if (!isOpen) return null;

  const handleDeckCreated = (deck: Deck) => {
    onDeckCreated(deck);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="p-6">
          <h2 className="inline-block text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">
            Create New Deck
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CreateDeck onDeckCreated={handleDeckCreated} />
            <FileUploadDeck onDeckCreated={handleDeckCreated} />
          </div>
        </div>
      </div>
    </div>
  );
} 