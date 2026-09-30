import { randomUUID } from "node:crypto";
import { createApp, type AppOptions } from "../src/app.js";
import { sql } from "../src/db/client.js";

export { sql };

const createdEmails: string[] = [];

// A fresh address per call; recorded so deleteTestUsers() can clean it up.
export function uniqueEmail(): string {
  const email = `test-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

// Plain http + high limits, so only the dedicated 429 tests hit the real limits.
export function testApp(overrides: AppOptions = {}) {
  return createApp({
    secureCookies: false,
    rateLimits: { signupPerHour: 1000 },
    ...overrides,
  });
}

// Sessions cascade from users.
export async function deleteTestUsers(): Promise<void> {
  if (createdEmails.length > 0) {
    await sql`delete from users where email in ${sql(createdEmails)}`;
  }
}

export const validPassword = "correct horse battery";
