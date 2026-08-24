import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.11.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

// ============================================================================
// Constants
// ============================================================================

const MODEL_NAME = "gemini-3.5-flash-lite";
const DEFAULT_NUM_QUESTIONS = 10;
const MAX_NUM_QUESTIONS = 50;
const MIN_NUM_QUESTIONS = 1;
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_PDF_BASE64_LENGTH = Math.ceil(MAX_PDF_SIZE_BYTES / 3) * 4;
const MAX_REQUEST_BODY_BYTES = MAX_PDF_BASE64_LENGTH + 64 * 1024;
const MAX_TOPIC_BYTES = 1_000;
const MAX_TEXT_BYTES = 500_000;
const MAX_CARD_COUNT = 50;
const MAX_CARD_ID_BYTES = 128;
const MAX_CARD_TEXT_BYTES = 5_000;
const MAX_DECK_TITLE_BYTES = 500;
const MAX_DECK_DESCRIPTION_BYTES = 2_000;

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (configuredOrigins.length === 0) {
  console.warn(
    "ALLOWED_ORIGINS is not configured; browser requests will not receive CORS access",
  );
}

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

interface ApiKeyState {
  failedKeyIndices: Set<number>;
  currentKeyIndex: number;
}

function createApiKeyState(): ApiKeyState {
  return {
    failedKeyIndices: new Set<number>(),
    currentKeyIndex: -1,
  };
}

/**
 * Get the next available API key (round-robin with failover)
 */
function getNextApiKey(
  keys: string[],
  state: ApiKeyState
): { key: string; index: number } | null {
  const availableKeys = keys.filter((_, idx) => !state.failedKeyIndices.has(idx));
  
  if (availableKeys.length === 0) {
    return null;
  }
  
  // Round-robin selection among available keys
  state.currentKeyIndex = (state.currentKeyIndex + 1) % keys.length;

  // Skip failed keys
  while (state.failedKeyIndices.has(state.currentKeyIndex)) {
    state.currentKeyIndex = (state.currentKeyIndex + 1) % keys.length;
  }

  return { key: keys[state.currentKeyIndex], index: state.currentKeyIndex };
}

function markKeyAsFailed(state: ApiKeyState, index: number): void {
  state.failedKeyIndices.add(index);
}

// ============================================================================
// Types
// ============================================================================

type ValidatedFlashcardRequest =
  | { action: "generateDeck"; topic: string; numQuestions: number }
  | {
      action: "generateDistractors";
      cards: Array<{ id: string; front: string; back: string }>;
    }
  | { action: "generateFromText"; text: string; numQuestions: number }
  | { action: "generateFromPDF"; pdfBase64: string; numQuestions: number };

interface FlashcardData {
  front: string;
  back: string;
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

class FunctionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "FunctionError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestError(message: string, status = 400): FunctionError {
  return new FunctionError(
    message,
    status,
    status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
  );
}

function aiResponseError(message: string): FunctionError {
  return new FunctionError(message, 502, "AI_INVALID_RESPONSE");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function requireString(
  value: unknown,
  fieldName: string,
  maxBytes: number,
): string {
  if (typeof value !== "string") {
    throw requestError(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw requestError(`${fieldName} is required`);
  }
  if (byteLength(normalized) > maxBytes) {
    throw requestError(`${fieldName} is too long`);
  }

  return normalized;
}

function requireAIString(
  value: unknown,
  fieldName: string,
  maxBytes: number,
): string {
  if (typeof value !== "string") {
    throw aiResponseError(`AI response field "${fieldName}" must be a string`);
  }

  const normalized = value.trim();
  if (!normalized || byteLength(normalized) > maxBytes) {
    throw aiResponseError(`AI response field "${fieldName}" is invalid`);
  }

  return normalized;
}

function validateNumQuestions(value: unknown): number {
  if (value === undefined) return DEFAULT_NUM_QUESTIONS;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_NUM_QUESTIONS ||
    value > MAX_NUM_QUESTIONS
  ) {
    throw requestError(
      `numQuestions must be an integer between ${MIN_NUM_QUESTIONS} and ${MAX_NUM_QUESTIONS}`,
    );
  }
  return value;
}

function validateCards(
  value: unknown,
): Array<{ id: string; front: string; back: string }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw requestError("cards must be a non-empty array");
  }
  if (value.length > MAX_CARD_COUNT) {
    throw requestError(`cards cannot contain more than ${MAX_CARD_COUNT} items`);
  }

  const ids = new Set<string>();
  return value.map((card, index) => {
    if (!isRecord(card)) {
      throw requestError(`cards[${index}] must be an object`);
    }

    const id = requireString(card.id, `cards[${index}].id`, MAX_CARD_ID_BYTES);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw requestError(`cards[${index}].id contains unsupported characters`);
    }
    if (ids.has(id)) {
      throw requestError(`cards contains duplicate id "${id}"`);
    }
    ids.add(id);

    return {
      id,
      front: requireString(card.front, `cards[${index}].front`, MAX_CARD_TEXT_BYTES),
      back: requireString(card.back, `cards[${index}].back`, MAX_CARD_TEXT_BYTES),
    };
  });
}

