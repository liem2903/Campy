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

// Inserts the question on the note and returns its new id. Postgres refuses it when the note
// isn't this user's.
export async function insertQuestion(
  userId: string, noteId: string, questionText: string, answerText: string, db: Db = sql,
): Promise<string> {
  const [question] = await db<Pick<Question, "id">[]>`
    insert into questions (user_id, note_id, question, answer)
    values (${userId}, ${noteId}, ${questionText}, ${answerText})
    returning id
  `;
  return question.id;
}

// Replaces this user's question's text. false when this user has no question with that id.
// The updated row stays locked until the transaction ends, so a concurrent delete waits.
export async function updateQuestionTextForUser(
  userId: string, questionId: string, questionText: string, answerText: string, db: Db = sql,
): Promise<boolean> {
  const result = await db`
    update questions set question = ${questionText}, answer = ${answerText}
    where id = ${questionId} and user_id = ${userId}
  `;
  return result.count === 1;
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
