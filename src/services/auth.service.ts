import { sql } from "../db/client.js";
import type { AuthUser } from "../db/types.js";
import { EmailTakenError, InvalidCredentialsError } from "../errors.js";
import {
  deleteDeadSessions,
  extendSessionIfIdle,
  findActiveSession,
  insertSession,
  revokeSession,
} from "../repositories/sessions.repository.js";
import { findUserByEmail, insertUser } from "../repositories/users.repository.js";
import { hashPassword, PASSWORD_MAX_LENGTH, passwordLength, verifyPassword } from "./password.js";
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

// Verified against when the email is unknown, so that path costs the same argon2 time as a
// wrong password. Created on first use so importing this module stays cheap.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  // Forget a failed attempt so one bad call doesn't break every later unknown-email login.
  dummyHash ??= hashPassword("campi-timing-parity-dummy-password").catch((err: unknown) => {
    dummyHash = undefined;
    throw err;
  });
  return dummyHash;
}

// Checks the credentials and starts a new session. Throws InvalidCredentialsError for an
// unknown email and a wrong password alike. Returns the raw session token for the cookie.
// `previousToken` is the browser's current sid, if any: its session is revoked, since the
// cookie is about to be overwritten and that session would otherwise stay live, unseen.
export async function logIn(
  { email, password }: Credentials,
  previousToken?: string,
): Promise<{ user: AuthUser; token: string }> {
  // No account can have a longer password, and this caps the argon2 work an attacker can ask for.
  if (passwordLength(password) > PASSWORD_MAX_LENGTH) throw new InvalidCredentialsError();

  const found = await findUserByEmail(email);
  if (!found) {
    await verifyPassword(await getDummyHash(), password);
    throw new InvalidCredentialsError();
  }
  if (!(await verifyPassword(found.passwordHash, password))) {
    throw new InvalidCredentialsError();
  }

  const user: AuthUser = { id: found.id, email: found.email };
  const token = generateToken();
  const now = new Date();
  await sql.begin(async (tx) => {
    if (previousToken) await revokeSession(hashToken(previousToken), now, tx);
    // Opportunistic cleanup, so dead sessions don't pile up without a cron job.
    await deleteDeadSessions(user.id, now, tx);
    await insertSession(user.id, hashToken(token), new Date(now.getTime() + SESSION_TTL_MS), tx);
  });
  return { user, token };
}

// Revokes the session behind this token, if there is one. Safe to call repeatedly.
export async function logOut(token: string): Promise<void> {
  await revokeSession(hashToken(token), new Date());
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
