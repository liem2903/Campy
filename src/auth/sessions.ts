import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Response } from "express";
import type postgres from "postgres";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Only this hash is stored, so a leaked sessions table can't be replayed as cookies.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS };
}

// Inserts a session row and returns the raw token for the cookie.
// Takes the connection so callers can run it inside a transaction.
export async function insertSession(
  db: postgres.Sql | postgres.TransactionSql,
  userId: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${hashToken(token)}, ${expiresAt})
  `;
  return token;
}

export function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(secure));
}
