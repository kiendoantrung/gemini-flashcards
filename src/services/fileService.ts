import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import type { Flashcard } from "../types/flashcard";
import { read, utils } from "xlsx";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_KEY);

// Set the workerSrc to a CDN version of the worker script
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `Create ${numQuestions} flashcard questions and answers from this text. 
    Return only a JSON array with objects in this format, with no additional text or formatting:
    [
      { "front": "Question about the content", "back": "Answer from the content" }
    ]
    Make questions clear and concise. Answers should be comprehensive but brief.
    Text content:
    ${text}`;

  try {
    const result = await model.generateContent(prompt);
    let responseText = await result.response?.text();

    if (!responseText) {
      throw new Error("Empty response from AI model");
    }

    // Remove any markdown or additional formatting, clean up common JSON errors
    responseText = responseText
      .replace(/```(?:json)?/g, "") // Remove markdown code block markers
      .replace(/,\s*([\]}])/g, "$1") // Remove trailing commas
      .replace(/\s*([\]}])/g, "$1"); // Remove extra whitespace

    let cards;
    try {
      cards = JSON.parse(responseText);
    } catch (jsonError: unknown) {
      throw new Error(
        `JSON parsing error after cleaning: ${(jsonError as Error).message}`
      );
    }

    if (!Array.isArray(cards)) {
      throw new Error("Invalid AI response format");
    }

    return cards.filter(
      (card) =>
        card && typeof card.front === "string" && typeof card.back === "string"
    );
  } catch (error: unknown) {
    throw new Error(
      `Failed to generate questions from content: ${(error as Error).message}`
    );
  }
}
