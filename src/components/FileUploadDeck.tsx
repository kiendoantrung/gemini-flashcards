import { useState } from 'react';
import { extractTextFromFile, generateQAFromText } from '../services/fileService';
import type { Deck } from '../types/flashcard';
import { FileText, Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

interface FileUploadDeckProps {
  onDeckCreated: (deck: Deck) => void;
}

export function FileUploadDeck({ onDeckCreated }: FileUploadDeckProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'text' | 'qa') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const text = await extractTextFromFile(file);

      if (type === 'text') {
        const cards = await generateQAFromText(text, numQuestions);
        const deck: Deck = {
          id: crypto.randomUUID(),
          title: file.name.split('.')[0],
          description: `AI-generated from ${file.name}`,
          cards: cards.map(card => ({ ...card, id: crypto.randomUUID() }))
        };
        onDeckCreated(deck);
      } else {
        // Parse the Q&A formatted text into cards
        const cards = text.split('\n\n')
          .map(pair => {
            const [question, answer] = pair.split('\n');
            return {
              id: crypto.randomUUID(),
              front: question.replace('Q: ', ''),
              back: answer.replace('A: ', '')
            };
          });

        const deck: Deck = {
          id: crypto.randomUUID(),
          title: file.name.split('.')[0],
          description: `Imported from ${file.name}`,
          cards
        };
        onDeckCreated(deck);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="bg-white/80 p-6 rounded-xl border border-warm-gray hover:border-warm-orange/30 transition-colors">
          <h4 className="text-sm font-semibold text-warm-brown mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-warm-orange" />
            Generate Q&A from Text Content
          </h4>
          <div className="mb-4">
            <label className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-warm-brown/80">Number of questions:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-20 px-2 py-1.5 border border-warm-gray rounded-lg bg-white text-warm-brown text-center text-sm focus:ring-warm-orange focus:border-warm-orange"
              />
            </label>
          </div>
          <div className="relative group">
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={(e) => handleFileUpload(e, 'text')}
              className="block w-full text-sm text-warm-brown/60
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-warm-orange file:text-white
                hover:file:bg-warm-brown
                file:transition-colors file:duration-200
                cursor-pointer"
              disabled={isLoading}
            />
          </div>
          <p className="mt-2 text-xs text-warm-brown/60 flex items-center">
            <Upload className="w-3 h-3 mr-1" />
            Upload PDF, DOC, or TXT files
          </p>
        </div>

        <div className="bg-white/80 p-6 rounded-xl border border-warm-gray hover:border-warm-orange/30 transition-colors">
          <h4 className="text-sm font-semibold text-warm-brown mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-warm-olive" />
            Import Existing Q&A Pairs
          </h4>
          <div className="relative group">
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => handleFileUpload(e, 'qa')}
              className="block w-full text-sm text-warm-brown/60
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-warm-olive file:text-white
                hover:file:bg-warm-brown
                file:transition-colors file:duration-200
                cursor-pointer"
              disabled={isLoading}
            />
          </div>
          <p className="mt-2 text-xs text-warm-brown/60 flex items-center">
            <Upload className="w-3 h-3 mr-1" />
            Import CSV, Excel, or JSON files
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-red-600 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-warm-orange/10 rounded-xl border border-warm-orange/20">
          <p className="text-warm-orange text-sm flex items-center">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing file...
          </p>
        </div>
      )}
    </div>
  );
}