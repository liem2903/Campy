import { sql, type Db } from "../db/client.js";
import type { BlockProperties } from "../db/types.js";

// One block as the API and service see it. Order and nesting come from the tree, so there's no
// parent_id or position. Ticket 1 is paragraphs only.
export type NoteBlock = { id: string; type: "text"; properties: BlockProperties["text"] };

// A NoteBlock plus where it sits. The service generates parent_id and position from the tree.
export type NoteBlockRow = NoteBlock & { parent_id: string | null; position: string };

// The note's blocks, ordered by position. Ticket 1: top-level only.
export async function findBlocksOfNote(noteId: string, db: Db = sql): Promise<NoteBlockRow[]> {
  throw new Error("Not implemented");
}

// Moves the note's blocks to positions no new row can take, so the upsert can't hit the unique
// sibling-position indexes.
export async function moveBlocksToTemporaryPositions(noteId: string, db: Db = sql): Promise<void> {
  throw new Error("Not implemented");
}

// Inserts or updates each row in array order (parents before children). Skips a row whose id
// belongs to another note, so it can't overwrite that block. Returns how many rows it wrote.
export async function upsertBlocks(
  noteId: string, blockRows: NoteBlockRow[], db: Db = sql,
): Promise<number> {
  throw new Error("Not implemented");
}

// Deletes the note's blocks whose id isn't in keptBlockIds.
export async function deleteBlocksMissingFrom(
  noteId: string, keptBlockIds: string[], db: Db = sql,
): Promise<void> {
  throw new Error("Not implemented");
}
