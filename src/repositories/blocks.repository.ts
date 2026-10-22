import { sql, type Db } from "../db/client.js";
import type { BlockProperties } from "../db/types.js";

// What one block holds, whether it's in a tree or a row.
type TextBlockContent = { id: string; type: "text"; properties: BlockProperties["text"] };
type ListItemBlockContent = { id: string; type: "list_item"; properties: BlockProperties["list_item"] };

// One block as the API and service see it. Order and nesting come from the tree, so there's no
// parent_id or position. Only list items nest; the controller lets only list items in as children.
export type NoteBlock = TextBlockContent | (ListItemBlockContent & { children: NoteBlock[] });

// A block's content plus where it sits. The service generates parent_id and position from the tree.
export type NoteBlockRow = (TextBlockContent | ListItemBlockContent) & {
  parent_id: string | null; position: string;
};

// All the note's blocks at every depth, ordered by position. Positions restart in each sibling
// group, so this order is only meaningful within one parent's children.
export async function findBlocksOfNote(noteId: string, db: Db = sql): Promise<NoteBlockRow[]> {
  return db<NoteBlockRow[]>`
    select id, type, properties, parent_id, position from blocks
    where note_id = ${noteId}
    order by position
  `;
}

// True when any of blockIds is already a block of a different note.
export async function isAnyBlockInAnotherNote(
  noteId: string, blockIds: string[], db: Db = sql,
): Promise<boolean> {
  const [{ exists }] = await db<{ exists: boolean }[]>`
    select exists (
      select 1 from blocks where id = any(${blockIds}::uuid[]) and note_id <> ${noteId}
    )
  `;
  return exists;
}

// Moves the note's blocks to positions no new row can take, so the upsert can't hit the unique
// sibling-position indexes.
export async function moveBlocksToTemporaryPositions(noteId: string, db: Db = sql): Promise<void> {
  // Real positions are digits only, so a "tmp:" prefix can't collide with one.
  await db`update blocks set position = 'tmp:' || position where note_id = ${noteId}`;
}

// Inserts or updates every row in one statement. Skips a row whose id belongs to another note,
// so it can't overwrite that block. Returns how many rows it wrote.
export async function upsertBlocks(
  noteId: string, blockRows: NoteBlockRow[], db: Db = sql,
): Promise<number> {
  if (blockRows.length === 0) return 0; // db([]) would be invalid SQL
  // Column by column, so stray fields like a list item's children never reach the insert.
  const insertableRows = blockRows.map((row) => ({
    id: row.id, note_id: noteId, parent_id: row.parent_id, position: row.position,
    type: row.type, properties: db.json(row.properties),
  }));
  const { count } = await db`
    insert into blocks ${db(insertableRows)}
    on conflict (id) do update
    set parent_id = excluded.parent_id, position = excluded.position,
        type = excluded.type, properties = excluded.properties
    where blocks.note_id = excluded.note_id
  `;
  return count;
}

// Deletes the note's blocks whose id isn't in keptBlockIds.
export async function deleteBlocksMissingFrom(
  noteId: string, keptBlockIds: string[], db: Db = sql,
): Promise<void> {
  // <> all(...) rather than not in (...): an empty list deletes everything instead of being invalid SQL.
  await db`
    delete from blocks where note_id = ${noteId} and id <> all(${keptBlockIds}::uuid[])
  `;
}
