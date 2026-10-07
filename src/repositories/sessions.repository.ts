import { sql, type Db } from "../db/client.js";
import type { Session, User } from "../db/types.js";

// A live session plus the bits of its user that requireSession needs.
export type ActiveSession = Pick<Session, "id" | "last_used_at"> & {
  user_id: string;
  email: User["email"];
};

export async function create(
  userId: string, tokenHash: string, expiresAt: Date, db: Db = sql,
): Promise<void> {
  await db`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt})
  `;
}

// Not revoked and not expired; null otherwise.
export async function findActiveByTokenHash(
  _tokenHash: string, _db: Db = sql,
): Promise<ActiveSession | null> {
  throw new Error("Not implemented");
}

// Slides the session forward and marks it as just used.
export async function bump(_id: string, _expiresAt: Date, _db: Db = sql): Promise<void> {
  throw new Error("Not implemented");
}
