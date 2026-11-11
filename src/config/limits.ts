/**
 * Limits shared by the client and the `generate-flashcards` Edge Function.
 *
 * The function cannot import from `src/` (it is bundled from
 * `supabase/functions/` on its own), so each value is duplicated there.
 * Change both sides together: a client limit above the server's turns into a
 * 400/413 the user did not see coming.
 */

/** Cards per AI generation request. Server: MAX_NUM_QUESTIONS. */
export const MAX_CARDS_PER_GENERATION = 50;

/**
 * Largest PDF sent to the function. Server: MAX_PDF_SIZE_BYTES.
 * Gemini accepts 50 MB, but the base64 payload is parsed and re-serialised
 * inside a 256 MB / 2 s-CPU Edge Function, which fails well before that.
 */
export const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_SIZE_LABEL = '15 MB';

/** UTF-8 bytes of extracted document text. Server: MAX_TEXT_BYTES. */
export const MAX_SOURCE_TEXT_BYTES = 500_000;

/**
 * Characters per card side. Server: MAX_CARD_TEXT_CHARS. Counted in
 * characters (UTF-16 code units, i.e. `string.length`) on both sides, so a
 * Vietnamese answer is not penalised for taking 2–3 bytes per letter.
 */
export const MAX_CARD_TEXT_CHARS = 4_000;
