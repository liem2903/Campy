import { sql } from "../db/client.js";
import { QuestionNotFoundError } from "../errors.js";
import * as flashcardsRepository from "../repositories/flashcards.repository.js";
import type { FlashcardRow } from "../repositories/flashcards.repository.js";
import { nextIntervalDaysForEveryGrade, scheduleAfterGrade, type CardSchedule } from "./flashcardSchedule.js";

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

const NEW_CARDS_PER_DAY = 20; // T4.9: fixed until T4c adds the setting
const STUDY_DAY_START_HOUR = 4; // a study day runs 4 am to 4 am, so a late-night session is still "today"

// Today's cards: new ones up to the daily cap, then due ones. "Today" starts at 4 am in timeZone.
export async function getTodaysSession(userId: string, timeZone: string): Promise<FlashcardSession> {
  const today = studyDayIn(timeZone);
  // One snapshot for all four reads, so a grade from another tab can't land between the cap count
  // and the new-card query and let a 21st new card through.
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const counts = await flashcardsRepository.countFlashcardsForUser(userId, today, tx);
    const newCardsLeftToday = Math.max(0, NEW_CARDS_PER_DAY - counts.new_graded_today_count);
    const newCards = await flashcardsRepository.findNewFlashcardsForUser(userId, today, newCardsLeftToday, tx);
    const dueCards = await flashcardsRepository.findDueFlashcardsForUser(userId, today, tx);
    const earliestDueDay = await flashcardsRepository.findEarliestDueDayAfterTodayForUser(userId, today, tx);
    return {
      cards: [...newCards, ...dueCards].map(flashcardFromRow),
      nextDue: nextDueWithHeldBackNewCards(earliestDueDay, counts.new_card_count - newCards.length),
      hasAnyQuestions: counts.question_count > 0,
    };
  });
}

// Grades the card and saves its new schedule. Throws QuestionNotFoundError when the question is
// missing or another user's.
export async function gradeFlashcard(
  userId: string, questionId: string, grade: FlashcardGrade, timeZone: string,
): Promise<Flashcard> {
  const today = studyDayIn(timeZone);
  return sql.begin(async (tx) => {
    // Locked until commit, so a double-pressed grade waits and then sees this one's result.
    const card = await flashcardsRepository.lockFlashcardForUser(userId, questionId, today, tx);
    if (!card) throw new QuestionNotFoundError();
    const nextSchedule = scheduleAfterGrade(cardScheduleFromRow(card), grade);
    const gradedCard = await flashcardsRepository.saveFlashcardSchedule(
      userId, questionId, today, nextSchedule.ease, nextSchedule.intervalDays, tx,
    );
    if (!gradedCard) throw new QuestionNotFoundError();
    return flashcardFromRow(gradedCard);
  });
}

// Today's study day in timeZone as 'YYYY-MM-DD': the date it was 4 hours ago there.
// 4 real hours, so on a DST-change night the day starts at 3 or 5 am instead; accepted.
function studyDayIn(timeZone: string): string {
  const fourHoursAgo = new Date(Date.now() - STUDY_DAY_START_HOUR * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(fourHoursAgo); // en-CA formats as YYYY-MM-DD
}

// New cards over today's cap come back tomorrow, so they count toward day 1 (T4.16).
function nextDueWithHeldBackNewCards(
  earliestDueDay: { days_from_today: number; card_count: number } | null, heldBackNewCardCount: number,
): FlashcardSession["nextDue"] {
  const dueTomorrowCount = earliestDueDay?.days_from_today === 1 ? earliestDueDay.card_count : 0;
  if (heldBackNewCardCount > 0) return { daysFromToday: 1, cardCount: dueTomorrowCount + heldBackNewCardCount };
  if (!earliestDueDay) return null;
  return { daysFromToday: earliestDueDay.days_from_today, cardCount: earliestDueDay.card_count };
}

function cardScheduleFromRow(card: FlashcardRow): CardSchedule {
  return { ease: card.ease, intervalDays: card.interval_days, isNew: card.is_new, wasGradedToday: card.was_graded_today };
}

function flashcardFromRow(card: FlashcardRow): Flashcard {
  return {
    questionId: card.id,
    question: card.question,
    answer: card.answer,
    isNew: card.is_new,
    nextIntervalDays: nextIntervalDaysForEveryGrade(cardScheduleFromRow(card)),
  };
}
