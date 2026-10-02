import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, testEmail } from "./helpers.js";

const password = "correct horse";

function signUp(app: ReturnType<typeof makeApp>, body: object) {
  return request(app).post("/api/auth/signup").send(body);
}

describe("POST /api/auth/signup", () => {
  it("creates the user and sets a secure session cookie", async () => {
    // Secure cookies on: this test only inspects the header, never sends it back.
    const app = makeApp({ secureCookies: true });
    const email = testEmail();

    const res = await signUp(app, { email, password });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), email });
    const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("sid="));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("stores an argon2id hash, never the raw password", async () => {
    const email = testEmail();
    await signUp(makeApp(), { email, password }).expect(201);

    const [user] = await sql`select password_hash from users where email = ${email}`;
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.password_hash).not.toContain(password);
  });

  it("rejects a taken email, ignoring case", async () => {
    const app = makeApp();
    const email = testEmail();
    await signUp(app, { email, password }).expect(201);

    for (const again of [email, email.toUpperCase()]) {
      const res = await signUp(app, { email: again, password });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "An account with this email already exists" });
    }
  });

  it("rejects an invalid email", async () => {
    const res = await signUp(makeApp(), { email: "not-an-email", password });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "That email isn't valid" });
  });

  it("rejects a 7-character password", async () => {
    const res = await signUp(makeApp(), { email: testEmail(), password: "1234567" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Password must be 8–128 characters" });
  });

  it("rejects a non-JSON body with 415", async () => {
    const res = await request(makeApp())
      .post("/api/auth/signup")
      .type("form")
      .send({ email: testEmail(), password });
    expect(res.status).toBe(415);
  });

  it("rate-limits the 6th signup in an hour from one IP", async () => {
    // Real limits: no overrides.
    const app = makeApp({ limits: {} });
    for (let i = 0; i < 5; i++) {
      await signUp(app, { email: testEmail(), password }).expect(201);
    }

    const res = await signUp(app, { email: testEmail(), password });
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "Too many attempts, please try again later." });
  });
});
