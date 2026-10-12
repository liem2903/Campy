import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

const notLoggedIn = { error: "You're not logged in" };

function me(app: ReturnType<typeof makeApp>, cookie?: string) {
  const req = request(app).get("/api/auth/me");
  return cookie ? req.set("Cookie", cookie) : req;
}

async function sessionOf(userId: string) {
  const [s] = await sql<{ last_used_at: Date; expires_at: Date }[]>`
    select last_used_at, expires_at from sessions where user_id = ${userId}
  `;
  return s;
}

describe("GET /api/auth/me", () => {
  it("rejects a request with no cookie", async () => {
    const res = await me(makeApp());
    expect(res.status).toBe(401);
    expect(res.body).toEqual(notLoggedIn);
    expect(res.get("Set-Cookie")).toBeUndefined();
  });

  it("clears the cookie when the session is dead", async () => {
    const res = await me(makeApp(), "sid=garbage").expect(401);
    const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("sid="));
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("marks the response as not cacheable", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const res = await me(app, user.cookie).expect(200);
    expect(res.get("Cache-Control")).toBe("no-store");
  });

  it("rejects a garbage cookie", async () => {
    const res = await me(makeApp(), "sid=garbage");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(notLoggedIn);
  });

  it("rejects an expired session", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await sql`update sessions set expires_at = now() - interval '1 minute' where user_id = ${user.id}`;

    const res = await me(app, user.cookie);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(notLoggedIn);
  });

  it("rejects a revoked session", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await sql`update sessions set revoked_at = now() where user_id = ${user.id}`;

    const res = await me(app, user.cookie);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(notLoggedIn);
  });

  it("returns the logged-in user", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await me(app, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, email: user.email });
  });

  it("doesn't touch a session used within the last day", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const before = await sessionOf(user.id);

    const res = await me(app, user.cookie).expect(200);
    expect(await sessionOf(user.id)).toEqual(before);
    expect(res.get("Set-Cookie")).toBeUndefined();
  });

  it("slides the expiry of a session last used over a day ago", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await sql`
      update sessions
      set last_used_at = now() - interval '2 days', expires_at = now() + interval '28 days'
      where user_id = ${user.id}
    `;
    const before = await sessionOf(user.id);

    const res = await me(app, user.cookie).expect(200);
    const after = await sessionOf(user.id);
    expect(after.last_used_at.getTime()).toBeGreaterThan(before.last_used_at.getTime());
    expect(after.expires_at.getTime()).toBeGreaterThan(before.expires_at.getTime());
    const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("sid="));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/); // 30 days
  });
});
