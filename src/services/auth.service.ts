import { sql } from "../db/client.js";
import type { AuthUser } from "../db/types.js";
import { EmailTakenError } from "../errors.js";
import {
  extendSessionIfIdle,
  findActiveSession,
  insertSession,
} from "../repositories/sessions.repository.js";
import { insertUser } from "../repositories/users.repository.js";
import { hashPassword } from "./password.js";
import { generateToken, hashToken, SESSION_TTL_MS } from "./sessionToken.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Credentials = { email: string; password: string };

// Creates the user and their first session. Throws EmailTakenError.
// Returns the raw session token for the cookie.
export async function signUp({ email, password }: Credentials): Promise<{ user: AuthUser; token: string }> {
  const passwordHash = await hashPassword(password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // One transaction: never leave an account behind without its first session.
  return sql.begin(async (tx) => {
    const user = await insertUser(email, passwordHash, tx);
    if (!user) throw new EmailTakenError();
    await insertSession(user.id, hashToken(token), expiresAt, tx);
    return { user, token };
  });
}

// Resolves a session token to its user, or null if it's unknown, expired or revoked.
// Sliding expiry: at most once a day, push the expiry out to a full TTL.
// `refreshed` tells the caller to re-send the cookie with a fresh max-age.
export async function authenticate(
  token: string,
): Promise<{ user: AuthUser; refreshed: boolean } | null> {
  const now = new Date();
  const session = await findActiveSession(hashToken(token), now);
  if (!session) return null;

  let refreshed = false;
  const idleSince = new Date(now.getTime() - DAY_MS);
  if (session.lastUsedAt < idleSince) {
    refreshed = await extendSessionIfIdle(
      session.sessionId,
      idleSince,
      new Date(now.getTime() + SESSION_TTL_MS),
      now,
    );
  }
  return { user: session.user, refreshed };
}
