import { supabase } from "../lib/supabase";
import type { Deck, Flashcard } from "../types/flashcard";

const USE_EDGE_FUNCTION = true;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to check if error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("fetch") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    );
  }
  return false;
}

// Generic retry wrapper for async functions
async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
        throw error;
      }

      const backoffDelay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1) +
          Math.random() * 1000,
        RETRY_CONFIG.maxDelay
      );

      console.warn(
        `${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}). Retrying in ${Math.round(backoffDelay)}ms...`,
        error instanceof Error ? error.message : error
      );

      await delay(backoffDelay);
    }
  }

  throw lastError;
}

export async function generateDeck(
  topic: string,
  numQuestions: number = 10
): Promise<Deck> {
  if (!USE_EDGE_FUNCTION) {
    throw new Error(
      "Direct API access is disabled for security. Please enable Edge Functions."
    );
  }

  const { data, error } = await withRetry(
    () =>
      supabase.functions.invoke("generate-flashcards", {
        body: {
          action: "generateDeck",
          topic,
          numQuestions,
        },
      }),
    "generateDeck"
  );

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as Deck;
}

export async function generateBatchDistractors(
  cards: Flashcard[]
): Promise<Record<string, string[]>> {
  if (cards.length === 0) {
    return {};
  }

  if (!USE_EDGE_FUNCTION) {
    console.error("Direct API access is disabled for security.");
    return {};
  }

  try {
    // Process in chunks of 10 to avoid timeout
    const chunkSize = 10;
    const chunks: Flashcard[][] = [];
    for (let i = 0; i < cards.length; i += chunkSize) {
      chunks.push(cards.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((chunk) =>
        withRetry(
          async () => {
            const { data, error } = await supabase.functions.invoke(
              "generate-flashcards",
              {
                body: {
                  action: "generateDistractors",
                  cards: chunk.map((c) => ({
                    id: c.id,
                    front: c.front,
                    back: c.back,
                  })),
                },
              }
            );

            if (error) {
              throw new Error(`Edge function error: ${error.message}`);
            }

            if (data.error) {
              throw new Error(data.error);
            }

            return data as Record<string, string[]>;
          },
          "generateDistractors"
        )
      )
    );

    return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  } catch (error) {
    console.error("Error generating batch distractors:", error);
    return {};
  }
}
