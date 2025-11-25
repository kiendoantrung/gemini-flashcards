import { GoogleGenAI } from "@google/genai";
import type { Deck, Flashcard } from "../types/flashcard";

const API_KEY = import.meta.env.VITE_GOOGLE_AI_KEY;

if (!API_KEY) {
  throw new Error("Please set a valid Google AI API key in .env file");
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

async function generateDistractorsFromAI(
  question: string,
  correctAnswer: string
): Promise<string[]> {
  const prompt = `For the question "${question}" with correct answer "${correctAnswer}", 
    generate 3 plausible but incorrect answer choices. Return them as a JSON array of strings.`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  const text = result.text;

  if (!text) {
    throw new Error("Empty response from AI model");
  }

  // Clean the response text before parsing
  const cleanText = text.replace(/```json\n?|```/g, "").trim();
  return JSON.parse(cleanText);
}

export async function generateDeck(
  topic: string,
  numQuestions: number = 10
): Promise<Deck> {
  const prompt = `Create a set of flashcards about "${topic}". 
  Return a JSON object with the following structure:
  {
    "title": "Topic Title",
    "description": "Brief description of the topic",
    "cards": [
      { "front": "Question", "back": "Answer" }
    ]
  }
  Include ${numQuestions} cards with clear, concise questions and answers.`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  const text = result.text;

  if (!text) {
    throw new Error("Empty response from AI model");
  }

  // Clean the response text before parsing
  const cleanText = text.replace(/```json\n?|```/g, "").trim();
  let data;

  try {
    data = JSON.parse(cleanText);
  } catch (error) {
    throw new Error(`Invalid response format from AI service: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!data.title || !data.description || !Array.isArray(data.cards)) {
    throw new Error("Missing required fields in AI response");
  }

  if (data.cards.length === 0) {
    throw new Error("No flashcards generated");
  }

  try {
    return {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      cards: data.cards.map((card: Omit<Flashcard, "id">) => ({
        ...card,
        id: crypto.randomUUID(),
      })),
    };
  } catch (error) {
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateDistractors(
  question: string,
  correctAnswer: string
): Promise<string[]> {
  try {
    const distractors = await generateDistractorsFromAI(
      question,
      correctAnswer
    );

    return distractors;
  } catch (error) {
    console.error("Error generating distractors:", error);
    return [];
  }
}

async function generateBatchDistractorsFromAI(
  cards: Flashcard[]
): Promise<Record<string, string[]>> {
  const cardsList = cards.map(c => ({ id: c.id, question: c.front, answer: c.back }));
  const prompt = `For the following flashcards, generate 3 plausible but incorrect answer choices (distractors) for each.
    Return a JSON object where keys are the card IDs and values are arrays of 3 distractor strings.
    
    Cards:
    ${JSON.stringify(cardsList, null, 2)}
    
    Example output structure:
    {
      "card_id_1": ["distractor1", "distractor2", "distractor3"],
      "card_id_2": ["distractor1", "distractor2", "distractor3"]
    }`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  const text = result.text;

  if (!text) {
    throw new Error("Empty response from AI model");
  }

  // Clean the response text before parsing
  const cleanText = text.replace(/```json\n?|```/g, "").trim();
  return JSON.parse(cleanText);
}

export async function generateBatchDistractors(
  cards: Flashcard[]
): Promise<Record<string, string[]>> {
  try {
    // Process in chunks of 5 to avoid hitting token limits or timeouts
    const chunkSize = 5;
    const chunks = [];
    for (let i = 0; i < cards.length; i += chunkSize) {
      chunks.push(cards.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map(chunk => generateBatchDistractorsFromAI(chunk))
    );

    return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  } catch (error) {
    console.error("Error generating batch distractors:", error);
    return {};
  }
}
