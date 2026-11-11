import type { Flashcard } from "../types/flashcard";
import {
  MAX_CARDS_PER_GENERATION,
  MAX_CARD_TEXT_CHARS,
  MAX_PDF_SIZE_BYTES,
  MAX_PDF_SIZE_LABEL,
  MAX_SOURCE_TEXT_BYTES,
} from "../config/limits";
import { GenerationError, invokeGenerate } from "./generateClient";

export type QAPair = Pick<Flashcard, "front" | "back">;

export type SourceFileKind = "pdf" | "word" | "text";
export type QAFileKind = "csv" | "excel" | "json";

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * The deck title for an uploaded file: its name without the final extension,
 * so "bai.giang.v2.pdf" becomes "bai.giang.v2" rather than "bai".
 */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
  return base || fileName;
}

/**
 * Classifies a document by extension first. `File.type` comes from the OS
 * and is unreliable: Windows reports .csv as application/vnd.ms-excel, and
 * .json or .md often arrive with an empty type.
 */
export function detectSourceFileKind(file: File): SourceFileKind {
  const extension = extensionOf(file.name);
  if (extension === "pdf" || (!extension && file.type === "application/pdf")) return "pdf";
  if (
    extension === "docx" ||
    extension === "doc" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }
  return "text";
}

export function detectQAFileKind(file: File): QAFileKind | null {
  switch (extensionOf(file.name)) {
    case "csv":
      return "csv";
    case "xlsx":
    case "xls":
      return "excel";
    case "json":
      return "json";
  }
  switch (file.type) {
    case "text/csv":
      return "csv";
    case "application/json":
      return "json";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.ms-excel":
      return "excel";
  }
  return null;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field.trim());
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') {
        index += 1;
      }
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error('CSV contains an unterminated quoted field');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

const HEADER_FRONT = /^(questions?|front|q|terms?|words?|câu hỏi|cau hoi|mặt trước|thuật ngữ|từ)$/i;
const HEADER_BACK = /^(answers?|back|a|definitions?|meanings?|đáp án|dap an|trả lời|mặt sau|định nghĩa|nghĩa)$/i;

/** A first row such as "Question,Answer" is a header, not a card. */
function isHeaderRow([front, back]: string[]): boolean {
  return HEADER_FRONT.test(front?.trim() ?? "") && HEADER_BACK.test(back?.trim() ?? "");
}

function toPairs(rows: string[][], source: string): QAPair[] {
  const body = rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  const pairs = body.map(([front, back]) => ({
    front: (front ?? "").trim(),
    back: (back ?? "").trim(),
  }));

  const tooLong = pairs.findIndex(
    (pair) => pair.front.length > MAX_CARD_TEXT_CHARS || pair.back.length > MAX_CARD_TEXT_CHARS
  );
  if (tooLong !== -1) {
    throw new Error(
      `Card ${tooLong + 1} in the ${source} is longer than ${MAX_CARD_TEXT_CHARS} characters`
    );
  }

  return pairs;
}

/**
 * Reads a spreadsheet or JSON file of ready-made question/answer pairs.
 * Returns the pairs directly instead of a "Q:/A:" text blob, so questions may
 * contain blank lines or a line starting with "A:".
 */
export async function parseQAFile(file: File): Promise<QAPair[]> {
  const kind = detectQAFileKind(file);

  if (kind === "excel") {
    let rows: string[][];
    try {
      // Dynamic import: only spreadsheet imports pay for the parser.
      const { read, utils } = await import("xlsx");
      const workbook = read(await file.arrayBuffer());
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false });
      rows = rawRows.map((row) =>
        row.slice(0, 2).map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
      );
    } catch (error) {
      console.error("Excel parsing error:", error);
      throw new Error(
        "Invalid Excel file. Please ensure the first sheet has questions in column A and answers in column B."
      );
    }

    const pairs = toPairs(rows, "spreadsheet").filter((pair) => pair.front && pair.back);
    if (pairs.length === 0) {
      throw new Error("No valid question-answer pairs found in the Excel file");
    }
    return pairs;
  }

  if (kind === "csv") {
    const text = await file.text();
    const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
    rows.forEach(([question, answer, ...extraColumns], index) => {
      if (!question || !answer || extraColumns.length > 0) {
        throw new Error(
          `CSV row ${index + 1} must contain exactly two non-empty columns: question and answer`
        );
      }
    });

    const pairs = toPairs(rows, "CSV file");
    if (pairs.length === 0) {
      throw new Error("CSV file does not contain any question-answer pairs");
    }
    return pairs;
  }

  if (kind === "json") {
    let json: unknown;
    try {
      json = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("Invalid JSON file: the file could not be parsed");
    }

    if (!Array.isArray(json)) {
      throw new Error("JSON must be an array of question/answer pairs");
    }

    const rows = json.map((item: unknown, index) => {
      const candidate = (typeof item === "object" && item !== null ? item : {}) as {
        question?: unknown;
        answer?: unknown;
        front?: unknown;
        back?: unknown;
      };
      const question = candidate.question ?? candidate.front;
      const answer = candidate.answer ?? candidate.back;
      if (
        typeof question !== "string" ||
        typeof answer !== "string" ||
        !question.trim() ||
        !answer.trim()
      ) {
        throw new Error(
          `JSON item ${index + 1} must contain non-empty "question" and "answer" strings`
        );
      }
      return [question, answer];
    });

    const pairs = toPairs(rows, "JSON file");
    if (pairs.length === 0) {
      throw new Error("JSON file does not contain any question-answer pairs");
    }
    return pairs;
  }

  throw new Error("Unsupported file type. Please upload a CSV, Excel or JSON file.");
}