function validatePdfBase64(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw requestError("pdfBase64 is required");
  }
  if (
    value.length > MAX_PDF_BASE64_LENGTH ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw requestError("pdfBase64 is not valid base64 or is too large");
  }

  validatePdfBase64Size(value);
  return value;
}

async function parseRequest(req: Request): Promise<ValidatedFlashcardRequest> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    throw requestError("Request payload is too large", 413);
  }

  const rawBody = await req.text();
  if (byteLength(rawBody) > MAX_REQUEST_BODY_BYTES) {
    throw requestError("Request payload is too large", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw requestError("Request body must be valid JSON");
  }
  if (!isRecord(payload)) {
    throw requestError("Request body must be a JSON object");
  }

  switch (payload.action) {
    case "generateDeck":
      return {
        action: payload.action,
        topic: requireString(payload.topic, "topic", MAX_TOPIC_BYTES),
        numQuestions: validateNumQuestions(payload.numQuestions),
      };
    case "generateDistractors":
      return { action: payload.action, cards: validateCards(payload.cards) };
    case "generateFromText":
      return {
        action: payload.action,
        text: requireString(payload.text, "text", MAX_TEXT_BYTES),
        numQuestions: validateNumQuestions(payload.numQuestions),
      };
    case "generateFromPDF":
      return {
        action: payload.action,
        pdfBase64: validatePdfBase64(payload.pdfBase64),
        numQuestions: validateNumQuestions(payload.numQuestions),
      };
    default:
      throw requestError("action must be one of the supported generation actions");
  }
}

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-retry-count",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && configuredOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || configuredOrigins.includes(origin);
}

/**
 * Creates a JSON response with CORS headers
 */
function jsonResponse(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req ?? new Request("http://localhost")),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates an error response with CORS headers
 */
function errorResponse(error: unknown, req: Request): Response {
  console.error("Edge function error:", error);

  if (error instanceof FunctionError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status, req);
  }

  return jsonResponse(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    500,
    req,
  );
}

/**
 * Validates the decoded PDF size. Gemini accepts PDFs up to 50 MB; validating
 * here also protects the Edge Function when it is called outside the client.
 */
function validatePdfBase64Size(pdfBase64: string): void {
  const padding = pdfBase64.endsWith('==') ? 2 : pdfBase64.endsWith('=') ? 1 : 0;
  const decodedSize = Math.floor((pdfBase64.length * 3) / 4) - padding;

  if (decodedSize > MAX_PDF_SIZE_BYTES) {
    throw requestError("PDF files must be 50 MB or smaller", 413);
  }
}

/**
 * Parses AI response text as JSON with error handling
 */
function parseAIResponse(responseText: string | undefined): unknown {
  if (!responseText) {
    throw aiResponseError("Empty response from AI model");
  }
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw aiResponseError("Failed to parse AI response as JSON");
  }
}

/**
 * Normalizes flashcard data from various response formats
 */
