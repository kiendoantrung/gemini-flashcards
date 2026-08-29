import { useState, lazy, Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Deck, DeckProgress } from '../types/flashcard';
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
const SpacedReviewMode = lazy(() =>
  import('./SpacedReviewMode').then((module) => ({ default: module.SpacedReviewMode }))
);

interface AuthenticatedAppViewProps {
  user: User | null;
  decks: Deck[];
  selectedDeck: Deck | null;
  editingDeck: Deck | null;
  spacedReviewDeck?: Deck | null;
  deckProgressById?: Record<string, DeckProgress>;
  onLogout: () => void | Promise<void>;
  onRefreshUser: () => Promise<void>;
  onDeckCreated: (newDeck: Deck) => Promise<void>;
  onDeckUpdate: (deckId: string, updates: Partial<Deck>) => Promise<void>;
  onDeckDelete: (deckId: string) => Promise<void>;
  onSelectDeck: (deck: Deck) => void;
  onEditDeck: (deck: Deck) => void;
  onStopEditing: () => void;
  onExitStudyMode: () => void;
  onStartSpacedReview?: (deck: Deck) => void;
  onExitSpacedReview?: () => void;
  onRefreshDeckProgress?: () => Promise<void>;
}

export function AuthenticatedAppView({
  user,
  decks,
  selectedDeck,
  editingDeck,
  spacedReviewDeck,
  deckProgressById = {},
  onLogout,
  onRefreshUser,
  onDeckCreated,
  onDeckUpdate,
  onDeckDelete,
  onSelectDeck,
  onEditDeck,
  onStopEditing,
  onExitStudyMode,
  onStartSpacedReview,
  onExitSpacedReview,
  onRefreshDeckProgress,
}: AuthenticatedAppViewProps) {
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isCreateDeckModalOpen, setIsCreateDeckModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-duo-paper flex flex-col">
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

      <main className={editingDeck ? "flex-grow w-full flex flex-col min-h-0" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow w-full"}>
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
        ) : spacedReviewDeck ? (
          <Suspense fallback={<LoadingSpinner />}>
            <SpacedReviewMode
              deck={spacedReviewDeck}
              userId={user?.id ?? ''}
              onExit={onExitSpacedReview ?? (() => {})}
              onComplete={() => {
                void onRefreshDeckProgress?.();
              }}
            />
          </Suspense>
        ) : selectedDeck ? (
          <StudyMode deck={selectedDeck} onExit={onExitStudyMode} />
        ) : (
          <>
            <div className="mb-10 text-center">
              <span className="inline-block px-4 py-1.5 bg-duo-green-subtle text-duo-green font-bold text-xs uppercase tracking-widest rounded-full border-2 border-duo-green mb-3">
                Your Dashboard
              </span>
              <h2 className="text-3xl md:text-4xl font-heading font-black text-duo-charcoal tracking-tight">
                Your Learning Journey
              </h2>
              <p className="text-duo-pencil text-base md:text-lg max-w-xl mx-auto mt-2 font-medium">
                Manage your flashcard decks and track your mastery.
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
              deckProgressById={deckProgressById}
              onStartSpacedReview={onStartSpacedReview}
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
