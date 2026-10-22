import { sql, type Db } from "../db/client.js";
import type { Note } from "../db/types.js";

// Inserts the note; null when the id already exists (insert … on conflict (id) do nothing).
export async function insertNote(userId: string, id: string, db: Db = sql): Promise<Note | null> {
  const [note] = await db<Note[]>`
    insert into notes (id, user_id) values (${id}, ${userId})
    on conflict (id) do nothing
    returning *
  `;
  return note ?? null;
}

// This user's note; null when this user has no note with that id.
export async function findNoteByIdForUser(
  userId: string, id: string, db: Db = sql,
): Promise<Note | null> {
  throw new Error("Not implemented");
}

// This user's notes, most recently edited first.
export async function listNotes(userId: string, db: Db = sql): Promise<Note[]> {
  return db<Note[]>`
    select * from notes
    where user_id = ${userId}
    order by updated_at desc
  `;
}

// Sets this user's note title; returns the new updated_at (the trigger bumps it), or null when
// this user has no note with that id.
export async function updateTitle(
  userId: string, id: string, title: string, db: Db = sql,
): Promise<Date | null> {
  const [note] = await db<Pick<Note, "updated_at">[]>`
    update notes set title = ${title}
    where id = ${id} and user_id = ${userId}
    returning updated_at
  `;
  return note?.updated_at ?? null;
}

// Deletes this user's note; on delete cascade removes its blocks. Returns the number of notes
// deleted: 1, or 0 when this user has no note with that id.
export async function deleteNote(userId: string, id: string, db: Db = sql): Promise<number> {
  const result = await db`
    delete from notes
    where id = ${id} and user_id = ${userId}
  `;
  return result.count;
}
