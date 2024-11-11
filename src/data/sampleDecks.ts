import type { Deck } from "../types/flashcard";

export const sampleDecks: Deck[] = [
  {
    id: "1",
    title: "JavaScript Fundamentals",
    description: "Basic concepts and terminology in JavaScript",
    cards: [
      {
        id: "1-1",
        front: "What is a closure?",
        back: "A closure is the combination of a function and the lexical environment within which that function was declared.",
      },
      {
        id: "1-2",
        front: "What is hoisting?",
        back: "Hoisting is JavaScript default behavior of moving declarations to the top of their scope before code execution.",
      },
      {
        id: "1-3",
        front: "What is the difference between let and var?",
        back: "let is block-scoped while var is function-scoped. let does not allow redeclaration and is not hoisted.",
      },
    ],
  },
  {
    id: "2",
    title: "React Hooks",
    description: "Common React hooks and their usage",
    cards: [
      {
        id: "2-1",
        front: "What is useState?",
        back: "useState is a Hook that lets you add React state to function components.",
      },
      {
        id: "2-2",
        front: "What is useEffect?",
        back: "useEffect is a Hook that lets you perform side effects in function components.",
      },
      {
        id: "2-3",
        front: "What is useContext?",
        back: "useContext is a Hook that subscribes to React context without introducing nesting.",
      },
    ],
  },
];
