import { sql, type Db } from "../db/client.js";
import type { Block } from "../db/types.js";

// What a caller supplies; the DB fills in id, version and timestamps. parent_id defaults to null.
export type NewBlock = Pick<Block, "type" | "position" | "properties">;

export async function insertBlock(noteId: string, block: NewBlock, db: Db = sql): Promise<void> {
  await db`
    insert into blocks (note_id, position, type, properties)
    values (${noteId}, ${block.position}, ${block.type}, ${db.json(block.properties)})
  `;
}
