import { supabase } from '../lib/supabase';
import type { Deck } from '../types/flashcard';


export async function saveDeck(deck: Deck, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('decks')
    .insert([{
      ...deck,
      user_id: userId,
      created_at: new Date().toISOString()
    }])
    .select('id')
    .single();

  if (error) {
    console.error('Error saving deck:', error);
    throw error;
  }

  return data.id;
}

export async function getUserDecks(userId: string): Promise<Deck[]> {
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching decks:', error);
    throw error;
  }

  return data.map(deck => ({
    ...deck,
    id: deck.id.toString()
  }));
}

export async function updateDeck(deckId: string, updates: Partial<Deck>, userId: string) {


  if (!updates.title || !updates.description || !updates.cards) {
    throw new Error('Missing required fields');
  }

  const updateData = {
    title: updates.title,
    description: updates.description,
    cards: updates.cards
  };



  const { data, error } = await supabase
    .from('decks')
    .update(updateData)
    .eq('id', deckId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    throw error;
  }

  if (!data) {
    throw new Error('No data returned from update');
  }

  return data;
}

export async function deleteDeck(deckId: string, userId: string) {
  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting deck:', error);
    throw error;
  }
} 