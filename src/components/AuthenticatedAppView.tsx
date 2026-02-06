import { useState, lazy, Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Deck } from '../types/flashcard';
import { AppHeader } from './AppHeader';
import { CreateDeckModal } from './CreateDeckModal';
import { DeckList } from './DeckList';
import { StudyMode } from './StudyMode';
import { LoadingSpinner } from './LoadingSpinner';

const ProfileEditor = lazy(() =>
  import('./ProfileEditor').then((module) => ({ default: module.ProfileEditor }))
);
const EditDeckPage = lazy(() =>
  import('./EditDeckPage').then((module) => ({ default: module.EditDeckPage }))
);

interface AuthenticatedAppViewProps {
  user: User | null;
  decks: Deck[];
  selectedDeck: Deck | null;
  editingDeck: Deck | null;
  onLogout: () => void | Promise<void>;
  onRefreshUser: () => Promise<void>;
  onDeckCreated: (newDeck: Deck) => Promise<void>;
  onDeckUpdate: (deckId: string, updates: Partial<Deck>) => Promise<void>;
  onDeckDelete: (deckId: string) => Promise<void>;
  onSelectDeck: (deck: Deck) => void;
  onEditDeck: (deck: Deck) => void;
  onStopEditing: () => void;
  onExitStudyMode: () => void;
}

export function AuthenticatedAppView({
  user,
  decks,
  selectedDeck,
  editingDeck,
  onLogout,
  onRefreshUser,
  onDeckCreated,
  onDeckUpdate,
  onDeckDelete,
  onSelectDeck,
  onEditDeck,
  onStopEditing,
  onExitStudyMode,
}: AuthenticatedAppViewProps) {
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isCreateDeckModalOpen, setIsCreateDeckModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neo-cream flex flex-col">
      <AppHeader
        user={user}
        onOpenProfile={() => setShowProfileEditor(true)}
        onLogout={onLogout}
      />

      {showProfileEditor && (
        <Suspense fallback={<LoadingSpinner />}>
          <ProfileEditor
            user={user}
            onUpdate={() => {
              void onRefreshUser();
            }}
            onClose={() => setShowProfileEditor(false)}
          />
        </Suspense>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {editingDeck ? (
          <Suspense fallback={<LoadingSpinner />}>
            <EditDeckPage
              deck={editingDeck}
              onSave={async (updates) => {
                try {
                  await onDeckUpdate(editingDeck.id, updates);
                  onStopEditing();
                } catch {
                  // Keep editor open so user can retry after save failure.
                }
              }}
              onCancel={onStopEditing}
            />
          </Suspense>
        ) : selectedDeck ? (
          <StudyMode deck={selectedDeck} onExit={onExitStudyMode} />
        ) : (
          <>
            <div className="mb-12 text-center">
              <span className="inline-block px-4 py-2 bg-neo-green text-white font-bold text-sm rounded-full border-2 border-neo-border shadow-neo mb-4">
                Your Dashboard
              </span>
              <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-neo-charcoal mb-4">
                Your Learning Journey
              </h2>
              <p className="text-neo-gray text-lg max-w-2xl mx-auto">
                Manage your flashcard decks and track your progress.
              </p>
            </div>

            <CreateDeckModal
              isOpen={isCreateDeckModalOpen}
              onClose={() => setIsCreateDeckModalOpen(false)}
              onDeckCreated={onDeckCreated}
              className="mx-4 sm:mx-0"
            />
            <DeckList
              decks={decks}
              onSelectDeck={onSelectDeck}
              onDeleteDeck={(deckId) => {
                void onDeckDelete(deckId);
              }}
              onUpdateDeck={(deckId, updates) => {
                void onDeckUpdate(deckId, updates);
              }}
              onEditDeck={onEditDeck}
              onCreateDeck={() => setIsCreateDeckModalOpen(true)}
            />
          </>
        )}
      </main>
    </div>
  );
}
