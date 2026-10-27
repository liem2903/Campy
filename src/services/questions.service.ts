import { sql, type Db } from "../db/client.js";
import { BlockNotInNoteError, NoteNotFoundError, QuestionNotFoundError } from "../errors.js";
import * as blocksRepository from "../repositories/blocks.repository.js";
import * as notesRepository from "../repositories/notes.repository.js";
import * as questionsRepository from "../repositories/questions.repository.js";
import * as tagsRepository from "../repositories/tags.repository.js";
import type { QuestionContent, QuestionWithTags } from "../repositories/questions.repository.js";

export type { QuestionWithTags };
// What a card's Save sends. Tag names are already cleaned up and deduplicated by the controller.
// blockId is the block of the note it's about; null = General.
export type QuestionFields = { question: string; answer: string; tagNames: string[]; blockId: string | null };

// This note's questions, oldest first. Throws NoteNotFoundError when the note is missing or
// another user's.
export async function listQuestionsOfNote(userId: string, noteId: string): Promise<QuestionWithTags[]> {
  const note = await notesRepository.findNoteByIdForUser(userId, noteId);
  if (!note) throw new NoteNotFoundError();
  return questionsRepository.findQuestionsOfNoteForUser(userId, noteId);
}

// Adds a question to the note, creating any tag that's new. One transaction, so a refused request
// never leaves a new tag behind. Throws NoteNotFoundError when the note is missing or another
// user's, BlockNotInNoteError when blockId isn't one of its blocks.
export async function createQuestion(
  userId: string, noteId: string, fields: QuestionFields,
): Promise<QuestionWithTags> {
  return sql.begin(async (tx) => {
    // Locked until commit, so deleting the note waits instead of breaking the inserts below.
    const note = await notesRepository.findNoteByIdForUserAndLock(userId, noteId, tx);
    if (!note) throw new NoteNotFoundError();
    await lockBlockOrThrow(noteId, fields.blockId, tx);
    const questionId = await questionsRepository.insertQuestion(userId, noteId, contentOf(fields), tx);
    return saveTagsAndReload(userId, questionId, fields.tagNames, tx);
  });
}

// Replaces the question's text, block and whole tag list. Throws QuestionNotFoundError when the
// question is missing or another user's, BlockNotInNoteError when blockId isn't a block of its note.
export async function updateQuestion(
  userId: string, questionId: string, fields: QuestionFields,
): Promise<QuestionWithTags> {
  return sql.begin(async (tx) => {
    const noteId = await questionsRepository.findNoteIdOfQuestionForUser(userId, questionId, tx);
    if (noteId === null) throw new QuestionNotFoundError();
    // The block before the question row, the same lock order as autosave, so they can't deadlock.
    await lockBlockOrThrow(noteId, fields.blockId, tx);
    // Scoped by user_id; false = deleted since the lookup above.
    const updated = await questionsRepository.updateQuestionContentForUser(userId, questionId, contentOf(fields), tx);
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

// Throws BlockNotInNoteError unless blockId is null or a block of this note. The block stays
// locked until commit, so autosave can't delete it before the question pointing at it is saved.
async function lockBlockOrThrow(noteId: string, blockId: string | null, tx: Db): Promise<void> {
  if (blockId === null) return;
  if (!(await blocksRepository.lockBlockIfInNote(noteId, blockId, tx))) throw new BlockNotInNoteError();
}

function contentOf(fields: QuestionFields): QuestionContent {
  return { questionText: fields.question, answerText: fields.answer, blockId: fields.blockId };
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
