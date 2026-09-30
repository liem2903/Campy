export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 254;
// Deliberately loose: one @, no spaces, a dot in the domain. Real validation is email verification.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Credentials = { email: string; password: string };

export type ParseResult = { ok: true; value: Credentials } | { ok: false; error: string };

// Validates a signup/login body. Emails are trimmed and lowercased so rate-limit keys match the DB's citext.
export function parseCredentials(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Email and password are required" };
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: "Email and password are required" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  // NFKC so the same password typed on different OSes/keyboards hashes identically.
  const normalizedPassword = password.normalize("NFKC");
  if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  // Counted in code points, not UTF-16 units, so emoji count as one character.
  const passwordLength = [...normalizedPassword].length;
  if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: { email: normalizedEmail, password: normalizedPassword } };
}
