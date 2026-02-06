import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Deck } from '../types/flashcard';
import { supabase } from '../lib/supabase';
import { getCurrentUser, logout as logoutService } from '../services/authService';
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
}

export function useDashboardState(
  showToast: (message: string, type: ToastType) => void
): UseDashboardStateResult {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [user, setUser] = useState<User | null>(null);

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
        return;
      }

      try {
        const userDecks = await getUserDecks(session.user.id);
        if (!isMounted) return;
        setDecks(userDecks);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load decks:', error);
        setDecks([]);
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
  }, []);

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
      if (!currentUser) return;

      const deckId = await saveDeck(newDeck, currentUser.id);
      setDecks((prevDecks) => [{ ...newDeck, id: deckId }, ...prevDecks]);
    } catch (error) {
      console.error('Failed to save deck:', error);
    }
  }, []);

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

        setDecks((prevDecks) =>
          prevDecks.map((deck) =>
            deck.id === deckId ? { ...deck, ...updates } : deck
          )
        );
        setSelectedDeck((prevDeck) =>
          prevDeck?.id === deckId ? { ...prevDeck, ...updates } : prevDeck
        );
        setEditingDeck((prevDeck) =>
          prevDeck?.id === deckId ? { ...prevDeck, ...updates } : prevDeck
        );

        showToast('Deck updated successfully!', 'success');
      } catch (error) {
        console.error('Failed to update deck:', error);
        throw error;
      }
    },
    [showToast]
  );

  const deleteDeckById = useCallback(async (deckId: string) => {
    try {
      const {
        data: { user: currentUser },
      } = await getCurrentUser();
      if (!currentUser) return;

      await deleteDeckService(deckId, currentUser.id);
      setDecks((prevDecks) => prevDecks.filter((deck) => deck.id !== deckId));
      setSelectedDeck((prevDeck) =>
        prevDeck?.id === deckId ? null : prevDeck
      );
      setEditingDeck((prevDeck) =>
        prevDeck?.id === deckId ? null : prevDeck
      );
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  }, []);

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

  return {
    isAuthenticated,
    user,
    decks,
    selectedDeck,
    editingDeck,
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
  };
}
