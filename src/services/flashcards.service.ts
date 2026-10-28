import { sql } from "../db/client.js";
import { FlashcardNotUpTodayError, QuestionNotFoundError } from "../errors.js";
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
// With tagIds, only questions carrying any of those tags; empty = every question (T4.7).
export async function getTodaysSession(userId: string, timeZone: string, tagIds: string[]): Promise<FlashcardSession> {
  const today = studyDayIn(timeZone);
  // The four reads run at once: one database round trip instead of four in a row. The cap check
  // lives inside the new-card query, so no transaction is needed to keep it exact. A grade from
  // another tab mid-load can leave nextDue off by a card until the next load; accepted.
  const [counts, newCards, dueCards, earliestDueDay] = await Promise.all([
    flashcardsRepository.countFlashcardsForUser(userId, today, tagIds),
    flashcardsRepository.findNewFlashcardsLeftTodayForUser(userId, today, tagIds, NEW_CARDS_PER_DAY),
    flashcardsRepository.findDueFlashcardsForUser(userId, today, tagIds),
    flashcardsRepository.findEarliestDueDayAfterTodayForUser(userId, today, tagIds),
  ]);
  return {
    cards: [...newCards, ...dueCards].map(flashcardFromRow),
    nextDue: nextDueWithHeldBackNewCards(earliestDueDay, Math.max(0, counts.new_card_count - newCards.length)),
    hasAnyQuestions: counts.question_count > 0,
  };
}

// Grades the card and saves its new schedule. Throws QuestionNotFoundError when the question is
// missing or another user's, and FlashcardNotUpTodayError when it was already passed or isn't due.
export async function gradeFlashcard(
  userId: string, questionId: string, grade: FlashcardGrade, timeZone: string,
): Promise<Flashcard> {
  const today = studyDayIn(timeZone);
  return sql.begin(async (tx) => {
    // Locked until commit, so a double-pressed grade waits and then sees this one's result
    // (and gets FlashcardNotUpTodayError unless this one was Again).
    const card = await flashcardsRepository.lockFlashcardForUser(userId, questionId, today, tx);
    if (!card) throw new QuestionNotFoundError();
    if (!card.is_up_today) throw new FlashcardNotUpTodayError();
    // A new card over today's cap is held back until tomorrow, so it isn't up today either (T4.12).
    // Two parallel grades of different new cards can still reach 21; accepted.
    if (card.is_new) {
      // The cap covers every question, whatever tag filter the session was started with.
      const flashcardCounts = await flashcardsRepository.countFlashcardsForUser(userId, today, [], tx);
      if (flashcardCounts.new_graded_today_count >= NEW_CARDS_PER_DAY) throw new FlashcardNotUpTodayError();
    }
    const nextSchedule = scheduleAfterGrade(cardScheduleFromRow(card), grade);
    const gradedCard = await flashcardsRepository.saveFlashcardSchedule(
      userId, questionId, today, grade, nextSchedule.ease, nextSchedule.intervalDays, tx,
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
