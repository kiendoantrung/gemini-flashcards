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
          
          <div className="md:hidden flex space-x-4 mb-4">
          <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'create' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Generate
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'upload' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Upload File
            </button>
          </div>

          <div className="hidden md:grid md:grid-cols-2 gap-6">
            <CreateDeck onDeckCreated={handleDeckCreated} />
            <FileUploadDeck onDeckCreated={handleDeckCreated} />
          </div>

          <div className="md:hidden">
            {activeTab === 'create' ? (
              <CreateDeck onDeckCreated={handleDeckCreated} />
            ) : (
              <FileUploadDeck onDeckCreated={handleDeckCreated} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 