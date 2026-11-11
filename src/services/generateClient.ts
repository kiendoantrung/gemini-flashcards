import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { withRetry } from '../utils/retry';

const FUNCTION_NAME = 'generate-flashcards';

/**
 * Error codes the `generate-flashcards` Edge Function returns in its JSON
 * body (`{ error, code }`). Kept as a string union rather than an enum so an
 * unknown code from a newer function version still type-checks.
 */
export type GenerationErrorCode =
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'USER_RATE_LIMITED'
  | 'AI_RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'AI_GENERATION_FAILED'
  | 'AI_INPUT_REJECTED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * A failure the UI can show as is. `message` is already user-facing.
 *
 * The HTTP status is deliberately stored as `httpStatus`, not `status`:
 * `isRetryableError` treats any `status` of 5xx as retryable, and a 5xx the
 * function produced itself has already been retried server-side.
 */
export class GenerationError extends Error {
  readonly code: GenerationErrorCode | string;
  readonly httpStatus: number | null;

  constructor(message: string, code: GenerationErrorCode | string, httpStatus: number | null) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const FALLBACK_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Your session has expired. Please sign in again.',
  AUTH_INVALID: 'Your session has expired. Please sign in again.',
  AI_INVALID_RESPONSE: 'The AI returned an unusable answer. Please try again.',
  AI_GENERATION_FAILED: 'The AI could not generate cards this time. Please try again.',
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
};

/** Codes whose server message is written for end users and can be shown verbatim. */
const PASSTHROUGH_CODES = new Set([
  'INVALID_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'USER_RATE_LIMITED',
  'AI_RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_INPUT_REJECTED',
]);

function messageForStatus(status: number | null): string {
  switch (status) {
    case 413:
      return 'The file is too large. Please upload a smaller file.';
    case 429:
      return 'Too many requests. Please wait a minute and try again.';
    case 504:
      return 'Generation took too long. Try fewer cards or a shorter document.';
    case 546:
      // WORKER_LIMIT: the function ran out of memory or CPU time.
      return 'This file is too large to process. Please try a smaller file.';
    default:
      return 'Something went wrong while generating cards. Please try again.';
  }
}

/**
 * `supabase.functions.invoke` turns every non-2xx response into a generic
 * "Edge Function returned a non-2xx status code"; the function's own
 * `{ error, code }` body is only reachable through `error.context`.
 */
export async function toGenerationError(error: unknown): Promise<GenerationError> {
  if (error instanceof GenerationError) {
    return error;
  }

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response | undefined;
    const status = typeof response?.status === 'number' ? response.status : null;

    let body: { error?: unknown; code?: unknown } | null = null;
    try {
      body = response ? await response.clone().json() : null;
    } catch {
      // Gateway errors (504, 546) are not JSON; fall back to the status.
    }

    const code = typeof body?.code === 'string' ? body.code : 'UNKNOWN';
    const serverMessage = typeof body?.error === 'string' ? body.error : null;

    const message =
      (PASSTHROUGH_CODES.has(code) && serverMessage) ||
      FALLBACK_MESSAGES[code] ||
      messageForStatus(status);

    return new GenerationError(message, code, status);
  }

  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new GenerationError(FALLBACK_MESSAGES.NETWORK_ERROR, 'NETWORK_ERROR', null);
  }

  return new GenerationError(
    error instanceof Error && error.message ? error.message : messageForStatus(null),
    'UNKNOWN',
    null,
  );
}

/**
 * Single entry point for the `generate-flashcards` Edge Function.
 *
 * Retry policy: the function already retries Gemini (and rotates keys) on the
 * server, so the client retries only when the request never got a response
 * (network or relay failure). An HTTP error is final, which keeps one click
 * from multiplying into dozens of Gemini calls.
 */
export async function invokeGenerate<T>(
  body: Record<string, unknown>,
  operationName: string,
): Promise<T> {
  let result: { data: unknown; error: unknown };
  try {
    result = await withRetry(async () => {
      const response = await supabase.functions.invoke(FUNCTION_NAME, { body });
      if (
        response.error instanceof FunctionsFetchError ||
        response.error instanceof FunctionsRelayError
      ) {
        throw response.error;
      }
      return response;
    }, operationName);
  } catch (error) {
    throw await toGenerationError(error);
  }

  if (result.error) {
    throw await toGenerationError(result.error);
  }

  if (result.data === null || result.data === undefined) {
    throw new GenerationError(FALLBACK_MESSAGES.AI_GENERATION_FAILED, 'AI_GENERATION_FAILED', null);
  }

  return result.data as T;
}
