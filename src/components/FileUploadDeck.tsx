import React, { useState } from 'react';
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
            const match = pair.match(/^Q:\s*([\s\S]*?)\nA:\s*([\s\S]*)$/);
            return {
              id: crypto.randomUUID(),
              front: match?.[1]?.trim() || '',
              back: match?.[2]?.trim() || ''
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
    <div className="space-y-6">
      <div className="space-y-5">
        {/* Generate Q&A from Text Content */}
        <div className="bg-white p-5 rounded-2xl border-2 border-duo-border shadow-duo-card hover:border-duo-green transition-all">
          <h4 className="text-sm font-heading font-black text-duo-charcoal mb-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-duo-green-subtle rounded-xl border-2 border-duo-green flex items-center justify-center">
              <FileText className="w-4 h-4 text-duo-green" />
            </div>
            Extract Cards from Text / PDF
          </h4>
          <div className="mb-4">
            <label className="flex items-center justify-between">
              <span className="text-xs font-bold text-duo-pencil uppercase tracking-wider">Number of cards:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-20 px-2 py-1.5 border-2 border-duo-border rounded-xl bg-white text-duo-charcoal text-center text-sm font-black focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <label
              className={`btn-duo-green duo-label py-2.5 px-5 text-xs tracking-wider cursor-pointer whitespace-nowrap ${
                isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Choose File
              <input
                type="file"
                accept=".txt,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => handleFileUpload(e, 'text')}
                className="sr-only"
                disabled={isLoading}
              />
            </label>
            <span className="text-xs text-duo-pencil font-bold truncate max-w-[150px]" title={textFileName || undefined}>
              {textFileName || 'No file chosen'}
            </span>
          </div>
          <p className="mt-2.5 text-xs text-duo-pencil flex items-center font-medium">
            <Upload className="w-3.5 h-3.5 mr-1 text-duo-green" />
            Supports PDF, DOC, DOCX, or TXT
          </p>
        </div>

        {/* Import Existing Q&A Pairs */}
        <div className="bg-white p-5 rounded-2xl border-2 border-duo-border shadow-duo-card hover:border-duo-blue transition-all">
          <h4 className="text-sm font-heading font-black text-duo-charcoal mb-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-duo-blue-subtle rounded-xl border-2 border-duo-blue flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-duo-blue" />
            </div>
            Import Q&A Spreadsheets
          </h4>
          <div className="flex items-center gap-3">
            <label
              className={`btn-duo-blue duo-label py-2.5 px-5 text-xs tracking-wider cursor-pointer whitespace-nowrap ${
                isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Choose Spreadsheet
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => handleFileUpload(e, 'qa')}
                className="sr-only"
                disabled={isLoading}
              />
            </label>
            <span className="text-xs text-duo-pencil font-bold truncate max-w-[150px]" title={qaFileName || undefined}>
              {qaFileName || 'No file chosen'}
            </span>
          </div>
          <p className="mt-2.5 text-xs text-duo-pencil flex items-center font-medium">
            <Upload className="w-3.5 h-3.5 mr-1 text-duo-blue" />
            Supports CSV, Excel, or JSON files
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-duo-red-subtle/80 rounded-2xl border-2 border-duo-red">
          <p className="text-duo-red text-sm font-bold flex items-center">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            {error}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-duo-gold-subtle rounded-2xl border-2 border-duo-gold">
          <p className="text-duo-charcoal text-sm font-bold flex items-center">
            <Loader2 className="w-4 h-4 mr-2 animate-spin text-duo-gold-dark" />
            Analyzing file and generating cards...
          </p>
        </div>
      )}
    </div>
  );
}
