import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import type { Flashcard } from "../types/flashcard";
import { read, utils } from "xlsx";

const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_KEY });

// Set the workerSrc to a CDN version of the worker script
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// Zod Schema for Structured Output
const flashcardSchema = z.object({
  front: z.string().describe("The question or front side of the flashcard"),
  back: z.string().describe("The answer or back side of the flashcard"),
});

const flashcardsArraySchema = z.array(flashcardSchema).describe("Array of flashcards");

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
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

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Accumulate text from each item on the page
      const pageText = textContent.items
        .map((item) => (item as any).str)
        .join(" ");
      text += pageText + "\n";
    }
    return text;
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  ) {
    try {
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
      return json
        .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
        .join("\n\n");
    } catch (error) {
      throw new Error("Invalid JSON file format");
    }
  }

  if (file.type === "text/csv") {
    const text = await file.text();
    // Convert CSV to readable text format
    const lines = text
      .split("\n")
      .filter((line) => line.trim()) // Remove empty lines
      .map((line) => {
        const [question, answer] = line.split(",").map((str) => str.trim());
        if (!question || !answer) {
          throw new Error("Each CSV line must have a question and answer");
        }
        return `Q: ${question}\nA: ${answer}`;
      })
      .join("\n\n");
    return lines;
  }

  // For other text files (including .txt)
  return await file.text();
}

export async function generateQAFromText(
  text: string,
  numQuestions: number = 10
): Promise<Array<Omit<Flashcard, "id">>> {
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

  // Use plain JSON schema format for better compatibility
  const responseSchema = {
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

  try {
    const result = await withRetry(
      () => genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema as Record<string, unknown>,
        },
      }),
      'generateQAFromText'
    );

    const responseText = result.text;
    if (!responseText) {
      throw new Error("Empty response from AI model");
    }

    let parsedData = JSON.parse(responseText);
    
    // Handle object response with cards/flashcards property
    if (!Array.isArray(parsedData)) {
      if (parsedData.cards && Array.isArray(parsedData.cards)) {
        parsedData = parsedData.cards;
      } else if (parsedData.flashcards && Array.isArray(parsedData.flashcards)) {
        parsedData = parsedData.flashcards;
      } else {
        throw new Error("Invalid response format: expected array of flashcards");
      }
    }

    // Normalize field names: support both front/back and question/answer formats
    const normalizedCards = parsedData.map((card: Record<string, unknown>) => ({
      front: card.front || card.question || card.q || "",
      back: card.back || card.answer || card.a || ""
    }));

    const cards = flashcardsArraySchema.parse(normalizedCards);

    return cards.filter(
      (card) =>
        card && typeof card.front === "string" && card.front.length > 0 && 
        typeof card.back === "string" && card.back.length > 0
    );
  } catch (error: unknown) {
    throw new Error(
      `Failed to generate questions from content: ${(error as Error).message}`
    );
  }
}
