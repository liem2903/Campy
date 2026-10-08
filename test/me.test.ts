import request from "supertest";
import { hashToken } from "../src/services/sessionToken.js";
import { deleteTestUsers, signUp, sql, testApp } from "./helpers.js";

afterAll(async () => {
  await deleteTestUsers();
  await sql.end();
});

const app = testApp();

function tokenHash(cookie: string): string {
  return hashToken(decodeURIComponent(cookie.slice("sid=".length)));
}

describe("GET /api/auth/me", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(app).get("/api/auth/me").expect(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it("returns 401 for a garbage cookie and clears it", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "sid=garbage").expect(401);
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(setCookie.some((c) => /^sid=;.*Expires=Thu, 01 Jan 1970/.test(c))).toBe(true);
  });

  it("returns 401 for an expired session", async () => {
    const { cookie } = await signUp(app);
    await sql`
      update sessions set expires_at = now() - interval '1 second'
      where token_hash = ${tokenHash(cookie)}
    `;
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  });

  it("returns 401 for a revoked session", async () => {
    const { cookie } = await signUp(app);
    await sql`update sessions set revoked_at = now() where token_hash = ${tokenHash(cookie)}`;
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  });

  it("returns the session's user", async () => {
    const user = await signUp(app);
    await signUp(app); // a second user, so the lookup can't just pick any session
    const res = await request(app).get("/api/auth/me").set("Cookie", user.cookie).expect(200);
    expect(res.body).toEqual({ id: user.id, email: user.email });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("sliding expiry", () => {
  async function sessionTimes(cookie: string) {
    const [row] = await sql<{ expires_at: Date; last_used_at: Date }[]>`
      select expires_at, last_used_at from sessions where token_hash = ${tokenHash(cookie)}
    `;
    return row;
  }

  it("does not write when the session was used within the last day", async () => {
    const { cookie } = await signUp(app);
    await sql`
      update sessions
      set last_used_at = now() - interval '23 hours', expires_at = now() + interval '10 days'
      where token_hash = ${tokenHash(cookie)}
    `;
    const before = await sessionTimes(cookie);

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);

    expect(await sessionTimes(cookie)).toEqual(before);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("bumps expires_at and last_used_at, and refreshes the cookie, after a day", async () => {
    const { cookie } = await signUp(app);
    await sql`
      update sessions
      set last_used_at = now() - interval '25 hours', expires_at = now() + interval '10 days'
      where token_hash = ${tokenHash(cookie)}
    `;
    const before = await sessionTimes(cookie);

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);

    const after = await sessionTimes(cookie);
    expect(after.last_used_at.getTime()).toBeGreaterThan(before.last_used_at.getTime());
    const daysLeft = (after.expires_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysLeft).toBeGreaterThan(29.9);
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(setCookie.some((c) => c.startsWith(`${cookie};`))).toBe(true);
  });
});
