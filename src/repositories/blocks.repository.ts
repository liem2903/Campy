import { sql, type Db } from "../db/client.js";
import type { Block, BlockProperties } from "../db/types.js";

// One block as the API and service see it. Order and nesting come from the tree, so there's no
// parent_id or position. Ticket 1 is paragraphs only.
export type NoteBlock = { id: string; type: "text"; properties: BlockProperties["text"] };

// What a caller supplies; the DB fills in id, version and timestamps. parent_id defaults to null.
export type NewBlock = Pick<Block, "type" | "position" | "properties">;

export async function insertBlock(noteId: string, block: NewBlock, db: Db = sql): Promise<void> {
  await db`
    insert into blocks (note_id, position, type, properties)
    values (${noteId}, ${block.position}, ${block.type}, ${db.json(block.properties)})
  `;
}

// Sets the note's body: the text of its first top-level text block, the same block
// findNoteWithBody reads. Returns how many rows changed (0 = the note has no such block).
// The caller has already checked the note belongs to the user.
export async function updateBodyText(noteId: string, text: string, db: Db = sql): Promise<number> {
  const { count } = await db`
    update blocks set properties = properties || jsonb_build_object('text', ${text}::text)
    where id = (
      select id from blocks
      where note_id = ${noteId} and parent_id is null and type = 'text'
      order by position
      limit 1
    )
  `;
  return count;
}