function normalizeFlashcards(data: unknown, maxCards = MAX_NUM_QUESTIONS): FlashcardData[] {
  let cards: unknown[];

  if (Array.isArray(data)) {
    cards = data;
  } else if (isRecord(data)) {
    const obj = data;
    if (Array.isArray(obj.cards)) {
      cards = obj.cards;
    } else if (Array.isArray(obj.flashcards)) {
      cards = obj.flashcards;
    } else {
      throw aiResponseError("Invalid response format: expected array of flashcards");
    }
  } else {
    throw aiResponseError("Invalid response format: expected array of flashcards");
  }

  if (cards.length === 0 || cards.length > maxCards) {
    throw aiResponseError("AI returned an invalid number of flashcards");
  }

  return cards.map((card: unknown, index) => {
    if (!isRecord(card)) {
      throw aiResponseError(`AI response card ${index + 1} is invalid`);
    }

    const frontValue = card.front ?? card.question ?? card.q;
    const backValue = card.back ?? card.answer ?? card.a;
    return {
      front: requireAIString(frontValue, `cards[${index}].front`, MAX_CARD_TEXT_BYTES),
      back: requireAIString(backValue, `cards[${index}].back`, MAX_CARD_TEXT_BYTES),
    };
  });
}

/** Only transient provider/network failures may be retried. */
function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const errorRecord = error as Record<string, unknown>;
  const status = errorRecord.status ?? errorRecord.statusCode;
  return typeof status === "number" ? status : null;
}

function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null) {
    return [429, 500, 502, 503, 504].includes(status);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("overloaded") ||
      message.includes("temporarily unavailable") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("internal server error")
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
  const keyState = createApiKeyState();

  // Try each available API key
  while (true) {
    const keyInfo = getNextApiKey(apiKeys, keyState);
    
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
          markKeyAsFailed(keyState, keyInfo.index);
          break; // Try next key
        }
        
        if (!isRetryableError(error) || attempt === MAX_RETRIES) {
          // For non-retryable errors or max retries reached, mark key as failed
          markKeyAsFailed(keyState, keyInfo.index);
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
    const status = getErrorStatus(lastError);
    if (
      status === 503 ||
      status === 500 ||
      status === 502 ||
      status === 504 ||
      message.includes("overloaded") ||
      message.includes("503") ||
      message.includes("unavailable")
    ) {
      throw new FunctionError(
        "AI service is currently busy. Please wait a moment and try again.",
        503,
        "AI_UNAVAILABLE",
      );
    }
    if (
      status === 429 ||
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("quota")
    ) {
      throw new FunctionError(
        "Too many requests. Please wait a minute and try again.",
        429,
        "AI_RATE_LIMITED",
      );
    }
  }

  throw new FunctionError("Failed to generate content", 502, "AI_GENERATION_FAILED");
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
  numQuestions: number,
  req: Request,
): Promise<Response> {
  const prompt = `Create a set of ${numQuestions} flashcards about "${topic}".

RULES:
- Respond in the SAME LANGUAGE as the topic
- Questions should test understanding, not just recall
- Answers should be concise but complete (1-3 sentences)
- Return a JSON object with: title (string), description (string), and cards (array of objects with front and back properties)`;

  const responseText = await generateContent(apiKeys, prompt, deckSchema as Record<string, unknown>);
  let parsedData = parseAIResponse(responseText);

  // Handle array response format
  if (Array.isArray(parsedData)) {
    parsedData = {
      title: topic,
      description: `Flashcards about ${topic}`,
      cards: parsedData,
    };
  }

  // Validate the response structure
  if (!isRecord(parsedData) || !Array.isArray(parsedData.cards)) {
    throw aiResponseError("Invalid deck structure in AI response");
  }
  const title = requireAIString(parsedData.title, "title", MAX_DECK_TITLE_BYTES);
  const description = parsedData.description === undefined
    ? `Flashcards about ${topic}`
    : requireAIString(parsedData.description, "description", MAX_DECK_DESCRIPTION_BYTES);
  const cards = normalizeFlashcards(parsedData.cards, numQuestions);

  // Generate IDs for the deck and cards
  const deck = {
    id: crypto.randomUUID(),
    title,
    description,
    cards: cards.map((card) => ({
      id: crypto.randomUUID(),
      front: card.front,
      back: card.back,
    })),
  };

  return jsonResponse(deck, 200, req);
}

