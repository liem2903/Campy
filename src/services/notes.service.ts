import { sql } from "../db/client.js";
import type { Note } from "../db/types.js";
import { NoteIdTakenError, NoteNotFoundError } from "../errors.js";
import * as blocksRepository from "../repositories/blocks.repository.js";
import * as notesRepository from "../repositories/notes.repository.js";
import type { NoteWithBody } from "../repositories/notes.repository.js";

export type { Note, NoteWithBody };
export type CreateNoteResult = { note: NoteWithBody; created: boolean };
// What the user edits: autosave sends both on every save.
export type NoteContent = { title: string; body: string };

// Creates the note and its empty text block. created: false = this user already owns the id.
// Throws NoteIdTakenError when another user owns it.
export async function createNote(userId: string, id: string): Promise<CreateNoteResult> {
  // Relies on READ COMMITTED: after a conflict, the lookup sees the other transaction's commit.
  return sql.begin(async (tx) => {
    const note = await notesRepository.insertNote(userId, id, tx);
    if (!note) {
      // The id exists. findNoteWithBody only sees this user's notes, so null = someone else's.
      const existing = await notesRepository.findNoteWithBody(userId, id, tx);
      if (!existing) throw new NoteIdTakenError();
      return { note: existing, created: false };
    }
    await blocksRepository.insertBlock(id, { type: "text", position: "a0", properties: { text: "" } }, tx);
    return { note: { ...note, body: "" }, created: true };
  });
}

// This user's note with its body. Throws NoteNotFoundError when it's missing or another user's.
export async function getNote(userId: string, id: string): Promise<NoteWithBody> {
  const note = await notesRepository.findNoteWithBody(userId, id);
  if (!note) throw new NoteNotFoundError();
  return note;
}

// Replaces the note's title and body together and returns its new updated_at.
// Throws NoteNotFoundError when the note is missing or another user's.
export async function updateNote(
  userId: string, id: string, { title, body }: NoteContent,
): Promise<Date> {
  return sql.begin(async (tx) => {
    // The title update is scoped by user_id, so it doubles as the ownership check.
    const updatedAt = await notesRepository.updateTitle(userId, id, title, tx);
    if (!updatedAt) throw new NoteNotFoundError();
    const updatedBlockCount = await blocksRepository.updateBodyText(id, body, tx);
    // Every note gets its text block on create, so 0 rows is a bug. Throwing rolls back the
    // title too, and the client shows "Couldn't save" instead of a false "Saved".
    if (updatedBlockCount === 0) throw new Error(`Note ${id} has no body block`);
    return updatedAt;
  });
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
