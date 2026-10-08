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
  tokenHash: string, db: Db = sql,
): Promise<ActiveSession | null> {
  const [session] = await db<ActiveSession[]>`
    select s.id, s.last_used_at, s.user_id, u.email
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
  `;
  return session ?? null;
}

// Slides the session forward and marks it as just used.
export async function bump(id: string, expiresAt: Date, db: Db = sql): Promise<void> {
  await db`
    update sessions
    set expires_at = ${expiresAt}, last_used_at = now()
    where id = ${id}
  `;
}
