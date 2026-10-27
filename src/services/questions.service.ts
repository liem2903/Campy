import { sql, type Db } from "../db/client.js";
import { NoteNotFoundError, QuestionNotFoundError } from "../errors.js";
import * as notesRepository from "../repositories/notes.repository.js";
import * as questionsRepository from "../repositories/questions.repository.js";
import * as tagsRepository from "../repositories/tags.repository.js";
import type { QuestionWithTags } from "../repositories/questions.repository.js";

export type { QuestionWithTags };
// What a card's Save sends. Tag names are already cleaned up and deduplicated by the controller.
export type QuestionFields = { question: string; answer: string; tagNames: string[] };

// This note's questions, oldest first. Throws NoteNotFoundError when the note is missing or
// another user's.
export async function listQuestionsOfNote(userId: string, noteId: string): Promise<QuestionWithTags[]> {
  const note = await notesRepository.findNoteByIdForUser(userId, noteId);
  if (!note) throw new NoteNotFoundError();
  return questionsRepository.findQuestionsOfNoteForUser(userId, noteId);
}

// Adds a question to the note, creating any tag that's new. One transaction, so a refused request
// never leaves a new tag behind. Throws NoteNotFoundError when the note is missing or another user's.
export async function createQuestion(
  userId: string, noteId: string, fields: QuestionFields,
): Promise<QuestionWithTags> {
  return sql.begin(async (tx) => {
    // Locked until commit, so deleting the note waits instead of breaking the inserts below.
    const note = await notesRepository.findNoteByIdForUserAndLock(userId, noteId, tx);
    if (!note) throw new NoteNotFoundError();
    const questionId = await questionsRepository.insertQuestion(userId, noteId, fields.question, fields.answer, tx);
    return saveTagsAndReload(userId, questionId, fields.tagNames, tx);
  });
}

// Replaces the question's text and its whole tag list. Throws QuestionNotFoundError when the
// question is missing or another user's.
export async function updateQuestion(
  userId: string, questionId: string, fields: QuestionFields,
): Promise<QuestionWithTags> {
  return sql.begin(async (tx) => {
    // Scoped by user_id, so it doubles as the ownership check.
    const updated = await questionsRepository.updateQuestionTextForUser(
      userId, questionId, fields.question, fields.answer, tx,
    );
    if (!updated) throw new QuestionNotFoundError();
    return saveTagsAndReload(userId, questionId, fields.tagNames, tx);
  });
}

// Deletes the question and its tag links; the tags stay. Throws QuestionNotFoundError when the
// question is missing or another user's.
export async function deleteQuestion(userId: string, questionId: string): Promise<void> {
  const deletedCount = await questionsRepository.deleteQuestionForUser(userId, questionId);
  if (deletedCount === 0) throw new QuestionNotFoundError();
}

// Finds or creates the named tags, makes them the question's tag list, and returns the question
// as it's now stored. Runs inside the caller's transaction, after the question row is locked.
async function saveTagsAndReload(
  userId: string, questionId: string, tagNames: string[], tx: Db,
): Promise<QuestionWithTags> {
  // Sorted so two saves sharing tags lock them in the same order (see upsertTags).
  const tags = await tagsRepository.upsertTags(userId, [...tagNames].sort(), tx);
  await questionsRepository.replaceTagsOfQuestionForUser(userId, questionId, tags.map((tag) => tag.id), tx);
  const savedQuestion = await questionsRepository.findQuestionByIdForUser(userId, questionId, tx);
  // The row is ours and locked until commit, so it can't have gone.
  return savedQuestion!;
}
