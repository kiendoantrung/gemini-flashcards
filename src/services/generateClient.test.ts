import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { GenerationError, invokeGenerate, toGenerationError } from './generateClient';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

function httpError(status: number, body: unknown) {
  const response = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  return new FunctionsHttpError(response);
}

describe('toGenerationError', () => {
  it('surfaces the function message for user-facing codes', async () => {
    const error = await toGenerationError(
      httpError(413, { error: 'PDF files must be 15 MB or smaller', code: 'PAYLOAD_TOO_LARGE' }),
    );

    expect(error).toBeInstanceOf(GenerationError);
    expect(error.message).toBe('PDF files must be 15 MB or smaller');
    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(error.httpStatus).toBe(413);
  });

  it('replaces internal messages with a friendly one', async () => {
    const error = await toGenerationError(
      httpError(502, { error: 'AI response field "cards[0].front" is invalid', code: 'AI_INVALID_RESPONSE' }),
    );

    expect(error.message).toMatch(/unusable answer/i);
  });

  it('falls back to the status when the gateway body is not JSON', async () => {
    const error = await toGenerationError(httpError(546, 'WORKER_LIMIT'));

    expect(error.message).toMatch(/too large to process/i);
    expect(error.code).toBe('UNKNOWN');
  });

  it('does not expose a 5xx as `status`, so the client never retries it', async () => {
    const error = await toGenerationError(httpError(503, { error: 'busy', code: 'AI_UNAVAILABLE' }));

    expect((error as unknown as { status?: number }).status).toBeUndefined();
  });
});

describe('invokeGenerate', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
  });

  it('does not retry an HTTP error from the function', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: httpError(503, { error: 'AI service is currently busy.', code: 'AI_UNAVAILABLE' }),
    } as never);

    await expect(invokeGenerate({ action: 'generateDeck' }, 'test')).rejects.toMatchObject({
      message: 'AI service is currently busy.',
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('retries when the request never reached the function', async () => {
    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('offline')) } as never)
      .mockResolvedValueOnce({ data: { ok: true }, error: null } as never);

    await expect(invokeGenerate({ action: 'generateDeck' }, 'test')).resolves.toEqual({ ok: true });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
  });
});
