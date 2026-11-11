import React, { useEffect, useState } from 'react';
import {
  detectSourceFileKind,
  extractTextFromFile,
  generateQAFromPDF,
  generateQAFromText,
  parseQAFile,
  titleFromFileName,
  type QAPair,
} from '../services/fileService';
import { MAX_CARDS_PER_GENERATION, MAX_PDF_SIZE_LABEL } from '../config/limits';
import type { Deck } from '../types/flashcard';
import { FileText, Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

interface FileUploadDeckProps {
  onDeckCreated: (deck: Deck) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

function clampCardCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_CARDS_PER_GENERATION, parsed));
}

export function FileUploadDeck({ onDeckCreated, onBusyChange }: FileUploadDeckProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [textFileName, setTextFileName] = useState<string | null>(null);
  const [qaFileName, setQaFileName] = useState<string | null>(null);

  // Lets the surrounding modal refuse to close mid-request.
  useEffect(() => {
    if (!isLoading || !onBusyChange) return;
    onBusyChange(true);
    return () => onBusyChange(false);
  }, [isLoading, onBusyChange]);

  const buildDeck = (file: File, pairs: QAPair[], description: string): Deck => ({
    id: crypto.randomUUID(),
    title: titleFromFileName(file.name),
    description,
    cards: pairs.map((pair) => ({ id: crypto.randomUUID(), front: pair.front, back: pair.back })),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'text' | 'qa') => {
    const input = e.target;
    const file = input.files?.[0];
    // Reset so choosing the same file again (e.g. after fixing it) still
    // fires onChange.
    input.value = '';
    if (!file) return;

    if (type === 'text') {
      setTextFileName(file.name);
    } else {
      setQaFileName(file.name);
    }

    setIsLoading(true);
    setError(null);

    try {
      let deck: Deck;
      if (type === 'text') {
        // Gemini reads PDFs natively; other documents are converted to text first.
        const pairs =
          detectSourceFileKind(file) === 'pdf'
            ? await generateQAFromPDF(file, numQuestions)
            : await generateQAFromText(await extractTextFromFile(file), numQuestions);
        deck = buildDeck(file, pairs, `AI-generated from ${file.name}`);
        if (deck.cards.length === 0) {
          throw new Error('No flashcards were generated from the file');
        }
      } else {
        deck = buildDeck(file, await parseQAFile(file), `Imported from ${file.name}`);
      }

      await onDeckCreated(deck);
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
                max={MAX_CARDS_PER_GENERATION}
                step="1"
                value={numQuestions}
                onChange={(e) => setNumQuestions(clampCardCount(e.target.value))}
                disabled={isLoading}
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
                accept=".txt,.md,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
            Supports PDF (up to {MAX_PDF_SIZE_LABEL}), DOC, DOCX, or TXT
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
                accept=".csv,.xlsx,.xls,.json,text/csv,application/json"
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
            Two columns (question, answer) in CSV or Excel, or a JSON array of {'{'} question, answer {'}'}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-duo-red-subtle/80 rounded-2xl border-2 border-duo-red">
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
