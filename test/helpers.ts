import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
import { createApp, type AppOptions } from "../src/app.js";
import { sql } from "../src/db/client.js";

// Tests run over plain http, where Supertest won't send Secure cookies back,
// and with limits high enough that only the dedicated 429 tests hit them.
export function makeApp(options: AppOptions = {}) {
  return createApp({
    secureCookies: false,
    limits: { signup: 1000, loginEmail: 1000, loginIp: 1000 },
    ...options,
  });
}

const createdEmails: string[] = [];

// A unique address per call, remembered so afterAll can delete the user.
export function testEmail(): string {
  const email = `test-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

afterAll(async () => {
  // Sessions are removed by on delete cascade.
  await sql`delete from users where email = any(${createdEmails})`;
  await sql.end();
});
