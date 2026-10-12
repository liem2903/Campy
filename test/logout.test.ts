import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

// Sends {} as JSON, like the client will, so the 415 check passes.
function logOut(app: App, cookie?: string) {
  const req = request(app).post("/api/auth/logout");
  return (cookie ? req.set("Cookie", cookie) : req).send({});
}

describe("POST /api/auth/logout", () => {
  it("revokes the session, so the old cookie gets 401 on /me", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    await logOut(app, user.cookie).expect(204);

    const me = await request(app).get("/api/auth/me").set("Cookie", user.cookie);
    expect(me.status).toBe(401);
    const [s] = await sql<{ revoked_at: Date | null }[]>`
      select revoked_at from sessions where user_id = ${user.id}
    `;
    expect(s.revoked_at).not.toBeNull();
  });

  it("clears the sid cookie", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await logOut(app, user.cookie).expect(204);
    const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("sid="));
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("returns 204 even without a cookie", async () => {
    await logOut(makeApp()).expect(204);
  });

  it("returns 204 and clears the cookie for a dead session", async () => {
    const res = await logOut(makeApp(), "sid=garbage").expect(204);
    const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("sid="));
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("returns 204 when logging out twice", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await logOut(app, user.cookie).expect(204);
    await logOut(app, user.cookie).expect(204);
  });

  it("leaves the user's other sessions working", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "correct horse" })
      .expect(200);
    const other = login.get("Set-Cookie")!.find((c) => c.startsWith("sid="))!.split(";")[0];

    await logOut(app, user.cookie).expect(204);
    await request(app).get("/api/auth/me").set("Cookie", other).expect(200);
  });

  it("rejects a non-JSON request with 415", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await request(app).post("/api/auth/logout").set("Cookie", user.cookie);
    expect(res.status).toBe(415);
  });
});
