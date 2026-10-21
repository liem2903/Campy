import { sql } from "../db/client.js";
import type { Note } from "../db/types.js";
import { NoteIdTakenError, NoteNotFoundError } from "../errors.js";
import * as blocksRepository from "../repositories/blocks.repository.js";
import * as notesRepository from "../repositories/notes.repository.js";
import type { NoteBlock } from "../repositories/blocks.repository.js";

export type { Note, NoteBlock };
// A note with its blocks as a tree, in order.
export type NoteWithBlocks = Note & { blocks: NoteBlock[] };
export type CreateNoteResult = { note: NoteWithBlocks; created: boolean };
// What the user edits: autosave sends both on every save.
export type NoteContent = { title: string; blocks: NoteBlock[] };

// Creates the note with no blocks. created: false = this user already owns the id.
// Throws NoteIdTakenError when another user owns it.
export async function createNote(userId: string, id: string): Promise<CreateNoteResult> {
  throw new Error("Not implemented");
}

// This user's note with its blocks. Throws NoteNotFoundError when it's missing or another user's.
export async function getNote(userId: string, id: string): Promise<NoteWithBlocks> {
  throw new Error("Not implemented");
}

// Replaces the note's title and blocks together and returns its new updated_at.
// Throws NoteNotFoundError when the note is missing or another user's, and
// BlockOfAnotherNoteError when a block id belongs to a different note.
export async function updateNote(
  userId: string, id: string, { title, blocks }: NoteContent,
): Promise<Date> {
  throw new Error("Not implemented");
}

// This user's notes, most recently edited first.
export async function listNotes(userId: string): Promise<Note[]> {
  return notesRepository.listNotes(userId);
}

// Deletes this user's note; its blocks go with it. Throws NoteNotFoundError when the note is
// missing or another user's.
export async function deleteNote(userId: string, id: string): Promise<void> {
  // One statement, and the cascade runs inside it, so no transaction is needed.
  const deletedCount = await notesRepository.deleteNote(userId, id);
  if (deletedCount === 0) throw new NoteNotFoundError();
}