/** Extracts readable text from a Word or plain-text document. */
export async function extractTextFromFile(file: File): Promise<string> {
  const kind = detectSourceFileKind(file);

  if (kind === "pdf") {
    throw new Error("PDF files are sent to the AI directly; use generateQAFromPDF");
  }

  if (kind === "word") {
    try {
      // Ream parses both OOXML .docx and legacy binary .doc in the browser.
      // Keep it lazy because most uploads are plain text files.
      const { Ream } = await import('reamkit');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = Ream.parse(bytes);
      const htmlBytes = await document.convert('html');
      const html = new TextDecoder().decode(htmlBytes);
      const htmlWithLineBreaks = html.replace(
        /<\/(p|div|li|h[1-6]|tr|br)>/gi,
        '\n'
      );
      const parsedHtml = new DOMParser().parseFromString(htmlWithLineBreaks, 'text/html');
      const text = parsedHtml.body.textContent
        ?.replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim() ?? '';

      if (!text) {
        throw new Error('The Word document does not contain readable text');
      }

      return text;
    } catch (error) {
      console.error('Word document parsing error:', error);
      throw new Error(
        'Invalid or unsupported Word document. Please upload a readable DOC or DOCX file.'
      );
    }
  }

  const text = (await file.text()).replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("The file does not contain any text");
  }
  return text;
}

function validateNumQuestions(numQuestions: number): void {
  if (
    !Number.isInteger(numQuestions) ||
    numQuestions < 1 ||
    numQuestions > MAX_CARDS_PER_GENERATION
  ) {
    throw new GenerationError(
      `Number of cards must be a whole number between 1 and ${MAX_CARDS_PER_GENERATION}`,
      "INVALID_REQUEST",
      null
    );
  }
}

export async function generateQAFromText(
  text: string,
  numQuestions: number = 10
): Promise<QAPair[]> {
  validateNumQuestions(numQuestions);

  // The function rejects anything larger with a 400; say so before uploading.
  if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_TEXT_BYTES) {
    throw new GenerationError(
      `This document has too much text (limit ${Math.round(MAX_SOURCE_TEXT_BYTES / 1000)} KB). Split it into smaller files and try again.`,
      "PAYLOAD_TOO_LARGE",
      null
    );
  }

  return invokeGenerate<QAPair[]>(
    { action: "generateFromText", text, numQuestions },
    "generateQAFromText"
  );
}

// Helper function to convert File to base64 without repeatedly reallocating a
// growing string for every byte.
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];

  for (let offset = 0; offset < uint8Array.length; offset += chunkSize) {
    const chunk = uint8Array.subarray(offset, offset + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(''));
}

// Generate flashcards directly from PDF using Edge Function
export async function generateQAFromPDF(
  file: File,
  numQuestions: number = 10
): Promise<QAPair[]> {
  if (detectSourceFileKind(file) !== "pdf") {
    throw new Error('Please upload a PDF file');
  }
  validateNumQuestions(numQuestions);
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new GenerationError(
      `PDF files must be ${MAX_PDF_SIZE_LABEL} or smaller`,
      "PAYLOAD_TOO_LARGE",
      null
    );
  }

  const pdfBase64 = await fileToBase64(file);
  return invokeGenerate<QAPair[]>(
    { action: "generateFromPDF", pdfBase64, numQuestions },
    "generateQAFromPDF"
  );
}
