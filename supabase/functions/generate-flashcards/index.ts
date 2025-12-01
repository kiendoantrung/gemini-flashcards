import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.11.0";

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL_NAME = "gemini-2.5-flash";
const DEFAULT_NUM_QUESTIONS = 10;
const MAX_NUM_QUESTIONS = 50;
const MIN_NUM_QUESTIONS = 1;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Get all available API keys from environment variables
 * Supports: GOOGLE_AI_KEY, GOOGLE_AI_KEY_2, GOOGLE_AI_KEY_3, etc.
 */
function getApiKeys(): string[] {
  const keys: string[] = [];
  
  // Primary key
  const primaryKey = Deno.env.get("GOOGLE_AI_KEY");
  if (primaryKey) keys.push(primaryKey);
  
  // Additional keys (up to 10)
  for (let i = 2; i <= 10; i++) {
    const key = Deno.env.get(`GOOGLE_AI_KEY_${i}`);
    if (key) keys.push(key);
  }
  
  return keys;
}

// Track failed keys to avoid using them again in the same request
let failedKeyIndices: Set<number> = new Set();
let currentKeyIndex = 0;

/**
 * Get the next available API key (round-robin with failover)
 */
function getNextApiKey(keys: string[]): { key: string; index: number } | null {
  const availableKeys = keys.filter((_, idx) => !failedKeyIndices.has(idx));
  
  if (availableKeys.length === 0) {
    return null;
  }
  
  // Round-robin selection among available keys
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  
  // Skip failed keys
  while (failedKeyIndices.has(currentKeyIndex)) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  }
  
  return { key: keys[currentKeyIndex], index: currentKeyIndex };
}

/**
 * Mark a key as failed for this request cycle
 */
function markKeyAsFailed(index: number): void {
  failedKeyIndices.add(index);
}

/**
 * Reset failed keys at the start of a new request
 */
function resetFailedKeys(): void {
  failedKeyIndices = new Set();
}

// ============================================================================
// Types
// ============================================================================

interface FlashcardRequest {
  action: "generateDeck" | "generateDistractors" | "generateFromText" | "generateFromPDF";
  topic?: string;
  numQuestions?: number;
  cards?: Array<{ id: string; front: string; back: string }>;
  text?: string;
  pdfBase64?: string;
}

interface FlashcardData {
  front: string;
  back: string;
}

interface DeckData {
  title: string;
  description: string;
  cards: FlashcardData[];
}

// ============================================================================
// Response Schemas
// ============================================================================

const flashcardArraySchema = {
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
};

const deckSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Title of the flashcard deck" },
    description: { type: "string", description: "Brief description of the topic" },
    cards: flashcardArraySchema
  },
  required: ["title", "description", "cards"]
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a JSON response with CORS headers
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Creates an error response with CORS headers
 */
function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unknown error occurred";
  console.error("Edge function error:", message);
  return jsonResponse({ error: message }, 500);
}

/**
 * Validates numQuestions parameter
 */
function validateNumQuestions(numQuestions: number): void {
  if (numQuestions < MIN_NUM_QUESTIONS || numQuestions > MAX_NUM_QUESTIONS) {
    throw new Error(`numQuestions must be between ${MIN_NUM_QUESTIONS} and ${MAX_NUM_QUESTIONS}`);
  }
}

/**
 * Parses AI response text as JSON with error handling
 */
function parseAIResponse<T>(responseText: string | undefined): T {
  if (!responseText) {
    throw new Error("Empty response from AI model");
  }
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }
}

/**
 * Normalizes flashcard data from various response formats
 */
function normalizeFlashcards(data: unknown): FlashcardData[] {
  let cards: unknown[];

  if (Array.isArray(data)) {
    cards = data;
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.cards)) {
      cards = obj.cards;
    } else if (Array.isArray(obj.flashcards)) {
      cards = obj.flashcards;
    } else {
      throw new Error("Invalid response format: expected array of flashcards");
    }
  } else {
    throw new Error("Invalid response format: expected array of flashcards");
  }

  return cards
    .map((card: unknown) => {
      const c = card as Record<string, string>;
      return {
        front: c.front || c.question || c.q || "",
        back: c.back || c.answer || c.a || "",
      };
    })
    .filter((card) => card.front && card.back);
}

/**
 * Checks if an error is retryable (503, 429, network errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("503") ||
      message.includes("overloaded") ||
      message.includes("unavailable") ||
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("quota") ||
      message.includes("timeout") ||
      message.includes("network")
    );
  }
  return false;
}

/**
 * Delay helper for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates content using Gemini AI with retry logic and key rotation
 */
