import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { DeckList } from './components/DeckList';
import { StudyMode } from './components/StudyMode';
import { CreateDeck } from './components/CreateDeck';
import { FileUploadDeck } from './components/FileUploadDeck';
import { sampleDecks } from './data/sampleDecks';
import type { Deck } from './types/flashcard';

function App() {
  const [decks, setDecks] = useState<Deck[]>(() => sampleDecks);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  const handleDeckCreated = (newDeck: Deck) => {
    setDecks([newDeck, ...decks]);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Flashcards</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedDeck ? (
          <StudyMode deck={selectedDeck} onExit={() => setSelectedDeck(null)} />
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Study Decks
              </h2>
              <p className="text-gray-600">
                Select a deck below to start studying. Click on cards to flip them
                and reveal the answers.
              </p>
            </div>
            <CreateDeck onDeckCreated={handleDeckCreated} />
            <FileUploadDeck onDeckCreated={handleDeckCreated} />
            <DeckList decks={decks} onSelectDeck={setSelectedDeck} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
