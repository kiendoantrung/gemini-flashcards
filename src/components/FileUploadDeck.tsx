import { useState } from 'react';
import { extractTextFromFile, generateQAFromText, generateQAFromPDF } from '../services/fileService';
import type { Deck } from '../types/flashcard';
import { FileText, Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

interface FileUploadDeckProps {
  onDeckCreated: (deck: Deck) => Promise<void>;
}

export function FileUploadDeck({ onDeckCreated }: FileUploadDeckProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [textFileName, setTextFileName] = useState<string | null>(null);
  const [qaFileName, setQaFileName] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'text' | 'qa') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Update file name display
    if (type === 'text') {
      setTextFileName(file.name);
    } else {
      setQaFileName(file.name);
    }

    setIsLoading(true);
    setError(null);

    try {
      if (type === 'text') {
        let cards;
        
        // Use Gemini's native PDF support for PDF files
        if (file.type === 'application/pdf') {
          cards = await generateQAFromPDF(file, numQuestions);
        } else {
          const text = await extractTextFromFile(file);
          cards = await generateQAFromText(text, numQuestions);
        }
        
        const deck: Deck = {
          id: crypto.randomUUID(),
          title: file.name.split('.')[0],
          description: `AI-generated from ${file.name}`,
          cards: cards.map(card => ({ ...card, id: crypto.randomUUID() }))
        };
        
        if (deck.cards.length === 0) {
          throw new Error('No flashcards were generated from the file');
        }
        
        await onDeckCreated(deck);
      } else {
        // Parse the Q&A formatted text into cards
        const text = await extractTextFromFile(file);
        const cards = text.split('\n\n')
          .map(pair => {
            const lines = pair.split('\n');
            const question = lines[0] || '';
            const answer = lines[1] || '';
            return {
              id: crypto.randomUUID(),
              front: question.replace('Q: ', '').trim(),
              back: answer.replace('A: ', '').trim()
            };
          })
          .filter(card => card.front && card.back); // Filter out empty cards

        if (cards.length === 0) {
          throw new Error('No valid question-answer pairs found in the file');
        }

        const deck: Deck = {
          id: crypto.randomUUID(),
          title: file.name.split('.')[0],
          description: `Imported from ${file.name}`,
          cards
        };
        await onDeckCreated(deck);
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
        <div className="bg-neo-cream p-6 rounded-neo-md border-2 border-neo-border hover:shadow-neo transition-all">
          <h4 className="text-sm font-bold text-neo-charcoal mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-neo-green/20 rounded-neo-sm border-2 border-neo-border flex items-center justify-center">
              <FileText className="w-4 h-4 text-neo-green" />
            </div>
            Generate Q&A from Text Content
          </h4>
          <div className="mb-4">
            <label className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neo-charcoal">Number of questions:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-20 px-2 py-1.5 border-2 border-neo-border rounded-neo-sm bg-white text-neo-charcoal text-center text-sm font-bold focus:ring-neo-green focus:border-neo-green"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 py-2 px-4 rounded-full border-2 border-neo-border text-xs font-bold bg-neo-green text-white shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all duration-200 cursor-pointer whitespace-nowrap ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="w-3.5 h-3.5" />
              Choose File
              <input
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={(e) => handleFileUpload(e, 'text')}
                className="sr-only"
                disabled={isLoading}
              />
            </label>
            <span className="text-xs text-neo-gray font-medium truncate max-w-[100px]" title={textFileName || undefined}>
              {textFileName || 'No file chosen'}
            </span>
          </div>
          <p className="mt-2 text-xs text-neo-gray flex items-center font-medium">
            <Upload className="w-3 h-3 mr-1 text-neo-green" />
            Upload PDF, DOC, or TXT files
          </p>
        </div>

        <div className="bg-neo-cream p-6 rounded-neo-md border-2 border-neo-border hover:shadow-neo transition-all">
          <h4 className="text-sm font-bold text-neo-charcoal mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-neo-accent-blue/30 rounded-neo-sm border-2 border-neo-border flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-neo-charcoal" />
            </div>
            Import Existing Q&A Pairs
          </h4>
          <div className="flex items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 py-2 px-4 rounded-full border-2 border-neo-border text-xs font-bold bg-neo-accent-blue text-neo-charcoal shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all duration-200 cursor-pointer whitespace-nowrap ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="w-3.5 h-3.5" />
              Choose File
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => handleFileUpload(e, 'qa')}
                className="sr-only"
                disabled={isLoading}
              />
            </label>
            <span className="text-xs text-neo-gray font-medium truncate max-w-[100px]" title={qaFileName || undefined}>
              {qaFileName || 'No file chosen'}
            </span>
          </div>
          <p className="mt-2 text-xs text-neo-gray flex items-center font-medium">
            <Upload className="w-3 h-3 mr-1 text-neo-accent-blue" />
            Import CSV, Excel, or JSON files
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-neo-pink/20 rounded-neo-md border-2 border-red-300">
          <p className="text-red-600 text-sm flex items-center font-medium">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-neo-yellow/20 rounded-neo-md border-2 border-neo-yellow">
          <p className="text-neo-charcoal text-sm flex items-center font-medium">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing file...
          </p>
        </div>
      )}
    </div>
  );
}
