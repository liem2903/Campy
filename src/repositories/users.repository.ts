import { sql, type Db } from "../db/client.js";
import type { AuthUser } from "../db/types.js";

// Returns null when the email is already taken (citext, so case-insensitively).
// "on conflict do nothing" instead of catching the unique violation keeps a surrounding transaction usable.
export async function insertUser(
  email: string,
  passwordHash: string,
  db: Db = sql,
): Promise<AuthUser | null> {
  const [user] = await db<AuthUser[]>`
    insert into users (email, password_hash)
    values (${email}, ${passwordHash})
    on conflict (email) do nothing
    returning id, email
  `;
  return user ?? null;
}

export type UserWithPassword = AuthUser & { passwordHash: string };

// citext column, so the match is case-insensitive.
export async function findUserByEmail(
  email: string,
  db: Db = sql,
): Promise<UserWithPassword | null> {
  const [row] = await db<{ id: string; email: string; password_hash: string }[]>`
    select id, email, password_hash from users where email = ${email}
  `;
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}
