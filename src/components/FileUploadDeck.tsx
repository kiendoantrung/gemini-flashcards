import { useState, useRef } from 'react';
import { FileUp, Loader2, AlertCircle } from 'lucide-react';
import { extractTextFromFile, generateQAFromText } from '../services/fileService';
import type { Deck } from '../types/flashcard';

interface FileUploadDeckProps {
  onDeckCreated: (deck: Deck) => void;
}

export function FileUploadDeck({ onDeckCreated }: FileUploadDeckProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // Extract text from file
      const text = await extractTextFromFile(file);
      
      // Generate QA pairs using AI
      const cards = await generateQAFromText(text);
      
      if (cards.length === 0) {
        throw new Error('No valid question-answer pairs found in the file');
      }

      // Create deck
      const deck: Deck = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: `Flashcards created from ${file.name}`,
        cards: cards.map(card => ({
          id: crypto.randomUUID(),
          ...card
        }))
      };

      onDeckCreated(deck);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Create Deck from File
      </h2>
      <div className="space-y-4">
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileUp className="w-8 h-8 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">Upload PDF or TXT files - AI will generate questions</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
          </label>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing file...
          </div>
        )}
      </div>
    </div>
  );
}