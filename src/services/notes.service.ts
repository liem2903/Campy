import type { Note } from "../db/types.js";

export type NoteWithBody = Note & { body: string };
export type CreateNoteResult = { note: NoteWithBody; created: boolean };

// Creates the note and its empty text block. created: false = this user already owns the id.
// Throws NoteIdTakenError when another user owns it.
export async function createNote(_userId: string, _id: string): Promise<CreateNoteResult> {
  throw new Error("Not implemented");
}
