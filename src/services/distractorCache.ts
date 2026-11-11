import type { Flashcard } from '../types/flashcard';

/**
 * Per-browser cache of AI quiz distractors.
 *
 * Without it every quiz start re-asked Gemini for every card (a 50-card deck
 * is five Edge Function calls), which burned both the shared API quota and
 * the user's own daily quota. Entries are keyed by a hash of the card's text,
 * so editing a card invalidates just that card.
 *
 * localStorage, not the database: distractors are disposable and writing
 * them into `decks.cards` would race with the deck editor, which saves the
 * whole cards array at once.
 */

const STORAGE_PREFIX = 'quiz-distractors:v1:';

interface CacheEntry {
  hash: string;
  distractors: string[];
}

type DeckCache = Record<string, CacheEntry>;

/** FNV-1a, 32-bit. Collision resistance is irrelevant here; stability is. */
function hashCard(card: Pick<Flashcard, 'front' | 'back'>): string {
  const input = `${card.front}\u0000${card.back}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function readDeckCache(deckId: string): DeckCache {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + deckId);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as DeckCache) : {};
  } catch {
    // Private mode, blocked storage or corrupt JSON: behave as a cold cache.
    return {};
  }
}

/** Cached distractors for cards whose text has not changed since caching. */
export function getCachedDistractors(deckId: string, cards: Flashcard[]): Record<string, string[]> {
  const cache = readDeckCache(deckId);
  const result: Record<string, string[]> = {};
  for (const card of cards) {
    const entry = cache[card.id];
    if (
      entry &&
      entry.hash === hashCard(card) &&
      Array.isArray(entry.distractors) &&
      entry.distractors.length >= 3
    ) {
      result[card.id] = entry.distractors;
    }
  }
  return result;
}

/**
 * Stores fresh distractors and drops entries for cards no longer in the
 * deck, so the cache never outgrows the deck.
 */
export function cacheDistractors(
  deckId: string,
  cards: Flashcard[],
  fresh: Record<string, string[]>,
): void {
  const previous = readDeckCache(deckId);
  const next: DeckCache = {};
  for (const card of cards) {
    const hash = hashCard(card);
    if (fresh[card.id]) {
      next[card.id] = { hash, distractors: fresh[card.id] };
    } else if (previous[card.id]?.hash === hash) {
      next[card.id] = previous[card.id];
    }
  }

  try {
    window.localStorage.setItem(STORAGE_PREFIX + deckId, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage unavailable: the cache is an optimisation.
  }
}
