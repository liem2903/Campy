import { sql, type Db } from "../db/client.js";
import type { Note } from "../db/types.js";

// A note plus its body: the text of its single top-level text block.
export type NoteWithBody = Note & { body: string };

// Inserts the note; null when the id already exists (insert … on conflict (id) do nothing).
export async function insertNote(userId: string, id: string, db: Db = sql): Promise<Note | null> {
  const [note] = await db<Note[]>`
    insert into notes (id, user_id) values (${id}, ${userId})
    on conflict (id) do nothing
    returning *
  `;
  return note ?? null;
}

// This user's note with its body; null only when this user has no note with that id.
// The body is the first top-level text block by position, or '' if there is none, so an owned
// note is never null.
export async function findNoteWithBody(
  userId: string, id: string, db: Db = sql,
): Promise<NoteWithBody | null> {
  const [note] = await db<NoteWithBody[]>`
    select n.*, coalesce(b.properties->>'text', '') as body
    from notes n
    left join blocks b on b.note_id = n.id and b.parent_id is null and b.type = 'text'
    where n.id = ${id} and n.user_id = ${userId}
    order by b.position
    limit 1
  `;
  return note ?? null;
}

// This user's notes, most recently edited first.
export async function listNotes(userId: string, db: Db = sql): Promise<Note[]> {
  return db<Note[]>`
    select * from notes
    where user_id = ${userId}
    order by updated_at desc
  `;
}

// Sets this user's note title; returns the new updated_at, or null when this user has no such note.
export async function updateTitle(
  _userId: string, _id: string, _title: string, _db: Db = sql,
): Promise<Date | null> {
  throw new Error("Not implemented");
}
