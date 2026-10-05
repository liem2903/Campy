import { sql, type Db } from "../db/client.js";
import type { User } from "../db/types.js";

// users.email is citext, so this match ignores case.
export async function findByEmail(email: string, db: Db = sql): Promise<User | undefined> {
  const [user] = await db<User[]>`select * from users where email = ${email}`;
  return user;
}

export async function create(
  email: string, passwordHash: string, db: Db = sql,
): Promise<Pick<User, "id" | "email">> {
  const [user] = await db<Pick<User, "id" | "email">[]>`
    insert into users (email, password_hash) values (${email}, ${passwordHash})
    returning id, email
  `;
  return user;
}
