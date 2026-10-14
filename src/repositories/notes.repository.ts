import { sql, type Db } from "../db/client.js";
import type { Note } from "../db/types.js";

// A note plus its body: the text of its single top-level text block.
export type NoteWithBody = Note & { body: string };

// Inserts the note; null when the id already exists (insert … on conflict (id) do nothing).
export async function insertNote(_userId: string, _id: string, _db: Db = sql): Promise<Note | null> {
  throw new Error("Not implemented");
}

// This user's note with its body; null only when this user has no note with that id.
// The body defaults to '' if the note has no top-level text block, so an owned note is never null.
export async function findNoteWithBody(
  _userId: string, _id: string, _db: Db = sql,
): Promise<NoteWithBody | null> {
  throw new Error("Not implemented");
}
