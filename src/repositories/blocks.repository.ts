import { sql, type Db } from "../db/client.js";
import type { Block } from "../db/types.js";

// What a caller supplies; the DB fills in id, version and timestamps. parent_id defaults to null.
export type NewBlock = Pick<Block, "type" | "position" | "properties">;

export async function insertBlock(_noteId: string, _block: NewBlock, _db: Db = sql): Promise<void> {
  throw new Error("Not implemented");
}
