import postgres from "postgres";
import { sql, type Db } from "../db/client.js";
import type { Tag } from "../db/types.js";

const UNIQUE_VIOLATION = "23505";

// What the API shows of a tag.
export type TagSummary = Pick<Tag, "id" | "name">;
export type TagWithNoteCount = TagSummary & { note_count: number };

// This user's tags in name order, each with how many notes it's on. A left join, so a tag on no
// notes is listed with 0.
export async function listTagsWithNoteCountsForUser(
  userId: string, db: Db = sql,
): Promise<TagWithNoteCount[]> {
  return db<TagWithNoteCount[]>`
    select tags.id, tags.name, count(note_tags.note_id)::int as note_count
    from tags
    left join note_tags on note_tags.tag_id = tags.id
    where tags.user_id = ${userId}
    group by tags.id
    order by tags.name
  `;
}

// One note's tags in name order. The caller has already checked the note is the user's.
export async function findTagsOfNote(noteId: string, db: Db = sql): Promise<TagSummary[]> {
  return db<TagSummary[]>`
    select tags.id, tags.name
    from note_tags
    join tags on tags.id = note_tags.tag_id
    where note_tags.note_id = ${noteId}
    order by tags.name
  `;
}

// Inserts the tag; null when the user already has one with this name.
export async function insertTag(userId: string, name: string, db: Db = sql): Promise<TagSummary | null> {
  const [tag] = await db<TagSummary[]>`
    insert into tags (user_id, name) values (${userId}, ${name})
    on conflict (user_id, name) do nothing
    returning id, name
  `;
  return tag ?? null;
}

// This user's tag with this name, created if it's new. The no-op update makes the conflict
// return the existing row and locks it, so a concurrent delete can't remove it mid-transaction.
export async function upsertTag(userId: string, name: string, db: Db = sql): Promise<TagSummary> {
  const [tag] = await db<TagSummary[]>`
    insert into tags (user_id, name) values (${userId}, ${name})
    on conflict (user_id, name) do update set name = excluded.name
    returning id, name
  `;
  return tag;
}

// upsertTag for several names in one statement. Pass the names deduplicated (Postgres refuses
// to update one row twice in a statement) and sorted, so two saves lock shared tags in the same
// order and can't deadlock.
export async function upsertTags(userId: string, names: string[], db: Db = sql): Promise<TagSummary[]> {
  if (names.length === 0) return [];
  return db<TagSummary[]>`
    insert into tags (user_id, name)
    select ${userId}, unnest(${names}::text[])
    on conflict (user_id, name) do update set name = excluded.name
    returning id, name
  `;
}

// Renames this user's tag. null when this user has no tag with that id; "name_taken" when
// another of their tags already has the name.
export async function renameTagForUser(
  userId: string, tagId: string, name: string, db: Db = sql,
): Promise<TagSummary | null | "name_taken"> {
  try {
    const [tag] = await db<TagSummary[]>`
      update tags set name = ${name}
      where id = ${tagId} and user_id = ${userId}
      returning id, name
    `;
    return tag ?? null;
  } catch (err) {
    if (err instanceof postgres.PostgresError && err.code === UNIQUE_VIOLATION) return "name_taken";
    throw err;
  }
}

// Deletes this user's tag; on delete cascade takes it off every note. Returns the number of tags
// deleted: 1, or 0 when this user has no tag with that id.
export async function deleteTagForUser(userId: string, tagId: string, db: Db = sql): Promise<number> {
  const result = await db`delete from tags where id = ${tagId} and user_id = ${userId}`;
  return result.count;
}

// Puts the tag on the note. Already there = no change. Postgres refuses it when the note or the
// tag isn't this user's.
export async function attachTagToNote(
  userId: string, noteId: string, tagId: string, db: Db = sql,
): Promise<void> {
  await db`
    insert into note_tags (note_id, tag_id, user_id) values (${noteId}, ${tagId}, ${userId})
    on conflict do nothing
  `;
}

// Takes the tag off the note. Not there, or not this user's = no change.
export async function detachTagFromNote(
  userId: string, noteId: string, tagId: string, db: Db = sql,
): Promise<void> {
  await db`
    delete from note_tags where note_id = ${noteId} and tag_id = ${tagId} and user_id = ${userId}
  `;
}
