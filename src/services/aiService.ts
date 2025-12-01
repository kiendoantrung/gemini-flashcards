import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { Deck, Flashcard } from "../types/flashcard";

const API_KEY = import.meta.env.VITE_GOOGLE_AI_KEY;

if (!API_KEY) {
  throw new Error("Please set a valid Google AI API key in .env file");
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

// Zod Schemas for Structured Outputs
const flashcardSchema = z.object({
  front: z.string().describe("The question or front side of the flashcard"),
  back: z.string().describe("The answer or back side of the flashcard"),
});

const deckSchema = z.object({
  title: z.string().describe("Title of the flashcard deck"),
  description: z.string().describe("Brief description of the topic"),
  cards: z.array(flashcardSchema).describe("Array of flashcards"),
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to check if error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, rate limits, and server errors
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
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

      // Exponential backoff with jitter
      const backoffDelay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
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
  const prompt = `Create a set of ${numQuestions} flashcards about "${topic}".

RULES:
- Respond in the SAME LANGUAGE as the topic
- Questions should test understanding, not just recall
- Answers should be concise but complete (1-3 sentences)
- Return a JSON object with: title (string), description (string), and cards (array of objects with front and back properties)`;

  // Create a clean JSON schema that Gemini understands
  const responseSchema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Title of the flashcard deck" },
      description: { type: "string", description: "Brief description of the topic" },
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string", description: "The question or front side of the flashcard" },
            back: { type: "string", description: "The answer or back side of the flashcard" }
          },
          required: ["front", "back"]
        },
        description: "Array of flashcards"
      }
    },
    required: ["title", "description", "cards"]
  };

  const result = await withRetry(
    () => genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as Record<string, unknown>,
      },
    }),
    'generateDeck'
  );

  const text = result.text;
  if (!text) {
    throw new Error("Empty response from AI model");
  }

  // Parse the response and handle potential array format
  let parsedData = JSON.parse(text);
  
  // If the response is an array, try to extract or construct the deck
  if (Array.isArray(parsedData)) {
    // Check if it's an array of flashcards
    if (parsedData.length > 0 && parsedData[0].front && parsedData[0].back) {
      parsedData = {
        title: topic,
        description: `Flashcards about ${topic}`,
        cards: parsedData
      };
    } else {
      throw new Error("Invalid response format from AI model");
    }
  }

  const data = deckSchema.parse(parsedData);

  if (data.cards.length === 0) {
    throw new Error("No flashcards generated");
  }

  return {
    id: crypto.randomUUID(),
    title: data.title,
    description: data.description,
    cards: data.cards.map((card) => ({
      ...card,
      id: crypto.randomUUID(),
    })),
  };
}

async function generateBatchDistractorsFromAI(
  cards: Flashcard[]
): Promise<Record<string, string[]>> {
  const cardsList = cards.map(c => ({ id: c.id, question: c.front, answer: c.back }));
  
  const prompt = `Generate 3 plausible but INCORRECT answer choices (distractors) for each flashcard.

RULES:
- Distractors must be in the SAME LANGUAGE as the correct answer
- Distractors should be similar in length and style to the correct answer
- Distractors should be believable but clearly wrong
- Return a JSON object where each key is the card ID and the value is an array of 3 distractor strings

Cards:
${JSON.stringify(cardsList, null, 2)}`;

  // Create dynamic schema based on card IDs - use plain JSON schema format
  const dynamicSchemaProperties: Record<string, unknown> = {};
  cards.forEach(card => {
    dynamicSchemaProperties[card.id] = {
      type: "array",
      items: { type: "string" },
      description: `3 distractors for card: ${card.front}`
    };
  });

  const responseSchema = {
    type: "object",
    properties: dynamicSchemaProperties,
    required: cards.map(c => c.id)
  };

  // Also create a Zod schema for validation
  const zodDynamicSchema = z.object(
    Object.fromEntries(
      cards.map(card => [
        card.id,
        z.array(z.string()).describe(`3 distractors for card: ${card.front}`)
      ])
    )
  );

  const result = await withRetry(
    () => genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as Record<string, unknown>,
      },
    }),
    'generateBatchDistractors'
  );

  const text = result.text;
  if (!text) {
    throw new Error("Empty response from AI model");
  }

  const parsedData = JSON.parse(text);
  
  // Handle array response by converting to object if needed
  if (Array.isArray(parsedData)) {
    // Create a fallback object mapping card IDs to empty arrays
    const fallback: Record<string, string[]> = {};
    cards.forEach(card => {
      fallback[card.id] = [];
    });
    return fallback;
  }

  return zodDynamicSchema.parse(parsedData);
}

export async function generateBatchDistractors(
  cards: Flashcard[]
): Promise<Record<string, string[]>> {
  try {
    // Process in chunks of 5 to avoid hitting token limits or timeouts
    const chunkSize = 5;
    const chunks = [];
    for (let i = 0; i < cards.length; i += chunkSize) {
      chunks.push(cards.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map(chunk => generateBatchDistractorsFromAI(chunk))
    );

    return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  } catch (error) {
    console.error("Error generating batch distractors:", error);
    return {};
  }
}
