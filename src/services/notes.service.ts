import { sql } from "../db/client.js";
import type { Note } from "../db/types.js";
import { NoteIdTakenError } from "../errors.js";
import * as blocksRepository from "../repositories/blocks.repository.js";
import * as notesRepository from "../repositories/notes.repository.js";
import type { NoteWithBody } from "../repositories/notes.repository.js";

export type { Note, NoteWithBody };
export type CreateNoteResult = { note: NoteWithBody; created: boolean };

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

// This user's notes, most recently edited first.
export async function listNotes(userId: string): Promise<Note[]> {
  return notesRepository.listNotes(userId);
}
