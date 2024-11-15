import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { DeckList } from './components/DeckList';
import { StudyMode } from './components/StudyMode';
import type { Deck } from './types/flashcard';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { getCurrentUser, logout } from './services/authService';
import { deleteDeck, updateDeck, saveDeck } from './services/supabaseService';
import { getUserDecks } from './services/supabaseService';
import { supabase } from './services/supabase';
import { Avatar } from './components/Avatar';
import { ProfileEditor } from './components/ProfileEditor';
import { CreateDeckModal } from './components/CreateDeckModal';
import { AuthCallback } from './components/AuthCallback';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleAuthStateChange = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        setUser(session.user);
        try {
          const userDecks = await getUserDecks(session.user.id);
          setDecks(userDecks);
        } catch (error) {
          console.error('Failed to load decks:', error);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user || null);
    });

    handleAuthStateChange();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDeckCreated = async (newDeck: Deck) => {
    try {
      const user = await getCurrentUser();
      if (!user.data.user) return;
      
      // Save to Supabase
      const deckId = await saveDeck(newDeck, user.data.user.id);
      
      // Update local state with the saved deck
      setDecks([{ ...newDeck, id: deckId }, ...decks]);
    } catch (error) {
      console.error('Failed to save deck:', error);
      // Add appropriate error handling
    }
  };

  const handleAuth = () => {
    setIsAuthenticated(true);
  };

  const handleAuthError = (error: any) => {
    if (error.message?.includes('not authorized')) {
      alert('This email is not authorized. Please contact administrator or use a different email.');
    } else {
      alert('Authentication failed. Please try again.');
    }
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
  };

  const handleDeckUpdate = async (deckId: string, updates: Partial<Deck>) => {
    try {
      const user = await getCurrentUser();
      if (!user.data.user) return;

      await updateDeck(deckId, updates, user.data.user.id);
      setDecks(decks.map(deck => 
        deck.id === deckId ? { ...deck, ...updates } : deck
      ));
    } catch (error) {
      console.error('Failed to update deck:', error);
    }
  };

  const handleDeckDelete = async (deckId: string) => {
    try {
      const user = await getCurrentUser();
      if (!user.data.user) return;

      await deleteDeck(deckId, user.data.user.id);
      setDecks(decks.filter(deck => deck.id !== deckId));
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  };

  // Kiểm tra nếu đang ở trang callback
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100">
        {showLogin ? (
          <Login 
            onLogin={handleAuth} 
            onError={handleAuthError}
            onToggleForm={() => setShowLogin(false)} 
          />
        ) : (
          <Signup 
            onSignup={handleAuth} 
            onError={handleAuthError}
            onToggleForm={() => setShowLogin(true)} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-indigo-600">Flashcards</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProfileEditor(true)}
                className="flex items-center gap-2 hover:opacity-80"
              >
                <Avatar 
                  name={user?.user_metadata?.name || user?.email || 'User'} 
                  imageUrl={user?.user_metadata?.avatar_url} 
                  size="sm"
                />
                <span className="text-gray-600">
                  {user?.user_metadata?.name || user?.email}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {showProfileEditor && (
        <ProfileEditor
          user={user}
          onUpdate={() => {
            // Refresh user data
            getCurrentUser().then(({ data: { user } }) => setUser(user));
          }}
          onClose={() => setShowProfileEditor(false)}
        />
      )}

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
            <div className="flex justify-center mb-8">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create New Deck
              </button>
            </div>
            <CreateDeckModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onDeckCreated={handleDeckCreated}
            />
            <DeckList decks={decks} onSelectDeck={setSelectedDeck} onDeleteDeck={handleDeckDelete} onUpdateDeck={handleDeckUpdate} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;