async function generateContent(
  apiKeys: string[],
  prompt: string,
  schema: Record<string, unknown>,
  inlineData?: { mimeType: string; data: string }
): Promise<string> {
  const contents = inlineData
    ? [{ text: prompt }, { inlineData }]
    : prompt;

  let lastError: Error | null = null;

  // Try each available API key
  while (true) {
    const keyInfo = getNextApiKey(apiKeys);
    
    if (!keyInfo) {
      // All keys have failed
      break;
    }

    const genAI = new GoogleGenAI({ apiKey: keyInfo.key });
    
    // Retry with exponential backoff for this key
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await genAI.models.generateContent({
          model: MODEL_NAME,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });

        return result.text || "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should try another key
        const shouldSwitchKey = isRetryableError(error) && 
          (lastError.message.toLowerCase().includes("quota") ||
           lastError.message.toLowerCase().includes("rate limit") ||
           lastError.message.toLowerCase().includes("429"));
        
        if (shouldSwitchKey) {
          console.warn(`API key ${keyInfo.index + 1} hit rate limit, switching to next key...`);
          markKeyAsFailed(keyInfo.index);
          break; // Try next key
        }
        
        if (!isRetryableError(error) || attempt === MAX_RETRIES) {
          // For non-retryable errors or max retries reached, mark key as failed
          markKeyAsFailed(keyInfo.index);
          break;
        }

        // Exponential backoff with jitter
        const backoffDelay = Math.min(
          INITIAL_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500,
          MAX_DELAY_MS
        );
        
        console.warn(
          `AI request failed (key ${keyInfo.index + 1}, attempt ${attempt}/${MAX_RETRIES}). Retrying in ${Math.round(backoffDelay)}ms...`,
          lastError.message
        );
        
        await delay(backoffDelay);
      }
    }
  }

  // Provide user-friendly error messages
  if (lastError) {
    const message = lastError.message.toLowerCase();
    if (message.includes("overloaded") || message.includes("503") || message.includes("unavailable")) {
      throw new Error("AI service is currently busy. Please wait a moment and try again.");
    }
    if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
      throw new Error("Too many requests. Please wait a minute and try again.");
    }
  }

  throw lastError || new Error("Failed to generate content");
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Generates a flashcard deck from a topic
 */
async function handleGenerateDeck(
  apiKeys: string[],
  topic: string,
  numQuestions: number
): Promise<Response> {
  const prompt = `Create a set of ${numQuestions} flashcards about "${topic}".

RULES:
- Respond in the SAME LANGUAGE as the topic
- Questions should test understanding, not just recall
- Answers should be concise but complete (1-3 sentences)
- Return a JSON object with: title (string), description (string), and cards (array of objects with front and back properties)`;

  const responseText = await generateContent(apiKeys, prompt, deckSchema as Record<string, unknown>);
  let parsedData = parseAIResponse<DeckData | FlashcardData[]>(responseText);

  // Handle array response format
  if (Array.isArray(parsedData)) {
    if (parsedData.length > 0 && "front" in parsedData[0] && "back" in parsedData[0]) {
      parsedData = {
        title: topic,
        description: `Flashcards about ${topic}`,
        cards: parsedData,
      };
    } else {
      throw new Error("Invalid response format from AI model");
    }
  }

  // Validate the response structure
  const data = parsedData as DeckData;
  if (!data.title || !data.cards || !Array.isArray(data.cards)) {
    throw new Error("Invalid deck structure in AI response");
  }

  // Generate IDs for the deck and cards
  const deck = {
    id: crypto.randomUUID(),
    title: data.title,
    description: data.description || `Flashcards about ${topic}`,
    cards: data.cards.map((card) => ({
      id: crypto.randomUUID(),
      front: card.front,
      back: card.back,
    })),
  };

  return jsonResponse(deck);
}

/**
 * Generates distractors for quiz mode
 */
