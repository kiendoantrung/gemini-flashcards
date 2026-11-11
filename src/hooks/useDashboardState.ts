import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Deck, DeckProgress } from '../types/flashcard';
import { supabase } from '../lib/supabase';
import { getCurrentUser, logout as logoutService } from '../services/authService';
import { getDeckProgressBatch } from '../services/spacedRepetitionService';
import {
  deleteDeck as deleteDeckService,
  getUserDecks,
  saveDeck,
  updateDeck as updateDeckService,
} from '../services/supabaseService';

type ToastType = 'success' | 'error' | 'warning';

function requireUser(user: User | null): User {
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

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
  /** Bumped to force a progress refetch when the decks themselves did not change. */
  const [progressVersion, setProgressVersion] = useState(0);

  // Mutations read the signed-in user from here instead of asking the Auth
  // server again (getUser() is a network round trip) on every save.
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const userId = user?.id ?? null;

  // Progress follows the deck list. Driving it from an effect keeps the state
  // updaters below pure and drops responses that arrive out of order.
  useEffect(() => {
    if (!userId || decks.length === 0) {
      setDeckProgressById({});
      return;
    }

    let isCurrent = true;
    getDeckProgressBatch(userId, decks)
      .then((progressById) => {
        if (isCurrent) setDeckProgressById(progressById);
      })
      .catch((error) => {
        console.error('Failed to load deck progress:', error);
      });

    return () => {
      isCurrent = false;
    };
  }, [userId, decks, progressVersion]);

  useEffect(() => {
    let isMounted = true;
    /** The user whose decks are loaded (or loading); null when signed out. */
    let loadedUserId: string | null = null;
    let loadSequence = 0;

    const clearDashboard = () => {
      setDecks([]);
      setSelectedDeck(null);
      setEditingDeck(null);
      setSpacedReviewDeck(null);
      setDeckProgressById({});
    };

    const loadDecks = async (forUserId: string) => {
      const sequence = ++loadSequence;
      try {
        const userDecks = await getUserDecks(forUserId);
        if (!isMounted || sequence !== loadSequence) return;
        setDecks(userDecks);
      } catch (error) {
        if (!isMounted || sequence !== loadSequence) return;
        console.error('Failed to load decks:', error);
        setDecks([]);
        showToast('Failed to load your decks. Please refresh the page.', 'error');
      }
    };

    const syncAuthState = (session: Session | null) => {
      if (!isMounted) return;

      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);

      const nextUserId = session?.user.id ?? null;
      // TOKEN_REFRESHED and USER_UPDATED keep the same user: the decks are
      // already loaded, so only the user object above needs replacing.
      if (nextUserId === loadedUserId) return;
      loadedUserId = nextUserId;

      if (!nextUserId) {
        loadSequence += 1; // discard any in-flight load for the previous user
        clearDashboard();
        return;
      }

      clearDashboard();
      void loadDecks(nextUserId);
    };

    // onAuthStateChange emits INITIAL_SESSION on subscribe, so a separate
    // getSession() call would load the decks twice on every page load.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer: calling other Supabase APIs synchronously inside this callback
      // can deadlock on the auth lock (see supabase-js docs).
      setTimeout(() => syncAuthState(session), 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [showToast]);

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
      const currentUser = requireUser(userRef.current);
      const deckId = await saveDeck(newDeck, currentUser.id);
      const createdDeck = { ...newDeck, id: deckId };
      setDecks((prevDecks) => [createdDeck, ...prevDecks]);
    } catch (error) {
      console.error('Failed to save deck:', error);
      showToast('Failed to save deck. Please try again.', 'error');
      throw error;
    }
  }, [showToast]);

  const updateDeckById = useCallback(
    async (deckId: string, updates: Partial<Deck>) => {
      try {
        const currentUser = requireUser(userRef.current);
        await updateDeckService(deckId, updates, currentUser.id);

        const applyUpdates = (deck: Deck | null) =>
          deck?.id === deckId ? { ...deck, ...updates } : deck;

        setDecks((prevDecks) =>
          prevDecks.map((deck) => (deck.id === deckId ? { ...deck, ...updates } : deck))
        );
        setSelectedDeck(applyUpdates);
        setEditingDeck(applyUpdates);
        setSpacedReviewDeck(applyUpdates);

        showToast('Deck updated successfully!', 'success');
      } catch (error) {
        console.error('Failed to update deck:', error);
        showToast('Failed to update deck. Please try again.', 'error');
        throw error;
      }
    },
    [showToast]
  );

  const deleteDeckById = useCallback(async (deckId: string) => {
    try {
      const currentUser = requireUser(userRef.current);
      await deleteDeckService(deckId, currentUser.id);

      const clearIfDeleted = (deck: Deck | null) => (deck?.id === deckId ? null : deck);
      setDecks((prevDecks) => prevDecks.filter((deck) => deck.id !== deckId));
      setSelectedDeck(clearIfDeleted);
      setEditingDeck(clearIfDeleted);
      setSpacedReviewDeck(clearIfDeleted);

      showToast('Deck deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete deck:', error);
      showToast('Failed to delete deck. Please try again.', 'error');
      throw error;
    }
  }, [showToast]);

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
    // The session changed review rows, not decks, so the progress effect would
    // not rerun on its own.
    setProgressVersion((version) => version + 1);
  }, []);

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
  };
}
