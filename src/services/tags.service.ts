import { sql } from "../db/client.js";
import { NoteNotFoundError, TagNameTakenError, TagNotFoundError } from "../errors.js";
import * as notesRepository from "../repositories/notes.repository.js";
import * as tagsRepository from "../repositories/tags.repository.js";
import type { TagSummary, TagWithNoteCount } from "../repositories/tags.repository.js";

export type { TagSummary, TagWithNoteCount };

// Every function takes a name already trimmed and lowercased by the controller.

// This user's tags in name order, with how many notes each is on.
export async function listTags(userId: string): Promise<TagWithNoteCount[]> {
  return tagsRepository.listTagsWithNoteCountsForUser(userId);
}

// Creates a tag on no notes. Throws TagNameTakenError when the user already has that name.
export async function createTag(userId: string, name: string): Promise<TagSummary> {
  const createdTag = await tagsRepository.insertTag(userId, name);
  if (!createdTag) throw new TagNameTakenError(name);
  return createdTag;
}

// Throws TagNameTakenError when another of the user's tags has the name, TagNotFoundError when
// the tag is missing or another user's. No check before the update: the unique constraint
// decides, so two renames racing onto one free name still give the loser a 409.
export async function renameTag(userId: string, tagId: string, name: string): Promise<TagSummary> {
  const renameResult = await tagsRepository.renameTagForUser(userId, tagId, name);
  if (renameResult === "name_taken") throw new TagNameTakenError(name);
  if (!renameResult) throw new TagNotFoundError();
  return renameResult;
}

// Deletes the tag and takes it off every note. Throws TagNotFoundError when the tag is missing
// or another user's.
export async function deleteTag(userId: string, tagId: string): Promise<void> {
  const deletedCount = await tagsRepository.deleteTagForUser(userId, tagId);
  if (deletedCount === 0) throw new TagNotFoundError();
}

// Puts the tag called `name` on the note, creating the tag on first use, and returns it.
// One transaction, so a refused request never leaves a new tag behind. Throws NoteNotFoundError
// when the note is missing or another user's.
export async function addTagToNote(userId: string, noteId: string, name: string): Promise<TagSummary> {
  return sql.begin(async (tx) => {
    // Locked until commit, so deleting the note waits instead of breaking the insert below.
    const note = await notesRepository.findNoteByIdForUserAndLock(userId, noteId, tx);
    if (!note) throw new NoteNotFoundError();
    const tag = await tagsRepository.upsertTag(userId, name, tx);
    await tagsRepository.attachTagToNote(userId, noteId, tag.id, tx);
    return tag;
  });
}

// Takes the tag off this note only; the tag stays. Throws NoteNotFoundError when the note is
// missing or another user's.
export async function removeTagFromNote(userId: string, noteId: string, tagId: string): Promise<void> {
  const note = await notesRepository.findNoteByIdForUser(userId, noteId);
  if (!note) throw new NoteNotFoundError();
  await tagsRepository.detachTagFromNote(userId, noteId, tagId);
}