/**
 * Generates distractors for quiz mode
 */
async function handleGenerateDistractors(
  apiKeys: string[],
  cards: Array<{ id: string; front: string; back: string }>,
  req: Request,
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
  const distractors = parseAIResponse(responseText);
  if (!isRecord(distractors)) {
    throw aiResponseError("AI returned an invalid distractor response");
  }

  // Validate and ensure all cards have distractors
  const validatedDistractors: Record<string, string[]> = {};
  for (const card of cards) {
    const cardDistractors = distractors[card.id];
    if (!Array.isArray(cardDistractors)) {
      throw aiResponseError(`AI did not return distractors for card ${card.id}`);
    }

    const uniqueDistractors: string[] = [];
    for (const distractor of cardDistractors) {
      const value = requireAIString(distractor, `distractors.${card.id}`, MAX_CARD_TEXT_BYTES);
      if (value.toLocaleLowerCase() === card.back.toLocaleLowerCase()) continue;
      if (!uniqueDistractors.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
        uniqueDistractors.push(value);
      }
    }

    if (uniqueDistractors.length < 3) {
      throw aiResponseError(`AI returned fewer than 3 valid distractors for card ${card.id}`);
    }

    validatedDistractors[card.id] = uniqueDistractors.slice(0, 3);
  }

  return jsonResponse(validatedDistractors, 200, req);
}

/**
 * Generates flashcards from text content
 */
async function handleGenerateFromText(
  apiKeys: string[],
  text: string,
  numQuestions: number,
  req: Request,
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
  const parsedData = parseAIResponse(responseText);
  const cards = normalizeFlashcards(parsedData, numQuestions);

  return jsonResponse(cards, 200, req);
}

/**
 * Generates flashcards from PDF content
 */
async function handleGenerateFromPDF(
  apiKeys: string[],
  pdfBase64: string,
  numQuestions: number,
  req: Request,
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
  const parsedData = parseAIResponse(responseText);
  const cards = normalizeFlashcards(parsedData, numQuestions);

  return jsonResponse(cards, 200, req);
}

// ============================================================================
// Main Handler
// ============================================================================

async function authenticateRequest(req: Request): Promise<void> {
  const authorization = req.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new FunctionError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    throw new FunctionError(
      "Authentication service is not configured",
      500,
      "AUTH_CONFIGURATION_ERROR",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) {
    throw new FunctionError("Invalid or expired authentication token", 401, "AUTH_INVALID");
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(req)) {
      return jsonResponse({ error: "Origin not allowed", code: "ORIGIN_NOT_ALLOWED" }, 403, req);
    }
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    if (req.method !== "POST") {
      throw new FunctionError("Only POST requests are supported", 405, "METHOD_NOT_ALLOWED");
    }
    if (!isAllowedOrigin(req)) {
      throw new FunctionError("Origin not allowed", 403, "ORIGIN_NOT_ALLOWED");
    }

    // verify_jwt remains enabled in supabase/config.toml. This explicit check
    // also protects local/self-hosted deployments where the gateway is absent.
    await authenticateRequest(req);

    const request = await parseRequest(req);

    // Get all available API keys
    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      throw new FunctionError(
        "AI service is not configured",
        503,
        "AI_CONFIGURATION_ERROR",
      );
    }

    console.log(`Using ${apiKeys.length} API key(s) for load balancing`);

    switch (request.action) {
      case "generateDeck": {
        return await handleGenerateDeck(apiKeys, request.topic, request.numQuestions, req);
      }

      case "generateDistractors": {
        return await handleGenerateDistractors(apiKeys, request.cards, req);
      }

      case "generateFromText": {
        return await handleGenerateFromText(apiKeys, request.text, request.numQuestions, req);
      }

      case "generateFromPDF": {
        return await handleGenerateFromPDF(apiKeys, request.pdfBase64, request.numQuestions, req);
      }
    }
  } catch (error) {
    return errorResponse(error, req);
  }
});
