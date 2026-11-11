import type { Flashcard } from '../types/flashcard';

const OPTION_COUNT = 4;

/** Unbiased Fisher-Yates shuffle (`sort(() => Math.random() - 0.5)` is not). */
export function shuffleArray<T>(array: T[], random: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The answer choices for one card: its correct answer plus up to three wrong
 * ones, never repeating a value. AI distractors come first; other cards'
 * answers fill any gap (all of them when the AI call failed). A deck with
 * fewer than four distinct answers can only offer that many choices.
 */
export function buildOptions(
  card: Flashcard,
  deckCards: Flashcard[],
  aiDistractors: string[] = [],
  random: () => number = Math.random,
): string[] {
  const seen = new Set([card.back.trim().toLocaleLowerCase()]);
  const wrong: string[] = [];

  const add = (candidate: string) => {
    const key = candidate.trim().toLocaleLowerCase();
    if (!key || seen.has(key) || wrong.length >= OPTION_COUNT - 1) return;
    seen.add(key);
    wrong.push(candidate);
  };

  aiDistractors.forEach(add);
  shuffleArray(deckCards.filter((other) => other.id !== card.id), random).forEach((other) =>
    add(other.back),
  );

  return shuffleArray([...wrong, card.back], random);
}
