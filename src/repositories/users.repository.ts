import { sql, type Db } from "../db/client.js";
import type { User } from "../db/types.js";

export async function findByEmail(_email: string, _db: Db = sql): Promise<User | undefined> {
  throw new Error("Not implemented");
}

export async function create(
  _email: string, _passwordHash: string, _db: Db = sql,
): Promise<Pick<User, "id" | "email">> {
  throw new Error("Not implemented");
}
