import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { sql, type Db } from "../db/client.js";
import type { User } from "../db/types.js";
import { EmailTakenError, InvalidCredentialsError } from "../errors.js";
import * as sessionsRepository from "../repositories/sessions.repository.js";
import * as usersRepository from "../repositories/users.repository.js";

export const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;
// A session used within this window isn't bumped: at most one DB write per day per session.
const bumpAfterMs = 24 * 60 * 60 * 1000;

export type SignUpResult = { user: Pick<User, "id" | "email">; token: string };

// Creates the user and a session. Throws EmailTakenError if the email is in use.
// Two signups for one email at the same instant: the loser hits the unique
// constraint and gets a generic 500 (accepted; a retry gets the normal 409).
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  if (await usersRepository.findByEmail(email)) throw new EmailTakenError();

  // Hash before the transaction so the slow argon2 work doesn't hold it open.
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return sql.begin(async (tx) => {
    const user = await usersRepository.create(email, passwordHash, tx);
    return { user, token: await createSession(user.id, tx) };
  });
}

export type AuthResult = { user: Pick<User, "id" | "email">; bumped: boolean };

// Looks up an active session by token; bumps it if last used over a day ago.
export async function authenticate(token: string): Promise<AuthResult | null> {
  const session = await sessionsRepository.findActiveByTokenHash(hashToken(token), bumpAfterMs);
  if (!session) return null;

  const user = { id: session.user_id, email: session.email };
  if (!session.stale) return { user, bumped: false };

  // bump re-checks staleness, so of two parallel requests only one writes.
  const bumped = await sessionsRepository.bump(session.id, sessionTtlMs, bumpAfterMs);
  return { user, bumped };
}

// Makes a random token, stores only its hash, and returns the raw token for the cookie.
async function createSession(userId: string, db: Db = sql): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs);
  await sessionsRepository.create(userId, hashToken(token), expiresAt, db);
  return token;
}

// Only this hash is stored; the raw token lives only in the cookie.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Verified against when the email is unknown, so that path costs the same argon2 work.
const dummyHash = argon2.hash("timing-parity-dummy", { type: argon2.argon2id });

// Checks the password and creates a session. Throws InvalidCredentialsError for a
// wrong password or unknown email. Also deletes the user's dead sessions.
export async function logIn(email: string, password: string): Promise<SignUpResult> {
  const user = await usersRepository.findByEmail(email);
  const valid = await argon2.verify(user?.password_hash ?? (await dummyHash), password);
  if (!user || !valid) throw new InvalidCredentialsError();

  await sessionsRepository.deleteDeadForUser(user.id);
  const token = await createSession(user.id);
  return { user: { id: user.id, email: user.email }, token };
}

// Revokes the session with this token, if it isn't already revoked. A no-op otherwise.
export async function logOut(token: string): Promise<void> {
  await sessionsRepository.revokeByTokenHash(hashToken(token));
}
