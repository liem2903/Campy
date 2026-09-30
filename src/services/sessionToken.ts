import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Opaque 32-byte token; only the client ever sees it.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only this hash is stored, so a leaked sessions table can't be replayed as cookies.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
