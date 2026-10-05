import { sql, type Db } from "../db/client.js";

export async function create(
  userId: string, tokenHash: string, expiresAt: Date, db: Db = sql,
): Promise<void> {
  await db`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt})
  `;
}
