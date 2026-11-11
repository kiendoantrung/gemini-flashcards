import { GoogleGenAI } from "npm:@google/genai@1.11.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.46.1";
import {
  AttemptTimeoutError,
  createApiKeyState,
  DEFAULT_RETRY_OPTIONS,
  FunctionError,
  generateWithRetry,
  isRecord,
  MAX_DECK_DESCRIPTION_CHARS,
  MAX_DECK_TITLE_CHARS,
  MAX_REQUEST_BODY_BYTES,
  normalizeDistractors,
  normalizeFlashcards,
  parseAIResponse,
  parseDailyLimit,
  parseRequestBody,
  quotaExceededError,
  requestError,
  requireAIString,
  aiResponseError,
  type ValidatedFlashcardRequest,
} from "./lib.ts";

// ============================================================================
// Configuration
// ============================================================================

/** Override with the GEMINI_MODEL secret to switch models without a deploy. */
const MODEL_NAME = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.5-flash-lite";

const DAILY_AI_REQUEST_LIMIT = parseDailyLimit(Deno.env.get("AI_DAILY_REQUEST_LIMIT"));

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (configuredOrigins.length === 0) {
  console.warn(
    "ALLOWED_ORIGINS is not configured; browser requests will not receive CORS access",
  );
}

/**
 * All available Gemini keys: GOOGLE_AI_KEY, GOOGLE_AI_KEY_2 … GOOGLE_AI_KEY_10.
 */
function getApiKeys(): string[] {
  const keys: string[] = [];
  const primaryKey = Deno.env.get("GOOGLE_AI_KEY");
  if (primaryKey) keys.push(primaryKey);
  for (let i = 2; i <= 10; i++) {
    const key = Deno.env.get(`GOOGLE_AI_KEY_${i}`);
    if (key) keys.push(key);
  }
  return keys;
}

// ============================================================================
// Response schemas
// ============================================================================

const flashcardArraySchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      front: { type: "string", description: "The question or front side of the flashcard" },
      back: { type: "string", description: "The answer or back side of the flashcard" },
    },
    required: ["front", "back"],
  },
  description: "Array of flashcards",
};

const deckSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Title of the flashcard deck" },
    description: { type: "string", description: "Brief description of the topic" },
    cards: flashcardArraySchema,
  },
  required: ["title", "description", "cards"],
};

// ============================================================================
// HTTP helpers
// ============================================================================

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

function jsonResponse(data: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

/**
 * Error contract: every failure is `{ error: string, code: string }` with a
 * matching HTTP status. `error` is safe to show to end users for the codes
 * the client passes through (see src/services/generateClient.ts).
 */
function errorResponse(error: unknown, req: Request): Response {
  if (error instanceof FunctionError) {
    // 4xx are expected (validation, quota); keep the logs for real failures.
    if (error.status >= 500) console.error("Edge function error:", error);
    return jsonResponse({ error: error.message, code: error.code }, error.status, req);
  }

  console.error("Edge function error:", error);
  return jsonResponse({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500, req);
}

async function readRequest(req: Request): Promise<ValidatedFlashcardRequest> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    throw requestError("Request payload is too large", 413);
  }
  return parseRequestBody(await req.text());
}

// ============================================================================
// Gemini
// ============================================================================

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AttemptTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function generateContent(
  apiKeys: string[],
  prompt: string,
  schema: Record<string, unknown>,
  inlineData?: { mimeType: string; data: string },
): Promise<string> {
  const contents = inlineData ? [{ text: prompt }, { inlineData }] : prompt;

  // Start at a random key so concurrent requests spread across keys instead
  // of all hammering key 1 first.
  const keyState = createApiKeyState(Math.floor(Math.random() * apiKeys.length) - 1);

  return await generateWithRetry(
    apiKeys,
    async (apiKey) => {
      const genAI = new GoogleGenAI({ apiKey });
      const result = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: { responseMimeType: "application/json", responseSchema: schema },
      });
      return result.text || "";
    },
    {
      ...DEFAULT_RETRY_OPTIONS,
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      withTimeout,
      onRetry: ({ keyIndex, kind, error }) => {
        console.warn(
          `AI request failed (key ${keyIndex + 1}, ${kind}):`,
          error instanceof Error ? error.message : error,
        );
      },
    },
    keyState,
  );
}

// ============================================================================
// Action handlers
// ============================================================================

async function handleGenerateDeck(apiKeys: string[], topic: string, numQuestions: number) {
  const prompt = `Create a set of ${numQuestions} flashcards about "${topic}".

RULES:
- Respond in the SAME LANGUAGE as the topic
- Questions should test understanding, not just recall
- Answers should be concise but complete (1-3 sentences)
- Return a JSON object with: title (string), description (string), and cards (array of objects with front and back properties)`;

  let parsedData = parseAIResponse(await generateContent(apiKeys, prompt, deckSchema));

  if (Array.isArray(parsedData)) {
    parsedData = { title: topic, description: `Flashcards about ${topic}`, cards: parsedData };
  }

  if (!isRecord(parsedData) || !Array.isArray(parsedData.cards)) {
    throw aiResponseError("Invalid deck structure in AI response");
  }
  const title = requireAIString(parsedData.title, "title", { chars: MAX_DECK_TITLE_CHARS });
  const description = parsedData.description === undefined
    ? `Flashcards about ${topic}`
    : requireAIString(parsedData.description, "description", { chars: MAX_DECK_DESCRIPTION_CHARS });
  const cards = normalizeFlashcards(parsedData.cards, numQuestions);

  return {
    id: crypto.randomUUID(),
    title,
    description,
    cards: cards.map((card) => ({ id: crypto.randomUUID(), front: card.front, back: card.back })),
  };
}

