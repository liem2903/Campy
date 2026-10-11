import { sql, type Db } from "../db/client.js";
import type { Session, User } from "../db/types.js";

// A live session plus the bits of its user that requireSession needs.
// stale: last used longer ago than staleAfterMs, by the DB's clock.
export type ActiveSession = Pick<Session, "id" | "user_id"> & {
  email: User["email"];
  stale: boolean;
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
  tokenHash: string, staleAfterMs: number, db: Db = sql,
): Promise<ActiveSession | null> {
  const [session] = await db<ActiveSession[]>`
    select s.id, s.user_id, u.email,
           s.last_used_at < now() - make_interval(secs => ${staleAfterMs / 1000}) as stale
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
  `;
  return session ?? null;
}

// Slides the session forward if it's still stale; false if another request got there first.
export async function bump(
  id: string, ttlMs: number, staleAfterMs: number, db: Db = sql,
): Promise<boolean> {
  const rows = await db`
    update sessions
    set expires_at = now() + make_interval(secs => ${ttlMs / 1000}), last_used_at = now()
    where id = ${id}
      and last_used_at < now() - make_interval(secs => ${staleAfterMs / 1000})
  `;
  return rows.count === 1;
}

// Deletes the user's expired or revoked sessions; they can never authenticate again.
export async function deleteDeadForUser(userId: string, db: Db = sql): Promise<void> {
  await db`
    delete from sessions
    where user_id = ${userId}
      and (revoked_at is not null or expires_at <= now())
  `;
}

// Sets revoked_at on the unrevoked session with this hash; a no-op if none matches.
export async function revokeByTokenHash(_tokenHash: string, _db: Db = sql): Promise<void> {
  throw new Error("Not implemented");
}
