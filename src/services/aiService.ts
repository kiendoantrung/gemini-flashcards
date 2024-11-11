import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Deck, Flashcard } from '../types/flashcard';

const API_KEY = import.meta.env.VITE_GOOGLE_AI_KEY;

if (!API_KEY) {
  throw new Error('Please set a valid Google AI API key in .env file');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateDeck(topic: string): Promise<Deck> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `Create a set of flashcards about "${topic}". 
    Return a JSON object with the following structure:
    {
      "title": "Topic Title",
      "description": "Brief description of the topic",
      "cards": [
        { "front": "Question", "back": "Answer" }
      ]
    }
    Include 5-7 cards with clear, concise questions and answers.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  let data;
  
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid response format from AI service');
  }

  if (!data.title || !data.description || !Array.isArray(data.cards)) {
    throw new Error('Missing required fields in AI response');
  }

  if (data.cards.length === 0) {
    throw new Error('No flashcards generated');
  }

  try {
    return {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      cards: data.cards.map((card: Omit<Flashcard, 'id'>) => ({
        ...card,
        id: crypto.randomUUID(),
      })),
    };
  } catch (error) {
    throw new Error('Failed to parse AI response');
  }
}