async function handleGenerateDistractors(
  apiKeys: string[],
  cards: Array<{ id: string; front: string; back: string }>,
) {
  const cardsList = cards.map((c) => ({ id: c.id, question: c.front, answer: c.back }));

  const prompt = `Generate 3 plausible but INCORRECT answer choices (distractors) for each flashcard.

RULES:
- Distractors must be in the SAME LANGUAGE as the correct answer
- Distractors should be similar in length and style to the correct answer
- Distractors should be believable but clearly wrong
- Return a JSON object where each key is the card ID and the value is an array of 3 distractor strings

Cards:
${JSON.stringify(cardsList, null, 2)}`;

  const properties: Record<string, unknown> = {};
  for (const card of cards) {
    properties[card.id] = {
      type: "array",
      items: { type: "string" },
      description: `3 distractors for card: ${card.front}`,
    };
  }
  const responseSchema = { type: "object", properties, required: cards.map((c) => c.id) };

  return normalizeDistractors(
    parseAIResponse(await generateContent(apiKeys, prompt, responseSchema)),
    cards,
  );
}

async function handleGenerateFromText(apiKeys: string[], text: string, numQuestions: number) {
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

  return normalizeFlashcards(
    parseAIResponse(await generateContent(apiKeys, prompt, flashcardArraySchema)),
    numQuestions,
  );
}

async function handleGenerateFromPDF(apiKeys: string[], pdfBase64: string, numQuestions: number) {
  const prompt = `Create ${numQuestions} flashcard questions and answers from this PDF document.

RULES:
- Respond in the SAME LANGUAGE as the source document
- Focus on KEY CONCEPTS and important facts
- Questions should test understanding, not trivial details
- Answers should be concise but complete (1-3 sentences)
- Avoid duplicate or overlapping questions
- Return a JSON array of objects, each with "front" (question) and "back" (answer) properties`;

  const responseText = await generateContent(apiKeys, prompt, flashcardArraySchema, {
    mimeType: "application/pdf",
    data: pdfBase64,
  });
  return normalizeFlashcards(parseAIResponse(responseText), numQuestions);
}

// ============================================================================
// Auth and quota
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const authClient: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, clientOptions)
  : null;
const adminClient: SupabaseClient | null = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, clientOptions)
  : null;

if (!adminClient) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY is not available; per-user AI quota is disabled");
}

/** Returns the caller's user id. */
async function authenticateRequest(req: Request): Promise<string> {
  const match = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new FunctionError("Authentication required", 401, "AUTH_REQUIRED");
  }
  if (!authClient) {
    throw new FunctionError(
      "Authentication service is not configured",
      500,
      "AUTH_CONFIGURATION_ERROR",
    );
  }

  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user) {
    throw new FunctionError("Invalid or expired authentication token", 401, "AUTH_INVALID");
  }
  return data.user.id;
}

/**
 * Counts one AI request against the caller's daily quota.
 *
 * Fails open: if the quota table or function is missing (the migration has
 * not been applied yet) or the database is unreachable, the request is
 * allowed and the problem is logged. Blocking every generation for every
 * user because of a bookkeeping failure would be the worse outage.
 */
async function consumeDailyQuota(userId: string): Promise<void> {
  if (!adminClient) return;

  const { data, error } = await adminClient.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_daily_limit: DAILY_AI_REQUEST_LIMIT,
  });

  if (error) {
    console.error("AI quota check failed; allowing request:", error.message);
    return;
  }
  if (data === null) {
    throw quotaExceededError(DAILY_AI_REQUEST_LIMIT);
  }
}

// ============================================================================
// Main handler
// ============================================================================

Deno.serve(async (req: Request) => {
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
    const userId = await authenticateRequest(req);
    const request = await readRequest(req);

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      throw new FunctionError("AI service is not configured", 503, "AI_CONFIGURATION_ERROR");
    }

    // After validation, so malformed requests do not burn the user's quota.
    await consumeDailyQuota(userId);

    switch (request.action) {
      case "generateDeck":
        return jsonResponse(
          await handleGenerateDeck(apiKeys, request.topic, request.numQuestions),
          200,
          req,
        );
      case "generateDistractors":
        return jsonResponse(await handleGenerateDistractors(apiKeys, request.cards), 200, req);
      case "generateFromText":
        return jsonResponse(
          await handleGenerateFromText(apiKeys, request.text, request.numQuestions),
          200,
          req,
        );
      case "generateFromPDF":
        return jsonResponse(
          await handleGenerateFromPDF(apiKeys, request.pdfBase64, request.numQuestions),
          200,
          req,
        );
    }
  } catch (error) {
    return errorResponse(error, req);
  }
});
