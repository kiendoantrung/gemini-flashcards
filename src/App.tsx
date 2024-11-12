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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-indigo-600 animate-bounce" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
              Flashcards
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedDeck ? (
          <StudyMode deck={selectedDeck} onExit={() => setSelectedDeck(null)} />
        ) : (
          <>
            <div className="mb-8">
              <div className="py-4">
                <p className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 font-bold text-lg md:text-xl lg:text-2xl text-center animate-gradient">
                  Because Who Needs a Cram Session
                </p>
                <p className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 font-bold text-lg md:text-xl lg:text-2xl text-center mt-2 animate-gradient">
                  When You've Got Genius in Your Pocket?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <CreateDeck onDeckCreated={handleDeckCreated} />
              <FileUploadDeck onDeckCreated={handleDeckCreated} />
            </div>
            {/* make the deck list shimmer when loading */}
            <div className="shimmer">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Study Decks
              </h2>
              <p className="text-gray-600">
                Select a deck below to start studying. Click on cards to flip them
                and reveal the answers.
              </p>
            </div>
              <DeckList decks={decks} onSelectDeck={setSelectedDeck} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
