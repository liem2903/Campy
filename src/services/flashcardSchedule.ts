import type { FlashcardGrade } from "./flashcards.service.js";

// A card's SM-2 numbers before it is graded.
export type CardSchedule = {
  ease: number;
  intervalDays: number;
  isNew: boolean; // due_on is null
  wasGradedToday: boolean; // last_graded_on = today
};
export type NextSchedule = { ease: number; intervalDays: number };

const MIN_EASE = 1.3;
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const MAX_INTERVAL_DAYS = 36500; // 100 years, Anki's default; keeps due_on far inside Postgres's date range
const EASE_CHANGE: Record<FlashcardGrade, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };

// The card's ease and interval after this grade (T4.10, T4.11). Pure: no dates, no DB.
export function scheduleAfterGrade(card: CardSchedule, grade: FlashcardGrade): NextSchedule {
  const skipsAgainPenalty = grade === "again" && card.wasGradedToday; // T4.3: once per day
  const changedEase = skipsAgainPenalty ? card.ease : Math.max(MIN_EASE, card.ease + EASE_CHANGE[grade]);
  const intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDaysAfterGrade(card, grade));
  return { ease: Math.round(changedEase * 100) / 100, intervalDays };
}

function intervalDaysAfterGrade(card: CardSchedule, grade: FlashcardGrade): number {
  if (grade === "again") return 1;
  if (card.isNew) return grade === "easy" ? 4 : 1;
  const goodDays = card.intervalDays <= 1 ? 6 : Math.round(card.intervalDays * card.ease);
  switch (grade) {
    case "hard": return Math.max(1, Math.round(card.intervalDays * HARD_FACTOR));
    case "good": return goodDays;
    case "easy": return Math.round(goodDays * EASY_BONUS);
  }
}

// The days each button would give (T4.13), from the same maths that grades.
export function nextIntervalDaysForEveryGrade(card: CardSchedule): Record<FlashcardGrade, number> {
  return {
    again: scheduleAfterGrade(card, "again").intervalDays,
    hard: scheduleAfterGrade(card, "hard").intervalDays,
    good: scheduleAfterGrade(card, "good").intervalDays,
    easy: scheduleAfterGrade(card, "easy").intervalDays,
  };
}
