import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, testEmail } from "./helpers.js";

const password = "correct horse";
const invalid = { error: "Invalid email or password" };
type App = ReturnType<typeof makeApp>;

// An existing account to log in to.
async function signedUp(app: App) {
  const email = testEmail();
  const res = await request(app).post("/api/auth/signup").send({ email, password }).expect(201);
  return { id: res.body.id as string, email };
}

function logIn(app: App, body: object) {
  return request(app).post("/api/auth/login").send(body);
}

// "sid=..." from a response, ready to send back; undefined if none was set.
function sidOf(res: request.Response) {
  return res.get("Set-Cookie")?.find((c) => c.startsWith("sid="))?.split(";")[0];
}

describe("POST /api/auth/login", () => {
  it("logs in and sets a cookie that works on /me", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await logIn(app, { email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, email: user.email });

    const cookie = sidOf(res);
    expect(cookie).toBeDefined();
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie!);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ id: user.id, email: user.email });
  });

  it("gives a wrong password and an unknown email the same 401", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const wrong = await logIn(app, { email: user.email, password: "wrong password" });
    const unknown = await logIn(app, { email: testEmail(), password });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(invalid);
      expect(sidOf(res)).toBeUndefined();
    }
  });

  it("matches the email ignoring case", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await logIn(app, { email: user.email.toUpperCase(), password });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it("rejects missing fields with 400", async () => {
    const res = await logIn(makeApp(), { email: testEmail() });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Email and password are required" });
  });

  it("rejects a non-JSON body with 415", async () => {
    const res = await request(makeApp())
      .post("/api/auth/login")
      .type("form")
      .send({ email: testEmail(), password });
    expect(res.status).toBe(415);
  });

  it("deletes the user's expired and revoked sessions", async () => {
    const app = makeApp();
    const user = await signedUp(app); // signup leaves one live session
    await sql`
      insert into sessions (user_id, token_hash, expires_at, revoked_at) values
        (${user.id}, ${"expired-" + user.id}, now() - interval '1 minute', null),
        (${user.id}, ${"revoked-" + user.id}, now() + interval '1 day', now())
    `;

    await logIn(app, { email: user.email, password }).expect(200);

    // Left: signup's session and the new login session, both live.
    const live = await sql`
      select 1 from sessions
      where user_id = ${user.id} and revoked_at is null and expires_at > now()
    `;
    const all = await sql`select 1 from sessions where user_id = ${user.id}`;
    expect(live).toHaveLength(2);
    expect(all).toHaveLength(2);
  });

  it("rate-limits the 6th bad attempt for one email within 15 minutes", async () => {
    // Real limits: no overrides.
    const app = makeApp({ limits: {} });
    const user = await signedUp(app);
    for (let i = 0; i < 5; i++) {
      await logIn(app, { email: user.email, password: "wrong password" }).expect(401);
    }

    // Blocked even with the right password: the limiter runs before the check.
    const res = await logIn(app, { email: user.email, password });
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "Too many attempts, please try again later." });
  });

  it("doesn't count successful logins against the per-IP limit", async () => {
    // Real limits: no overrides. One IP, like a shared campus network.
    const app = makeApp({ limits: {} });
    const user = await signedUp(app);
    for (let i = 0; i < 21; i++) {
      await logIn(app, { email: user.email, password }).expect(200);
    }
  });

  it("rate-limits the 21st failed login from one IP across many emails", async () => {
    // Real limits: no overrides. A new email each time dodges the per-email limiter.
    const app = makeApp({ limits: {} });
    for (let i = 0; i < 20; i++) {
      await logIn(app, { email: testEmail(), password }).expect(401);
    }

    const res = await logIn(app, { email: testEmail(), password });
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "Too many attempts, please try again later." });
  });
});
