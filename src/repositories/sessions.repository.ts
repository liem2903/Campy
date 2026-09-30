import { sql, type Db } from "../db/client.js";
import type { AuthUser } from "../db/types.js";

export type ActiveSession = {
  sessionId: string;
  lastUsedAt: Date;
  user: AuthUser;
};

export async function insertSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  db: Db = sql,
): Promise<void> {
  await db`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt})
  `;
}

// A session that is neither revoked nor expired at `now`, with its user.
export async function findActiveSession(
  tokenHash: string,
  now: Date,
  db: Db = sql,
): Promise<ActiveSession | null> {
  const [row] = await db<{ session_id: string; last_used_at: Date; id: string; email: string }[]>`
    select s.id as session_id, s.last_used_at, u.id, u.email
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > ${now}
  `;
  if (!row) return null;
  return {
    sessionId: row.session_id,
    lastUsedAt: row.last_used_at,
    user: { id: row.id, email: row.email },
  };
}

// Marks the session used and moves its expiry, but only if it hasn't been used since
// `idleSince`. The guard means concurrent requests extend it once, not once each.
// Returns whether this call did the update.
export async function extendSessionIfIdle(
  sessionId: string,
  idleSince: Date,
  newExpiresAt: Date,
  now: Date,
  db: Db = sql,
): Promise<boolean> {
  const result = await db`
    update sessions
    set last_used_at = ${now}, expires_at = ${newExpiresAt}
    where id = ${sessionId} and last_used_at < ${idleSince}
  `;
  return result.count > 0;
}
