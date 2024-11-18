import { useState } from 'react';
import { extractTextFromFile, generateQAFromText } from '../services/fileService';
import type { Deck } from '../types/flashcard';

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
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
        <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Create Deck from File
      </h2>

      <div className="space-y-8">
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h4 className="text-md font-semibold text-gray-700 mb-4">Generate Q&A from Text Content</h4>
            <div className="mb-4">
              <label className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Number of questions:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </label>
            </div>
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={(e) => handleFileUpload(e, 'text')}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700
                file:transition-colors file:duration-200
                cursor-pointer"
            />
            <p className="mt-2 text-sm text-gray-500 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Upload PDF, DOC, or TXT files to auto-generate flashcards
            </p>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h4 className="text-md font-semibold text-gray-700 mb-4">Import Existing Q&A Pairs</h4>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => handleFileUpload(e, 'qa')}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700
                file:transition-colors file:duration-200
                cursor-pointer"
            />
            <p className="mt-2 text-sm text-gray-500 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Import CSV, Excel, or JSON files with question-answer pairs
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600 text-sm flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}
      
      {isLoading && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-600 text-sm flex items-center">
            <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Processing file...
          </p>
        </div>
      )}
    </div>
  );
}