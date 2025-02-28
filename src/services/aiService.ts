import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Deck, Flashcard } from "../types/flashcard";

const API_KEY = import.meta.env.VITE_GOOGLE_AI_KEY;

if (!API_KEY) {
  throw new Error("Please set a valid Google AI API key in .env file");
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function generateDistractorsFromAI(
  question: string,
  correctAnswer: string
): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `For the question "${question}" with correct answer "${correctAnswer}", 
    generate 3 plausible but incorrect answer choices. Return them as a JSON array of strings.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Clean the response text before parsing
  const cleanText = text.replace(/```json\n?|```/g, "").trim();
  return JSON.parse(cleanText);
}

export async function generateDeck(
  topic: string,
  numQuestions: number = 10
): Promise<Deck> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
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
