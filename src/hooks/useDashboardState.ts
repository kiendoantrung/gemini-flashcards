import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Deck, DeckProgress } from '../types/flashcard';
import { supabase } from '../lib/supabase';
import { getCurrentUser, logout as logoutService } from '../services/authService';
import { getDeckProgress } from '../services/spacedRepetitionService';
import {
  deleteDeck as deleteDeckService,
  getUserDecks,
  saveDeck,
  updateDeck as updateDeckService,
} from '../services/supabaseService';

type ToastType = 'success' | 'error' | 'warning';

interface UseDashboardStateResult {
  isAuthenticated: boolean;
  user: User | null;
  decks: Deck[];
  selectedDeck: Deck | null;
  editingDeck: Deck | null;
  spacedReviewDeck: Deck | null;
  deckProgressById: Record<string, DeckProgress>;
  markAuthenticated: () => void;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  createDeck: (newDeck: Deck) => Promise<void>;
  updateDeckById: (deckId: string, updates: Partial<Deck>) => Promise<void>;
  deleteDeckById: (deckId: string) => Promise<void>;
  selectDeck: (deck: Deck) => void;
  exitStudyMode: () => void;
  startEditingDeck: (deck: Deck) => void;
  stopEditingDeck: () => void;
  startSpacedReview: (deck: Deck) => void;
  exitSpacedReview: () => void;
  refreshDeckProgress: () => Promise<void>;
}

export function useDashboardState(
  showToast: (message: string, type: ToastType) => void
): UseDashboardStateResult {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [spacedReviewDeck, setSpacedReviewDeck] = useState<Deck | null>(null);
  const [deckProgressById, setDeckProgressById] = useState<Record<string, DeckProgress>>({});
  const [user, setUser] = useState<User | null>(null);

  const fetchProgressForDecks = useCallback(async (userId: string, currentDecks: Deck[]) => {
    if (!userId || currentDecks.length === 0) {
      setDeckProgressById({});
      return;
    }
    try {
      const progressEntries = await Promise.all(
        currentDecks.map(async (deck) => {
          const progress = await getDeckProgress(userId, deck.id, deck.cards.length);
          return [deck.id, progress] as const;
        })
      );
      setDeckProgressById(Object.fromEntries(progressEntries));
    } catch (error) {
      console.error('Failed to load deck progress:', error);
    }
  }, []);

  const refreshDeckProgress = useCallback(async () => {
    if (!user) {
      setDeckProgressById({});
      return;
    }
    await fetchProgressForDecks(user.id, decks);
  }, [user, decks, fetchProgressForDecks]);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async (session: Session | null) => {
      if (!isMounted) return;

      setIsAuthenticated(!!session);
      setUser(session?.user || null);

      if (!session) {
        setDecks([]);
        setSelectedDeck(null);
        setEditingDeck(null);
        setSpacedReviewDeck(null);
        setDeckProgressById({});
        return;
      }

      try {
        const userDecks = await getUserDecks(session.user.id);
        if (!isMounted) return;
        setDecks(userDecks);
        void fetchProgressForDecks(session.user.id, userDecks);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load decks:', error);
        setDecks([]);
        setDeckProgressById({});
      }
    };

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await syncAuthState(session);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthState(session);
    });

    void initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProgressForDecks]);

  const markAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logoutUser = useCallback(async () => {
    await logoutService();
    setIsAuthenticated(false);
    setUser(null);
    setDecks([]);
    setSelectedDeck(null);
    setEditingDeck(null);
    setSpacedReviewDeck(null);
    setDeckProgressById({});
  }, []);

  const refreshUser = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await getCurrentUser();
    setUser(currentUser);
  }, []);

  const createDeck = useCallback(async (newDeck: Deck) => {
    try {
      const {
        data: { user: currentUser },
      } = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const deckId = await saveDeck(newDeck, currentUser.id);
      const createdDeck = { ...newDeck, id: deckId };
      setDecks((prevDecks) => {
        const updated = [createdDeck, ...prevDecks];
        void fetchProgressForDecks(currentUser.id, updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to save deck:', error);
      showToast('Failed to save deck. Please try again.', 'error');
      throw error;
    }
  }, [showToast, fetchProgressForDecks]);

  const updateDeckById = useCallback(
    async (deckId: string, updates: Partial<Deck>) => {
      try {
        const {
          data: { user: currentUser },
        } = await getCurrentUser();

        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        await updateDeckService(deckId, updates, currentUser.id);

        setDecks((prevDecks) => {
          const updated = prevDecks.map((deck) =>
            deck.id === deckId ? { ...deck, ...updates } : deck
          );
          void fetchProgressForDecks(currentUser.id, updated);
          return updated;
        });
        setSelectedDeck((prevDeck) =>
          prevDeck?.id === deckId ? { ...prevDeck, ...updates } : prevDeck
        );
        setEditingDeck((prevDeck) =>
          prevDeck?.id === deckId ? { ...prevDeck, ...updates } : prevDeck
        );
        setSpacedReviewDeck((prevDeck) =>
          prevDeck?.id === deckId ? { ...prevDeck, ...updates } : prevDeck
        );

        showToast('Deck updated successfully!', 'success');
      } catch (error) {
        console.error('Failed to update deck:', error);
        showToast('Failed to update deck. Please try again.', 'error');
        throw error;
      }
    },
    [showToast, fetchProgressForDecks]
  );

  const deleteDeckById = useCallback(async (deckId: string) => {
    try {
      const {
        data: { user: currentUser },
      } = await getCurrentUser();
      if (!currentUser) return;

      await deleteDeckService(deckId, currentUser.id);
      setDecks((prevDecks) => {
        const updated = prevDecks.filter((deck) => deck.id !== deckId);
        void fetchProgressForDecks(currentUser.id, updated);
        return updated;
      });
      setSelectedDeck((prevDeck) =>
        prevDeck?.id === deckId ? null : prevDeck
      );
      setEditingDeck((prevDeck) =>
        prevDeck?.id === deckId ? null : prevDeck
      );
      setSpacedReviewDeck((prevDeck) =>
        prevDeck?.id === deckId ? null : prevDeck
      );
      setDeckProgressById((prev) => {
        const next = { ...prev };
        delete next[deckId];
        return next;
      });
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  }, [fetchProgressForDecks]);

  const selectDeck = useCallback((deck: Deck) => {
    setSelectedDeck(deck);
  }, []);

  const exitStudyMode = useCallback(() => {
    setSelectedDeck(null);
  }, []);

  const startEditingDeck = useCallback((deck: Deck) => {
    setEditingDeck(deck);
  }, []);

  const stopEditingDeck = useCallback(() => {
    setEditingDeck(null);
  }, []);

  const startSpacedReview = useCallback((deck: Deck) => {
    setSelectedDeck(null);
    setEditingDeck(null);
    setSpacedReviewDeck(deck);
  }, []);

  const exitSpacedReview = useCallback(() => {
    setSpacedReviewDeck(null);
    if (user) {
      void fetchProgressForDecks(user.id, decks);
    }
  }, [user, decks, fetchProgressForDecks]);

  return {
    isAuthenticated,
    user,
    decks,
    selectedDeck,
    editingDeck,
    spacedReviewDeck,
    deckProgressById,
    markAuthenticated,
    logoutUser,
    refreshUser,
    createDeck,
    updateDeckById,
    deleteDeckById,
    selectDeck,
    exitStudyMode,
    startEditingDeck,
    stopEditingDeck,
    startSpacedReview,
    exitSpacedReview,
    refreshDeckProgress,
  };
}
