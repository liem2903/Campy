import { sql, type Db } from "../db/client.js";

export async function create(
  _userId: string, _tokenHash: string, _expiresAt: Date, _db: Db = sql,
): Promise<void> {
  throw new Error("Not implemented");
}