async function handleGenerateDistractors(
  apiKeys: string[],
  cards: Array<{ id: string; front: string; back: string }>
): Promise<Response> {
  const cardsList = cards.map((c) => ({
    id: c.id,
    question: c.front,
    answer: c.back,
  }));

  const prompt = `Generate 3 plausible but INCORRECT answer choices (distractors) for each flashcard.

RULES:
- Distractors must be in the SAME LANGUAGE as the correct answer
- Distractors should be similar in length and style to the correct answer
- Distractors should be believable but clearly wrong
- Return a JSON object where each key is the card ID and the value is an array of 3 distractor strings

Cards:
${JSON.stringify(cardsList, null, 2)}`;

  // Dynamic schema based on card IDs
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

  const responseText = await generateContent(apiKeys, prompt, responseSchema);
  let distractors = parseAIResponse<Record<string, string[]>>(responseText);

  // Handle array response by converting to object if needed
  if (Array.isArray(distractors)) {
    const fallback: Record<string, string[]> = {};
    cards.forEach(card => {
      fallback[card.id] = [];
    });
    distractors = fallback;
  }

  // Validate and ensure all cards have distractors
  const validatedDistractors: Record<string, string[]> = {};
  for (const card of cards) {
    const cardDistractors = distractors[card.id];
    if (Array.isArray(cardDistractors) && cardDistractors.length >= 3) {
      validatedDistractors[card.id] = cardDistractors.slice(0, 3);
    } else {
      // Return empty array for this card - client will use fallback
      validatedDistractors[card.id] = [];
    }
  }

  return jsonResponse(validatedDistractors);
}

/**
 * Generates flashcards from text content
 */
async function handleGenerateFromText(
  apiKeys: string[],
  text: string,
  numQuestions: number
): Promise<Response> {
  const prompt = `Create ${numQuestions} flashcard questions and answers from this text.

RULES:
- Respond in the SAME LANGUAGE as the source text
- Focus on KEY CONCEPTS and important facts
- Questions should test understanding, not trivial details
- Answers should be concise but complete (1-3 sentences)
- Avoid duplicate or overlapping questions
- Return a JSON array of objects, each with "front" (question) and "back" (answer) properties

Source text:
${text}`;

  const responseText = await generateContent(apiKeys, prompt, flashcardArraySchema as Record<string, unknown>);
  const parsedData = parseAIResponse<unknown>(responseText);
  const cards = normalizeFlashcards(parsedData);

  return jsonResponse(cards);
}

/**
 * Generates flashcards from PDF content
 */
async function handleGenerateFromPDF(
  apiKeys: string[],
  pdfBase64: string,
  numQuestions: number
): Promise<Response> {
  const prompt = `Create ${numQuestions} flashcard questions and answers from this PDF document.

RULES:
- Respond in the SAME LANGUAGE as the source document
- Focus on KEY CONCEPTS and important facts
- Questions should test understanding, not trivial details
- Answers should be concise but complete (1-3 sentences)
- Avoid duplicate or overlapping questions
- Return a JSON array of objects, each with "front" (question) and "back" (answer) properties`;

  const responseText = await generateContent(
    apiKeys,
    prompt,
    flashcardArraySchema as Record<string, unknown>,
    { mimeType: "application/pdf", data: pdfBase64 }
  );
  const parsedData = parseAIResponse<unknown>(responseText);
  const cards = normalizeFlashcards(parsedData);

  return jsonResponse(cards);
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get all available API keys
    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      throw new Error("No GOOGLE_AI_KEY environment variable is set. Please set GOOGLE_AI_KEY (and optionally GOOGLE_AI_KEY_2, GOOGLE_AI_KEY_3, etc.)");
    }

    // Reset failed keys for this request
    resetFailedKeys();

    console.log(`Using ${apiKeys.length} API key(s) for load balancing`);

    const { action, topic, numQuestions = DEFAULT_NUM_QUESTIONS, cards, text, pdfBase64 } =
      (await req.json()) as FlashcardRequest;

    // Validate numQuestions
    validateNumQuestions(numQuestions);

    switch (action) {
      case "generateDeck": {
        if (!topic) {
          throw new Error("Topic is required for generateDeck action");
        }
        return await handleGenerateDeck(apiKeys, topic, numQuestions);
      }

      case "generateDistractors": {
        if (!cards || !Array.isArray(cards) || cards.length === 0) {
          throw new Error("Cards array is required for generateDistractors action");
        }
        return await handleGenerateDistractors(apiKeys, cards);
      }

      case "generateFromText": {
        if (!text) {
          throw new Error("Text is required for generateFromText action");
        }
        return await handleGenerateFromText(apiKeys, text, numQuestions);
      }

      case "generateFromPDF": {
        if (!pdfBase64) {
          throw new Error("PDF base64 data is required for generateFromPDF action");
        }
        return await handleGenerateFromPDF(apiKeys, pdfBase64, numQuestions);
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
