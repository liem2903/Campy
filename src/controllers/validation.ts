import type { Credentials } from "../services/auth.service.js";
import { PASSWORD_MAX_LENGTH, passwordLength } from "../services/password.js";

export const PASSWORD_MIN_LENGTH = 8;
export const EMAIL_MAX_LENGTH = 254;
// Deliberately loose: one @, no spaces, a dot in the domain. Real validation is email verification.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trimmed and lowercased so rate-limit keys match the DB's citext comparison.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type ParseResult = { ok: true; value: Credentials } | { ok: false; error: string };

// Validates a signup body.
export function parseCredentials(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Email and password are required" };
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: "Email and password are required" };
  }

  const normalizedEmail = normalizeEmail(email);
  // NFKC so the same password typed on different OSes/keyboards hashes identically.
  const normalizedPassword = password.normalize("NFKC");
  if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  const length = passwordLength(normalizedPassword);
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: { email: normalizedEmail, password: normalizedPassword } };
}

// Login only checks the shape: the password policy may change, and an old password that no
// longer meets it must still be able to log in. (Over-long passwords are the service's call.)
export function parseLoginCredentials(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Email and password are required" };
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string" || email.trim() === "" || password === "") {
    return { ok: false, error: "Email and password are required" };
  }
  const normalizedEmail = normalizeEmail(email);
  // Signup never accepts a longer one, so no account can match it.
  if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
    return { ok: false, error: "Enter a valid email address" };
  }
  return { ok: true, value: { email: normalizedEmail, password: password.normalize("NFKC") } };
}
