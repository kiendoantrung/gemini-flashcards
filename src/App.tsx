import { useState, useEffect } from 'react';
import { GraduationCap, UserCircle, LogOut, ChevronDown } from 'lucide-react';
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
import { Home } from './components/Home';
import { EditDeckPage } from './components/EditDeckPage';
import { Footer } from './components/Footer';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDropdown && !target.closest('.dropdown-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

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
      console.log('Updating deck:', { deckId, updates });

      const user = await getCurrentUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      // Call API to update
      const updatedDeck = await updateDeck(deckId, updates, user.data.user.id);
      console.log('Update response:', updatedDeck);

      // Update local state
      setDecks(prevDecks => 
        prevDecks.map(deck => 
          deck.id === deckId ? { ...deck, ...updates } : deck
        )
      );

      // Update selectedDeck if it's currently selected
      setSelectedDeck(prevDeck => 
        prevDeck?.id === deckId ? { ...prevDeck, ...updates } : prevDeck
      );

      alert('Deck updated successfully!');

    } catch (error) {
      console.error('Failed to update deck:', error);
      throw error;
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

  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
  };

  const handleEditDeck = (deck: Deck) => {
    setEditingDeck(deck);
  };

  // Kiểm tra nếu đang ở trang callback
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (!isAuthenticated) {
    // Check if we're on the home page
    if (window.location.pathname === '/') {
      return <Home />;
    }
    
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
      <header className="bg-white/90 backdrop-blur-sm shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                Gemini Flashcards
              </h1>
            </div>
            <div className="flex items-center gap-4 relative dropdown-container">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <Avatar 
                  name={user?.user_metadata?.name || user?.email || 'User'} 
                  imageUrl={user?.user_metadata?.avatar_url} 
                  size="sm"
                />
                <span className="hidden md:inline text-gray-700 font-medium">
                  {user?.user_metadata?.name || user?.email}
                </span>
                <ChevronDown 
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                    showDropdown ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 transform opacity-100 scale-100 transition-all duration-200 ease-out origin-top-right">
                  <div className="py-1" role="menu">
                    <button
                      onClick={() => {
                        setShowProfileEditor(true);
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                      role="menuitem"
                    >
                      <UserCircle className="w-4 h-4 text-gray-500" />
                      <span>Edit Profile</span>
                    </button>
                    <div className="h-px bg-gray-200 mx-3"></div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
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
        {editingDeck ? (
          <EditDeckPage
            deck={editingDeck}
            onSave={(updates) => {
              handleDeckUpdate(editingDeck.id, updates);
              setEditingDeck(null);
            }}
            onCancel={() => setEditingDeck(null)}
          />
        ) : selectedDeck ? (
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
                className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-3.5 border border-transparent text-sm sm:text-base font-medium rounded-full text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:shadow-lg w-full sm:w-auto max-w-[280px] justify-center"
              >
                Create New Deck
              </button>
            </div>
            <CreateDeckModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onDeckCreated={handleDeckCreated}
              className="mx-4 sm:mx-0"
            />
            <DeckList 
              decks={decks} 
              onSelectDeck={handleSelectDeck} 
              onDeleteDeck={handleDeckDelete} 
              onUpdateDeck={handleDeckUpdate}
              onEditDeck={handleEditDeck}
            />
          </>
        )}
      </main>
      <Footer />
    </div>
    
  );
}

export default App;