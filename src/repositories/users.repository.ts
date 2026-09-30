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
