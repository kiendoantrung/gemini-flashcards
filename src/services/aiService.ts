import type { Deck, Flashcard } from "../types/flashcard";
import { invokeGenerate } from "./generateClient";

export async function generateDeck(
  topic: string,
  numQuestions: number = 10
): Promise<Deck> {
  return invokeGenerate<Deck>(
    { action: "generateDeck", topic, numQuestions },
    "generateDeck"
  );
}

/**
 * Cards per request. Must not exceed MAX_CARD_COUNT in the Edge Function;
 * kept small so one slow Gemini call does not hold up the whole quiz.
 */
const DISTRACTOR_CHUNK_SIZE = 10;

export async function generateBatchDistractors(
  cards: Flashcard[]
): Promise<Record<string, string[]>> {
  if (cards.length === 0) {
    return {};
  }

  const chunks: Flashcard[][] = [];
  for (let i = 0; i < cards.length; i += DISTRACTOR_CHUNK_SIZE) {
    chunks.push(cards.slice(i, i + DISTRACTOR_CHUNK_SIZE));
  }

  // Chunks are independent: one failing chunk (e.g. a card the function
  // rejects) must not throw away the distractors the others produced. Cards
  // without distractors fall back to other answers from the deck.
  const results = await Promise.allSettled(
    chunks.map((chunk) =>
      invokeGenerate<Record<string, string[]>>(
        {
          action: "generateDistractors",
          cards: chunk.map((c) => ({ id: c.id, front: c.front, back: c.back })),
        },
        "generateDistractors"
      )
    )
  );

  const merged: Record<string, string[]> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      Object.assign(merged, result.value);
    } else {
      console.error("Error generating distractors:", result.reason);
    }
  }
  return merged;
}
