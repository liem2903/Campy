// The four grades, keys 1–4 on the client.
export const FLASHCARD_GRADES = ["again", "hard", "good", "easy"] as const;
export type FlashcardGrade = (typeof FLASHCARD_GRADES)[number];

// One card as the API sends it; same shape as client/src/flashcards.ts.
export type Flashcard = {
  questionId: string;
  question: string;
  answer: string;
  isNew: boolean;
  nextIntervalDays: Record<FlashcardGrade, number>;
};
export type FlashcardSession = {
  cards: Flashcard[];
  nextDue: { daysFromToday: number; cardCount: number } | null;
  hasAnyQuestions: boolean;
};

// Today's cards: new ones up to the daily cap, then due ones. "Today" starts at 4 am in timeZone.
export async function getTodaysSession(userId: string, timeZone: string): Promise<FlashcardSession> {
  throw new Error("Not implemented");
}

// Grades the card and saves its new schedule. Throws QuestionNotFoundError when the question is
// missing or another user's.
export async function gradeFlashcard(
  userId: string, questionId: string, grade: FlashcardGrade, timeZone: string,
): Promise<Flashcard> {
  throw new Error("Not implemented");
}
