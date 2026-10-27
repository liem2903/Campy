import { sql, type Db } from "../db/client.js";
import type { Question } from "../db/types.js";

// A question as a card: its text plus what scheduleAfterGrade needs. `today` is 'YYYY-MM-DD'.
export type FlashcardRow = Pick<Question, "id" | "question" | "answer" | "ease" | "interval_days"> & {
  is_new: boolean; // due_on is null
  was_graded_today: boolean; // last_graded_on = today
};

function flashcardColumns(db: Db, today: string) {
  return db`id, question, answer, ease, interval_days, due_on is null as is_new,
    coalesce(last_graded_on = ${today}::date, false) as was_graded_today`;
}

export type FlashcardCounts = { question_count: number; new_card_count: number; new_graded_today_count: number };

// One pass over the user's questions: everything the start screen counts (T4.12, T4.16).
export async function countFlashcardsForUser(userId: string, today: string, db: Db = sql): Promise<FlashcardCounts> {
  const [counts] = await db<FlashcardCounts[]>`
    select count(*)::int as question_count,
           count(*) filter (where due_on is null)::int as new_card_count,
           count(*) filter (where first_graded_on = ${today}::date)::int as new_graded_today_count
    from questions where user_id = ${userId}
  `;
  return counts;
}

// The oldest `limit` new cards (T4.14).
export async function findNewFlashcardsForUser(
  userId: string, today: string, limit: number, db: Db = sql,
): Promise<FlashcardRow[]> {
  return db<FlashcardRow[]>`
    select ${flashcardColumns(db, today)} from questions
    where user_id = ${userId} and due_on is null
    order by created_at, id limit ${limit}
  `;
}

// Cards due today or overdue, oldest due_on first (T4.14).
export async function findDueFlashcardsForUser(userId: string, today: string, db: Db = sql): Promise<FlashcardRow[]> {
  return db<FlashcardRow[]>`
    select ${flashcardColumns(db, today)} from questions
    where user_id = ${userId} and due_on <= ${today}::date
    order by due_on, created_at, id
  `;
}

// The first day after today with due cards, and how many; null when there is none.
export async function findEarliestDueDayAfterTodayForUser(
  userId: string, today: string, db: Db = sql,
): Promise<{ days_from_today: number; card_count: number } | null> {
  const [earliestDay] = await db<{ days_from_today: number; card_count: number }[]>`
    select due_on - ${today}::date as days_from_today, count(*)::int as card_count
    from questions where user_id = ${userId} and due_on > ${today}::date
    group by due_on order by due_on limit 1
  `;
  return earliestDay ?? null;
}

// This user's card, locked until the transaction ends so a second grade waits; null when missing.
export async function lockFlashcardForUser(
  userId: string, questionId: string, today: string, db: Db = sql,
): Promise<FlashcardRow | null> {
  const [card] = await db<FlashcardRow[]>`
    select ${flashcardColumns(db, today)} from questions
    where id = ${questionId} and user_id = ${userId} for update
  `;
  return card ?? null;
}

// Saves the graded schedule: due today + interval; first_graded_on only set once (T4.12).
// null when this user has no question with that id.
export async function saveFlashcardSchedule(
  userId: string, questionId: string, today: string, ease: number, intervalDays: number, db: Db = sql,
): Promise<FlashcardRow | null> {
  const [card] = await db<FlashcardRow[]>`
    update questions
    set ease = ${ease}, interval_days = ${intervalDays}, due_on = ${today}::date + ${intervalDays}::int,
        last_graded_on = ${today}::date, first_graded_on = coalesce(first_graded_on, ${today}::date)
    where id = ${questionId} and user_id = ${userId}
    returning ${flashcardColumns(db, today)}
  `;
  return card ?? null;
}
