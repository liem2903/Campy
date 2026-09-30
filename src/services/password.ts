import argon2 from "argon2";

export const PASSWORD_MAX_LENGTH = 128;

// Counted in code points, not UTF-16 units, so emoji count as one character.
export function passwordLength(password: string): number {
  return [...password].length;
}

// argon2id with the library's defaults (OWASP-recommended parameters).
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash: treat as a mismatch rather than a server error.
    return false;
  }
}
