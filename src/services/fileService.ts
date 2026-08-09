import { supabase } from "../lib/supabase";
import type { Flashcard } from "../types/flashcard";
import { withRetry } from "../utils/retry";

export const MAX_GEMINI_PDF_SIZE_BYTES = 50 * 1024 * 1024;

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

export async function extractTextFromFile(file: File): Promise<string> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  if (file.type === "application/pdf") {
    return "";
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/msword" ||
    fileExtension === "docx" ||
    fileExtension === "doc"
  ) {
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

  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  ) {
    try {
      // Dynamic import xlsx only when needed
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);

      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert sheet to array of arrays (raw data)
      const rawData = utils.sheet_to_json<string[]>(worksheet, { header: 1 });

      // Skip empty rows and process each row
      const processedData = rawData
        .filter((row) => row.length >= 2 && row[0] && row[1]) // Ensure row has both Q&A
        .map((row) => {
          const question = row[0].toString().trim();
          const answer = row[1].toString().trim();
          return `Q: ${question}\nA: ${answer}`;
        });

      if (processedData.length === 0) {
        throw new Error("No valid question-answer pairs found in Excel file");
      }

      return processedData.join("\n\n");
    } catch (error) {
      console.error("Excel parsing error:", error);
      throw new Error(
        "Invalid Excel file format. Please ensure file contains two columns with questions and answers."
      );
    }
  }


  if (file.type === "application/json") {
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      // Expect array of simple question/answer pairs
      if (!Array.isArray(json)) {
        throw new Error("JSON must be an array of question/answer pairs");
      }
      // Convert JSON to readable text format
      const pairs = json.map((item: unknown) => {
        if (typeof item !== 'object' || item === null) {
          throw new Error('Each JSON item must be an object');
        }

        const candidate = item as { question?: unknown; answer?: unknown };
        if (
          typeof candidate.question !== 'string' ||
          typeof candidate.answer !== 'string' ||
          !candidate.question.trim() ||
          !candidate.answer.trim()
        ) {
          throw new Error('Each JSON item must contain non-empty question and answer strings');
        }

        return `Q: ${candidate.question.trim()}\nA: ${candidate.answer.trim()}`;
      });

      if (pairs.length === 0) {
        throw new Error('JSON file does not contain any question-answer pairs');
      }

      return pairs.join("\n\n");
    } catch {
      throw new Error("Invalid JSON file format");
    }
  }

  if (file.type === "text/csv") {
    const text = await file.text();
    const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
    const pairs = rows.map(([question, answer, ...extraColumns]) => {
      if (!question || !answer || extraColumns.length > 0) {
        throw new Error('Each CSV row must contain exactly two non-empty columns: question and answer');
      }
      return `Q: ${question}\nA: ${answer}`;
    });

    if (pairs.length === 0) {
      throw new Error('CSV file does not contain any question-answer pairs');
    }

    return pairs.join("\n\n");
  }

  // For other text files (including .txt)
  return await file.text();
}

export async function generateQAFromText(
  text: string,
  numQuestions: number = 10
): Promise<Array<Omit<Flashcard, "id">>> {
  try {
    const { data, error } = await withRetry(
      () => supabase.functions.invoke("generate-flashcards", {
        body: {
          action: "generateFromText",
          text,
          numQuestions,
        },
      }),
      'generateQAFromText'
    );

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data as Array<Omit<Flashcard, "id">>;
  } catch (error: unknown) {
    throw new Error(
      `Failed to generate questions from content: ${(error as Error).message}`
    );
  }
}

// Helper function to convert File to base64 without repeatedly reallocating a
// growing string for every byte.
async function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_GEMINI_PDF_SIZE_BYTES) {
    throw new Error('PDF files must be 50 MB or smaller');
  }

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
): Promise<Array<Omit<Flashcard, "id">>> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please upload a PDF file');
  }

  const base64Data = await fileToBase64(file);

  try {
    const { data, error } = await withRetry(
      () => supabase.functions.invoke("generate-flashcards", {
        body: {
          action: "generateFromPDF",
          pdfBase64: base64Data,
          numQuestions,
        },
      }),
      'generateQAFromPDF'
    );

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data as Array<Omit<Flashcard, "id">>;
  } catch (error: unknown) {
    throw new Error(
      `Failed to generate questions from PDF: ${(error as Error).message}`
    );
  }
}
