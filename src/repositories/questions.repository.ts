import postgres from "postgres";
import { sql, type Db } from "../db/client.js";
import type { Question } from "../db/types.js";
import type { TagSummary } from "./tags.repository.js";

// A question with its tags in name order.
export type QuestionWithTags = Question & { tags: TagSummary[] };

// This user's questions on one note, oldest first.
export async function findQuestionsOfNoteForUser(
  userId: string, noteId: string, db: Db = sql,
): Promise<QuestionWithTags[]> {
  return selectQuestionsWithTags(db, db`questions.note_id = ${noteId} and questions.user_id = ${userId}`);
}

// This user's question; null when this user has no question with that id.
export async function findQuestionByIdForUser(
  userId: string, questionId: string, db: Db = sql,
): Promise<QuestionWithTags | null> {
  const [question] = await selectQuestionsWithTags(db, db`questions.id = ${questionId} and questions.user_id = ${userId}`);
  return question ?? null;
}

// What a card's Save writes to the row: its text and the block it's about (null = General).
export type QuestionContent = { questionText: string; answerText: string; blockId: string | null };

// The note this user's question is on; null when this user has no question with that id.
export async function findNoteIdOfQuestionForUser(
  userId: string, questionId: string, db: Db = sql,
): Promise<string | null> {
  const [question] = await db<Pick<Question, "note_id">[]>`
    select note_id from questions where id = ${questionId} and user_id = ${userId}
  `;
  return question?.note_id ?? null;
}

// Inserts the question on the note and returns its new id. Postgres refuses it when the note
// isn't this user's.
export async function insertQuestion(
  userId: string, noteId: string, { questionText, answerText, blockId }: QuestionContent, db: Db = sql,
): Promise<string> {
  const [question] = await db<Pick<Question, "id">[]>`
    insert into questions (user_id, note_id, block_id, question, answer)
    values (${userId}, ${noteId}, ${blockId}, ${questionText}, ${answerText})
    returning id
  `;
  return question.id;
}

// Replaces this user's question's text and block. false when this user has no question with that
// id. A "(deleted paragraph)" mark stays until the question is linked to a block again.
// The updated row stays locked until the transaction ends, so a concurrent delete waits.
export async function updateQuestionContentForUser(
  userId: string, questionId: string, { questionText, answerText, blockId }: QuestionContent, db: Db = sql,
): Promise<boolean> {
  const result = await db`
    update questions
    set question = ${questionText}, answer = ${answerText}, block_id = ${blockId},
        block_was_deleted = block_was_deleted and ${blockId}::uuid is null
    where id = ${questionId} and user_id = ${userId}
  `;
  return result.count === 1;
}

// Unlinks the note's questions whose block isn't in keptBlockIds and marks them, so their cards
// say "(deleted paragraph)". Autosave calls it right after deleting those blocks.
export async function unlinkQuestionsFromBlocksMissingFrom(
  noteId: string, keptBlockIds: string[], db: Db = sql,
): Promise<void> {
  // "is not null" spelled out: against an empty list, <> all(...) is true even for a null block_id.
  await db`
    update questions set block_id = null, block_was_deleted = true
    where note_id = ${noteId} and block_id is not null and block_id <> all(${keptBlockIds}::uuid[])
  `;
}

// Deletes this user's question; on delete cascade removes its tag links. Returns the number of
// questions deleted: 1, or 0 when this user has no question with that id.
export async function deleteQuestionForUser(userId: string, questionId: string, db: Db = sql): Promise<number> {
  const result = await db`delete from questions where id = ${questionId} and user_id = ${userId}`;
  return result.count;
}

// Makes these tags the question's whole tag list. Postgres refuses a tag that isn't this user's.
export async function replaceTagsOfQuestionForUser(
  userId: string, questionId: string, tagIds: string[], db: Db = sql,
): Promise<void> {
  await db`delete from question_tags where question_id = ${questionId} and user_id = ${userId}`;
  if (tagIds.length === 0) return;
  await db`
    insert into question_tags (question_id, tag_id, user_id)
    select ${questionId}, unnest(${tagIds}::uuid[]), ${userId}
  `;
}

// Questions matching `condition`, oldest first (id breaks ties), each with its tags as a JSON
// array ('[]' when it has none). Left joins, so a question with no tags is still listed.
function selectQuestionsWithTags(db: Db, condition: postgres.Fragment): Promise<QuestionWithTags[]> {
  return db<QuestionWithTags[]>`
    select
      questions.*,
      coalesce(
        json_agg(json_build_object('id', tags.id, 'name', tags.name) order by tags.name)
          filter (where tags.id is not null),
        '[]'
      ) as tags
    from questions
    left join question_tags on question_tags.question_id = questions.id
    left join tags on tags.id = question_tags.tag_id
    where ${condition}
    group by questions.id
    order by questions.created_at, questions.id
  `;
}
