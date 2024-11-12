import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import type { Flashcard } from '../types/flashcard';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_KEY);

// Set the workerSrc to a CDN version of the worker script
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Accumulate text from each item on the page
      const pageText = textContent.items.map(item => (item as any).str).join(' ');
      text += pageText + '\n';
    }
    return text;
  }

  // For non-PDF text files
  return await file.text();
}

export async function generateQAFromText(text: string, numQuestions: number = 10): Promise<Array<Omit<Flashcard, 'id'>>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

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
      throw new Error('Empty response from AI model');
    }

    // Remove any markdown or additional formatting, clean up common JSON errors
    responseText = responseText
      .replace(/```(?:json)?/g, '') // Remove markdown code block markers
      .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas
      .replace(/\s*([\]}])/g, '$1'); // Remove extra whitespace

    let cards;
    try {
      cards = JSON.parse(responseText);
    } catch (jsonError: unknown) {
      throw new Error(`JSON parsing error after cleaning: ${(jsonError as Error).message}`);
    }
    
    if (!Array.isArray(cards)) {
      throw new Error('Invalid AI response format');
    }
    
    return cards.filter(card => 
      card && typeof card.front === 'string' && typeof card.back === 'string'
    );
  } catch (error: unknown) {
    throw new Error(`Failed to generate questions from content: ${(error as Error).message}`);
  }
}
